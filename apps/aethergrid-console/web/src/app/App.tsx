import { useEffect, useMemo, useRef, useState } from 'react';

import {
  AgentDock,
  type AgentHandoffRequest
} from '../components/AgentDock';
import { DataSourceBadge } from '../components/DataSourceBadge';
import { EvidencePanel } from '../components/EvidencePanel';
import { QuantumPanel } from '../components/QuantumPanel';
import { ProfileMenu } from '../components/ProfileMenu';
import { ScenarioPanel } from '../components/ScenarioPanel';
import { SpatialAnalysisPanel } from '../components/SpatialAnalysisPanel';
import { RuntimeDiagnosticsPanel } from '../components/RuntimeDiagnosticsPanel';
import { SpatialViewport } from '../components/SpatialViewport';
import { TemporalRail } from '../components/TemporalRail';
import { ViewBookmarksPanel } from '../components/ViewBookmarksPanel';
import { useAppearance } from '../hooks/use-appearance';
import { useOperatorShortcuts } from '../hooks/use-operator-shortcuts';
import { useTemporalClock } from '../hooks/use-temporal-clock';
import {
  weatherPhenomenon,
  type AtmosphericOverlaySnapshot
} from '../renderer/overlays/atmospheric-overlay';
import type { SpatialOverlaySnapshot } from '../renderer/overlays/spatial-overlay';
import type {
  LayerState,
  SpatialFeatureSelection,
  SpatialInteractionMode,
  SpatialSurfacePoint,
  SpatialTarget,
  TemporalInstant,
  VisualMode
} from '../renderer/spatial-renderer';
import { solarStateAt } from '../renderer/solar-position';
import {
  atmosphereToWindOverlay,
  loadCityEnvironment
} from '../services/city-environment';
import type { ScenarioVisualState } from '../services/scenario-client';
import {
  loadGlobalLiveContext,
  type GlobalLiveContext
} from '../services/global-live-context';
import {
  airQualityToOverlay,
  loadCityLiveContext,
  seismicToOverlay,
  type CityLiveSnapshot
} from '../services/city-live-context';
import {
  loadCitySpatialBundle,
  loadCoordinateSpatialBundle,
  type CityIdentitySummary
} from '../services/city-power-overlay';
import {
  measureSpatialPoints,
  measurementToOverlay,
  type SpatialMeasurement
} from '../services/spatial-analysis';
import { formatDataAge, formatSourceTime } from '../utils/data-freshness';
import type { SpatialViewBookmark } from '../services/view-bookmarks';
import {
  USE_CASE_PRESETS,
  type UseCaseId,
  type UseCasePreset
} from './use-case-presets';

interface CityLoadState {
  spatial: boolean;
  environment: boolean;
  liveContext: boolean;
}

interface CityTarget extends SpatialTarget {
  id: string;
  name: string;
  district: string;
  custom?: boolean;
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
  { id: 'world', visible: true },
  { id: 'terrain', visible: true },
  { id: 'buildings', visible: true },
  { id: 'roads', visible: true },
  { id: 'water', visible: true },
  { id: 'green', visible: true },
  { id: 'grid', visible: true },
  { id: 'weather', visible: true },
  { id: 'air', visible: true },
  { id: 'seismic', visible: true },
  { id: 'energy', visible: true }
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
  const appearance = useAppearance();
  const [city, setCity] = useState<CityTarget>(CITY_TARGETS[0]);
  const [scope, setScope] = useState<'world' | 'city'>('city');
  const [visualMode, setVisualMode] = useState<VisualMode>('solid');
  const [activeUseCase, setActiveUseCase] = useState<UseCaseId | null>(null);
  const [layers, setLayers] = useState<readonly LayerState[]>(INITIAL_LAYERS);
  const [selection, setSelection] = useState<SpatialFeatureSelection | null>(null);
  const [interactionMode, setInteractionMode] =
    useState<SpatialInteractionMode>('inspect');
  const [measurementPoints, setMeasurementPoints] =
    useState<readonly SpatialSurfacePoint[]>([]);
  const [measurementFrame, setMeasurementFrame] =
    useState<TemporalInstant | null>(null);
  const [powerOverlay, setPowerOverlay] = useState<SpatialOverlaySnapshot | null>(null);
  const [illuminationOverlay, setIlluminationOverlay] =
    useState<SpatialOverlaySnapshot | null>(null);
  const [semanticOverlays, setSemanticOverlays] = useState<readonly SpatialOverlaySnapshot[]>([]);
  const [cityIdentity, setCityIdentity] = useState<CityIdentitySummary | null>(null);
  const [powerOverlayError, setPowerOverlayError] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [intelOpen, setIntelOpen] = useState(false);
  const [intelWorkspace, setIntelWorkspace] = useState<
    'context' | 'analysis' | 'ai' | 'scenario' | 'quantum' | 'evidence' | 'system'
  >('context');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [atmosphere, setAtmosphere] = useState<AtmosphericOverlaySnapshot | null>(null);
  const [environmentError, setEnvironmentError] = useState<string | null>(null);
  const [liveContext, setLiveContext] = useState<CityLiveSnapshot | null>(null);
  const [globalLive, setGlobalLive] = useState<GlobalLiveContext | null>(null);
  const [liveContextError, setLiveContextError] = useState<string | null>(null);
  const [scenarioVisual, setScenarioVisual] = useState<ScenarioVisualState | null>(null);
  const [agentHandoff, setAgentHandoff] = useState<AgentHandoffRequest | null>(null);
  const [cityLoad, setCityLoad] = useState<CityLoadState>({
    spatial: true,
    environment: true,
    liveContext: true
  });

  const temporalInstant = useMemo(
    () => ({
      iso: temporal.cursorIso,
      mode: temporal.mode,
      sourceTime: temporal.liveIso,
      scenarioId: temporal.scenarioId,
      scenarioVisual
    }),
    [temporal, scenarioVisual]
  );

  const measurement = useMemo<SpatialMeasurement | null>(
    () =>
      measurementPoints.length >= 2
        ? measureSpatialPoints(measurementPoints[0], measurementPoints[1])
        : null,
    [measurementPoints]
  );

  const measurementOverlay = useMemo(
    () =>
      measurement && measurementFrame
        ? measurementToOverlay(measurement, measurementFrame)
        : null,
    [measurement, measurementFrame]
  );

  useEffect(() => {
    const controller = new AbortController();

    const refresh = () => {
      void loadGlobalLiveContext(controller.signal)
        .then(setGlobalLive)
        .catch(() => undefined);
    };

    refresh();
    const timer = globalThis.setInterval(refresh, 60_000);
    return () => {
      controller.abort();
      globalThis.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setPowerOverlay(null);
    setIlluminationOverlay(null);
    setSemanticOverlays([]);
    setCityIdentity(null);
    setPowerOverlayError(null);
    setAtmosphere(null);
    setEnvironmentError(null);
    setLiveContext(null);
    setLiveContextError(null);
    setMeasurementPoints([]);
    setMeasurementFrame(null);
    setCityLoad({
      spatial: true,
      environment: true,
      liveContext: true
    });

    const spatialRequest = city.custom
      ? loadCoordinateSpatialBundle(
          city.latitude,
          city.longitude,
          city.name,
          controller.signal
        )
      : loadCitySpatialBundle(city.id, controller.signal);

    void spatialRequest
      .then((bundle) => {
        setPowerOverlay(bundle.power);
        setIlluminationOverlay(bundle.illumination);
        setSemanticOverlays(bundle.semantics);
        setCityIdentity(bundle.identity);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setPowerOverlayError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCityLoad((current) => ({ ...current, spatial: false }));
        }
      });

    void loadCityEnvironment(city.latitude, city.longitude, controller.signal)
      .then((snapshot) => setAtmosphere(snapshot))
      .catch((error) => {
        if (controller.signal.aborted) return;
        setEnvironmentError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCityLoad((current) => ({ ...current, environment: false }));
        }
      });

    void loadCityLiveContext(city.latitude, city.longitude, controller.signal)
      .then((snapshot) => setLiveContext(snapshot))
      .catch((error) => {
        if (controller.signal.aborted) return;
        setLiveContextError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCityLoad((current) => ({ ...current, liveContext: false }));
        }
      });

    return () => controller.abort();
  }, [city.id, city.latitude, city.longitude]);

  useOperatorShortcuts({
    focusSearch: () => searchInputRef.current?.focus(),
    showWorld: () => setScope('world'),
    showCity: () => setScope('city'),
    goLive: () => clock.goLive(),
    toggleIntel: () => setIntelOpen((open) => !open)
  });

  const navigateSearch = (value: string) => {
    const query = value.trim();
    setSearchError(null);
    if (!query) return;

    const cityMatch = CITY_TARGETS.find((target) => {
      const normalized = query.toLocaleLowerCase();
      return (
        target.name.toLocaleLowerCase().includes(normalized) ||
        target.district.toLocaleLowerCase().includes(normalized)
      );
    });
    if (cityMatch) {
      setCity(cityMatch);
      setScope('city');
      setSearchValue('');
      return;
    }

    const coordinateMatch = query.match(
      /^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/u
    );
    if (coordinateMatch) {
      const latitude = Number(coordinateMatch[1]);
      const longitude = Number(coordinateMatch[2]);
      if (latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) {
        setCity({
          id: `coord-${latitude.toFixed(5)}-${longitude.toFixed(5)}`,
          name: 'COORDINATE',
          district: `${latitude.toFixed(5)}°, ${longitude.toFixed(5)}°`,
          latitude,
          longitude,
          rangeMeters: 5_200,
          pitchDegrees: -35,
          custom: true
        });
        setScope('city');
        setSearchValue('');
        return;
      }
    }

    setSearchError('Enter a supported city or latitude, longitude.');
  };

  const sceneTarget = useMemo<SpatialTarget>(() => {
    if (scope === 'world') {
      return {
        latitude: 20,
        longitude: 0,
        rangeMeters: 11_800_000,
        pitchDegrees: -88,
        headingDegrees: 0,
        journey: 'global'
      };
    }

    const identityMatches = cityIdentity?.cityId === city.id;
    return {
      ...city,
      headingDegrees: identityMatches
        ? cityIdentity.arrivalHeadingDegrees
        : city.headingDegrees ?? 0,
      journey: identityMatches ? 'direct' : 'full'
    };
  }, [scope, city, cityIdentity]);

  const worldOverlay = useMemo(
    () => (globalLive && temporal.mode === 'live' ? globalLive.overlay : null),
    [globalLive, temporal.mode]
  );

  const agentContext = useMemo(
    () => ({
      region: scope === 'world' ? 'Global' : city.name,
      view: visualMode,
      temporalMode: temporal.mode,
      temporalCursor: temporal.cursorIso,
      useCase: activeUseCase,
      coordinate:
        scope === 'world'
          ? {
              latitude: 20,
              longitude: 0
            }
          : {
              latitude: city.latitude,
              longitude: city.longitude
            },
      cityIdentity:
        scope === 'city' && cityIdentity ? { ...cityIdentity } : null,
      selectedEntity: selection
        ? {
            id: selection.id,
            kind: selection.kind,
            source: selection.source ?? null,
            latitude: selection.latitude ?? null,
            longitude: selection.longitude ?? null,
            heightMeters: selection.heightMeters ?? null,
            properties: selection.properties ?? null
          }
        : null,
      environment:
        scope === 'city' && atmosphere && temporal.mode === 'live'
          ? {
            sourceTime: atmosphere.sourceTime,
            live: atmosphere.live,
            current: atmosphere.current
            }
          : null,
      liveContext:
        scope === 'city' && liveContext && temporal.mode === 'live'
          ? {
            airQuality: liveContext.airQuality,
            seismic: {
              eventCount: liveContext.seismic.eventCount,
              maxMagnitude: liveContext.seismic.maxMagnitude,
              nearestDistanceKm: liveContext.seismic.nearestDistanceKm,
              live: liveContext.seismic.source.live
            }
            }
          : null
    }),
    [
      city,
      scope,
      visualMode,
      temporal.mode,
      temporal.cursorIso,
      activeUseCase,
      cityIdentity,
      selection,
      atmosphere,
      liveContext
    ]
  );

  const citySolar = useMemo(
    () => solarStateAt(temporal.cursorIso, city.latitude, city.longitude),
    [temporal.cursorIso, city.latitude, city.longitude]
  );

  const activeIllumination = useMemo(
    () =>
      scope === 'city' &&
      illuminationOverlay &&
      (citySolar.phase === 'twilight' || citySolar.phase === 'night')
        ? illuminationOverlay
        : null,
    [scope, illuminationOverlay, citySolar.phase]
  );

  const windOverlay = useMemo(
    () =>
      scope === 'city' && atmosphere && temporal.mode === 'live'
        ? atmosphereToWindOverlay(atmosphere)
        : null,
    [scope, atmosphere, temporal.mode]
  );

  const seismicOverlay = useMemo(
    () =>
      scope === 'city' && liveContext && temporal.mode === 'live'
        ? seismicToOverlay(liveContext)
        : null,
    [scope, liveContext, temporal.mode]
  );

  const airQualityOverlay = useMemo(
    () =>
      scope === 'city' && liveContext && temporal.mode === 'live'
        ? airQualityToOverlay(liveContext, {
            windSpeedKph: atmosphere?.current?.windSpeedKph,
            windDirectionDegrees: atmosphere?.current?.windDirectionDegrees
          })
        : null,
    [scope, liveContext, temporal.mode, atmosphere]
  );

  const activeOverlays = useMemo(
    () =>
      (scope === 'world'
        ? [worldOverlay]
        : [
            ...semanticOverlays,
            activeIllumination,
            powerOverlay,
            windOverlay,
            seismicOverlay,
            measurementOverlay
          ]
      ).filter(
        (snapshot): snapshot is SpatialOverlaySnapshot => Boolean(snapshot)
      ),
    [
      scope,
      worldOverlay,
      semanticOverlays,
      activeIllumination,
      powerOverlay,
      windOverlay,
      seismicOverlay,
      measurementOverlay
    ]
  );

  const handleSpatialSelection = (next: SpatialFeatureSelection | null) => {
    setSelection(next);

    if (scope !== 'world' || next?.kind !== 'city') return;
    const cityId =
      typeof next.properties?.cityId === 'string'
        ? next.properties.cityId
        : null;
    if (!cityId) return;

    const target = CITY_TARGETS.find((candidate) => candidate.id === cityId);
    if (!target) return;

    setCity(target);
    setScope('city');
  };

  const handleSurfacePoint = (point: SpatialSurfacePoint | null) => {
    if (!point) return;

    setSelection(null);
    if (measurementPoints.length >= 2) {
      setMeasurementPoints([point]);
      setMeasurementFrame({ ...temporalInstant });
      return;
    }

    if (measurementPoints.length === 0) {
      setMeasurementFrame({ ...temporalInstant });
    }
    setMeasurementPoints([...measurementPoints, point]);
  };

  const clearMeasurement = () => {
    setMeasurementPoints([]);
    setMeasurementFrame(null);
  };

  const changeInteractionMode = (mode: SpatialInteractionMode) => {
    setInteractionMode(mode);
    if (mode === 'measure') {
      setIntelWorkspace('analysis');
      setIntelOpen(true);
    }
  };

  const layerCounts = useMemo(() => {
    const semantic = new Map(semanticOverlays.map((snapshot) => [snapshot.layerId, snapshot]));
    const countOverlay = (id: string) => {
      const snapshot = semantic.get(id);
      if (!snapshot) return 0;
      return (
        snapshot.nodes.length +
        snapshot.edges.length +
        (snapshot.areas?.length ?? 0)
      );
    };

    return {
      world: globalLive?.overlay.nodes.length ?? 0,
      terrain: scope === 'city' ? 1 : 0,
      buildings: scope === 'city' ? cityIdentity?.buildingCount ?? 0 : 0,
      roads: scope === 'city' ? countOverlay('roads') : 0,
      water: scope === 'city' ? countOverlay('water') : 0,
      green: scope === 'city' ? countOverlay('green') : 0,
      grid: 1,
      weather:
        scope === 'city' && temporal.mode === 'live'
          ? (windOverlay?.edges.length ?? (atmosphere?.current ? 1 : 0))
          : 0,
      air:
        scope === 'city' &&
        temporal.mode === 'live' &&
        liveContext?.airQuality.current?.usAqi != null
          ? 1
          : 0,
      seismic:
        temporal.mode !== 'live'
          ? 0
          : scope === 'world'
            ? globalLive?.earthquakeCount ?? 0
            : liveContext?.seismic.eventCount ?? 0,
      energy:
        scope === 'city' && powerOverlay
          ? powerOverlay.nodes.length + powerOverlay.edges.length
          : 0
    } as Record<string, number>;
  }, [
    semanticOverlays,
    globalLive,
    scope,
    cityIdentity,
    atmosphere,
    liveContext,
    temporal.mode,
    windOverlay,
    powerOverlay
  ]);

  const currentBookmark = useMemo(
    () => ({
      scope,
      target:
        scope === 'world'
          ? {
              ...sceneTarget,
              id: 'world',
              name: 'GLOBAL',
              district: 'God’s-eye live world'
            }
          : {
              ...city,
              headingDegrees: sceneTarget.headingDegrees,
              journey: sceneTarget.journey
            },
      visualMode,
      temporalMode: temporal.mode,
      cursorIso: temporal.cursorIso,
      scenarioId: temporal.scenarioId,
      scenarioVisual,
      useCase: activeUseCase,
      layers
    }),
    [
      scope,
      sceneTarget,
      city,
      visualMode,
      temporal.mode,
      temporal.cursorIso,
      temporal.scenarioId,
      scenarioVisual,
      activeUseCase,
      layers
    ]
  );

  const restoreBookmark = (bookmark: SpatialViewBookmark) => {
    setScope(bookmark.scope);
    setVisualMode(bookmark.visualMode);
    setLayers(bookmark.layers.map((layer) => ({ ...layer })));
    setActiveUseCase(bookmark.useCase);
    setScenarioVisual(bookmark.scenarioVisual ?? null);

    if (bookmark.scope === 'city') {
      setCity({
        id: bookmark.target.id || 'saved-coordinate',
        name: bookmark.target.name || 'SAVED VIEW',
        district: bookmark.target.district || 'Saved spatial target',
        latitude: bookmark.target.latitude,
        longitude: bookmark.target.longitude,
        rangeMeters: bookmark.target.rangeMeters,
        heightMeters: bookmark.target.heightMeters,
        headingDegrees: bookmark.target.headingDegrees,
        pitchDegrees: bookmark.target.pitchDegrees,
        custom: bookmark.target.custom === true
      });
    }

    if (bookmark.temporalMode === 'live') {
      clock.goLive();
    } else if (bookmark.temporalMode === 'scenario') {
      clock.setMode('scenario', bookmark.scenarioId ?? null);
      clock.scrub(bookmark.cursorIso, 'scenario');
    } else {
      clock.scrub(bookmark.cursorIso, bookmark.temporalMode);
    }
  };

  const applyUseCase = (preset: UseCasePreset) => {
    setScope('city');
    setActiveUseCase(preset.id);
    setVisualMode(preset.visualMode);
    setLayers((current) =>
      current.map((layer) => ({
        ...layer,
        visible: preset.layers.includes(layer.id)
      }))
    );
  };

  const toggleLayer = (id: string) => {
    setActiveUseCase(null);
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

        <form
          className="global-search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            navigateSearch(searchValue);
          }}
        >
          <span aria-hidden="true">⌕</span>
          <input
            ref={searchInputRef}
            aria-label="Search city or geographic coordinate"
            placeholder="City or lat, lon"
            value={searchValue}
            onChange={(event) => setSearchValue(event.currentTarget.value)}
          />
          <button type="submit">GO</button>
          <kbd aria-hidden="true">⌘K</kbd>
          {searchError ? <span className="search-error">{searchError}</span> : null}
        </form>

        <div className="topbar-actions">
          <button
            className="intel-toggle"
            type="button"
            aria-expanded={intelOpen}
            aria-controls="aethergrid-intelligence-rail"
            onClick={() => setIntelOpen((open) => !open)}
          >
            INTEL
          </button>
          <button
            className="appearance-button"
            type="button"
            onClick={appearance.cycle}
            aria-label={`Appearance: ${appearance.mode}. Select to cycle theme.`}
          >
            <span aria-hidden="true">{appearance.resolved === 'light' ? '☀' : '◐'}</span>
            <strong>{appearance.mode.toUpperCase()}</strong>
          </button>
          <ProfileMenu />
          <div className="live-cluster">
            <span className="status-dot live" />
            <span>LIVE WORLD</span>
            <strong>{new Date(temporal.liveIso).toLocaleTimeString()}</strong>
          </div>
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
                onClick={() => {
                  setCity(target);
                  setScope('city');
                }}
              >
                <span>{target.name}</span>
                <small>{target.district}</small>
              </button>
            ))}
          </nav>

          <section className="use-case-presets">
            <span className="rail-kicker">OPERATION MODE</span>
            <div className="use-case-grid">
              {USE_CASE_PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset.id}
                  className={activeUseCase === preset.id ? 'active' : ''}
                  onClick={() => applyUseCase(preset)}
                  title={preset.description}
                >
                  <strong>{preset.label}</strong>
                  <small>{preset.visualMode.toUpperCase()}</small>
                </button>
              ))}
            </div>
            <p>
              {activeUseCase
                ? USE_CASE_PRESETS.find((preset) => preset.id === activeUseCase)?.description
                : 'CUSTOM · manually controlled layers and view'}
            </p>
          </section>

          <ViewBookmarksPanel
            current={currentBookmark}
            onRestore={restoreBookmark}
          />

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
                <em>{layerCounts[layer.id] ?? 0}</em>
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
            <div className="stage-controls">
              <div className="scope-modes" role="group" aria-label="Spatial scope">
                <button
                  type="button"
                  className={scope === 'world' ? 'active' : ''}
                  onClick={() => {
                    setActiveUseCase(null);
                    setScope('world');
                  }}
                >
                  WORLD
                </button>
                <button
                  type="button"
                  className={scope === 'city' ? 'active' : ''}
                  onClick={() => setScope('city')}
                >
                  CITY
                </button>
              </div>
              <div className="interaction-modes" role="group" aria-label="Spatial interaction">
                {(['inspect', 'measure'] as const).map((mode) => (
                  <button
                    type="button"
                    key={mode}
                    className={interactionMode === mode ? 'active' : ''}
                    onClick={() => changeInteractionMode(mode)}
                  >
                    {mode.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="visual-modes" role="group" aria-label="Visual mode">
              {VISUAL_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={mode === visualMode ? 'active' : ''}
                  onClick={() => {
                    setActiveUseCase(null);
                    setVisualMode(mode);
                  }}
                >
                  {mode.toUpperCase()}
                </button>
              ))}
              </div>
            </div>
          </div>

          <SpatialViewport
            target={sceneTarget}
            time={temporalInstant}
            layers={layers}
            visualMode={visualMode}
            overlays={activeOverlays}
            atmosphere={
              scope === 'city' && temporal.mode === 'live' ? atmosphere : null
            }
            airQuality={airQualityOverlay}
            interactionMode={interactionMode}
            onSelection={handleSpatialSelection}
            onSurfacePoint={handleSurfacePoint}
          />

          {scope === 'city' && Object.values(cityLoad).some(Boolean) ? (
            <div className="city-load-status" aria-live="polite">
              <div>
                <span>LOADING {city.name}</span>
                <strong>
                  {Object.values(cityLoad).filter(Boolean).length} SOURCES PENDING
                </strong>
              </div>
              <ul>
                <li data-ready={!cityLoad.spatial}>GEOMETRY</li>
                <li data-ready={!cityLoad.environment}>ATMOSPHERE</li>
                <li data-ready={!cityLoad.liveContext}>LIVE CONTEXT</li>
              </ul>
            </div>
          ) : null}

          {activeIllumination ? (
            <div className="illumination-scene-badge">
              <span>URBAN ILLUMINATION</span>
              <strong>
                {activeIllumination.nodes.length} MAPPED BUILDING POINTS
              </strong>
              <small>PRESENTATION ONLY · NOT MEASURED WINDOW LIGHTS</small>
            </div>
          ) : null}

          {temporal.mode === 'scenario' && scenarioVisual ? (
            <div className="scenario-scene-badge">
              <span>MODELED SCENARIO · SOURCE DATA UNCHANGED</span>
              <strong>{scenarioVisual.stressFactor.toFixed(2)}× NETWORK STRESS</strong>
              <small>DIM = SOURCE BASELINE · BRIGHT = MODELED SCENARIO</small>
            </div>
          ) : null}

          <DataSourceBadge
            label={
              scope === 'world'
                ? 'GLOBAL LIVE'
                : powerOverlayError
                  ? 'POWER DATA'
                  : powerOverlay?.live
                    ? 'OSM POWER'
                    : 'POWER'
            }
            state={
              scope === 'world'
                ? globalLive?.overlay.live
                  ? 'live'
                  : globalLive
                    ? 'fallback'
                    : 'loading'
                : powerOverlayError
                  ? 'unavailable'
                  : powerOverlay?.live
                    ? 'live'
                    : powerOverlay
                      ? 'fallback'
                      : 'loading'
            }
            attribution={
              scope === 'world'
                ? globalLive?.overlay.attribution
                : powerOverlay?.attribution
            }
            sourceTime={
              scope === 'world'
                ? globalLive?.overlay.sourceTime
                : powerOverlay?.sourceTime
            }
            fetchedAt={
              scope === 'world'
                ? globalLive?.overlay.fetchedAt
                : powerOverlay?.fetchedAt
            }
            error={scope === 'world' ? null : powerOverlayError}
          />

          {activeUseCase ? (
            <div className="use-case-scene-badge">
              <span>OPERATION MODE</span>
              <strong>
                {USE_CASE_PRESETS.find((preset) => preset.id === activeUseCase)?.label}
              </strong>
            </div>
          ) : null}

          <div className="scene-caption">
            <span>{scope === 'world' ? 'GLOBAL GOD’S-EYE' : city.name}</span>
            <strong>
              {scope === 'world'
                ? `${globalLive?.cityCount ?? CITY_TARGETS.length} CITIES · ${globalLive?.earthquakeCount ?? 0} SEISMIC EVENTS`
                : `${city.latitude.toFixed(4)}°, ${city.longitude.toFixed(4)}°`}
            </strong>
            <small>
              {interactionMode === 'measure'
                ? 'SELECT TWO GEOGRAPHIC POINTS TO MEASURE'
                : 'CLICK OR TAP A 3D FEATURE TO INSPECT'}
            </small>
          </div>
        </section>

        <aside
          id="aethergrid-intelligence-rail"
          className={intelOpen ? 'intel-rail open' : 'intel-rail'}
          data-workspace={intelWorkspace}
        >
          <div className="intel-mobile-head">
            <span>INTELLIGENCE</span>
            <button type="button" onClick={() => setIntelOpen(false)} aria-label="Close intelligence drawer">
              ×
            </button>
          </div>
          <nav className="intel-workspace-tabs" aria-label="Intelligence workspace">
            {[
              ['context', 'CONTEXT'],
              ['analysis', 'ANALYSIS'],
              ['ai', 'AI'],
              ['scenario', 'SCENARIO'],
              ['quantum', 'QUANTUM'],
              ['evidence', 'EVIDENCE'],
              ['system', 'SYSTEM']
            ].map(([id, label]) => (
              <button
                type="button"
                key={id}
                className={intelWorkspace === id ? 'active' : ''}
                aria-pressed={intelWorkspace === id}
                onClick={() =>
                  setIntelWorkspace(
                    id as
                      | 'context'
                      | 'analysis'
                      | 'ai'
                      | 'scenario'
                      | 'quantum'
                      | 'evidence'
                      | 'system'
                  )
                }
              >
                {label}
              </button>
            ))}
          </nav>
          <section className="identity-card intel-context-panel">
            <div className="identity-head">
              <span>
                <small>CITY IDENTITY</small>
                <strong>{city.name}</strong>
              </span>
              <span className={cityIdentity?.live ? 'status-dot live' : 'status-dot'} />
            </div>
            <div className="identity-metrics">
              <span>
                <small>BUILDINGS</small>
                <strong>{cityIdentity?.buildingCount?.toLocaleString() ?? '—'}</strong>
              </span>
              <span>
                <small>SKYLINE MAX</small>
                <strong>
                  {cityIdentity?.maxHeightM ? `${cityIdentity.maxHeightM.toFixed(0)}m` : '—'}
                </strong>
              </span>
              <span>
                <small>P95</small>
                <strong>
                  {cityIdentity?.p95HeightM ? `${cityIdentity.p95HeightM.toFixed(0)}m` : '—'}
                </strong>
              </span>
            </div>
            <div className="identity-quality">
              <span>HEIGHT COVERAGE</span>
              <strong>
                {cityIdentity
                  ? `${cityIdentity.sourceBackedHeightCoveragePercent.toFixed(1)}%`
                  : '—'}
              </strong>
            </div>
            <div className="identity-quality">
              <span>ARRIVAL HEADING</span>
              <strong>
                {cityIdentity
                  ? `${cityIdentity.arrivalHeadingDegrees.toFixed(0)}°`
                  : '—'}
              </strong>
            </div>
            <div className="identity-landmarks">
              {(cityIdentity?.namedStructures ?? []).slice(0, 4).map((structure) => (
                <div key={structure.id}>
                  <span>{structure.name}</span>
                  <small>{structure.heightM ? `${structure.heightM.toFixed(0)}m` : 'MAPPED'}</small>
                </div>
              ))}
              {!cityIdentity?.namedStructures?.length ? <p>Mapped identity anchors pending.</p> : null}
            </div>
          </section>

          <section className="weather-card intel-context-panel" data-source-state={
            environmentError ? 'unavailable' : atmosphere?.live ? 'live' : atmosphere ? 'fallback' : 'loading'
          }>
            <div className="weather-card-head">
              <span>
                <small>ATMOSPHERE</small>
                <strong>
                  {temporal.mode === 'live'
                    ? weatherPhenomenon(atmosphere).toUpperCase()
                    : `${temporal.mode.toUpperCase()} · DATA PENDING`}
                </strong>
              </span>
              <span className={atmosphere?.live ? 'status-dot live' : 'status-dot'} />
            </div>
            <div className="weather-metrics">
              <span>
                <small>TEMP</small>
                <strong>{atmosphere?.current?.temperatureC != null ? `${atmosphere.current.temperatureC.toFixed(1)}°C` : '—'}</strong>
              </span>
              <span>
                <small>WIND</small>
                <strong>{atmosphere?.current?.windSpeedKph != null ? `${atmosphere.current.windSpeedKph.toFixed(0)} km/h` : '—'}</strong>
              </span>
              <span>
                <small>CLOUD</small>
                <strong>{atmosphere?.current?.cloudCoverPercent != null ? `${atmosphere.current.cloudCoverPercent.toFixed(0)}%` : '—'}</strong>
              </span>
            </div>
            <p>
              {environmentError
                ? environmentError
                : temporal.mode !== 'live'
                  ? 'Current weather visuals are hidden until a source supports the selected time.'
                  : atmosphere?.attribution ?? 'Weather source pending'}
            </p>
            <div className="weather-source-meta">
              <span>{formatSourceTime(atmosphere?.sourceTime, atmosphere?.timezone)}</span>
              <span>FETCHED {formatDataAge(atmosphere?.fetchedAt)}</span>
            </div>
          </section>

          <section className="live-context-card intel-context-panel">
            <div className="live-context-head">
              <span>
                <small>AIR QUALITY</small>
                <strong>
                  {temporal.mode === 'live'
                    ? liveContext?.airQuality.current?.usAqi != null
                      ? `AQI ${liveContext.airQuality.current.usAqi.toFixed(0)}`
                      : 'AQI —'
                    : `${temporal.mode.toUpperCase()} · DATA PENDING`}
                </strong>
              </span>
              <span
                className={
                  temporal.mode === 'live' && liveContext?.airQuality.source.live
                    ? 'status-dot live'
                    : 'status-dot'
                }
              />
            </div>
            <div className="live-context-metrics">
              <span>
                <small>PM2.5</small>
                <strong>
                  {temporal.mode === 'live' && liveContext?.airQuality.current?.pm25UgM3 != null
                    ? `${liveContext.airQuality.current.pm25UgM3.toFixed(1)}`
                    : '—'}
                </strong>
              </span>
              <span>
                <small>SEISMIC</small>
                <strong>
                  {temporal.mode === 'live'
                    ? `${liveContext?.seismic.eventCount ?? 0} EVENTS`
                    : 'HIDDEN'}
                </strong>
              </span>
              <span>
                <small>MAX M</small>
                <strong>
                  {temporal.mode === 'live' && liveContext?.seismic.maxMagnitude != null
                    ? liveContext.seismic.maxMagnitude.toFixed(1)
                    : '—'}
                </strong>
              </span>
            </div>
            <p>
              {liveContextError
                ? liveContextError
                : temporal.mode !== 'live'
                  ? 'Current AQI and seismic context are hidden outside LIVE mode.'
                  : liveContext?.airQuality.source.attribution ||
                    liveContext?.seismic.source.attribution ||
                    'Live context pending'}
            </p>
            <div className="weather-source-meta">
              <span>
                {formatSourceTime(
                  liveContext?.airQuality.source.modelTime ||
                    liveContext?.seismic.source.generatedAt
                )}
              </span>
              <span>
                FETCHED {formatDataAge(
                  liveContext?.airQuality.source.fetchedAt ||
                    liveContext?.seismic.source.fetchedAt
                )}
              </span>
            </div>
          </section>

          <div className="intel-workspace intel-analysis">
            <SpatialAnalysisPanel
              mode={interactionMode}
              points={measurementPoints}
              measurement={measurement}
              onModeChange={changeInteractionMode}
              onReset={clearMeasurement}
            />
          </div>
          <div className="intel-workspace intel-ai">
            <AgentDock context={agentContext} handoff={agentHandoff} />
          </div>
          <div className="intel-workspace intel-scenario">
            <ScenarioPanel
            activeTemporalMode={temporal.mode}
            onScenarioApplied={(scenarioId) => clock.setMode('scenario', scenarioId)}
              onReturnLive={() => clock.goLive()}
            />
          </div>
          <div className="intel-workspace intel-quantum">
            <QuantumPanel />
          </div>
          <div className="intel-workspace intel-evidence">
            <EvidencePanel />
          </div>
          <div className="intel-workspace intel-system">
            <RuntimeDiagnosticsPanel />
          </div>

          <section className="intel-card intel-context-panel">
            <div className="intel-head">
              <span className="status-dot live" />
              <span>
                <small>SPATIAL INTELLIGENCE</small>
                <strong>AUREN</strong>
              </span>
            </div>
            <p>Infrastructure, topology, terrain and live spatial context.</p>
          </section>

          <section className="intel-card intel-context-panel">
            <div className="intel-head">
              <span className="status-dot quantum" />
              <span>
                <small>OPTIMIZATION</small>
                <strong>VÆLON</strong>
              </span>
            </div>
            <p>Scenario exploration, classical baselines and quantum-ready workloads.</p>
          </section>

          <section className="intel-card intel-context-panel">
            <div className="intel-head">
              <span className="status-dot evidence" />
              <span>
                <small>EVIDENCE</small>
                <strong>SOLVÆR</strong>
              </span>
            </div>
            <p>Simulation, provenance, uncertainty and reproducible validation.</p>
          </section>

          <section className="selection-card intel-context-panel">
            <span className="rail-kicker">SELECTED ENTITY</span>
            {selection ? (
              <>
                <h3>{selection.id}</h3>
                <p>{selection.kind}</p>
                <small className="selection-hint">ESC TO CLEAR</small>
                <dl>
                  <div><dt>SOURCE</dt><dd>{selection.source ?? 'UNKNOWN'}</dd></div>
                  <div>
                    <dt>LAYER</dt>
                    <dd>{String(selection.properties?.layerId ?? '—')}</dd>
                  </div>
                  <div>
                    <dt>STATE</dt>
                    <dd>
                      {selection.properties?.live === true
                        ? 'LIVE'
                        : selection.properties?.fallback === true
                          ? 'FALLBACK'
                          : 'RECORDED'}
                    </dd>
                  </div>
                  <div>
                    <dt>SOURCE TIME</dt>
                    <dd>{String(selection.properties?.sourceTime ?? '—')}</dd>
                  </div>
                  <div>
                    <dt>FETCHED</dt>
                    <dd>{String(selection.properties?.fetchedAt ?? '—')}</dd>
                  </div>
                  <div><dt>LAT</dt><dd>{selection.latitude?.toFixed(5) ?? '—'}</dd></div>
                  <div><dt>LON</dt><dd>{selection.longitude?.toFixed(5) ?? '—'}</dd></div>
                </dl>
                <button
                  className="selection-ai-action"
                  type="button"
                  onClick={() => {
                    const layer = String(selection.properties?.layerId ?? 'unknown layer');
                    const sourceTime = String(selection.properties?.sourceTime ?? 'unknown');
                    const sourceState =
                      selection.properties?.live === true
                        ? 'live'
                        : selection.properties?.fallback === true
                          ? 'fallback'
                          : 'recorded';

                    setAgentHandoff((current) => ({
                      id: (current?.id ?? 0) + 1,
                      agent: 'AUREN',
                      prompt:
                        `Analyze the selected ${selection.kind} "${selection.id}" in ${layer}. ` +
                        `Its source state is ${sourceState} and source time is ${sourceTime}. ` +
                        'Use the active spatial context and evidence receipts. Separate observed facts, modeled context, assumptions, uncertainty, and suggested operator follow-up.'
                    }));
                    setIntelWorkspace('ai');
                    setIntelOpen(true);
                  }}
                >
                  ANALYZE WITH AI
                </button>
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
