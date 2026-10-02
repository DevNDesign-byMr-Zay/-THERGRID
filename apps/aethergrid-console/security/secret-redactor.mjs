const DEFAULT_SECRET_KEYS = [
  'apiKey',
  'api_key',
  'token',
  'secret',
  'password',
  'credential',
  'authorization',
  'serviceCrn',
  'service_crn',
];

const PUBLIC_EXEMPT_KEYS = [
  'cesiumiontoken',
  'cesium_ion_token',
  'publictoken',
  'public_token',
];

export function createSecretRedactor(knownSecrets = []) {
  const secretSet = new Set();

  function addSecret(secret) {
    if (typeof secret === 'string' && secret.trim().length >= 3) {
      secretSet.add(secret.trim());
    }
  }

  for (const s of knownSecrets) {
    addSecret(s);
  }

  function registerSecretsFromConfig(config) {
    if (!config || typeof config !== 'object') return;

    const stack = [config];
    while (stack.length > 0) {
      const item = stack.pop();
      if (!item || typeof item !== 'object') continue;

      for (const [key, value] of Object.entries(item)) {
        const lowerKey = key.toLowerCase();
        if (PUBLIC_EXEMPT_KEYS.some((pk) => lowerKey.includes(pk.toLowerCase()))) {
          continue;
        }

        if (typeof value === 'string') {
          if (
            DEFAULT_SECRET_KEYS.some((sk) => lowerKey.includes(sk.toLowerCase())) &&
            value.trim().length >= 3
          ) {
            addSecret(value);
          }
        } else if (typeof value === 'object' && value !== null) {
          stack.push(value);
        }
      }
    }
  }

  function redactString(text) {
    if (typeof text !== 'string') return text;
    let redacted = text;

    for (const secret of secretSet) {
      if (secret && redacted.includes(secret)) {
        redacted = redacted.replaceAll(secret, '[REDACTED_SECRET]');
      }
    }

    redacted = redacted.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED_TOKEN]');

    redacted = redacted.replace(
      /([?&](?:api_?[kK]ey|token|key|secret|auth)=)[^&\s]+/gi,
      '$1[REDACTED_PARAM]',
    );

    return redacted;
  }

  function redactValue(value, seen = new WeakSet()) {
    if (value === null || value === undefined) return value;

    if (typeof value === 'string') {
      return redactString(value);
    }

    if (value instanceof Error) {
      const copy = new Error(redactString(value.message));
      copy.name = value.name;
      if (value.stack) {
        copy.stack = redactString(value.stack);
      }
      return copy;
    }

    if (typeof value === 'object') {
      if (seen.has(value)) return '[CIRCULAR]';
      seen.add(value);

      if (Array.isArray(value)) {
        return value.map((item) => redactValue(item, seen));
      }

      const copy = {};
      for (const [k, v] of Object.entries(value)) {
        const lowerKey = k.toLowerCase();
        if (PUBLIC_EXEMPT_KEYS.some((pk) => lowerKey.includes(pk.toLowerCase()))) {
          copy[k] = v;
        } else if (
          DEFAULT_SECRET_KEYS.some((sk) => lowerKey.includes(sk.toLowerCase())) &&
          typeof v === 'string'
        ) {
          copy[k] = v ? '[REDACTED_SECRET]' : '';
        } else {
          copy[k] = redactValue(v, seen);
        }
      }
      return copy;
    }

    return value;
  }

  return {
    addSecret,
    registerSecretsFromConfig,
    redactString,
    redactValue,
    getKnownSecretsCount: () => secretSet.size,
  };
}
