import { useState } from 'react';
import {
  readPublicSpatialToken,
  savePublicSpatialToken,
} from '../services/public-spatial-connection';
import { loadAviationSnapshot } from '../services/aviation-client';
import { loadWeatherRadar } from '../services/weather-radar';
export function LiveConnections() {
  const [token, setToken] = useState(readPublicSpatialToken),
    [message, setMessage] = useState(''),
    [checking, setChecking] = useState(false),
    [checks, setChecks] = useState<string[]>([]);
  async function check() {
    setChecking(true);
    const results = await Promise.allSettled([
      loadAviationSnapshot({ scope: 'city', latitude: 40.7549, longitude: -73.984, radiusKm: 250 }),
      loadAviationSnapshot({ scope: 'global' }),
      loadWeatherRadar(),
    ]);
    setChecks(
      results.map((result, index) =>
        result.status === 'fulfilled'
          ? index === 2
            ? `Radar: ${'frames' in result.value ? result.value.frames.length : 0} observed frames`
            : `${index === 0 ? 'City' : 'Global'} aircraft: ${'aircraft' in result.value ? result.value.aircraft.length : 0} displayed · ${result.value.stale ? 'DELAYED' : 'RECENT'} · ${'sourceTime' in result.value ? result.value.sourceTime : result.value.fetchedAt}`
          : `${['City aircraft', 'Global aircraft', 'Radar'][index]}: unavailable · ${result.reason?.message ?? 'Connection failed'}`,
      ),
    );
    setChecking(false);
  }
  return (
    <section className="live-connections" aria-label="Live map connections">
      <h3>LIVE MAP CONNECTIONS</h3>
      <p>
        City aircraft use ADSB.lol; global aircraft use OpenSky. Radar shows recent RainViewer
        composites where coverage exists. Internet access is required.
      </p>
      <button type="button" onClick={() => void check()} disabled={checking}>
        {checking ? 'CHECKING SOURCES…' : 'CHECK LIVE SOURCES'}
      </button>
      <ul>
        {checks.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          try {
            savePublicSpatialToken(token);
            setMessage(
              'Spatial connection applied. The renderer is reconnecting; check its status for provider acceptance.',
            );
          } catch (error) {
            setMessage(String((error as Error).message));
          }
        }}
      >
        <label>
          Cesium ion public browser token
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            aria-label="Cesium ion public browser token"
            placeholder="Optional public token for terrain and 3D tiles"
          />
        </label>
        <p>
          Use a read-only, asset-scoped public token. Reality mode also requires access to the
          photorealistic tiles asset in your Cesium account. A saved token does not confirm provider
          acceptance.
        </p>
        <button type="submit">APPLY SPATIAL CONNECTION</button>
        <button
          type="button"
          onClick={() => {
            try {
              savePublicSpatialToken('');
              setToken('');
              setMessage(
                'Browser token removed. Reconnecting with server configuration or bundled maps.',
              );
            } catch {
              setMessage('Browser storage is unavailable.');
            }
          }}
        >
          REMOVE BROWSER TOKEN
        </button>
        <p role="status">{message}</p>
      </form>
      <small>
        Anonymous global observations refresh upstream at most every 15 minutes. Server-side OpenSky
        OAuth allows a shorter interval; private OAuth credentials stay on the server. RainViewer
        public use is personal/educational; production use requires the provider’s agreement.
      </small>
    </section>
  );
}
