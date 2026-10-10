export function createUrlPolicy(allowedUrlsOrOrigins = []) {
  const allowedOrigins = new Set();
  const allowedHosts = new Set();

  function addAllowedOrigin(rawUrlOrOrigin) {
    if (!rawUrlOrOrigin || typeof rawUrlOrOrigin !== 'string') return;
    try {
      const parsed = new URL(rawUrlOrOrigin);
      allowedOrigins.add(parsed.origin.toLowerCase());
      allowedHosts.add(parsed.hostname.toLowerCase());
    } catch {
      allowedHosts.add(rawUrlOrOrigin.toLowerCase().trim());
    }
  }

  // Pre-approved default provider domains
  const defaults = [
    'https://api.openai.com',
    'http://127.0.0.1:11434',
    'http://localhost:11434',
    'https://overpass.kumi.systems',
    'https://overpass.nchc.org.tw',
    'https://overpass.private.coffee',
    'https://overpass-api.de',
    'https://maps.mail.ru',
    'https://api.openstreetmap.org',
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
    'https://sapi.qpu.dwavesys.com',
    'https://transit.land',
  ];

  for (const d of defaults) {
    addAllowedOrigin(d);
  }

  for (const item of allowedUrlsOrOrigins) {
    if (item) addAllowedOrigin(item);
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

    // Disallow embedded credentials in URL
    if (parsed.username || parsed.password) {
      return false;
    }

    const targetOrigin = parsed.origin.toLowerCase();
    const targetHostname = parsed.hostname.toLowerCase();

    // Allow loopback endpoints for local development
    if (targetHostname === '127.0.0.1' || targetHostname === 'localhost') {
      return true;
    }

    // Exact origin match required!
    if (allowedOrigins.has(targetOrigin)) {
      return true;
    }

    return false;
  }

  function validateUrl(targetUrl) {
    if (!isAllowedUrl(targetUrl)) {
      throw new Error(
        `Outbound URL blocked by security policy: ${targetUrl}. Must be an approved provider origin or local endpoint.`,
      );
    }
    return targetUrl;
  }

  return {
    addAllowedPrefix: addAllowedOrigin,
    addAllowedOrigin,
    isAllowedUrl,
    validateUrl,
  };
}
