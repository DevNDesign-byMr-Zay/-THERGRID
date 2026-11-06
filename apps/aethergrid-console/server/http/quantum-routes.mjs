import { readRequestJson as body } from '../../security/request-body.mjs';
import { runLocalQuboComparison } from '../../local-optimization-runtime.mjs';
import { AerBridgeError, probeQiskitAer, runQiskitAer } from '../../qiskit-aer-runtime.mjs';

// A matched route returns true from json(); false leaves dispatch to the next family.
export function createQuantumRoutes({
  quantumRuntime,
  openQuantumRuntime,
  dwaveProvider,
  providerRegistry,
  state,
  activity,
  json,
}) {
  return async function handleRoutes({ request, response, url, reqContext, execCtx }) {
    if (request.method === 'GET' && url.pathname === '/api/aethergrid/quantum/openquantum/runtime') {
      return json(response, 200, openQuantumRuntime.summary());
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/quantum/openquantum/status') {
      return json(response, 200, await openQuantumRuntime.status());
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/quantum/openquantum/backends') {
      const result = await openQuantumRuntime.listBackends();
      return json(response, 200, providerRegistry.redactor.redactValue(result));
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/quantum/dwave/solvers') {
      const result = await dwaveProvider.request({ action: 'discover' }, execCtx);
      return json(response, 200, providerRegistry.redactor.redactValue(result));
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/quantum/dwave/jobs') {
      const problemId = url.searchParams.get('id') || undefined;
      if (!problemId) {
        return json(response, 400, {
          error: 'invalid_request',
          message: 'Explicit id query parameter is required for D-Wave job status',
        });
      }
      const result = await dwaveProvider.request({ action: 'status', problemId }, execCtx);
      return json(response, 200, providerRegistry.redactor.redactValue(result));
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/quantum/dwave/jobs') {
      const payload = await body(request);
      if (payload?.confirmSubmission !== true) {
        return json(response, 400, {
          error: 'confirmation_required',
          message:
            'Explicit operator confirmation (confirmSubmission: true) is required to submit D-Wave hardware jobs.',
        });
      }
      if (!payload.solver || typeof payload.solver !== 'string' || payload.solver.trim() === '') {
        return json(response, 400, {
          error: 'invalid_request',
          message: 'Explicit solver identifier is required for D-Wave problem submission.',
        });
      }
      if (
        !payload.problemType ||
        typeof payload.problemType !== 'string' ||
        payload.problemType.trim() === ''
      ) {
        return json(response, 400, {
          error: 'invalid_request',
          message: 'Explicit supported problemType is required for D-Wave problem submission.',
        });
      }
      if (
        !payload.problemPayload ||
        (typeof payload.problemPayload === 'object' &&
          Object.keys(payload.problemPayload).length === 0)
      ) {
        return json(response, 400, {
          error: 'invalid_request',
          message: 'Actual encoded problem payload is required for D-Wave problem submission.',
        });
      }

      try {
        const result = await dwaveProvider.request(
          {
            action: 'submit',
            confirmSubmission: true,
            solver: payload.solver,
            problemType: payload.problemType,
            problemPayload: payload.problemPayload,
            parameters: payload.parameters || {},
          },
          execCtx,
        );
        return json(response, 200, providerRegistry.redactor.redactValue(result));
      } catch (err) {
        return json(response, 400, { error: 'invalid_request', message: err.message });
      }
    }

    if (
      request.method === 'GET' &&
      url.pathname.startsWith('/api/aethergrid/quantum/dwave/jobs/') &&
      url.pathname.endsWith('/result')
    ) {
      const parts = url.pathname.split('/');
      const problemId = parts[parts.length - 2];
      if (!problemId) {
        return json(response, 400, {
          error: 'invalid_request',
          message: 'Explicit problemId path parameter is required for D-Wave job result',
        });
      }
      try {
        const result = await dwaveProvider.request({ action: 'result', problemId }, execCtx);
        return json(response, 200, providerRegistry.redactor.redactValue(result));
      } catch (err) {
        return json(response, 400, { error: 'invalid_request', message: err.message });
      }
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/api/aethergrid/quantum/optimization/local'
    ) {
      try {
        const input = await body(request);
        return json(response, 200, { result: runLocalQuboComparison(input) });
      } catch (error) {
        if (!(error instanceof TypeError) && !(error instanceof SyntaxError)) throw error;
        return json(response, 400, {
          error: 'invalid_qubo_problem',
          message: error.message,
        });
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/quantum/qiskit/status') {
      return json(response, 200, await probeQiskitAer());
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/quantum/qiskit/run') {
      try {
        const input = await body(request);
        return json(response, 200, { result: await runQiskitAer(input) });
      } catch (error) {
        if (error instanceof AerBridgeError) {
          return json(response, error.status, { error: error.code, message: error.message });
        }
        if (error instanceof SyntaxError) {
          return json(response, 400, {
            error: 'invalid-circuit-input',
            message: 'Circuit request must be valid JSON',
          });
        }
        throw error;
      }
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/quantum/runtime') {
      return json(response, 200, quantumRuntime.summary());
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/quantum/backends') {
      return json(response, 200, await quantumRuntime.listBackends());
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/quantum/jobs') {
      return json(
        response,
        200,
        await quantumRuntime.listJobs({
          limit: url.searchParams.get('limit') || 20,
        }),
      );
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api/aethergrid/quantum/jobs/')) {
      const suffix = url.pathname.slice('/api/aethergrid/quantum/jobs/'.length);
      const [encodedJobId, action] = suffix.split('/');
      const jobId = decodeURIComponent(encodedJobId || '');
      if (!jobId) return json(response, 400, { error: 'quantum_job_id_required' });
      if (action === 'results') {
        return json(response, 200, await quantumRuntime.jobResults(jobId));
      }
      if (action === 'metrics') {
        return json(response, 200, await quantumRuntime.jobMetrics(jobId));
      }
      if (action) return json(response, 404, { error: 'quantum_job_route_not_found' });
      return json(response, 200, await quantumRuntime.job(jobId));
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/quantum/jobs') {
      const input = await body(request);
      const primitive = String(input.primitive || 'sampler').toLowerCase();
      if (!['sampler', 'estimator'].includes(primitive)) {
        return json(response, 400, { error: 'unsupported_quantum_primitive' });
      }
      const result =
        primitive === 'estimator'
          ? await quantumRuntime.submitEstimator({
              circuit: input.circuit,
              backend: input.backend,
              observable: input.observable,
            })
          : await quantumRuntime.submitSampler({
              circuit: input.circuit,
              backend: input.backend,
              shots: input.shots,
            });
      const record = {
        id: result.receipt.slice(0, 16),
        title: `Quantum ${String(result.programId || primitive).toUpperCase()}: ${result.backend}`,
        type: 'QUANTUM_JOB',
        age: 'just now',
        status: result.status === 'COMPLETED' ? 'VERIFIED' : 'PENDING',
        receipt: result.receipt,
        details: {
          provider: result.provider,
          backend: result.backend,
          programId: result.programId,
          observable: result.observable || null,
          expectationValue: Number.isFinite(Number(result.expectationValue))
            ? Number(result.expectationValue)
            : null,
          approximation: result.approximation || null,
          status: result.status,
          hardwareSubmitted: Boolean(result.hardwareSubmitted),
          hardwareExecuted: Boolean(result.hardwareExecuted),
          jobId: result.id,
          advisoryOnly: true,
        },
      };
      state.evidence.unshift(record);
      state.evidence = state.evidence.slice(0, 24);
      state.externalContext.quantum = {
        jobId: result.id,
        provider: result.provider,
        backend: result.backend,
        programId: result.programId,
        observable: result.observable || null,
        expectationValue: Number.isFinite(Number(result.expectationValue))
          ? Number(result.expectationValue)
          : null,
        status: result.status,
        hardwareSubmitted: Boolean(result.hardwareSubmitted),
        hardwareExecuted: Boolean(result.hardwareExecuted),
        receipt: result.receipt,
      };
      activity(
        `Quantum ${result.programId || primitive} job ${result.id} submitted through ${result.provider}/${result.backend}; status ${result.status}.`,
        'quantum',
      );
      return json(response, 200, {
        job: result,
        evidence: record,
        activity: state.activity,
        advisoryOnly: true,
      });
    }
    return false;
  };
}
