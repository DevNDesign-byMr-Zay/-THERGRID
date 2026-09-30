import { useEffect, useMemo, useState } from 'react';

import { SpatialViewport } from '../components/SpatialViewport';
import { TemporalRail } from '../components/TemporalRail';
import { useTemporalClock } from '../hooks/use-temporal-clock';
import type { SpatialOverlaySnapshot } from '../renderer/overlays/spatial-overlay';
import type {
  LayerState,
  SpatialFeatureSelection,
  SpatialTarget,
  VisualMode
} from '../renderer/spatial-renderer';
import { loadCityPowerOverlay } from '../services/city-power-overlay';

interface CityTarget extends SpatialTarget {
  id: string;
  name: string;
  district: string;
}

const CITY_TARGETS: readonly CityTarget[] = [
  {
    id: 'new-york',
    name: 'NEW YORK',
    district: 'Midtown Manhattan',
    latitude: 40.7549,
    longitude: -73.984,
    rangeMeters: 4_800,
    pitchDegrees: -34
  },
  {
    id: 'london',
    name: 'LONDON',
    district: 'City / South Bank',
    latitude: 51.5136,
    longitude: -0.0917,
    rangeMeters: 4_600,
    pitchDegrees: -35
  },
  {
    id: 'tokyo',
    name: 'TOKYO',
    district: 'Shinjuku',
    latitude: 35.6896,
    longitude: 139.6917,
    rangeMeters: 4_800,
    pitchDegrees: -34
  },
  {
    id: 'dubai',
    name: 'DUBAI',
    district: 'Downtown',
    latitude: 25.1972,
    longitude: 55.2744,
    rangeMeters: 5_000,
    pitchDegrees: -32
  },
  {
    id: 'singapore',
    name: 'SINGAPORE',
    district: 'Marina Bay / Downtown Core',
    latitude: 1.2838,
    longitude: 103.8515,
    rangeMeters: 4_600,
    pitchDegrees: -34
  },
  {
    id: 'sao-paulo',
    name: 'SÃO PAULO',
    district: 'Paulista / Bela Vista',
    latitude: -23.5614,
    longitude: -46.6559,
    rangeMeters: 4_800,
    pitchDegrees: -35
  },
  {
    id: 'lagos',
    name: 'LAGOS',
    district: 'Victoria Island / Eko Atlantic',
    latitude: 6.4281,
    longitude: 3.4219,
    rangeMeters: 4_800,
    pitchDegrees: -34
  },
  {
    id: 'sydney',
    name: 'SYDNEY',
    district: 'CBD / Circular Quay',
    latitude: -33.8651,
    longitude: 151.2099,
    rangeMeters: 4_700,
    pitchDegrees: -34
  }
];

const INITIAL_LAYERS: readonly LayerState[] = [
  { id: 'terrain', visible: true },
  { id: 'buildings', visible: true },
  { id: 'grid', visible: true },
  { id: 'weather', visible: true },
  { id: 'energy', visible: true },
  { id: 'transit', visible: false }
];

const VISUAL_MODES: readonly VisualMode[] = [
  'solid',
  'xray',
  'holographic',
  'operations',
  'reality'
];

export function App() {
  const { clock, state: temporal } = useTemporalClock();
  const [city, setCity] = useState<CityTarget>(CITY_TARGETS[0]);
  const [visualMode, setVisualMode] = useState<VisualMode>('solid');
  const [layers, setLayers] = useState<readonly LayerState[]>(INITIAL_LAYERS);
  const [selection, setSelection] = useState<SpatialFeatureSelection | null>(null);
  const [powerOverlay, setPowerOverlay] = useState<SpatialOverlaySnapshot | null>(null);
  const [powerOverlayError, setPowerOverlayError] = useState<string | null>(null);

  const temporalInstant = useMemo(
    () => ({
      iso: temporal.cursorIso,
      mode: temporal.mode,
      sourceTime: temporal.liveIso,
      scenarioId: temporal.scenarioId
    }),
    [temporal]
  );

  useEffect(() => {
    const controller = new AbortController();
    setPowerOverlay(null);
    setPowerOverlayError(null);

    void loadCityPowerOverlay(city.id, controller.signal)
      .then((snapshot) => setPowerOverlay(snapshot))
      .catch((error) => {
        if (controller.signal.aborted) return;
        setPowerOverlayError(error instanceof Error ? error.message : String(error));
      });

    return () => controller.abort();
  }, [city.id]);

  const toggleLayer = (id: string) => {
    setLayers((current) =>
      current.map((layer) =>
        layer.id === id ? { ...layer, visible: !layer.visible } : layer
      )
    );
  };

  return (
    <main className="aethergrid-app">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">Æ</span>
          <span>
            <strong>ÆTHERGRID</strong>
            <small>4D SPATIAL INTELLIGENCE</small>
          </span>
        </div>

        <div className="global-search" role="search">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Search world, city, infrastructure or asset"
            placeholder="Search world / city / infrastructure / asset"
          />
          <kbd>⌘ K</kbd>
        </div>

        <div className="live-cluster">
          <span className="status-dot live" />
          <span>LIVE WORLD</span>
          <strong>{new Date(temporal.liveIso).toLocaleTimeString()}</strong>
        </div>
      </header>

      <section className="operator-layout">
        <aside className="left-rail">
          <div className="rail-section">
            <span className="rail-kicker">WORLD</span>
            <h2>{city.name}</h2>
            <p>{city.district}</p>
          </div>

          <nav className="city-list" aria-label="City targets">
            {CITY_TARGETS.map((target) => (
              <button
                className={target.id === city.id ? 'active' : ''}
                key={target.id}
                type="button"
                onClick={() => setCity(target)}
              >
                <span>{target.name}</span>
                <small>{target.district}</small>
              </button>
            ))}
          </nav>

          <div className="rail-section layer-list">
            <span className="rail-kicker">LAYERS</span>
            {layers.map((layer) => (
              <label key={layer.id}>
                <input
                  type="checkbox"
                  checked={layer.visible}
                  onChange={() => toggleLayer(layer.id)}
                />
                <span>{layer.id.toUpperCase()}</span>
              </label>
            ))}
          </div>
        </aside>

        <section className="world-stage">
          <div className="stage-toolbar">
            <div>
              <span className="eyebrow">ACTIVE FRAME</span>
              <strong>{temporal.mode.toUpperCase()}</strong>
            </div>
            <div className="visual-modes" role="group" aria-label="Visual mode">
              {VISUAL_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={mode === visualMode ? 'active' : ''}
                  onClick={() => setVisualMode(mode)}
                >
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <SpatialViewport
            target={city}
            time={temporalInstant}
            layers={layers}
            visualMode={visualMode}
            overlays={powerOverlay ? [powerOverlay] : []}
            onSelection={setSelection}
          />

          <div className="source-badge" data-source-state={
            powerOverlayError ? 'unavailable' : powerOverlay?.live ? 'live' : powerOverlay ? 'fallback' : 'loading'
          }>
            <span>
              {powerOverlayError
                ? 'POWER DATA UNAVAILABLE'
                : powerOverlay?.live
                  ? 'OSM POWER · LIVE SOURCE'
                  : powerOverlay
                    ? 'POWER · FALLBACK'
                    : 'POWER · LOADING'}
            </span>
            <small>
              {powerOverlayError
                ? powerOverlayError
                : powerOverlay?.attribution ?? 'Source state pending'}
            </small>
          </div>

          <div className="scene-caption">
            <span>{city.name}</span>
            <strong>{city.latitude.toFixed(4)}°, {city.longitude.toFixed(4)}°</strong>
            <small>DOUBLE-CLICK A 3D FEATURE TO INSPECT</small>
          </div>
        </section>

        <aside className="intel-rail">
          <section className="intel-card">
            <div className="intel-head">
              <span className="status-dot live" />
              <span>
                <small>SPATIAL INTELLIGENCE</small>
                <strong>AUREN</strong>
              </span>
            </div>
            <p>Infrastructure, topology, terrain and live spatial context.</p>
          </section>

          <section className="intel-card">
            <div className="intel-head">
              <span className="status-dot quantum" />
              <span>
                <small>OPTIMIZATION</small>
                <strong>VÆLON</strong>
              </span>
            </div>
            <p>Scenario exploration, classical baselines and quantum-ready workloads.</p>
          </section>

          <section className="intel-card">
            <div className="intel-head">
              <span className="status-dot evidence" />
              <span>
                <small>EVIDENCE</small>
                <strong>SOLVÆR</strong>
              </span>
            </div>
            <p>Simulation, provenance, uncertainty and reproducible validation.</p>
          </section>

          <section className="selection-card">
            <span className="rail-kicker">SELECTED ENTITY</span>
            {selection ? (
              <>
                <h3>{selection.id}</h3>
                <p>{selection.kind}</p>
                <dl>
                  <div><dt>SOURCE</dt><dd>{selection.source ?? 'UNKNOWN'}</dd></div>
                  <div><dt>LAT</dt><dd>{selection.latitude?.toFixed(5) ?? '—'}</dd></div>
                  <div><dt>LON</dt><dd>{selection.longitude?.toFixed(5) ?? '—'}</dd></div>
                </dl>
              </>
            ) : (
              <p>No feature selected.</p>
            )}
          </section>
        </aside>
      </section>

      <TemporalRail clock={clock} state={temporal} />
    </main>
  );
}
