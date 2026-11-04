import { readRequestJson as body } from '../../security/request-body.mjs';

// A matched route returns true from json(); false leaves dispatch to the next family.
export function createAgentRoutes({ agentRuntime, state, activity, json }) {
  function agentContext(input = {}) {
    return {
      ...input,
      region: input.region || state.system.region,
      scenario: input.scenario || state.system.scenario,
      view: input.view || state.system.view,
      metrics: input.metrics || state.metrics,
      metricsBasis: input.metrics ? 'operator-supplied-unverified' : 'illustrative-local-model',
      observationsRequiredForLiveClaims: true,
      externalContext: {
        geospatial: state.externalContext.geospatial,
        quantum: state.externalContext.quantum,
      },
      authority: 'advisory-only',
    };
  }

  function validateAgentRequest(input, id = 'TEAM') {
    if (
      !['TEAM', 'VÆLON', 'AUREN', 'SOLVÆR'].includes(id) ||
      !input ||
      typeof input !== 'object' ||
      typeof input.message !== 'string' ||
      !input.message.trim() ||
      input.message.length > 12000 ||
      (input.context != null && (typeof input.context !== 'object' || Array.isArray(input.context)))
    ) {
      const error = new Error(
        'A known agent, nonempty message (at most 12000 characters), and object context are required',
      );
      error.status = 400;
      throw error;
    }
  }

  function agentEvidenceStatus(result) {
    if (result.runtime.provider === 'local' || result.runtime.fallbackUsed || result.runtime.error)
      return 'LOCAL_FALLBACK';
    if (
      result.contributions?.some(
        (item) =>
          item.runtime.provider === 'local' || item.runtime.fallbackUsed || item.runtime.error,
      )
    )
      return 'PARTIAL';
    return 'VERIFIED';
  }
  return async function handleRoutes({ request, response, url, reqContext, execCtx }) {
    if (request.method === 'POST' && url.pathname.startsWith('/api/aethergrid/agents/')) {
      const input = await body(request);
      const encodedId = url.pathname.slice('/api/aethergrid/agents/'.length);
      const agentId = decodeURIComponent(encodedId);
      validateAgentRequest(input, agentId);
      const requestedContext = agentContext(input.context);
      const result = await agentRuntime.runAgent(agentId, {
        message: input.message,
        context: requestedContext,
        history: Array.isArray(input.history) ? input.history : [],
      });
      activity(
        `${agentId} completed an advisory model request using ${result.runtime.provider}/${result.runtime.model || 'fallback'}.`,
        'ai',
      );
      const agentRecord = {
        id: result.receipt.slice(0, 16),
        title: `${agentId} Advisory Analysis`,
        type: 'AI_AGENT',
        age: 'just now',
        status: agentEvidenceStatus(result),
        receipt: result.receipt,
        details: {
          agent: agentId,
          provider: result.runtime.provider,
          model: result.runtime.model,
          fallbackUsed: result.runtime.fallbackUsed,
          latencyMs: result.runtime.latencyMs,
          region: requestedContext.region,
          scenario: requestedContext.scenario,
          temporalMode: requestedContext.temporalMode || 'live',
          temporalCursor: requestedContext.temporalCursor || null,
          selectedEntityId: requestedContext.selectedEntity?.id || null,
          advisoryOnly: true,
        },
      };
      state.evidence.unshift(agentRecord);
      state.evidence = state.evidence.slice(0, 24);
      return json(response, 200, {
        ...result,
        evidence: agentRecord,
        advisoryOnly: true,
        activity: state.activity,
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/team') {
      const input = await body(request);
      validateAgentRequest(input);
      const requestedContext = agentContext(input.context);
      const result = await agentRuntime.runTeam({
        message: input.message,
        context: requestedContext,
        history: Array.isArray(input.history) ? input.history : [],
      });
      activity(
        `ÆTHERGRID team completed a coordinated advisory request with ${result.contributions.length} agent contributions.`,
        'ai-team',
      );
      const teamRecord = {
        id: result.receipt.slice(0, 16),
        title: 'ÆTHERGRID Multi-Agent Synthesis',
        type: 'AI_TEAM',
        age: 'just now',
        status: agentEvidenceStatus(result),
        receipt: result.receipt,
        details: {
          provider: result.runtime.provider,
          model: result.runtime.model,
          fallbackUsed: result.runtime.fallbackUsed,
          contributionReceipts: result.contributions.map((item) => ({
            agent: item.agent,
            receipt: item.receipt,
            provider: item.runtime.provider,
            model: item.runtime.model,
          })),
          region: requestedContext.region,
          scenario: requestedContext.scenario,
          temporalMode: requestedContext.temporalMode || 'live',
          temporalCursor: requestedContext.temporalCursor || null,
          selectedEntityId: requestedContext.selectedEntity?.id || null,
          advisoryOnly: true,
        },
      };
      state.evidence.unshift(teamRecord);
      state.evidence = state.evidence.slice(0, 24);
      return json(response, 200, {
        ...result,
        evidence: teamRecord,
        advisoryOnly: true,
        activity: state.activity,
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/aethergrid/chat') {
      const input = await body(request);
      const requestedAgent = String(input.agent || 'TEAM');
      validateAgentRequest(input, requestedAgent);
      const result =
        requestedAgent === 'TEAM'
          ? await agentRuntime.runTeam({
              message: input.message,
              context: agentContext(input.context),
            })
          : await agentRuntime.runAgent(requestedAgent, {
              message: input.message,
              context: agentContext(input.context),
            });
      activity(`AI collaboration completed for ${requestedAgent}.`, 'ai');
      return json(response, 200, {
        reply: result.reply || result.synthesis,
        result,
        advisoryOnly: true,
        activity: state.activity,
      });
    }
    return false;
  };
}
