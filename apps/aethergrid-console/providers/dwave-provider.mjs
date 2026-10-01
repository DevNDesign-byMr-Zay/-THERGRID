import { createProviderAdapter } from './provider-adapter.mjs';

export function createDwaveProvider(options = {}) {
  const token = options.token || process.env.AETHERGRID_DWAVE_API_TOKEN || '';
  const baseUrl = options.baseUrl || process.env.AETHERGRID_DWAVE_URL || 'https://sapi.qpu.dwavesys.com/v2';

  function configured() {
    return Boolean(token && token.trim().length > 0);
  }

  async function request(params = {}, context = {}) {
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

    const action = params.action || 'list_solvers';
    const url = `${baseUrl}/solvers/remote/`;

    const fetcher = async () => {
      if (typeof options.fetchFn === 'function') {
        return options.fetchFn(url);
      }

      if (action === 'submit_job') {
        if (!params.workload) {
          throw new Error('Workload payload required for D-Wave quantum submission');
        }
        if (params.confirmed !== true) {
          throw new Error('Explicit operator confirmation required for live QPU submission');
        }

        const postResp = await fetch(`${baseUrl}/problems/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Sapi-Token': token,
          },
          body: JSON.stringify(params.workload),
        });

        if (!postResp.ok) {
          throw new Error(`D-Wave Problem Submission HTTP ${postResp.status}`);
        }

        const jobJson = await postResp.json();
        return {
          jobId: jobJson.id || `dwave-job-${Date.now()}`,
          status: jobJson.status || 'SUBMITTED',
          solver: jobJson.solver || 'Advantage_system6.4',
          hardwareSubmitted: true,
          hardwareExecuted: false,
          submittedAt: new Date().toISOString(),
          live: true,
        };
      }

      const resp = await fetch(url, {
        headers: {
          accept: 'application/json',
          'X-Sapi-Token': token,
        },
      });

      if (!resp.ok) {
        throw new Error(`D-Wave SAPI Solvers HTTP ${resp.status}`);
      }

      const solvers = await resp.json();
      return {
        solvers: Array.isArray(solvers) ? solvers : [],
        hardwareSubmitted: false,
        hardwareExecuted: false,
        status: 'D-Wave SAPI Solvers Discovered',
        live: true,
      };
    };

    if (typeof context.executeProviderRequest === 'function') {
      return context.executeProviderRequest(
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

  return createProviderAdapter({
    id: 'dwave',
    name: 'D-Wave Ocean SAPI Quantum Annealing Provider',
    capability: 'quantum',
    capabilities: ['quantum', 'quantum-annealing', 'optimization'],
    configured,
    request,
  });
}
