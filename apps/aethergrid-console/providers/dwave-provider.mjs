import { createProviderAdapter } from './provider-adapter.mjs';

const VALID_ACTIONS = new Set(['discover', 'submit', 'status', 'result']);
const SUPPORTED_PROBLEM_TYPES = new Set(['qubo', 'ising', 'cqm', 'bqm']);

export function createDwaveProvider(options = {}) {
  const token = options.token || process.env.AETHERGRID_DWAVE_API_TOKEN || '';
  const baseUrl = options.baseUrl || process.env.AETHERGRID_DWAVE_URL || 'https://sapi.qpu.dwavesys.com/v2';

  function configured() {
    return Boolean(token && token.trim().length > 0);
  }

  async function request(params = {}, context = {}) {
    const action = params.action || 'discover';

    if (!VALID_ACTIONS.has(action)) {
      throw new Error(`Unknown action '${action}'. Valid actions are: discover, submit, status, result`);
    }

    if (!configured()) {
      return {
        data: {
          status: 'unconfigured',
          message: 'D-Wave Ocean SAPI token is not configured on this server.',
          solvers: [],
          hardwareSubmitted: false,
          hardwareExecuted: false,
          live: false,
        },
        receipt: {
          provider: 'dwave',
          capability: 'quantum',
          dataset: 'quantum-annealing',
          requestId: params.requestId || context.requestId,
          live: false,
          fallback: true,
          attribution: 'D-Wave Ocean SAPI Quantum Cloud (Unconfigured)',
        },
      };
    }

    // DISCOVER ACTION
    if (action === 'discover') {
      const url = `${baseUrl}/solvers/remote/`;
      const fetcher = async ({ signal } = {}) => {
        let resp;
        if (typeof options.fetchFn === 'function') {
          resp = await options.fetchFn(url);
        } else {
          resp = await fetch(url, {
            headers: {
              accept: 'application/vnd.dwave.sapi.solver-definition-list+json; version=3.0, application/json',
              'X-Sapi-Token': token,
            },
            signal,
          });
          if (!resp.ok) {
            throw new Error(`D-Wave SAPI Solvers HTTP ${resp.status}`);
          }
        }
        const json = resp && typeof resp.json === 'function' ? await resp.json() : resp;
        const rawSolvers = Array.isArray(json) ? json : Array.isArray(json?.solvers) ? json.solvers : [];

        const normalizedSolvers = rawSolvers.map((s) => {
          if (typeof s === 'string') {
            return {
              id: s,
              name: s,
              type: null,
              description: '',
              properties: {},
              parameters: {},
            };
          }
          return {
            id: s.id || s.name || null,
            name: s.name || s.id || null,
            type: s.type || null,
            description: s.description || '',
            properties: s.properties || {},
            parameters: s.parameters || {},
          };
        });

        return {
          status: 'D-Wave SAPI Solvers Discovered',
          solvers: normalizedSolvers,
          hardwareSubmitted: false,
          hardwareExecuted: false,
          live: true,
        };
      };

      if (typeof context.executeProviderRequest === 'function') {
        const exec = await context.executeProviderRequest(
          'dwave',
          {
            url,
            capability: 'quantum',
            dataset: 'quantum-annealing',
            requestId: params.requestId || context.requestId,
            ttlMs: 30000,
            attribution: 'D-Wave Ocean SAPI Quantum Cloud',
          },
          fetcher,
        );
        return { data: exec.data, receipt: exec.receipt };
      }
      const data = await fetcher();
      return {
        data,
        receipt: {
          provider: 'dwave',
          capability: 'quantum',
          dataset: 'quantum-annealing',
          requestId: params.requestId || context.requestId,
          live: true,
        },
      };
    }

    // SUBMIT ACTION
    if (action === 'submit') {
      const isConfirmed = params.confirmSubmission === true || params.confirmed === true;
      if (!isConfirmed) {
        throw new Error('Explicit operator confirmation (confirmSubmission: true) is required for live QPU submission');
      }

      const solver = params.solver;
      if (!solver || typeof solver !== 'string' || solver.trim() === '') {
        throw new Error('Explicit solver identifier is required for D-Wave problem submission');
      }

      const problemType = params.problemType ? String(params.problemType).toLowerCase() : null;
      if (!problemType || !SUPPORTED_PROBLEM_TYPES.has(problemType)) {
        throw new Error(`Explicit supported problemType is required. Supported types: ${Array.from(SUPPORTED_PROBLEM_TYPES).join(', ')}`);
      }

      const problemPayload = params.problem || params.problemPayload;
      if (!problemPayload || (typeof problemPayload === 'object' && Object.keys(problemPayload).length === 0)) {
        throw new Error('Actual encoded problem payload is required for D-Wave problem submission');
      }

      const parameters = params.parameters && typeof params.parameters === 'object' ? params.parameters : {};

      const url = `${baseUrl}/problems/`;
      const fetcher = async ({ signal } = {}) => {
        const postBody = {
          solver: solver.trim(),
          type: problemType,
          data: problemPayload,
          params: parameters,
        };

        let resp;
        if (typeof options.fetchFn === 'function') {
          resp = await options.fetchFn(url, {
            method: 'POST',
            body: JSON.stringify(postBody),
          });
        } else {
          resp = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              accept: 'application/vnd.dwave.sapi.problem+json; version=3.0, application/json',
              'X-Sapi-Token': token,
            },
            body: JSON.stringify(postBody),
            signal,
          });
          if (!resp.ok) {
            throw new Error(`D-Wave Problem Submission HTTP ${resp.status}`);
          }
        }

        const jobJson = resp && typeof resp.json === 'function' ? await resp.json() : resp;
        if (!jobJson || !jobJson.id) {
          throw new Error('D-Wave submission response did not contain a genuine problem ID');
        }

        return {
          problemId: jobJson.id,
          status: jobJson.status || 'SUBMITTED',
          solver: jobJson.solver || solver.trim(),
          type: jobJson.type || problemType,
          hardwareSubmitted: true,
          hardwareExecuted: false,
          submitted_on: jobJson.submitted_on || null,
          live: true,
        };
      };

      if (typeof context.executeProviderRequest === 'function') {
        const exec = await context.executeProviderRequest(
          'dwave',
          {
            url,
            capability: 'quantum',
            dataset: 'quantum-annealing',
            requestId: params.requestId || context.requestId,
            ttlMs: 0,
            cachePolicy: 'no-cache',
            attribution: 'D-Wave Ocean SAPI Quantum Cloud',
          },
          fetcher,
        );
        return { data: exec.data, receipt: exec.receipt };
      }
      const data = await fetcher();
      return {
        data,
        receipt: {
          provider: 'dwave',
          capability: 'quantum',
          dataset: 'quantum-annealing',
          requestId: params.requestId || context.requestId,
          live: true,
        },
      };
    }

    // STATUS ACTION
    if (action === 'status') {
      const problemId = params.problemId || params.id;
      if (!problemId || typeof problemId !== 'string' || problemId.trim() === '') {
        throw new Error('Explicit problemId is required for D-Wave problem status inquiry');
      }

      const cleanId = problemId.trim();
      const url = `${baseUrl}/problems/${cleanId}/`;

      const fetcher = async ({ signal } = {}) => {
        let resp;
        if (typeof options.fetchFn === 'function') {
          resp = await options.fetchFn(url);
        } else {
          resp = await fetch(url, {
            headers: {
              accept: 'application/vnd.dwave.sapi.problem+json; version=3.0, application/json',
              'X-Sapi-Token': token,
            },
            signal,
          });
          if (!resp.ok) {
            throw new Error(`D-Wave Problem Status HTTP ${resp.status}`);
          }
        }
        const json = resp && typeof resp.json === 'function' ? await resp.json() : resp;
        const rawStatus = (json?.status || '').toUpperCase();
        let mappedStatus = 'PENDING';
        if (['COMPLETED', 'RESOLVED', 'SUCCESS'].includes(rawStatus)) {
          mappedStatus = 'COMPLETED';
        } else if (['IN_PROGRESS', 'RUNNING'].includes(rawStatus)) {
          mappedStatus = 'IN_PROGRESS';
        } else if (['PENDING', 'SUBMITTED', 'QUEUED'].includes(rawStatus)) {
          mappedStatus = 'PENDING';
        } else if (['FAILED', 'ERROR'].includes(rawStatus)) {
          mappedStatus = 'FAILED';
        } else if (['CANCELLED', 'CANCELED'].includes(rawStatus)) {
          mappedStatus = 'CANCELLED';
        }

        const isCompleted = mappedStatus === 'COMPLETED';

        return {
          problemId: cleanId,
          status: mappedStatus,
          rawStatus: json?.status || mappedStatus,
          solver: json?.solver || null,
          type: json?.type || null,
          hardwareSubmitted: true,
          hardwareExecuted: isCompleted && Boolean(json?.answer || json?.result),
          submitted_on: json?.submitted_on || null,
          solved_on: json?.solved_on || null,
          live: true,
        };
      };

      if (typeof context.executeProviderRequest === 'function') {
        const exec = await context.executeProviderRequest(
          'dwave',
          {
            url,
            capability: 'quantum',
            dataset: 'quantum-annealing',
            requestId: params.requestId || context.requestId,
            ttlMs: 5000,
            attribution: 'D-Wave Ocean SAPI Quantum Cloud',
          },
          fetcher,
        );
        return { data: exec.data, receipt: exec.receipt };
      }
      const data = await fetcher();
      return {
        data,
        receipt: {
          provider: 'dwave',
          capability: 'quantum',
          dataset: 'quantum-annealing',
          requestId: params.requestId || context.requestId,
          live: true,
        },
      };
    }

    // RESULT ACTION
    if (action === 'result') {
      const problemId = params.problemId || params.id;
      if (!problemId || typeof problemId !== 'string' || problemId.trim() === '') {
        throw new Error('Explicit problemId is required for D-Wave problem result inquiry');
      }

      const cleanId = problemId.trim();
      const statusUrl = `${baseUrl}/problems/${cleanId}/`;
      const answerUrl = `${baseUrl}/problems/${cleanId}/answer/`;

      const fetcher = async ({ signal } = {}) => {
        // Fetch status first
        let statusResp;
        if (typeof options.fetchFn === 'function') {
          statusResp = await options.fetchFn(statusUrl);
        } else {
          statusResp = await fetch(statusUrl, {
            headers: {
              accept: 'application/vnd.dwave.sapi.problem+json; version=3.0, application/json',
              'X-Sapi-Token': token,
            },
            signal,
          });
          if (!statusResp.ok) {
            throw new Error(`D-Wave Problem Result Status HTTP ${statusResp.status}`);
          }
        }
        const statusJson = statusResp && typeof statusResp.json === 'function' ? await statusResp.json() : statusResp;
        const rawStatus = (statusJson?.status || '').toUpperCase();
        const isCompleted = ['COMPLETED', 'RESOLVED', 'SUCCESS'].includes(rawStatus);

        if (!isCompleted) {
          return {
            problemId: cleanId,
            status: statusJson?.status || 'PENDING',
            solver: statusJson?.solver || null,
            hardwareSubmitted: true,
            hardwareExecuted: false,
            result: null,
            message: 'Problem execution is not complete',
            submitted_on: statusJson?.submitted_on || null,
            live: true,
          };
        }

        // Fetch answer endpoint
        let answerResp;
        if (typeof options.fetchFn === 'function') {
          answerResp = await options.fetchFn(answerUrl);
        } else {
          answerResp = await fetch(answerUrl, {
            headers: {
              accept: 'application/vnd.dwave.sapi.problem-answer+json; version=3.0, application/json',
              'X-Sapi-Token': token,
            },
            signal,
          });
          if (!answerResp.ok) {
            throw new Error(`D-Wave Problem Answer HTTP ${answerResp.status}`);
          }
        }
        const answerJson = answerResp && typeof answerResp.json === 'function' ? await answerResp.json() : answerResp;
        const answerData = answerJson?.answer || answerJson;

        return {
          problemId: cleanId,
          status: 'COMPLETED',
          solver: statusJson?.solver || null,
          type: statusJson?.type || null,
          hardwareSubmitted: true,
          hardwareExecuted: Boolean(answerData),
          result: answerData,
          submitted_on: statusJson?.submitted_on || null,
          solved_on: statusJson?.solved_on || null,
          live: true,
        };
      };

      if (typeof context.executeProviderRequest === 'function') {
        const exec = await context.executeProviderRequest(
          'dwave',
          {
            url: answerUrl,
            capability: 'quantum',
            dataset: 'quantum-annealing',
            requestId: params.requestId || context.requestId,
            ttlMs: 60000,
            attribution: 'D-Wave Ocean SAPI Quantum Cloud',
          },
          fetcher,
        );
        return { data: exec.data, receipt: exec.receipt };
      }
      const data = await fetcher();
      return {
        data,
        receipt: {
          provider: 'dwave',
          capability: 'quantum',
          dataset: 'quantum-annealing',
          requestId: params.requestId || context.requestId,
          live: true,
        },
      };
    }
  }

  return createProviderAdapter({
    id: 'dwave',
    name: 'D-Wave Ocean SAPI Quantum Annealing Provider',
    capability: 'quantum',
    capabilities: ['quantum', 'quantum-annealing', 'optimization'],
    configured,
    request,
  });
}
