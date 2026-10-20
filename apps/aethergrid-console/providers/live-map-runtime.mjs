// Shared browser/server adapters. No Node imports or embedded credentials.
const ADSB = 'https://api.adsb.lol';
const OPENSKY = 'https://opensky-network.org/api/states/all';
const TOKEN =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const RADAR = 'https://api.rainviewer.com/public/weather-maps.json';
const number = (v) =>
  v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null;
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : null);
const iso = (t) => new Date(t).toISOString();
const validPosition = (lat, lon) =>
  lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

function normalizeAircraft(payload, provider, now, limit) {
  const milliseconds =
    provider === 'adsb-lol'
      ? number(payload.now)
      : number(payload.time) == null
        ? null
        : Number(payload.time) * 1000;
  if (!Number.isFinite(milliseconds) || Math.abs(milliseconds - now) > 3600000)
    throw Error('Aircraft source timestamp unavailable or outside freshness bounds');
  const rows = provider === 'adsb-lol' ? payload.ac : payload.states;
  if (rows != null && !Array.isArray(rows)) throw Error('Invalid aircraft response');
  const aircraft = [],
    seen = new Set();
  for (const row of rows ?? []) {
    const adsb = provider === 'adsb-lol';
    const latitude = number(adsb ? row.lat : row[6]),
      longitude = number(adsb ? row.lon : row[5]);
    const id = text(adsb ? row.hex : row[0]);
    const age = adsb
      ? number(row.seen_pos)
      : number(row[3]) == null
        ? null
        : milliseconds / 1000 - Number(row[3]);
    if (
      !id ||
      seen.has(id) ||
      !validPosition(latitude, longitude) ||
      age == null ||
      age < -30 ||
      age > 180
    )
      continue;
    const feet = (v) => (number(v) == null ? null : Number(v) * 0.3048);
    const onGround = adsb ? row.alt_baro === 'ground' : row[8] === true;
    aircraft.push({
      id,
      icaoHex: id,
      callsign: text(adsb ? row.flight : row[1]),
      operator: null,
      flightNumber: null,
      registration: adsb ? text(row.r) : null,
      aircraftType: adsb ? text(row.t) : null,
      latitude,
      longitude,
      barometricAltitudeMeters: adsb ? (onGround ? 0 : feet(row.alt_baro)) : number(row[7]),
      geometricAltitudeMeters: adsb ? feet(row.alt_geom) : number(row[13]),
      groundSpeedKnots: adsb
        ? number(row.gs)
        : number(row[9]) == null
          ? null
          : Number(row[9]) * 1.9438444924406,
      trackDegrees: number(adsb ? row.track : row[10]),
      verticalRateFpm: adsb
        ? number(row.baro_rate)
        : number(row[11]) == null
          ? null
          : Number(row[11]) * 196.85039370079,
      squawk: text(adsb ? row.squawk : row[14]),
      onGround,
      observedAt: iso(milliseconds - Math.max(0, age) * 1000),
      truthState: age > 90 ? 'stale' : 'observed',
    });
    seen.add(id);
  }
  // Round-robin geographic cells so bounded globe rendering does not select only the densest region.
  const cells = new Map();
  for (const a of aircraft) {
    const key = `${Math.floor(a.latitude / 10)}:${Math.floor(a.longitude / 10)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(a);
  }
  const selected = [];
  let index = 0;
  while (selected.length < Math.min(limit, aircraft.length)) {
    for (const cell of cells.values()) {
      if (cell[index] && selected.length < limit) selected.push(cell[index]);
    }
    index++;
  }
  return {
    provider,
    sourceTime: iso(milliseconds),
    fetchedAt: iso(now),
    aircraft: selected,
    relationships: [],
    totalAircraft: aircraft.length,
    displayedAircraft: selected.length,
    truncated: aircraft.length > selected.length,
  };
}

export function createLiveMapRuntime(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis),
    now = options.now ?? Date.now;
  const cache = new Map(),
    pending = new Map(),
    requestTimes = new Map();
  let token = null,
    tokenExpires = 0,
    tokenRequest = null;
  const authenticated = Boolean(options.clientId && options.clientSecret);
  async function request(url, init = {}) {
    const origin = new URL(url).origin,
      timestamps = (requestTimes.get(origin) ?? []).filter((t) => now() - t < 60000);
    if (timestamps.length >= 60) throw Error('Live map provider request budget exceeded');
    timestamps.push(now());
    requestTimes.set(origin, timestamps);
    const response = await fetchImpl(url, {
      ...init,
      headers: {
        accept: 'application/json',
        ...(typeof window === 'undefined'
          ? { 'user-agent': 'AETHERGRID/4.0 (open data map)' }
          : {}),
        ...init.headers,
      },
      redirect: 'error',
      signal: init.signal ?? AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      const error = new Error(`Live map provider returned HTTP ${response.status}`);
      error.status = response.status;
      error.retryAfterMs = Math.min(
        3600000,
        Math.max(30000, Number(response.headers.get('retry-after') || 30) * 1000),
      );
      throw error;
    }
    return response.json();
  }
  async function authorization() {
    if (!authenticated) return {};
    if (token && now() < tokenExpires) return { authorization: `Bearer ${token}` };
    if (!tokenRequest)
      tokenRequest = (async () => {
        const value = await request(TOKEN, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: options.clientId,
            client_secret: options.clientSecret,
          }).toString(),
        });
        if (!text(value.access_token))
          throw Error('OpenSky token response is missing an access token');
        token = value.access_token;
        tokenExpires = now() + Math.max(1000, (Number(value.expires_in) || 1800) * 1000 - 30000);
      })().finally(() => {
        tokenRequest = null;
      });
    await tokenRequest;
    return { authorization: `Bearer ${token}` };
  }
  async function cached(key, ttl, load) {
    const existing = cache.get(key);
    if (existing && now() < existing.nextRequest) {
      if (existing.value && (!existing.failed || now() - Date.parse(existing.value.fetchedAt) < 1800000))
        return { value: existing.value, failed: existing.failed };
      throw Error('Live map provider is cooling down after an unavailable response');
    }
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= 16) throw Error('Live map provider is busy; retry shortly');
    if (!cache.has(key) && cache.size >= 64) cache.delete(cache.keys().next().value);
    const work = (async () => {
      try {
        const value = await load();
        cache.set(key, { value, nextRequest: now() + ttl, failed: false });
        return { value, failed: false };
      } catch (error) {
        // Errors and stale fallback never become fresh observations.
        const value =
          existing?.value && now() - Date.parse(existing.value.fetchedAt) < 1800000
            ? existing.value
            : null;
        cache.set(key, { value, nextRequest: now() + (error.retryAfterMs || 60000), failed: true });
        if (value) return { value, failed: true };
        throw error;
      } finally {
        pending.delete(key);
      }
    })();
    pending.set(key, work);
    return work;
  }
  async function aviation(query = {}) {
    if (query.scope !== 'global' && query.scope !== 'city') throw Error('Invalid aviation scope');
    let url = OPENSKY;
    if (query.scope === 'city') {
      const lat = number(query.latitude),
        lon = number(query.longitude),
        radius = number(query.radiusKm ?? 250);
      if (!validPosition(lat, lon) || radius == null || radius <= 0 || radius > 463)
        throw Error('Invalid aircraft coordinate or radius');
      url = `${ADSB}/v2/lat/${lat}/lon/${lon}/dist/${Math.min(250, Math.ceil(radius / 1.852))}`;
    }
    const global = query.scope === 'global',
      provider = global ? 'opensky' : 'adsb-lol';
    const ttl = global ? (authenticated ? 120000 : 900000) : 15000;
    const { value, failed } = await cached(url, ttl, async () => {
      let payload;
      try {
        payload = await request(url, { headers: global ? await authorization() : {} });
      } catch (error) {
        if (!global || !authenticated || error.status !== 401) throw error;
        token = null;
        tokenExpires = 0;
        payload = await request(url, { headers: await authorization() });
      }
      return normalizeAircraft(payload, provider, now(), global ? 2400 : 1000);
    });
    const stale = failed || now() - Date.parse(value.sourceTime) > 120000;
    const attribution = global
      ? 'The OpenSky Network · receiver coverage varies'
      : 'ADSB.lol · ODbL 1.0 · receiver coverage varies';
    return {
      data: {
        ...value,
        scope: query.scope,
        live: !stale,
        stale,
        fallback: false,
        attribution,
        refreshAfterMs: 30000,
        upstreamRefreshMs: ttl,
      },
      receipt: {
        provider,
        sourceTime: value.sourceTime,
        fetchedAt: value.fetchedAt,
        live: !stale,
        stale,
        fallback: false,
        attribution,
      },
    };
  }
  async function radar() {
    const { value, failed } = await cached(RADAR, 300000, async () => {
      const raw = await request(RADAR);
      if (raw.host !== 'https://tilecache.rainviewer.com')
        throw Error('Untrusted radar tile origin');
      const generated = number(raw.generated);
      if (generated == null || !Array.isArray(raw.radar?.past))
        throw Error('Invalid radar manifest');
      const frames = raw.radar.past
        .filter(
          (f) =>
            Number.isFinite(f.time) &&
            f.time * 1000 <= now() + 60000 &&
            f.time * 1000 >= now() - 10800000 &&
            /^\/v2\/radar\/[A-Za-z0-9_-]{1,80}$/.test(f.path),
        )
        .sort((a, b) => a.time - b.time)
        .filter((f, i, a) => !i || f.time !== a[i - 1].time)
        .slice(-13)
        .map((f) => ({
          time: iso(f.time * 1000),
          urlTemplate: `${raw.host}${f.path}/256/{z}/{x}/{y}/2/1_1.png`,
        }));
      if (!frames.length) throw Error('Radar has no recent observed frames');
      return {
        provider: 'rainviewer',
        generatedAt: iso(generated * 1000),
        fetchedAt: iso(now()),
        frames,
        maximumLevel: 7,
        attribution: 'Weather radar by RainViewer',
        attributionUrl: 'https://www.rainviewer.com/',
        coverageUrl: `${raw.host}/v2/coverage/0/256/{z}/{x}/{y}/0/0_0.png`,
        coverage:
          'Radar coverage is partial; no echoes do not prove clear weather. Frames are composites, not instantaneous observations.',
      };
    });
    return { ...value, stale: failed || now() - Date.parse(value.generatedAt) > 1800000 };
  }
  return { aviation, radar };
}
