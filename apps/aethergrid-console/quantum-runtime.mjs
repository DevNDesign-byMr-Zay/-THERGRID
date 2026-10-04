import { createHash } from 'node:crypto';

const API_VERSION = '2026-04-15';
const DEFAULT_CIRCUIT =
  'OPENQASM 3.0; include "stdgates.inc"; bit[2] c; h $0; cx $0, $1; c[0] = measure $0; c[1] = measure $1;';
const DEFAULT_ESTIMATOR_CIRCUIT =
  'OPENQASM 3.0; include "stdgates.inc"; qubit[2] q; h q[0]; cx q[0], q[1];';

function receipt(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function safeUrl(value, label) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) {
    throw new Error(`${label} must use HTTP(S)`);
  }
  return url;
}

function cleanCircuit(value, fallback = DEFAULT_CIRCUIT) {
  const circuit = String(value || fallback).trim();
  if (!circuit.startsWith('OPENQASM 3.0;')) {
    throw new Error('OpenQASM 3.0 circuit is required');
  }
  if (circuit.length > 100_000) throw new Error('OpenQASM circuit is too large');
  return circuit;
}

function normalizeObservable(value = 'ZZ') {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value);
    if (!entries.length || entries.length > 64) {
      throw new Error('Estimator observable map must contain 1-64 Pauli terms');
    }
    return Object.fromEntries(
      entries.map(([key, coefficient]) => {
        const pauli = String(key).trim().toUpperCase();
        const numeric = Number(coefficient);
        if (!/^[IXYZ]{1,64}$/u.test(pauli) || !Number.isFinite(numeric)) {
          throw new Error('Estimator observable map must use Pauli strings with numeric coefficients');
        }
        return [pauli, numeric];
      }),
    );
  }
  const observable = String(value || 'ZZ').trim().toUpperCase();
  if (!/^[IXYZ]{1,64}$/u.test(observable)) {
    throw new Error('Estimator observable must be a Pauli string such as Z, ZZ, or XIZ');
  }
  return observable;
}

function normalizeBackend(item = {}) {
  const statusValue =
    typeof item.status === 'object'
      ? item.status?.name
      : item.status || item.state?.status || item.state;
  return {
    name: item.name || item.backend_name || item.id,
    status: statusValue || 'available',
    statusReason:
      typeof item.status === 'object' ? item.status?.reason || null : item.state?.reason || null,
    simulator: Boolean(item.is_simulator ?? item.simulator),
    pendingJobs: item.queue_length ?? item.pending_jobs ?? item.pendingJobs ?? null,
    qubits: item.qubits ?? null,
  };
}

function normalizeJob(job = {}) {
  const status =
    typeof job.state === 'object'
      ? job.state?.status || job.status
      : job.status || job.state || null;
  return {
    id: job.id || job.job_id || null,
    backend: job.backend || job.backend_name || null,
    programId: job.program_id || job.program?.id || null,
    status,
    created: job.created || job.created_at || null,
    hardwareSubmitted: true,
    hardwareExecuted: String(status || '').toLowerCase() === 'completed',
  };
}

function localEstimatorValue(circuit, observable) {
  const terms =
    typeof observable === 'string' ? { [observable]: 1 } : observable;
  const isBell =
    /\bh\s+(?:\$0|q\[0\])/u.test(circuit) &&
    /\bcx\s+(?:\$0|q\[0\])\s*,\s*(?:\$1|q\[1\])/u.test(circuit);
  const xFlips = new Set(
    [...circuit.matchAll(/\bx\s+(?:\$(\d+)|q\[(\d+)\])/gu)].map((match) =>
      Number(match[1] ?? match[2]),
    ),
  );
  let total = 0;

  for (const [pauli, coefficient] of Object.entries(terms)) {
    let expectation = 1;
    if (isBell && pauli.length === 2) {
      const bellExpectations = { II: 1, XX: 1, YY: -1, ZZ: 1 };
      expectation = bellExpectations[pauli] ?? 0;
    } else {
      for (let index = 0; index < pauli.length; index += 1) {
        const operator = pauli[index];
        if (operator === 'I') continue;
        if (operator === 'X' || operator === 'Y') {
          expectation = 0;
          break;
        }
        if (operator === 'Z' && xFlips.has(index)) expectation *= -1;
      }
    }
    total += expectation * Number(coefficient);
  }

  return total;
}

export function createQuantumRuntime({
  env = process.env,
  fetchImpl = fetch,
  now = () => new Date().toISOString(),
} = {}) {
  const provider = String(env.AETHERGRID_QUANTUM_PROVIDER || 'local-simulator').toLowerCase();
  const baseUrl = String(
    env.AETHERGRID_IBM_QUANTUM_BASE_URL || 'https://quantum.cloud.ibm.com/api/v1/',
  );
  const iamUrl = String(
    env.AETHERGRID_IBM_IAM_URL || 'https://iam.cloud.ibm.com/identity/token',
  );
  const apiKey = String(env.AETHERGRID_IBM_QUANTUM_API_KEY || '');
  const serviceCrn = String(env.AETHERGRID_IBM_QUANTUM_SERVICE_CRN || '');
  const defaultBackend = String(env.AETHERGRID_IBM_QUANTUM_BACKEND || '');
  let tokenCache = null;

  function summary() {
    const ibmApiKeyPresent = Boolean(apiKey && apiKey.trim().length > 0);
    const ibmServiceCrnPresent = Boolean(serviceCrn && serviceCrn.trim().length > 0);
    const ibmConfigured = ibmApiKeyPresent && ibmServiceCrnPresent;
    const ibmStatus = ibmConfigured
      ? 'configured'
      : ibmApiKeyPresent
        ? 'instance_required'
        : 'unconfigured';

    const dwaveToken = String(env.AETHERGRID_DWAVE_API_TOKEN || '').trim();
    const dwaveConfigured = Boolean(dwaveToken.length > 0);
    const dwaveStatus = dwaveConfigured ? 'configured' : 'unconfigured';

    const selectedProvider = provider;
    let selectedProviderStatus = 'unconfigured';
    if (selectedProvider === 'ibm-quantum') {
      selectedProviderStatus = ibmStatus;
    } else if (selectedProvider === 'dwave') {
      selectedProviderStatus = dwaveStatus;
    } else {
      selectedProviderStatus = 'ready';
    }

    const selectedHardwareEnabled =
      selectedProvider === 'ibm-quantum'
        ? ibmConfigured
        : selectedProvider === 'dwave'
          ? dwaveConfigured
          : false;

    let alternateProvider = null;
    let alternateProviderAvailable = false;
    let aggregateStatus = selectedProviderStatus;

    if (selectedProviderStatus !== 'configured' && selectedProviderStatus !== 'ready') {
      if (selectedProvider === 'ibm-quantum' && dwaveConfigured) {
        alternateProvider = 'dwave';
        alternateProviderAvailable = true;
        aggregateStatus = 'alternate-available';
      } else if (selectedProvider === 'dwave' && ibmConfigured) {
        alternateProvider = 'ibm-quantum';
        alternateProviderAvailable = true;
        aggregateStatus = 'alternate-available';
      } else {
        alternateProvider = 'local-simulator';
        alternateProviderAvailable = true;
      }
    } else {
      if (selectedProvider === 'ibm-quantum' && dwaveConfigured) {
        alternateProvider = 'dwave';
        alternateProviderAvailable = true;
      } else if (selectedProvider === 'dwave' && ibmConfigured) {
        alternateProvider = 'ibm-quantum';
        alternateProviderAvailable = true;
      } else if (selectedProvider !== 'local-simulator') {
        alternateProvider = 'local-simulator';
        alternateProviderAvailable = true;
      }
    }

    return {
      provider: selectedProvider,
      selectedProvider,
      selectedProviderStatus,
      aggregateStatus,
      alternateProviderAvailable,
      alternateProvider,
      hardwareEnabled: selectedHardwareEnabled,
      apiVersion: API_VERSION,
      configured: selectedProviderStatus === 'configured' || selectedProviderStatus === 'ready',
      defaultBackend:
        defaultBackend ||
        (selectedProvider === 'local-simulator' ? 'aethergrid-local-sampler' : null),
      baseUrl:
        selectedProvider === 'ibm-quantum' ? safeUrl(baseUrl, 'IBM Quantum base URL').origin : null,
      primitives: ['sampler', 'estimator'],
      hardwareExecution: selectedHardwareEnabled,
      credentialsExposed: false,
      providers: {
        ibm: {
          provider: 'ibm-quantum',
          status: ibmStatus,
          configured: ibmConfigured,
          apiKeyPresent: ibmApiKeyPresent,
          serviceCrnPresent: ibmServiceCrnPresent,
          hardwareEnabled: ibmConfigured,
        },
        dwave: {
          provider: 'dwave',
          status: dwaveStatus,
          configured: dwaveConfigured,
          hardwareEnabled: dwaveConfigured,
        },
        local: {
          provider: 'local-simulator',
          status: 'ready',
          configured: true,
          hardwareEnabled: false,
        },
      },
    };
  }

  async function iamToken() {
    if (!apiKey) throw new Error('IBM Quantum API key is not configured');
    if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
      return tokenCache.token;
    }
    const response = await fetchImpl(safeUrl(iamUrl, 'IBM IAM URL'), {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
        apikey: apiKey,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      throw new Error(
        payload.errorMessage ||
          payload.error_description ||
          `IBM IAM HTTP ${response.status}`,
      );
    }
    tokenCache = {
      token: payload.access_token,
      expiresAt: Date.now() + Math.max(60, Number(payload.expires_in || 3600)) * 1000,
    };
    return tokenCache.token;
  }

  async function ibmRequest(path, options = {}) {
    if (!serviceCrn) throw new Error('IBM Quantum service CRN is not configured');
    const token = await iamToken();
    const url = new URL(
      path.replace(/^\//u, ''),
      baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
    );
    const response = await fetchImpl(url, {
      ...options,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`,
        'service-crn': serviceCrn,
        'ibm-api-version': API_VERSION,
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      signal: options.signal || AbortSignal.timeout(30_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        payload?.errors?.[0]?.message ||
          payload?.error ||
          `IBM Quantum HTTP ${response.status}`,
      );
    }
    return payload;
  }

  async function listBackends() {
    if (provider !== 'ibm-quantum') {
      return {
        provider: 'local-simulator',
        backends: [
          {
            name: 'aethergrid-local-sampler',
            status: 'online',
            simulator: true,
            description:
              'Deterministic local Sampler and bounded analytic Estimator fallback for development and offline ZIP use.',
          },
        ],
      };
    }
    const payload = await ibmRequest('backends');
    const list = Array.isArray(payload)
      ? payload
      : payload.devices || payload.backends || [];
    return {
      provider: 'ibm-quantum',
      backends: list.map(normalizeBackend),
    };
  }

  function localSampler({
    circuit = DEFAULT_CIRCUIT,
    backend = 'aethergrid-local-sampler',
    shots = 1024,
  } = {}) {
    const hasHadamard = /\bh\s+\$0/u.test(circuit);
    const hasCnot = /\bcx\s+\$0\s*,\s*\$1/u.test(circuit);
    const distribution =
      hasHadamard && hasCnot
        ? {
            '00': Math.round(shots / 2),
            '11': shots - Math.round(shots / 2),
          }
        : { '00': shots };
    const completedAt = now();
    const result = {
      id: `local-qjob-${Date.now()}`,
      provider: 'local-simulator',
      backend,
      programId: 'sampler',
      status: 'COMPLETED',
      shots,
      circuit,
      distribution,
      completedAt,
      hardwareExecuted: false,
      advisoryOnly: true,
    };
    return { ...result, receipt: receipt(result) };
  }

  function localEstimator({
    circuit = DEFAULT_ESTIMATOR_CIRCUIT,
    observable = 'ZZ',
    backend = 'aethergrid-local-sampler',
  } = {}) {
    const completedAt = now();
    const value = localEstimatorValue(circuit, observable);
    const result = {
      id: `local-estimator-${Date.now()}`,
      provider: 'local-simulator',
      backend,
      programId: 'estimator',
      status: 'COMPLETED',
      circuit,
      observable,
      expectationValue: value,
      completedAt,
      hardwareExecuted: false,
      approximation: 'bounded-local-analytic-demo',
      advisoryOnly: true,
    };
    return { ...result, receipt: receipt(result) };
  }

  async function submitSampler({
    circuit = DEFAULT_CIRCUIT,
    backend = defaultBackend,
    shots = 1024,
  } = {}) {
    const clean = cleanCircuit(circuit, DEFAULT_CIRCUIT);
    const cleanShots = Math.max(1, Math.min(100_000, Number(shots) || 1024));

    if (provider !== 'ibm-quantum') {
      return localSampler({ circuit: clean, backend, shots: cleanShots });
    }
    if (!backend) throw new Error('IBM Quantum backend is required');

    const payload = await ibmRequest('jobs', {
      method: 'POST',
      body: JSON.stringify({
        program_id: 'sampler',
        backend,
        params: {
          pubs: [[clean]],
          options: { default_shots: cleanShots },
          version: 2,
        },
      }),
    });
    const result = {
      id: payload.id || payload.job_id,
      provider: 'ibm-quantum',
      backend,
      programId: 'sampler',
      status: payload.status || 'QUEUED',
      submittedAt: now(),
      hardwareSubmitted: true,
      hardwareExecuted: false,
      advisoryOnly: true,
    };
    return { ...result, receipt: receipt(result) };
  }

  async function submitEstimator({
    circuit = DEFAULT_ESTIMATOR_CIRCUIT,
    observable = 'ZZ',
    backend = defaultBackend,
  } = {}) {
    const clean = cleanCircuit(circuit, DEFAULT_ESTIMATOR_CIRCUIT);
    const cleanObservable = normalizeObservable(observable);

    if (provider !== 'ibm-quantum') {
      return localEstimator({
        circuit: clean,
        observable: cleanObservable,
        backend,
      });
    }
    if (!backend) throw new Error('IBM Quantum backend is required');

    const payload = await ibmRequest('jobs', {
      method: 'POST',
      body: JSON.stringify({
        program_id: 'estimator',
        backend,
        params: {
          pubs: [[clean, cleanObservable]],
          options: {},
          version: 2,
        },
      }),
    });
    const result = {
      id: payload.id || payload.job_id,
      provider: 'ibm-quantum',
      backend,
      programId: 'estimator',
      status: payload.status || 'QUEUED',
      observable: cleanObservable,
      submittedAt: now(),
      hardwareSubmitted: true,
      hardwareExecuted: false,
      advisoryOnly: true,
    };
    return { ...result, receipt: receipt(result) };
  }

  async function listJobs({ limit = 20 } = {}) {
    if (provider !== 'ibm-quantum') {
      return { provider: 'local-simulator', jobs: [] };
    }
    const payload = await ibmRequest(
      `jobs?limit=${Math.max(1, Math.min(200, Number(limit) || 20))}`,
    );
    const jobs = Array.isArray(payload) ? payload : payload.jobs || payload.items || [];
    return {
      provider: 'ibm-quantum',
      jobs: jobs.map(normalizeJob),
    };
  }

  function requireRemoteProvider() {
    if (provider !== 'ibm-quantum') {
      const error = new Error(
        'local simulator jobs complete synchronously and are not remotely queryable',
      );
      error.status = 404;
      throw error;
    }
  }

  async function job(id) {
    requireRemoteProvider();
    const payload = await ibmRequest(`jobs/${encodeURIComponent(id)}`);
    return {
      provider: 'ibm-quantum',
      ...normalizeJob(payload),
      rawState: payload.state || null,
    };
  }

  async function jobResults(id) {
    requireRemoteProvider();
    return {
      provider: 'ibm-quantum',
      jobId: id,
      result: await ibmRequest(`jobs/${encodeURIComponent(id)}/results`),
    };
  }

  async function jobMetrics(id) {
    requireRemoteProvider();
    return {
      provider: 'ibm-quantum',
      jobId: id,
      metrics: await ibmRequest(`jobs/${encodeURIComponent(id)}/metrics`),
    };
  }

  return {
    summary,
    listBackends,
    submitSampler,
    submitEstimator,
    listJobs,
    job,
    jobResults,
    jobMetrics,
    DEFAULT_CIRCUIT,
    DEFAULT_ESTIMATOR_CIRCUIT,
  };
}

export { API_VERSION, DEFAULT_CIRCUIT, DEFAULT_ESTIMATOR_CIRCUIT };
