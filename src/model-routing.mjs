const ROUTER_VERSION = 1;

const CAPABILITIES = Object.freeze({
  'scenario.explain': { safetyClass: 'advisory', fallback: 'classical-summary-v1' },
  'optimization.explore': { safetyClass: 'advisory', fallback: 'classical-reference-v1' },
  'spatial.annotate': { safetyClass: 'presentation', fallback: 'none' },
});

export function createModelRoute({ model = 'VÆLON', version = 'unbound' } = {}) {
  return {
    contractVersion: ROUTER_VERSION,
    model,
    version,
    capabilities: Object.keys(CAPABILITIES),
    resolve(capability) {
      const definition = CAPABILITIES[capability];
      if (!definition) throw new TypeError(`unsupported capability: ${capability}`);
      return { capability, ...definition, model, version };
    },
  };
}

export function buildModelEvidence({
  route,
  capability,
  status = 'proposed',
  fallbackUsed = false,
} = {}) {
  if (!route || typeof route.resolve !== 'function')
    throw new TypeError('route must be a model route');
  const resolved = route.resolve(capability);
  return {
    contractVersion: ROUTER_VERSION,
    model: resolved.model,
    modelVersion: resolved.version,
    capability,
    safetyClass: resolved.safetyClass,
    status,
    fallbackUsed: fallbackUsed === true,
    fallbackIdentity: fallbackUsed ? resolved.fallback : null,
  };
}
