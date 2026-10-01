import { createProviderAdapter } from './provider-adapter.mjs';

export function createDwaveProvider(options = {}) {
  const token = options.token || process.env.AETHERGRID_DWAVE_API_TOKEN || '';
  const solverUrl = options.solverUrl || process.env.AETHERGRID_DWAVE_SOLVER_URL || 'https://cloud.dwavesys.com/sapi/v2';

  function configured() {
    return Boolean(token && token.trim().length > 0);
  }

  async function request(params = {}, context = {}) {
    const actionType = params.action || 'discover'; // 'discover' | 'submit' | 'status' | 'result'
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

    let url = `${solverUrl}/solvers/remote/`;
    if (actionType === 'submit') {
      url = `${solverUrl}/problems`;
    } else if ((actionType === 'status' || actionType === 'result') && params.problemId) {
      url = `${solverUrl}/problems/${encodeURIComponent(params.problemId)}`;
    }

    const fetcher = async () => {
      if (typeof options.fetchFn === 'function') {
        return options.fetchFn(url);
      }

      if (actionType === 'submit') {
        const payload = params.problemPayload || { type: 'bqm', params: {} };
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'X-Auth-Token': token,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) throw new Error(`D-Wave Submit HTTP ${resp.status}`);
        const json = await resp.json();
        const problemId = json?.id || json?.problem_id || null;
        return {
          provider: 'dwave',
          workload,
          problemId,
          status: 'submitted',
          hardwareSubmitted: Boolean(problemId),
          hardwareExecuted: false,
          live: true,
          sapiResponse: json,
        };
      }

      const resp = await fetch(url, {
        headers: {
          'X-Auth-Token': token,
          'Accept': 'application/json',
        },
      });
      if (!resp.ok) throw new Error(`D-Wave SAPI HTTP ${resp.status}`);
      const json = await resp.json();

      if (actionType === 'discover') {
        return {
          provider: 'dwave',
          workload,
          status: 'solvers_discovered',
          hardwareSubmitted: false,
          hardwareExecuted: false,
          live: true,
          solvers: Array.isArray(json) ? json : [json],
        };
      }

      const isCompleted = json?.status === 'COMPLETED' || json?.status === 'DONE';
      return {
        provider: 'dwave',
        workload,
        problemId: params.problemId,
        status: json?.status || 'unknown',
        hardwareSubmitted: true,
        hardwareExecuted: isCompleted,
        live: true,
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
    return { data, receipt: { provider: 'dwave', capability: 'quantum', dataset: 'quantum-annealing', live: true } };
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
