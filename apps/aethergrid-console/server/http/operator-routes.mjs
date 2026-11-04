import { createHash } from 'node:crypto';
import { readRequestJson as body } from '../../security/request-body.mjs';
import { computeOperatorOptimization } from '../../analysis/operator-optimization.mjs';

// A matched route returns true from json(); false leaves dispatch to the next family.
export function createOperatorRoutes({
  state,
  regions,
  scenarios,
  views,
  activity,
  snapshot,
  telemetryTick,
  json,
}) {
  function validateChoice(value, allowed, label) {
    if (!allowed.includes(value)) {
      const error = new Error(`unsupported ${label}: ${value}`);
      error.status = 400;
      throw error;
    }
    return value;
  }
  return async function handleRoutes({ request, response, url, reqContext, execCtx }) {
    if (request.method === 'GET' && url.pathname === '/api/aethergrid/stream') {
      response.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-content-type-options': 'nosniff',
      });
      const sendEvent = () => {
        telemetryTick();
        response.write(
          `event: telemetry\ndata: ${JSON.stringify({ state: snapshot(), at: new Date().toISOString() })}\n\n`,
        );
      };
      sendEvent();
      const interval = setInterval(sendEvent, 2500);
      request.once('close', () => clearInterval(interval));
      return true;
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/state') {
      telemetryTick();
      return json(response, 200, snapshot());
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/telemetry') {
      telemetryTick();
      return json(response, 200, {
        metrics: state.metrics,
        system: state.system,
        at: new Date().toISOString(),
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/aethergrid/evidence') {
      return json(response, 200, { evidence: state.evidence, activity: state.activity });
    }
    if (
      request.method === 'GET' &&
      url.pathname.startsWith('/api/aethergrid/evidence/') &&
      url.pathname !== '/api/aethergrid/evidence/'
    ) {
      const id = decodeURIComponent(url.pathname.slice('/api/aethergrid/evidence/'.length));
      const record = state.evidence.find((item) => item.id === id || item.receipt === id);
      if (!record) return json(response, 404, { error: 'evidence_not_found' });
      return json(response, 200, { evidence: record, advisoryOnly: true });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/view') {
      const input = await body(request);
      const view = validateChoice(String(input.view || ''), views, 'view');
      state.system.view = view;
      activity(`Operator review mode changed to ${view}.`, 'view');
      return json(response, 200, { state: snapshot() });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/region') {
      const input = await body(request);
      const region = validateChoice(String(input.region || ''), regions, 'region');
      state.system.region = region;
      activity(`Operator region changed to ${region}.`, 'region');
      return json(response, 200, { state: snapshot() });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/scenario') {
      const input = await body(request);
      const scenario = validateChoice(String(input.scenario || ''), scenarios, 'scenario');
      state.system.scenario = scenario;
      state.system.view = 'scenario';
      if (scenario === 'custom') {
        const parameters = input.parameters || {};
        const clampNumber = (value, fallback, min, max) => {
          const parsed = Number(value);
          return Math.max(min, Math.min(max, Number.isFinite(parsed) ? parsed : fallback));
        };
        state.system.scenarioParameters = {
          loadMultiplierPercent: clampNumber(
            parameters.loadMultiplierPercent,
            state.system.scenarioParameters.loadMultiplierPercent,
            70,
            150,
          ),
          renewableAvailabilityPercent: clampNumber(
            parameters.renewableAvailabilityPercent,
            state.system.scenarioParameters.renewableAvailabilityPercent,
            40,
            160,
          ),
          storageReservePercent: clampNumber(
            parameters.storageReservePercent,
            state.system.scenarioParameters.storageReservePercent,
            5,
            45,
          ),
          weatherRiskPercent: clampNumber(
            parameters.weatherRiskPercent,
            state.system.scenarioParameters.weatherRiskPercent,
            0,
            100,
          ),
        };
      }
      activity(
        `Scenario loaded: ${scenario}${scenario === 'custom' ? ` ${JSON.stringify(state.system.scenarioParameters)}` : ''}.`,
        'scenario',
      );
      const scenarioRecord = {
        id: `scenario-${Date.now()}`,
        title: `Scenario: ${scenario}`,
        type: 'SCENARIO',
        age: 'just now',
        status: 'VERIFIED',
        details: {
          region: state.system.region,
          scenario,
          parameters: scenario === 'custom' ? { ...state.system.scenarioParameters } : null,
          view: state.system.view,
          advisoryOnly: true,
        },
      };
      scenarioRecord.receipt = createHash('sha256')
        .update(JSON.stringify(scenarioRecord))
        .digest('hex');
      state.evidence.unshift(scenarioRecord);
      state.evidence = state.evidence.slice(0, 24);
      return json(response, 200, { state: snapshot(), evidence: scenarioRecord });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/reset') {
      state.system.region = 'New York Metro';
      state.system.view = 'live';
      state.system.scenario = 'peak-demand';
      state.system.scenarioParameters = {
        loadMultiplierPercent: 110,
        renewableAvailabilityPercent: 100,
        storageReservePercent: 18,
        weatherRiskPercent: 20,
      };
      state.optimization.currentCost = 12480;
      state.optimization.candidateCost = 10230;
      state.optimization.classicalCandidateCost = 11790;
      state.optimization.emissionsReduction = 24.3;
      state.optimization.renewableUtilizationGain = 16.7;
      state.optimization.reliabilityScore = 90.0;
      activity('Operator review state reset to the New York Metro live baseline.', 'reset');
      return json(response, 200, { state: snapshot() });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/optimize') {
      const input = await body(request);
      if (input.region && regions.includes(String(input.region)))
        state.system.region = String(input.region);
      if (input.scenario && scenarios.includes(String(input.scenario))) {
        state.system.scenario = String(input.scenario);
      }

      const {
        objective,
        costWeight,
        emissionsWeight,
        minimumReservePercent,
        classicalBaselineRequired,
        currentCost,
        classicalCandidateCost,
        candidateCost,
        emissionsReduction,
        renewableUtilizationGain,
        reliabilityScore,
      } = computeOperatorOptimization(input, {
        scenario: state.system.scenario,
        scenarioParameters: state.system.scenarioParameters,
      });

      state.optimization.runCount += 1;
      state.optimization.currentCost = Math.round(currentCost);
      state.optimization.classicalCandidateCost = classicalCandidateCost;
      state.optimization.candidateCost = candidateCost;
      state.optimization.emissionsReduction = emissionsReduction;
      state.optimization.renewableUtilizationGain = renewableUtilizationGain;
      state.optimization.reliabilityScore = reliabilityScore;

      const completedAt = new Date().toISOString();
      const run = {
        id: `optimization-${state.optimization.runCount}`,
        completedAt,
        objective,
        weights: { cost: costWeight, emissions: emissionsWeight },
        constraints: { minimumReservePercent, classicalBaselineRequired },
        scenario: state.system.scenario,
        region: state.system.region,
        baseline: {
          currentCost: Math.round(currentCost),
          classicalCandidateCost,
        },
        candidate: {
          cost: candidateCost,
          emissionsReduction,
          renewableUtilizationGain,
          reliabilityScore,
        },
      };
      const receipt = createHash('sha256').update(JSON.stringify(run)).digest('hex');
      run.receipt = receipt;
      state.optimization.history.unshift(run);
      state.optimization.history = state.optimization.history.slice(0, 20);
      state.evidence.unshift({
        id: receipt.slice(0, 16),
        title: `Optimization: ${objective} / ${state.system.scenario}`,
        type: 'OPTIMIZATION',
        age: 'just now',
        status: 'VERIFIED',
        receipt,
      });
      state.evidence = state.evidence.slice(0, 24);

      activity(
        `Bounded optimization completed for ${state.system.region} / ${state.system.scenario}; classical baseline ${classicalCandidateCost} and experimental candidate ${candidateCost} recorded.`,
        'optimization',
      );
      return json(response, 200, {
        status: 'completed',
        optimization: state.optimization,
        comparison: {
          classical: {
            candidateCost: classicalCandidateCost,
            method: 'deterministic-classical-baseline',
          },
          experimental: {
            candidateCost,
            emissionsReduction,
            renewableUtilizationGain,
            reliabilityScore,
            method: 'bounded-experimental-search',
          },
        },
        receipt,
        advisoryOnly: true,
        classicalBaselineRequired,
        activity: state.activity,
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/export') {
      const input = await body(request);
      const receipt = createHash('sha256')
        .update(JSON.stringify({ input, state: snapshot(), ts: new Date().toISOString() }))
        .digest('hex');
      activity(`Evidence export prepared: ${input.kind || 'package'}.`, 'export');
      return json(response, 200, {
        receipt,
        format: 'json',
        advisoryOnly: true,
        generatedAt: new Date().toISOString(),
        state: snapshot(),
      });
    }
    return false;
  };
}
