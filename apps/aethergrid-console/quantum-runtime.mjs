import { createHash } from 'node:crypto';

const API_VERSION = '2026-04-15';
const DEFAULT_CIRCUIT =
  'OPENQASM 3.0; include "stdgates.inc"; bit[2] c; h $0; cx $0, $1; c[0] = measure $0; c[1] = measure $1;';

function receipt(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function safeUrl(value, label) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error(`${label} must use HTTP(S)`);
  return url;
}

export function createQuantumRuntime({
  env = process.env,
  fetchImpl = fetch,
  now = () => new Date().toISOString(),
} = {}) {
  const provider = String(env.AETHERGRID_QUANTUM_PROVIDER || 'local-simulator').toLowerCase();
  const baseUrl = String(env.AETHERGRID_IBM_QUANTUM_BASE_URL || 'https://quantum.cloud.ibm.com/api/v1/');
  const iamUrl = String(env.AETHERGRID_IBM_IAM_URL || 'https://iam.cloud.ibm.com/identity/token');
  const apiKey = String(env.AETHERGRID_IBM_QUANTUM_API_KEY || '');
  const serviceCrn = String(env.AETHERGRID_IBM_QUANTUM_SERVICE_CRN || '');
  const defaultBackend = String(env.AETHERGRID_IBM_QUANTUM_BACKEND || '');
  let tokenCache = null;

  function summary() {
    return {
      provider,
      apiVersion: API_VERSION,
      configured:
        provider === 'ibm-quantum'
          ? Boolean(apiKey && serviceCrn && defaultBackend)
          : true,
      defaultBackend: defaultBackend || (provider === 'local-simulator' ? 'aethergrid-local-sampler' : null),
      baseUrl: provider === 'ibm-quantum' ? safeUrl(baseUrl, 'IBM Quantum base URL').origin : null,
      primitives: ['sampler', 'estimator'],
      hardwareExecution: provider === 'ibm-quantum',
      credentialsExposed: false,
    };
  }

  async function iamToken() {
    if (!apiKey) throw new Error('IBM Quantum API key is not configured');
    if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token;
    const response = await fetchImpl(safeUrl(iamUrl, 'IBM IAM URL'), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
        apikey: apiKey,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      throw new Error(payload.errorMessage || payload.error_description || `IBM IAM HTTP ${response.status}`);
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
    const url = new URL(path.replace(/^\//u, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
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
    if (!response.ok) throw new Error(payload?.errors?.[0]?.message || payload?.error || `IBM Quantum HTTP ${response.status}`);
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
            description: 'Deterministic local sampling fallback for development and offline ZIP use.',
          },
        ],
      };
    }
    const payload = await ibmRequest('backends');
    const list = Array.isArray(payload) ? payload : payload.devices || payload.backends || [];
    return {
      provider: 'ibm-quantum',
      backends: list.map((item) => ({
        name: item.name || item.backend_name || item.id,
        status: item.status || item.state || 'available',
        simulator: Boolean(item.simulator),
        pendingJobs: item.pending_jobs ?? item.pendingJobs ?? null,
      })),
    };
  }

  function localRun({ circuit = DEFAULT_CIRCUIT, backend = 'aethergrid-local-sampler', shots = 1024 } = {}) {
    const hasHadamard = /\bh\s+\$0/u.test(circuit);
    const hasCnot = /\bcx\s+\$0\s*,\s*\$1/u.test(circuit);
    const distribution =
      hasHadamard && hasCnot
        ? { '00': Math.round(shots / 2), '11': shots - Math.round(shots / 2) }
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

  async function submitSampler({
    circuit = DEFAULT_CIRCUIT,
    backend = defaultBackend,
    shots = 1024,
  } = {}) {
    const cleanCircuit = String(circuit || '').trim();
    if (!cleanCircuit.startsWith('OPENQASM 3.0;')) throw new Error('OpenQASM 3.0 circuit is required');
    const cleanShots = Math.max(1, Math.min(100_000, Number(shots) || 1024));

    if (provider !== 'ibm-quantum') return localRun({ circuit: cleanCircuit, backend, shots: cleanShots });
    if (!backend) throw new Error('IBM Quantum backend is required');

    const payload = await ibmRequest('jobs', {
      method: 'POST',
      body: JSON.stringify({
        program_id: 'sampler',
        backend,
        params: {
          pubs: [[cleanCircuit]],
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
      hardwareExecuted: true,
      advisoryOnly: true,
    };
    return { ...result, receipt: receipt(result) };
  }

  async function listJobs({ limit = 20 } = {}) {
    if (provider !== 'ibm-quantum') return { provider: 'local-simulator', jobs: [] };
    const payload = await ibmRequest(`jobs?limit=${Math.max(1, Math.min(100, Number(limit) || 20))}`);
    const jobs = Array.isArray(payload) ? payload : payload.jobs || payload.items || [];
    return {
      provider: 'ibm-quantum',
      jobs: jobs.map((job) => ({
        id: job.id,
        backend: job.backend || job.backend_name || null,
        programId: job.program_id || null,
        status: job.status || job.state || null,
        created: job.created || job.created_at || null,
      })),
    };
  }

  async function job(id) {
    if (provider !== 'ibm-quantum') {
      const error = new Error('local simulator jobs complete synchronously and are not remotely queryable');
      error.status = 404;
      throw error;
    }
    return ibmRequest(`jobs/${encodeURIComponent(id)}`);
  }

  return { summary, listBackends, submitSampler, listJobs, job, DEFAULT_CIRCUIT };
}

export { API_VERSION, DEFAULT_CIRCUIT };
