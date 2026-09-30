export function createUrlPolicy(allowedUrlsOrPrefixes = []) {
  const allowedPrefixes = new Set();

  function addAllowedPrefix(rawUrlOrPrefix) {
    if (!rawUrlOrPrefix || typeof rawUrlOrPrefix !== 'string') return;
    try {
      const parsed = new URL(rawUrlOrPrefix);
      allowedPrefixes.add(parsed.origin.toLowerCase());
      allowedPrefixes.add(rawUrlOrPrefix.toLowerCase());
    } catch {
      allowedPrefixes.add(rawUrlOrPrefix.toLowerCase());
    }
  }

  // Pre-approved default provider domains / patterns
  const defaults = [
    'https://api.openai.com',
    'http://127.0.0.1:11434',
    'http://localhost:11434',
    'https://overpass-api.de',
    'https://api.open-meteo.com',
    'https://air-quality-api.open-meteo.com',
    'https://earthquake.usgs.gov',
    'https://quantum.cloud.ibm.com',
    'https://iam.cloud.ibm.com',
    'https://api.tomorrow.io',
    'https://api.weather.gov',
    'https://api.eia.gov',
    'https://api.water.noaa.gov',
    'https://cloud.dwavesys.com',
  ];

  for (const d of defaults) {
    addAllowedPrefix(d);
  }

  for (const item of allowedUrlsOrPrefixes) {
    if (item) addAllowedPrefix(item);
  }

  function isAllowedUrl(targetUrl) {
    if (!targetUrl || typeof targetUrl !== 'string') return false;

    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return false;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    const targetLower = targetUrl.toLowerCase();
    const originLower = parsed.origin.toLowerCase();

    for (const prefix of allowedPrefixes) {
      if (
        originLower === prefix ||
        targetLower.startsWith(prefix) ||
        (prefix.startsWith('http') && originLower.startsWith(prefix))
      ) {
        return true;
      }
    }

    return false;
  }

  function validateUrl(targetUrl) {
    if (!isAllowedUrl(targetUrl)) {
      throw new Error(
        `Outbound URL blocked by security policy: ${targetUrl}. Must be an approved provider URL or local endpoint.`,
      );
    }
    return targetUrl;
  }

  return {
    addAllowedPrefix,
    isAllowedUrl,
    validateUrl,
  };
}
