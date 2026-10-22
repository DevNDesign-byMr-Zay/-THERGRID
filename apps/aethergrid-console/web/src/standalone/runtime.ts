import {createLiveMapRuntime} from '../../../providers/live-map-runtime.mjs';
type Snapshot = { city: { id: string; name?: string; lat: number; lon: number }; source: { snapshot?: boolean; fetchedAt?: string }; buildings: unknown[] };

// Public local read adapter. Private provider calls are never synthesized or sent with keys.
export function installStandaloneRuntime() {
  if (location.protocol !== 'file:') return;
  const nativeFetch = globalThis.fetch.bind(globalThis);
  const liveMaps=createLiveMapRuntime({fetchImpl:nativeFetch});
  const snapshots = (globalThis as typeof globalThis & { __AETHERGRID_CITIES__?: Record<string, Snapshot> }).__AETHERGRID_CITIES__ ?? {};
  const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
  globalThis.fetch = async (input, init) => {
    // On Windows, resolving a root-relative /api path against file:///C:/...
    // yields file:///C:/api/... (pathname /C:/api/...), NOT /api/...
    // Match the original relative request before URL resolution instead.
    // This also prevents interception of absolute external HTTP(S) URLs.
    const requestPath = input instanceof Request ? input.url : String(input);
    if (!requestPath.startsWith('/api/aethergrid/')) return nativeFetch(input, init);
    const url = new URL(requestPath, 'https://local.aethergrid.invalid');
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    const route = url.pathname.slice('/api/aethergrid/'.length);
    if (route === 'profile') {
      const key = 'aethergrid.local-file.profile';
      try {
        if (method === 'PUT') { const value = JSON.parse(String(init?.body)); localStorage.setItem(key, JSON.stringify(value.profile)); return json(value); }
        const profile = JSON.parse(localStorage.getItem(key) || 'null');
        return json({ profile: profile ?? { id: 'local-operator', displayName: 'ÆTHERGRID Operator', initials: 'IM', title: 'Local workspace', organization: '', homeRegion: 'GLOBAL', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, bio: '', avatarDataUrl: '', updatedAt: null } });
      } catch { return json({ error: 'Local profile storage unavailable.' }, 503); }
    }
    if (method !== 'GET') return json({ error: 'This action requires the connected application runtime.' }, 503);
    if (route === 'auth/session') return json({ enabled: false, user: null, csrf: null });
    if (route === 'config/public') return json({ spatial: { provider: 'cesium', cesiumIonToken: null, realityEnabled: false } });
    if (route.startsWith('geospatial/city/')) {
      const id = decodeURIComponent(route.slice('geospatial/city/'.length));
      return snapshots[id] ? json(snapshots[id]) : json({ error: 'No bundled map exists for this location.' }, 404);
    }
    if (route === 'domains/aviation/aircraft') {
      const scope=url.searchParams.get('scope');
      if(scope!=='city' && scope!=='global')return json({error:'Invalid aviation scope'},400);
      try {
        const response=await nativeFetch(`http://127.0.0.1:8090${url.pathname}${url.search}`,{signal:AbortSignal.any([AbortSignal.timeout(15000),...(init?.signal?[init.signal]:[])]),headers:{accept:'application/json'}});
        if(response.ok)return json(await response.json());
        return json({error:response.status===401?'Sign in through the connected workspace to enable aircraft feeds.':'The local aircraft service is unavailable.'},response.status);
      } catch{return json({error:'Aircraft providers require the connected runtime because their browser policy blocks file-origin requests. Start START-AETHERGRID.cmd, then open the connected workspace.'},503);}
    }
    if (route === 'weather/radar') {
      try{return json(await liveMaps.radar());}
      catch(error){return json({error:error instanceof Error?error.message:'Radar provider unavailable.'},503);}
    }
    if (route === 'history') return json({ observations: [] });
    if (route === 'global-live') {
      const generatedAt = Object.values(snapshots).map(s => s.source.fetchedAt || '').sort().at(-1);
      const cities = Object.values(snapshots).map(s => ({ ...s.city, source: { provider: 'bundled-openstreetmap', live: false, fetchedAt: s.source.fetchedAt, attribution: '© OpenStreetMap contributors · dated city catalog' } }));
      let seismic = { source: { provider: 'usgs', live: false, attribution: 'USGS feed unavailable', fetchedAt: null as string | null }, events: [] as unknown[] };
      try {
        const response = await nativeFetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson', { signal: AbortSignal.timeout(8000) });
        if (response.ok) { const value = await response.json(); seismic = { source: { provider: 'usgs', live: true, attribution: 'USGS earthquake catalog · past day', fetchedAt: new Date().toISOString() }, events: value.features.map((f: { id: string; geometry: { coordinates: number[] }; properties: { mag: number; place: string; time: number } }) => ({ id: f.id, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], depthKm: f.geometry.coordinates[2], magnitude: f.properties.mag, place: f.properties.place, time: new Date(f.properties.time).toISOString() })) }; }
      } catch { /* Offline view keeps real city locations; earthquake data remains unavailable. */ }
      return json({ generatedAt, snapshot: !seismic.source.live, cities, seismic });
    }
    if (route === 'weather/current' || route === 'weather/forecast' || route === 'environment') {
      if (url.searchParams.has('at')) return json({ error: 'Historical weather requires recorded observations.' }, 404);
      const lat = Number(url.searchParams.get('lat')), lon = Number(url.searchParams.get('lon'));
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return json({ error: 'Invalid weather coordinate.' }, 400);
      const variables = 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m';
      const query = new URLSearchParams({ latitude: String(lat), longitude: String(lon), current: variables, hourly: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m', timezone: 'UTC', forecast_days: '2' });
      try {
        const response = await nativeFetch(`https://api.open-meteo.com/v1/forecast?${query}`, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) return json({ error: 'Public weather provider unavailable.' }, 503);
        const value = await response.json(), c = value.current, fetchedAt = new Date().toISOString();
        const source = { provider: 'open-meteo', live: true, attribution: 'Open-Meteo weather model · not a street sensor', fetchedAt, modelTime: `${c.time}Z` };
        if (route === 'weather/forecast') return json({ receipt: { provider: 'open-meteo', live: true, fallback: false, retrievedAt: fetchedAt, attribution: source.attribution }, data: { coordinate: { lat, lon }, hourly: value.hourly.time.map((time: string, index: number) => ({ eventTime: `${time}Z`, temperatureC: value.hourly.temperature_2m[index], relativeHumidityPercent: value.hourly.relative_humidity_2m[index], weatherCode: value.hourly.weather_code[index], windSpeedKph: value.hourly.wind_speed_10m[index] })) } });
        return json({ coordinate: { lat, lon }, source, timezone: 'UTC', utcOffsetSeconds: 0, current: { time: `${c.time}Z`, temperatureC: c.temperature_2m, apparentTemperatureC: c.apparent_temperature, relativeHumidityPercent: c.relative_humidity_2m, weatherCode: c.weather_code, weatherCodeSystem: 'wmo', cloudCoverPercent: c.cloud_cover, precipitationMm: c.precipitation, surfacePressureHpa: c.surface_pressure, isDay: c.is_day === 1, windSpeedKph: c.wind_speed_10m, windDirectionDegrees: c.wind_direction_10m, windGustsKph: c.wind_gusts_10m } });
      } catch { return json({ error: 'Public weather unavailable while offline.' }, 503); }
    }
    return json({ error: 'Service requires a connected runtime; bundled city snapshots remain available.' }, 503);
  };
}
