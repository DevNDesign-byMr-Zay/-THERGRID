import { createSecretRedactor } from '../../apps/aethergrid-console/security/secret-redactor.mjs';

export function summarizeAgent(result, agent) {
  const runtime = result?.runtime || {};
  const verified =
    runtime.provider === 'openai-compatible' &&
    runtime.fallbackUsed === false &&
    !runtime.error &&
    typeof result?.reply === 'string' &&
    result.reply.trim().length > 0;
  const summary = {
    agent,
    verified,
    provider: runtime.provider || 'unconfigured',
    model: runtime.model || null,
    fallbackUsed: runtime.fallbackUsed !== false,
    receipt: result?.receipt || null,
  };
  if (agent !== 'TEAM') return summary;
  const contributions = (result.contributions || []).map((item) =>
    summarizeAgent(item, item.agent),
  );
  const expected = ['VÆLON', 'AUREN', 'SOLVÆR'];
  return {
    ...summary,
    contributions,
    verified:
      verified &&
      contributions.length === 3 &&
      expected.every(
        (name) => contributions.filter((item) => item.agent === name && item.verified).length === 1,
      ),
  };
}

export function summarizeProvider(result, provider, { records = 1 } = {}) {
  const receipt = result?.receipt || {};
  return {
    verified:
      receipt.live === true &&
      receipt.fallback !== true &&
      receipt.stale !== true &&
      result?.data?.stale !== true &&
      receipt.provider === provider &&
      records > 0,
    records,
    provider: receipt.provider || 'unconfigured',
    dataset: receipt.dataset || null,
    live: receipt.live === true,
    stale: receipt.stale === true,
    fallback: receipt.fallback === true,
    observedAt: receipt.observedAt || null,
    retrievedAt: receipt.retrievedAt || null,
  };
}

export function summarizeObservation(result, kind) {
  const data = result?.data || {};
  const timestamp =
    typeof data.observedAt === 'string' && Number.isFinite(Date.parse(data.observedAt));
  const valid =
    kind === 'tomorrow-current'
      ? timestamp && Number.isFinite(data.temperatureCelsius) && data.status === 'Tomorrow.io Live'
      : timestamp &&
        data.gaugeId === 'BATN6' &&
        data.status === 'NOAA NWPS Live' &&
        (Number.isFinite(data.observedStageFeet) || Number.isFinite(data.observedFlowCfs));
  return {
    ...summarizeProvider(result, kind === 'tomorrow-current' ? 'tomorrow-io' : 'noaa-nwps', {
      records: valid ? 1 : 0,
    }),
    observationVerified: Boolean(valid),
    observedAt: timestamp ? data.observedAt : null,
    ...(kind === 'noaa-BATN6' ? { gaugeId: 'BATN6' } : {}),
  };
}

export function sanitizeAcceptance(report, env = process.env) {
  const redactor = createSecretRedactor();
  const secrets = Object.entries(env)
    .filter(
      ([name, value]) =>
        /key|token|secret|password|crn/i.test(name) &&
        typeof value === 'string' &&
        value.length >= 3,
    )
    .map(([, value]) => value);
  for (const secret of secrets) {
    redactor.addSecret(secret);
    redactor.addSecret(encodeURIComponent(secret));
  }
  const sanitized = redactor.redactValue(report);
  const text = JSON.stringify(sanitized);
  if (
    secrets.some((secret) => text.includes(secret) || text.includes(encodeURIComponent(secret)))
  ) {
    throw new Error('acceptance evidence failed credential sanitation');
  }
  return sanitized;
}
