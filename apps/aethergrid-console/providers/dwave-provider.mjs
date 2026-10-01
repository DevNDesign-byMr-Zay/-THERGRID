import { createProviderAdapter } from './provider-adapter.mjs';

export function createDwaveProvider(options = {}) {
  const token = options.token || process.env.AETHERGRID_DWAVE_API_TOKEN || '';
  const solverUrl = options.solverUrl || process.env.AETHERGRID_DWAVE_SOLVER_URL || 'https://cloud.dwavesys.com/sapi/v2';

  function configured() {
    return Boolean(token && token.trim().length > 0);
  }

  async function request(params = {}, context = {}) {
    const workload = params.workload || 'renewable-siting';

    if (!configured()) {
      return {
        data: {
          provider: 'dwave',
          workload,
          status: 'unconfigured',
          hardwareSubmitted: false,
          hardwareExecuted: false,
          live: false,
          message: 'AETHERGRID_DWAVE_API_TOKEN is unconfigured',
        },
        receipt: {
          provider: 'dwave',
          capability: 'quantum',
          dataset: 'quantum-annealing',
          live: false,
          fallback: true,
          attribution: 'D-Wave Systems (Unconfigured)',
        },
      };
    }

    const url = `${solverUrl}/problems`;

    const fetcher = async () => {
      if (typeof options.fetchFn === 'function') {
        return options.fetchFn(url);
      }
      const resp = await fetch(url, {
        headers: {
          'X-Auth-Token': token,
          'Content-Type': 'application/json',
        },
      });
      if (!resp.ok) throw new Error(`D-Wave SAPI HTTP ${resp.status}`);
      const json = await resp.json();
      return {
        provider: 'dwave',
        workload,
        status: 'solvers_discovered',
        hardwareSubmitted: false, // Discovering problems/solvers is NOT workload submission!
        hardwareExecuted: false,
        live: false,
        sapiResponse: json,
      };
    };

    if (typeof context.executeProviderRequest === 'function') {
      return context.executeProviderRequest(
        'dwave',
        { url, capability: 'quantum', dataset: 'quantum-annealing', ttlMs: 30000, attribution: 'D-Wave Ocean SAPI Quantum Cloud' },
        fetcher,
      );
    }

    const data = await fetcher();
    return { data, receipt: { provider: 'dwave', capability: 'quantum', dataset: 'quantum-annealing', live: false, fallback: true } };
  }

  return createProviderAdapter({
    id: 'dwave',
    name: 'D-Wave Systems Quantum Annealer Provider',
    capability: 'quantum',
    capabilities: ['quantum'],
    configured,
    request,
  });
}
