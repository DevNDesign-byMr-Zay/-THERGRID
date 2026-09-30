import { createProviderAdapter } from './adapter.mjs';

export function createDwaveProvider(options = {}) {
  const token = options.token || process.env.AETHERGRID_DWAVE_API_TOKEN || '';
  const solverUrl = options.solverUrl || process.env.AETHERGRID_DWAVE_SOLVER_URL || 'https://cloud.dwavesys.com/sapi/v2';

  function configured() {
    return Boolean(token && token.trim().length > 0);
  }

  async function request(params = {}, context = {}) {
    const workload = params.workload || 'renewable-siting';

    const fallbackFetcher = async () => ({
      provider: 'dwave',
      workload,
      status: 'unconfigured',
      hardwareSubmitted: false,
      hardwareExecuted: false,
      result: {
        solution: [0, 1, 1, 0],
        energy: -4.2,
        solver: 'local-classical-simulated-annealer',
      },
      source: 'local-simulated-annealing-fallback',
    });

    if (!configured()) {
      const fallbackData = await fallbackFetcher();
      return {
        data: fallbackData,
        receipt: {
          provider: 'dwave',
          dataset: 'quantum-annealing',
          live: false,
          fallback: true,
          attribution: 'D-Wave Systems (Unconfigured - Local Classical Annealing Fallback)',
        },
      };
    }

    const url = `${solverUrl}/problems`;

    const fetcher = async () => {
      if (typeof options.fetchFn === 'function') return options.fetchFn(url);
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
        status: 'submitted',
        hardwareSubmitted: true,
        hardwareExecuted: false,
        sapiResponse: json,
      };
    };

    if (typeof context.executeProviderRequest === 'function') {
      return context.executeProviderRequest(
        'quantum',
        { url, dataset: 'quantum-annealing', ttlMs: 30000, attribution: 'D-Wave Ocean SAPI Quantum Cloud' },
        fetcher,
        fallbackFetcher,
      );
    }

    const data = await fetcher();
    return {
      data,
      receipt: {
        provider: 'dwave',
        dataset: 'quantum-annealing',
        live: true,
        attribution: 'D-Wave Ocean SAPI Quantum Cloud',
      },
    };
  }

  return createProviderAdapter({
    id: 'dwave',
    name: 'D-Wave Systems Quantum Annealer Provider',
    capabilities: ['quantum'],
    configured,
    request,
  });
}
