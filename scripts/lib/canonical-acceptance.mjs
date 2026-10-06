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

export function summarizeQuantumDiscovery(result, runtimeSummary = {}) {
  const backends = Array.isArray(result?.backends) ? result.backends : [];
  const validBackends = backends.filter(
    (backend) => typeof backend?.name === 'string' && backend.name.trim().length > 0,
  );
  const ibm = runtimeSummary?.providers?.ibm || {};
  const configured =
    ibm.configured === true &&
    ibm.apiKeyPresent === true &&
    ibm.serviceCrnPresent === true &&
    runtimeSummary.credentialsExposed === false;
  const verified =
    configured &&
    result?.provider === 'ibm-quantum' &&
    validBackends.length > 0;

  return {
    verified,
    acceptanceState: verified ? 'live-authenticated-discovery-verified' : null,
    provider: result?.provider || 'unconfigured',
    configured,
    discoveryOnly: true,
    backendCount: validBackends.length,
    hardwareBackendCount: validBackends.filter((backend) => backend.simulator !== true).length,
    simulatorCount: validBackends.filter((backend) => backend.simulator === true).length,
    apiVersion: runtimeSummary.apiVersion || null,
    hardwareSubmitted: false,
    hardwareExecuted: false,
    credentialsExposed: runtimeSummary.credentialsExposed === true,
  };
}

export function summarizeScheduledRealtime(
  result,
  provider,
  {
    records = 0,
    expectedDataset = null,
    runAt = new Date(),
    sourceTimestamp = null,
    timeZone = 'America/New_York',
    serviceStartHour = 6,
    serviceEndHour = 22,
    maxSourceAgeSeconds = 300,
  } = {},
) {
  const receipt = result?.receipt || {};
  const runDate = runAt instanceof Date ? runAt : new Date(runAt);
  const localHour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(runDate),
  );
  const withinServiceHours =
    Number.isFinite(localHour) && localHour >= serviceStartHour && localHour < serviceEndHour;

  const timestampSeconds = Number(sourceTimestamp);
  const sourceDate =
    Number.isFinite(timestampSeconds) && timestampSeconds > 0
      ? new Date(timestampSeconds * 1000)
      : null;
  const sourceAgeSeconds =
    sourceDate && Number.isFinite(runDate.getTime())
      ? Math.round((runDate.getTime() - sourceDate.getTime()) / 1000)
      : null;
  const sourceFresh =
    sourceAgeSeconds != null && sourceAgeSeconds >= -60 && sourceAgeSeconds <= maxSourceAgeSeconds;

  const transportVerified =
    receipt.live === true &&
    receipt.fallback !== true &&
    receipt.stale !== true &&
    result?.data?.stale !== true &&
    receipt.provider === provider &&
    (!expectedDataset || receipt.dataset === expectedDataset);
  const nonempty = records > 0;
  const freshEmptyOutsideServiceHours = !withinServiceHours && records === 0 && sourceFresh;
  const verified = transportVerified && (nonempty || freshEmptyOutsideServiceHours);

  return {
    verified,
    records,
    provider: receipt.provider || 'unconfigured',
    dataset: receipt.dataset || null,
    live: receipt.live === true,
    stale: receipt.stale === true,
    fallback: receipt.fallback === true,
    observedAt: sourceDate ? sourceDate.toISOString() : receipt.observedAt || null,
    retrievedAt: receipt.retrievedAt || null,
    sourceFresh,
    sourceAgeSeconds,
    serviceWindow: {
      timeZone,
      startHour: serviceStartHour,
      endHour: serviceEndHour,
      localHour,
      withinServiceHours,
    },
    expectedEmptyOutsideServiceHours: freshEmptyOutsideServiceHours,
    acceptanceState: freshEmptyOutsideServiceHours ? 'live-empty-outside-service-hours' : null,
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
