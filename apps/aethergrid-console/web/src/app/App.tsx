import { useEffect, useMemo, useRef, useState } from 'react';

import {
  AgentDock,
  type AgentHandoffRequest
} from '../components/AgentDock';
import { DataSourceBadge } from '../components/DataSourceBadge';
import { EntityDossierPanel } from '../components/EntityDossierPanel';
import { EvidencePanel } from '../components/EvidencePanel';
import { OperationalDataPanel } from '../components/OperationalDataPanel';
import { OperatorSessionPanel } from '../components/OperatorSessionPanel';
import { QuantumPanel } from '../components/QuantumPanel';
import { ProfileMenu } from '../components/ProfileMenu';
import { ScenarioComposerPanel } from '../components/ScenarioComposerPanel';
import { ScenarioPanel } from '../components/ScenarioPanel';
import { SpatialAnalysisPanel } from '../components/SpatialAnalysisPanel';
import { SpatialComparisonPanel } from '../components/SpatialComparisonPanel';
import { SpatialIncidentPanel } from '../components/SpatialIncidentPanel';
import { SpatialInvestigationBoard } from '../components/SpatialInvestigationBoard';
import { SpatialWorksetGeometryPanel } from '../components/SpatialWorksetGeometryPanel';
import { SpatialWorksetPanel } from '../components/SpatialWorksetPanel';
import { RuntimeDiagnosticsPanel } from '../components/RuntimeDiagnosticsPanel';
import { SpatialViewport } from '../components/SpatialViewport';
import { TemporalEventNavigator } from '../components/TemporalEventNavigator';
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
  loadCityEnvironment,
  loadCityEnvironmentForecast,
  selectCityEnvironmentForecast,
  type AtmosphericForecastSeries
} from '../services/city-environment';
import type { ScenarioVisualState } from '../services/scenario-client';
import {
  compareOperatorScenario,
  loadOperatorScenarios,
  OPERATOR_SCENARIOS_EVENT,
  operatorScenarioToOverlay,
  type OperatorScenario
} from '../services/operator-scenario';
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
import {
  buildSpatialEntityDossier,
  freezeSpatialEntityDossier,
  type SpatialEntityDossier
} from '../services/spatial-entity-dossier';
import { bindSpatialSelectionIdentity } from '../services/spatial-entity-identity';
import {
  loadSpatialIncidents,
  saveSpatialIncidents,
  spatialIncidentsToOverlay,
  type SpatialIncident
} from '../services/spatial-incidents';
import {
  type OperatorSessionWorkspace,
  type OperatorWorkspaceSession
} from '../services/operator-session';
import {
  captureSpatialObservation,
  compareSpatialObservations,
  type SpatialObservation
} from '../services/spatial-comparison';
import {
  loadSpatialWorkset,
  saveSpatialWorkset,
  SPATIAL_WORKSET_EVENT,
  type SpatialWorksetItem
} from '../services/spatial-workset';
import {
  buildSpatialWorksetGeometry,
  spatialWorksetGeometryToOverlay,
  type SpatialWorksetGeometrySummary
} from '../services/spatial-workset-geometry';
import {
  buildTemporalNavigatorEvents,
  type TemporalNavigatorEvent
} from '../services/temporal-event-navigator';
import type { EvidenceRecord } from '../services/evidence-client';
import type { SpatialInvestigation } from '../services/spatial-investigation';
import {
  loadNwsHazards,
  type NwsHazardContext
} from '../services/nws-hazards';
import {
  loadGtfsTransit,
  type GtfsTransitContext
} from '../services/gtfs-transit';
import {
  loadNoaaHydrologyContext,
  type NoaaHydrologyContext
} from '../services/noaa-hydrology';
import {
  loadOperationalSourceBindings,
  OPERATIONAL_SOURCE_BINDINGS_EVENT,
  type OperationalSourceBindings
} from '../services/operational-source-bindings';
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
  { id: 'hazards', visible: true },
  { id: 'transit', visible: true },
  { id: 'hydrology', visible: true },
  { id: 'energy', visible: true },
  { id: 'annotations', visible: true },
  { id: 'workset-analysis', visible: true },
  { id: 'scenario-model', visible: true }
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
  const [observationA, setObservationA] =
    useState<SpatialObservation | null>(null);
  const [observationB, setObservationB] =
    useState<SpatialObservation | null>(null);
  const [frozenDossier, setFrozenDossier] =
    useState<SpatialEntityDossier | null>(null);
  const [spatialIncidents, setSpatialIncidents] =
    useState<SpatialIncident[]>(loadSpatialIncidents);
  const [spatialWorkset, setSpatialWorkset] =
    useState<SpatialWorksetItem[]>(loadSpatialWorkset);
  const [pendingSessionRestore, setPendingSessionRestore] =
    useState<OperatorWorkspaceSession | null>(null);
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
    'context' | 'operations' | 'analysis' | 'ai' | 'scenario' | 'quantum' | 'evidence' | 'system'
  >('context');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [atmosphere, setAtmosphere] = useState<AtmosphericOverlaySnapshot | null>(null);
  const [environmentError, setEnvironmentError] = useState<string | null>(null);
  const [forecastSeries, setForecastSeries] =
    useState<AtmosphericForecastSeries | null>(null);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [liveContext, setLiveContext] = useState<CityLiveSnapshot | null>(null);
  const [hazardContext, setHazardContext] = useState<NwsHazardContext | null>(null);
  const [hazardError, setHazardError] = useState<string | null>(null);
  const [transitContext, setTransitContext] = useState<GtfsTransitContext | null>(null);
  const [transitError, setTransitError] = useState<string | null>(null);
  const [operationalBindings, setOperationalBindings] =
    useState<OperationalSourceBindings>({
      gaugeId: null,
      energyRegion: null,
      updatedAt: null
    });
  const [hydrologyContext, setHydrologyContext] =
    useState<NoaaHydrologyContext | null>(null);
  const [hydrologyError, setHydrologyError] = useState<string | null>(null);
  const [globalLive, setGlobalLive] = useState<GlobalLiveContext | null>(null);
  const [liveContextError, setLiveContextError] = useState<string | null>(null);
  const [scenarioVisual, setScenarioVisual] =
    useState<ScenarioVisualState | null>(null);
  const [activeOperatorScenario, setActiveOperatorScenario] =
    useState<OperatorScenario | null>(null);
  const [savedOperatorScenarios, setSavedOperatorScenarios] =
    useState<OperatorScenario[]>(loadOperatorScenarios);
  const [agentHandoff, setAgentHandoff] = useState<AgentHandoffRequest | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceRecord | null>(null);
  const [cityLoad, setCityLoad] = useState<CityLoadState>({
    spatial: true,
    environment: true,
    liveContext: true
  });

  const operationalBindingScope = useMemo(
    () => `coord:${city.latitude.toFixed(5)}:${city.longitude.toFixed(5)}`,
    [city.latitude, city.longitude]
  );

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

  const forecastAtmosphere = useMemo(
    () =>
      temporal.mode === 'forecast' && forecastSeries
        ? selectCityEnvironmentForecast(
            forecastSeries,
            temporal.cursorIso,
            atmosphere?.utcOffsetSeconds ?? 0
          )
        : null,
    [
      temporal.mode,
      temporal.cursorIso,
      forecastSeries,
      atmosphere?.utcOffsetSeconds
    ]
  );

  const activeAtmosphere =
    temporal.mode === 'live'
      ? atmosphere
      : temporal.mode === 'forecast'
        ? forecastAtmosphere
        : null;

  const activeAtmosphereError =
    temporal.mode === 'live'
      ? environmentError
      : temporal.mode === 'forecast'
        ? forecastError
        : null;

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
  const incidentOverlay = useMemo(
    () => spatialIncidentsToOverlay(spatialIncidents, temporalInstant),
    [spatialIncidents, temporalInstant]
  );
  const worksetGeometry = useMemo(
    () => buildSpatialWorksetGeometry(spatialWorkset),
    [spatialWorkset]
  );

  const worksetGeometryOverlay = useMemo(
    () => spatialWorksetGeometryToOverlay(worksetGeometry, temporalInstant),
    [worksetGeometry, temporalInstant]
  );

  const operatorScenarioOverlay = useMemo(
    () =>
      activeOperatorScenario
        ? operatorScenarioToOverlay(
            activeOperatorScenario,
            worksetGeometry,
            temporalInstant
          )
        : null,
    [activeOperatorScenario, worksetGeometry, temporalInstant]
  );

  const spatialComparison = useMemo(
    () =>
      observationA && observationB
        ? compareSpatialObservations(observationA, observationB)
        : null,
    [observationA, observationB]
  );

  const temporalEvents = useMemo(
    () =>
      buildTemporalNavigatorEvents(
        spatialIncidents,
        observationA,
        observationB,
        savedOperatorScenarios
      ),
    [spatialIncidents, observationA, observationB, savedOperatorScenarios]
  );

  const entityDossier = useMemo(
    () =>
      selection
        ? buildSpatialEntityDossier({
            region: scope === 'world' ? 'GLOBAL' : city.name,
            temporal: temporalInstant,
            visualMode,
            useCase: activeUseCase,
            selection,
            measurement,
            observationA,
            observationB,
            cityIdentity: scope === 'city' ? cityIdentity : null,
            atmosphere: scope === 'city' ? activeAtmosphere : null,
            liveContext:
              scope === 'city' && temporal.mode === 'live'
                ? liveContext
                : null
          })
        : null,
    [
      selection,
      scope,
      city.name,
      temporalInstant,
      temporal.mode,
      visualMode,
      activeUseCase,
      measurement,
      observationA,
      observationB,
      cityIdentity,
      atmosphere,
      activeAtmosphere,
      liveContext,
      hazardContext
    ]
  );

  useEffect(() => {
    const syncWorkset = () => setSpatialWorkset(loadSpatialWorkset());
    globalThis.addEventListener?.(SPATIAL_WORKSET_EVENT, syncWorkset);
    return () =>
      globalThis.removeEventListener?.(SPATIAL_WORKSET_EVENT, syncWorkset);
  }, []);

  useEffect(() => {
    const syncScenarios = () =>
      setSavedOperatorScenarios(loadOperatorScenarios());
    globalThis.addEventListener?.(OPERATOR_SCENARIOS_EVENT, syncScenarios);
    return () =>
      globalThis.removeEventListener?.(
        OPERATOR_SCENARIOS_EVENT,
        syncScenarios
      );
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const refresh = () => {      void loadGlobalLiveContext(controller.signal)
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
    setForecastSeries(null);
    setForecastError(null);
    setLiveContext(null);
    setLiveContextError(null);
    setSelection(null);
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

  useEffect(() => {
    const syncBindings = () => {
      setOperationalBindings(
        loadOperationalSourceBindings(operationalBindingScope)
      );
    };
    const onBindingChange = (event: Event) => {
      const detail = (event as CustomEvent<{ scopeId?: string }>).detail;
      if (detail?.scopeId === operationalBindingScope) syncBindings();
    };

    syncBindings();
    globalThis.addEventListener(
      OPERATIONAL_SOURCE_BINDINGS_EVENT,
      onBindingChange
    );
    return () =>
      globalThis.removeEventListener(
        OPERATIONAL_SOURCE_BINDINGS_EVENT,
        onBindingChange
      );
  }, [operationalBindingScope]);

  useEffect(() => {
    if (
      scope !== 'city' ||
      temporal.mode !== 'live' ||
      !operationalBindings.gaugeId
    ) {
      setHydrologyContext(null);
      setHydrologyError(null);
      return;
    }

    const controller = new AbortController();
    const refresh = () => {
      void loadNoaaHydrologyContext(
        operationalBindings.gaugeId as string,
        controller.signal
      )
        .then((next) => {
          if (!controller.signal.aborted) {
            setHydrologyContext(next);
            setHydrologyError(null);
          }
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setHydrologyContext(null);
          setHydrologyError(
            error instanceof Error ? error.message : String(error)
          );
        });
    };

    refresh();
    const timer = globalThis.setInterval(refresh, 60_000);
    return () => {
      controller.abort();
      globalThis.clearInterval(timer);
    };
  }, [scope, temporal.mode, operationalBindings.gaugeId]);

  useEffect(() => {
    if (temporal.mode !== 'live') {
      setHazardContext(null);
      setHazardError(null);
      return;
    }

    const controller = new AbortController();
    const refresh = () => {
      void loadNwsHazards(city.latitude, city.longitude, controller.signal)
        .then((next) => {
          if (!controller.signal.aborted) {
            setHazardContext(next);
            setHazardError(null);
          }
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setHazardContext(null);
          setHazardError(error instanceof Error ? error.message : String(error));
        });
    };

    refresh();
    const timer = globalThis.setInterval(refresh, 60_000);
    return () => {
      controller.abort();
      globalThis.clearInterval(timer);
    };
  }, [city.id, city.latitude, city.longitude, temporal.mode]);

  useEffect(() => {
    if (scope !== 'city' || temporal.mode !== 'live') {
      setTransitContext(null);
      setTransitError(null);
      return;
    }

    const controller = new AbortController();
    const refresh = () => {
      void loadGtfsTransit(city.id, controller.signal)
        .then((next) => {
          if (!controller.signal.aborted) {
            setTransitContext(next);
            setTransitError(null);
          }
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setTransitContext(null);
          setTransitError(error instanceof Error ? error.message : String(error));
        });
    };

    refresh();
    const timer = globalThis.setInterval(refresh, 30_000);
    return () => {
      controller.abort();
      globalThis.clearInterval(timer);
    };
  }, [scope, city.id, temporal.mode]);

  useEffect(() => {
    if (temporal.mode !== 'forecast') {
      setForecastError(null);
      return;
    }

    const controller = new AbortController();
    setForecastSeries(null);
    setForecastError(null);

    void loadCityEnvironmentForecast(
      city.latitude,
      city.longitude,
      controller.signal
    )
      .then((series) => {
        if (!controller.signal.aborted) setForecastSeries(series);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setForecastError(error instanceof Error ? error.message : String(error));
      });

    return () => controller.abort();
  }, [city.id, city.latitude, city.longitude, temporal.mode]);

  useEffect(() => {
    if (!pendingSessionRestore) return;
    const workspace = pendingSessionRestore.workspace;
    setInteractionMode(workspace.interactionMode);
    setMeasurementPoints(
      workspace.measurementPoints.map((point) => ({ ...point }))
    );
    setMeasurementFrame(
      workspace.measurementFrame
        ? {
            ...workspace.measurementFrame,
            scenarioVisual: workspace.measurementFrame.scenarioVisual
              ? { ...workspace.measurementFrame.scenarioVisual }
              : null
          }
        : null
    );
    setObservationA(workspace.observationA ? { ...workspace.observationA } : null);
    setObservationB(workspace.observationB ? { ...workspace.observationB } : null);
    setFrozenDossier(
      workspace.frozenDossier
        ? (JSON.parse(
            JSON.stringify(workspace.frozenDossier)
          ) as SpatialEntityDossier)
        : null
    );
    setPendingSessionRestore(null);
  }, [pendingSessionRestore, city.id]);

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
            canonicalId: selection.identity?.canonicalId ?? null,
            identityBasis: selection.identity?.basis ?? null,
            sourceFeatureId: selection.identity?.sourceFeatureId ?? null,
            gersId: selection.identity?.gersId ?? null,
            crossSourceJoinReady:
              selection.identity?.crossSourceJoinReady ?? false,
            kind: selection.kind,
            source: selection.source ?? null,
            latitude: selection.latitude ?? null,
            longitude: selection.longitude ?? null,
            heightMeters: selection.heightMeters ?? null,
            properties: selection.properties ?? null
          }
        : null,
      entityDossier: entityDossier
        ? {
            canonicalId: entityDossier.entity.canonicalId,
            frozen: entityDossier.frozen,
            entitySourceState: entityDossier.entitySource.state,
            coveragePercent: entityDossier.coverage.percent,
            temporal: entityDossier.temporal,
            matchingObservationSlots: entityDossier.matchingObservations.map(
              (observation) => observation.slot
            ),
            limitations: entityDossier.limitations
          }
        : null,
      environment:
        scope === 'city' && activeAtmosphere
          ? {
              sourceTime: activeAtmosphere.sourceTime,
              live: temporal.mode === 'live' && activeAtmosphere.live,
              forecast: temporal.mode === 'forecast',
              stale: activeAtmosphere.stale === true,
              current: activeAtmosphere.current
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
          : null,
      hazards:
        scope === 'city' && hazardContext && temporal.mode === 'live'
          ? {
              count: hazardContext.alerts.length,
              live: hazardContext.live,
              stale: hazardContext.stale,
              attribution: hazardContext.attribution,
              events: hazardContext.alerts.slice(0, 8).map((alert) => ({
                event: alert.event,
                severity: alert.severity,
                urgency: alert.urgency,
                certainty: alert.certainty,
                expires: alert.expires
              }))
            }
          : null,
      transit:
        scope === 'city' && transitContext && temporal.mode === 'live'
          ? {
              agency: transitContext.agencyName,
              provider: transitContext.provider,
              sourceTime: transitContext.sourceTime,
              live: transitContext.live,
              stale: transitContext.stale,
              vehicleCount: transitContext.vehicles.length,
              vehicles: transitContext.vehicles.slice(0, 20).map((vehicle) => ({
                vehicleId: vehicle.vehicleId,
                tripId: vehicle.tripId,
                routeId: vehicle.routeId,
                latitude: vehicle.latitude,
                longitude: vehicle.longitude,
                bearing: vehicle.bearing,
                speedMps: vehicle.speedMps,
                timestamp: vehicle.timestamp
              }))
            }
          : null,
      hydrology:
        scope === 'city' && hydrologyContext && temporal.mode === 'live'
          ? {
              gaugeId: hydrologyContext.gauge.gaugeId,
              name: hydrologyContext.gauge.name,
              sourceTime: hydrologyContext.sourceTime,
              live: hydrologyContext.live,
              stale: hydrologyContext.stale,
              partial: hydrologyContext.partial,
              observedStageFeet: hydrologyContext.gauge.observedStageFeet,
              observedFlowCfs: hydrologyContext.gauge.observedFlowCfs,
              forecastStageFeet: hydrologyContext.gauge.forecastStageFeet,
              minorFloodStageFeet:
                hydrologyContext.gauge.minorFloodStageFeet
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
      entityDossier,
      atmosphere,
      activeAtmosphere,
      liveContext,
      hazardContext,
      transitContext,
      hydrologyContext
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
      scope === 'city' &&
      activeAtmosphere &&
      (temporal.mode === 'live' || temporal.mode === 'forecast')
        ? atmosphereToWindOverlay(activeAtmosphere)
        : null,
    [scope, activeAtmosphere, temporal.mode]
  );

  const seismicOverlay = useMemo(
    () =>
      scope === 'city' && liveContext && temporal.mode === 'live'
        ? seismicToOverlay(liveContext)
        : null,
    [scope, liveContext, temporal.mode]
  );

  const hazardOverlay = useMemo(
    () =>
      scope === 'city' &&
      hazardContext &&
      temporal.mode === 'live' &&
      !hazardContext.fallback
        ? hazardContext.overlay
        : null,
    [scope, hazardContext, temporal.mode]
  );

  const transitOverlay = useMemo(
    () =>
      scope === 'city' &&
      transitContext &&
      temporal.mode === 'live' &&
      !transitContext.fallback &&
      !transitContext.unconfigured
        ? transitContext.overlay
        : null,
    [scope, transitContext, temporal.mode]
  );

  const hydrologyOverlay = useMemo(
    () =>
      scope === 'city' &&
      hydrologyContext &&
      temporal.mode === 'live' &&
      !hydrologyContext.fallback
        ? hydrologyContext.overlay
        : null,
    [scope, hydrologyContext, temporal.mode]
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
        ? [worldOverlay, incidentOverlay, worksetGeometryOverlay, operatorScenarioOverlay, measurementOverlay]
        : [
            ...semanticOverlays,
            activeIllumination,
            powerOverlay,
            windOverlay,
            seismicOverlay,
            hazardOverlay,
            transitOverlay,
            hydrologyOverlay,
            incidentOverlay,
            worksetGeometryOverlay,
            operatorScenarioOverlay,
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
      hazardOverlay,
      transitOverlay,
      hydrologyOverlay,
      incidentOverlay,
      worksetGeometryOverlay,
      operatorScenarioOverlay,
      measurementOverlay
    ]
  );

  const handleSpatialSelection = (next: SpatialFeatureSelection | null) => {
    const bound = next
      ? bindSpatialSelectionIdentity(
          next,
          scope === 'world' ? 'global' : city.id
        )
      : null;
    setSelection(bound);

    if (scope !== 'world' || bound?.kind !== 'city') return;
    const cityId =
      typeof bound.properties?.cityId === 'string'
        ? bound.properties.cityId
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

  const captureObservation = (slot: 'a' | 'b') => {
    const observation = captureSpatialObservation({
      region: scope === 'world' ? 'GLOBAL' : city.name,
      latitude: scope === 'world' ? 20 : city.latitude,
      longitude: scope === 'world' ? 0 : city.longitude,
      temporal: temporalInstant,
      useCase: activeUseCase,
      visualMode,
      cityIdentity: scope === 'city' ? cityIdentity : null,
      atmosphere:
        scope === 'city' && temporal.mode === 'live' ? atmosphere : null,
      liveContext:
        scope === 'city' && temporal.mode === 'live' ? liveContext : null,
      selection,
      measurement
    });

    if (slot === 'a') setObservationA(observation);
    else setObservationB(observation);
  };

  const clearComparison = () => {
    setObservationA(null);
    setObservationB(null);
  };

  const analyzeComparison = () => {
    if (!spatialComparison) return;
    const deltas = spatialComparison.metricDeltas
      .slice(0, 10)
      .map(
        (metric) =>
          `${metric.label}: ${metric.a.toFixed(2)} → ${metric.b.toFixed(2)} (${
            metric.delta >= 0 ? '+' : ''
          }${metric.delta.toFixed(2)} ${metric.unit})`
      )
      .join('; ');

    const entityRelation =
      spatialComparison.sameCanonicalEntity == null
        ? 'entity identity not comparable'
        : spatialComparison.sameCanonicalEntity
          ? `same canonical entity ${spatialComparison.a.selectedEntity?.canonicalId ?? ''}`
          : 'different canonical entities';

    setAgentHandoff((current) => ({
      id: (current?.id ?? 0) + 1,
      agent: 'AUREN',
      prompt:
        `Compare operator-captured Frame A (${spatialComparison.a.region}, ${spatialComparison.a.temporal.mode}, ${spatialComparison.a.temporal.iso}) with Frame B (${spatialComparison.b.region}, ${spatialComparison.b.temporal.mode}, ${spatialComparison.b.temporal.iso}). ` +
        `Entity relationship: ${entityRelation}. Mutually available numeric changes: ${deltas || 'none'}. ` +
        'Use the active spatial context and provenance. Distinguish observation from modeled context, do not infer causation from correlation, identify missing/non-comparable fields, and suggest evidence needed before an operator decision.'
    }));
    setIntelWorkspace('ai');
    setIntelOpen(true);
  };

  const analyzeEntityDossier = (dossier: SpatialEntityDossier) => {
    const sourceChain = [dossier.entitySource, ...dossier.contextSources]
      .map(
        (source) =>
          `${source.role}:${source.provider ?? source.dataset ?? 'unknown'}:${source.state}`
      )
      .join('; ');

    setAgentHandoff((current) => ({
      id: (current?.id ?? 0) + 1,
      agent: 'AUREN',
      prompt:
        `Review the ${dossier.frozen ? 'frozen' : 'active'} operator entity dossier for "${dossier.entity.canonicalId}" (${dossier.entity.kind}) in ${dossier.region}. ` +
        `Identity basis: ${dossier.entity.identityBasis}; GERS-linked: ${dossier.entity.crossSourceJoinReady ? 'yes' : 'no'}. ` +
        `4D frame: ${dossier.temporal.mode} at ${dossier.temporal.iso}. Entity source state: ${dossier.entitySource.state}. ` +
        `Source chain: ${sourceChain || 'none'}. Core coverage: ${dossier.coverage.percent}%. ` +
        `Matching captured frames: ${dossier.matchingObservations.map((item) => item.slot).join(', ') || 'none'}. ` +
        'Treat the dossier as non-authoritative operator analysis. Separate entity-specific facts from surrounding context, preserve missing fields, do not infer a GERS join or causation where none is proven, and identify the next evidence needed before an operator decision.'
    }));
    setIntelWorkspace('ai');
    setIntelOpen(true);
  };
  const locateSpatialIncident = (incident: SpatialIncident) => {
    setSelection(null);
    setCity({
      id: `incident-${incident.anchor.latitude.toFixed(5)}-${incident.anchor.longitude.toFixed(5)}`,
      name: 'INCIDENT ANCHOR',
      district: `${incident.title} · ${incident.anchor.latitude.toFixed(5)}°, ${incident.anchor.longitude.toFixed(5)}°`,
      latitude: incident.anchor.latitude,
      longitude: incident.anchor.longitude,
      rangeMeters: 3_000,
      pitchDegrees: -35,
      custom: true
    });
    setScope('city');
    setIntelOpen(true);
  };

  const analyzeSpatialIncident = (incident: SpatialIncident) => {
    setAgentHandoff((current) => ({
      id: (current?.id ?? 0) + 1,
      agent: 'AUREN',
      prompt:
        `Review the local operator-created ${incident.category} record "${incident.title}" at ${incident.anchor.region}. ` +
        `Severity: ${incident.severity}; record status: ${incident.status}; observed frame: ${incident.temporalMode} at ${incident.observedAt}. ` +
        `Entity link: ${incident.anchor.canonicalId ?? 'none'}; workset link: ${incident.linkedWorksetCanonicalId ?? 'none'}; GERS: ${incident.anchor.gersId ?? 'none'}. ` +
        `Operator note: ${incident.note || 'none'}. ` +
        'Treat this strictly as a non-authoritative operator annotation. Do not treat its severity/status as provider-confirmed fact, do not infer causation, and identify what source-backed evidence would be required to verify or dismiss the concern.'
    }));
    setIntelWorkspace('ai');
    setIntelOpen(true);
  };
  const locateEntityDossier = (dossier: SpatialEntityDossier) => {
    const { latitude, longitude } = dossier.entity.position;
    if (latitude == null || longitude == null) return;

    setActiveUseCase(null);
    setSelection(null);
    setCity({
      id: `workset-${latitude.toFixed(5)}-${longitude.toFixed(5)}`,
      name: 'WORKSET ANCHOR',
      district: `${dossier.entity.displayName} · ${latitude.toFixed(5)}°, ${longitude.toFixed(5)}°`,
      latitude,
      longitude,
      rangeMeters: 3_200,
      pitchDegrees: -35,
      custom: true
    });
    setScope('city');
    setIntelOpen(true);
  };
  const analyzeSpatialInvestigation = (
    investigation: SpatialInvestigation
  ) => {
    const hypotheses = investigation.hypotheses
      .slice(0, 12)
      .map(
        (item) =>
          `${item.assessment.toUpperCase()}: ${item.text}${
            item.rationale ? ` — rationale: ${item.rationale}` : ''
          }`
      )
      .join('; ');
    const openQuestions = investigation.openQuestions.slice(0, 12).join('; ');

    setAgentHandoff((current) => ({
      id: (current?.id ?? 0) + 1,
      agent: 'TEAM',
      prompt:
        `Review operator investigation "${investigation.name}". Objective: ${investigation.objective || 'not stated'}. ` +
        `Status: ${investigation.status}. Linked references: ${investigation.references.canonicalEntityIds.length} canonical entities, ${investigation.references.incidentIds.length} local incidents, ${investigation.references.observationIds.length} captured A/B observations, ${investigation.references.evidenceReceipts.length} provenance-ledger references. ` +
        `Operator hypotheses: ${hypotheses || 'none'}. Open questions: ${openQuestions || 'none'}. ` +
        'Treat every hypothesis assessment as a human-entered analytical judgment, not a verified finding. Treat local incidents and workset geometry as non-authoritative operator context. Use provenance-ledger references only as pointers to evidence that must be inspected independently. Separate confirmed observations from assumptions, contradictions, uncertainty and missing evidence before suggesting next investigative steps.'
    }));
    setIntelWorkspace('ai');
    setIntelOpen(true);
  };
  const activateOperatorScenario = (scenario: OperatorScenario) => {
    const comparison = compareOperatorScenario(scenario);
    const sameScenario = activeOperatorScenario?.id === scenario.id;
    setActiveOperatorScenario({ ...scenario, status: 'active' });
    setScenarioVisual(comparison.visual);
    if (!sameScenario) {
      clock.pause();
      clock.setMode('scenario', scenario.id);
      clock.scrub(scenario.startIso, 'scenario');
    }
    setIntelWorkspace('scenario');
    setIntelOpen(true);
  };

  const deactivateOperatorScenario = () => {
    setActiveOperatorScenario(null);
    setScenarioVisual(null);
    clock.goLive();
  };

  const restoreScenarioFromTemporalEvent = (
    event: TemporalNavigatorEvent
  ) => {
    if (!event.scenarioId) return;
    const scenario = savedOperatorScenarios.find(
      (candidate) => candidate.id === event.scenarioId
    );
    if (scenario) {
      activateOperatorScenario(scenario);
      clock.scrub(event.timeIso, 'scenario');
      return;
    }
    clock.pause();
    clock.setMode('scenario', event.scenarioId);
    clock.scrub(event.timeIso, 'scenario');
  };

  const analyzeOperatorScenario = (scenario: OperatorScenario) => {
    const comparison = compareOperatorScenario(scenario);
    const assumptions = scenario.assumptions
      .slice(0, 12)
      .map((item) => item.text)
      .join('; ');
    const references =
      `${scenario.references.canonicalEntityIds.length} canonical entities, ${scenario.references.incidentIds.length} local incidents, ${scenario.references.observationIds.length} captured observations across ${scenario.references.regions.length} region(s)`;

    setAgentHandoff((current) => ({
      id: (current?.id ?? 0) + 1,
      agent: 'VÆLON',
      prompt:
        `Analyze operator-authored scenario "${scenario.name}" (${scenario.template}) beginning ${scenario.startIso}${scenario.endIso ? ` and ending ${scenario.endIso}` : ''}. ` +
        `Parameters: load ${scenario.parameters.loadMultiplierPercent}%, renewable availability ${scenario.parameters.renewableAvailabilityPercent}%, storage reserve ${scenario.parameters.storageReservePercent}%, weather risk ${scenario.parameters.weatherRiskPercent}%. ` +
        `Modeled visual state: stress ${comparison.visual.stressFactor.toFixed(2)}x, renewable bias ${comparison.visual.renewableBias.toFixed(2)}, storage stress ${comparison.visual.storageStress.toFixed(2)}, weather risk ${comparison.visual.weatherRisk.toFixed(2)}. ` +
        `Captured references: ${references}. Assumptions: ${assumptions || 'none explicitly recorded'}. ` +
        'Treat every parameter, assumption, visual factor and scenario geometry as hypothetical operator input. Do not call it live data, a provider forecast, a probability, a causal finding or a verified real-world outcome. Separate what is merely assumed from what the referenced source evidence could support, identify sensitivity to assumptions, and specify what real data or simulation would be needed before an operational recommendation.'
    }));
    setIntelWorkspace('ai');
    setIntelOpen(true);
  };
  const centerWorksetGeometry = () => {
    if (!worksetGeometry.centroid) return;
    const { latitude, longitude } = worksetGeometry.centroid;
    setSelection(null);
    setActiveUseCase(null);
    setCity({
      id: `workset-centroid-${latitude.toFixed(5)}-${longitude.toFixed(5)}`,
      name: 'WORKSET GEOMETRY',
      district: `${worksetGeometry.positionedEntityCount} pinned entities · analytical centroid`,
      latitude,
      longitude,
      rangeMeters: Math.max(
        4_500,
        Math.min(
          8_000_000,
          worksetGeometry.maximumPairDistanceMeters * 1.35
        )
      ),
      pitchDegrees: -38,
      custom: true
    });
    setScope('city');
    setIntelOpen(true);
  };

  const analyzeWorksetGeometry = (
    geometry: SpatialWorksetGeometrySummary
  ) => {
    const regions = geometry.regions.join(', ') || 'none';
    const edgeSummary = geometry.edges
      .slice(0, 12)
      .map(
        (edge) =>
          `${edge.fromCanonicalId} ↔ ${edge.toCanonicalId}: ${(edge.distanceMeters / 1000).toFixed(2)} km`
      )
      .join('; ');

    setAgentHandoff((current) => ({
      id: (current?.id ?? 0) + 1,
      agent: 'AUREN',
      prompt:
        `Review the local operator workset geometry containing ${geometry.positionedEntityCount} positioned canonical entities across ${geometry.regions.length} region(s): ${regions}. ` +
        `Minimum-spanning analytical distance: ${(geometry.totalTreeDistanceMeters / 1000).toFixed(2)} km; maximum pair separation: ${(geometry.maximumPairDistanceMeters / 1000).toFixed(2)} km. ` +
        `Analytical edges: ${edgeSummary || 'none'}. ` +
        'Treat these links strictly as minimum-spanning spatial geometry derived from operator-pinned coordinates. Do not infer physical, electrical, transit, ownership, dependency, operational, or causal relationships from the lines. Identify only defensible spatial patterns and the source-backed evidence required before asserting any real-world relationship.'
    }));
    setIntelWorkspace('ai');
    setIntelOpen(true);
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
      hazards:
        scope === 'city' && temporal.mode === 'live' && hazardOverlay
          ? hazardOverlay.nodes.length + hazardOverlay.edges.length
          : 0,
      transit:
        scope === 'city' && temporal.mode === 'live' && transitOverlay
          ? transitOverlay.nodes.length + transitOverlay.edges.length
          : 0,
      hydrology:
        scope === 'city' && temporal.mode === 'live' && hydrologyOverlay
          ? hydrologyOverlay.nodes.length + hydrologyOverlay.edges.length
          : 0,
      energy:
        scope === 'city' && powerOverlay
          ? powerOverlay.nodes.length + powerOverlay.edges.length
          : 0,
      annotations: spatialIncidents.length,
      'workset-analysis':
        worksetGeometry.positionedEntityCount + worksetGeometry.edgeCount,
      'scenario-model': operatorScenarioOverlay
        ? operatorScenarioOverlay.nodes.length +
          operatorScenarioOverlay.edges.length
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
    hazardOverlay,
    transitOverlay,
    hydrologyOverlay,
    powerOverlay,
    spatialIncidents,
    worksetGeometry,
    operatorScenarioOverlay
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

  const currentSessionWorkspace = useMemo<
    Omit<OperatorSessionWorkspace, 'workset'>
  >(
    () => ({
      view: currentBookmark,
      interactionMode,
      measurementPoints: measurementPoints.map((point) => ({ ...point })),
      measurementFrame: measurementFrame
        ? {
            ...measurementFrame,
            scenarioVisual: measurementFrame.scenarioVisual
              ? { ...measurementFrame.scenarioVisual }
              : null
          }
        : null,
      observationA,
      observationB,
      frozenDossier,
      operatorScenario: activeOperatorScenario
        ? JSON.parse(JSON.stringify(activeOperatorScenario))
        : null,
      incidents: spatialIncidents.map((incident) => ({
        ...incident,
        anchor: { ...incident.anchor }
      }))
    }),
    [
      currentBookmark,
      interactionMode,
      measurementPoints,
      measurementFrame,
      observationA,
      observationB,
      frozenDossier,
      activeOperatorScenario,
      spatialIncidents
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

  const restoreOperatorSession = (session: OperatorWorkspaceSession) => {
    const view = session.workspace.view;
    setSelection(null);
    clock.pause();
    setActiveOperatorScenario(
      session.workspace.operatorScenario
        ? (JSON.parse(
            JSON.stringify(session.workspace.operatorScenario)
          ) as OperatorScenario)
        : null
    );
    restoreBookmark({
      ...view,
      id: `session-view:${session.id}`,
      name: session.name,
      createdAt: session.createdAt
    });
    saveSpatialWorkset(session.workspace.workset);
    setSpatialIncidents(saveSpatialIncidents(session.workspace.incidents));
    setPendingSessionRestore(session);
    setIntelOpen(true);
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

          <OperatorSessionPanel
            current={currentSessionWorkspace}
            onRestore={restoreOperatorSession}
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
            atmosphere={scope === 'city' ? activeAtmosphere : null}
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

          {scope === 'city' &&
          temporal.mode === 'live' &&
          hazardContext &&
          hazardContext.alerts.length > 0 ? (
            <div
              className="hazard-scene-badge"
              data-source-state={
                hazardContext.stale
                  ? 'stale'
                  : hazardContext.live
                    ? 'live'
                    : 'fallback'
              }
            >
              <span>NWS ACTIVE HAZARDS</span>
              <strong>
                {hazardContext.alerts.length} ALERT
                {hazardContext.alerts.length === 1 ? '' : 'S'}
              </strong>
              <small>
                {hazardContext.alerts[0]?.event ?? 'ACTIVE ALERT'} ·{' '}
                {hazardContext.alerts[0]?.severity ?? 'UNKNOWN'} SEVERITY
              </small>
            </div>
          ) : hazardError && scope === 'city' && temporal.mode === 'live' ? (
            <div className="hazard-scene-badge" data-source-state="unavailable">
              <span>NWS ACTIVE HAZARDS</span>
              <strong>UNAVAILABLE</strong>
              <small>{hazardError}</small>
            </div>
          ) : null}

          {scope === 'city' && temporal.mode === 'live' && transitContext ? (
            <div
              className="transit-scene-badge"
              data-source-state={
                transitContext.unconfigured
                  ? 'unconfigured'
                  : transitContext.stale
                    ? 'stale'
                    : transitContext.live
                      ? 'live'
                      : 'fallback'
              }
            >
              <span>GTFS-RT TRANSIT</span>
              <strong>
                {transitContext.unconfigured
                  ? 'FEED NOT CONFIGURED'
                  : `${transitContext.vehicles.length} VEHICLE${transitContext.vehicles.length === 1 ? '' : 'S'}`}
              </strong>
              <small>
                {transitContext.agencyName ?? transitContext.provider ?? 'GTFS-REALTIME'}
                {' · '}
                {transitContext.stale
                  ? 'STALE SOURCE POSITIONS'
                  : transitContext.live
                    ? 'SOURCE-BACKED POSITIONS'
                    : 'NO LIVE POSITION FEED'}
              </small>
            </div>
          ) : transitError && scope === 'city' && temporal.mode === 'live' ? (
            <div className="transit-scene-badge" data-source-state="unavailable">
              <span>GTFS-RT TRANSIT</span>
              <strong>UNAVAILABLE</strong>
              <small>{transitError}</small>
            </div>
          ) : null}

          {scope === 'city' &&
          temporal.mode === 'live' &&
          hydrologyContext ? (
            <div
              className="hydrology-scene-badge"
              data-source-state={
                hydrologyContext.partial
                  ? 'partial'
                  : hydrologyContext.stale
                    ? 'stale'
                    : hydrologyContext.live
                      ? 'live'
                      : 'fallback'
              }
            >
              <span>NOAA NWPS · {hydrologyContext.gauge.gaugeId}</span>
              <strong>
                {hydrologyContext.gauge.observedStageFeet == null
                  ? 'STAGE UNAVAILABLE'
                  : `${hydrologyContext.gauge.observedStageFeet.toFixed(2)} FT STAGE`}
              </strong>
              <small>
                {hydrologyContext.partial
                  ? 'PARTIAL · METADATA SOURCE LIVE'
                  : hydrologyContext.gauge.name ?? 'SOURCE-BACKED GAUGE'}
              </small>
            </div>
          ) : hydrologyError &&
            scope === 'city' &&
            temporal.mode === 'live' ? (
            <div
              className="hydrology-scene-badge"
              data-source-state="unavailable"
            >
              <span>NOAA NWPS</span>
              <strong>UNAVAILABLE</strong>
              <small>{hydrologyError}</small>
            </div>
          ) : null}

          {measurement ? (
            <div className="measurement-scene-badge">
              <span>SPATIAL MEASUREMENT</span>
              <strong>
                {measurement.distanceMeters >= 1000
                  ? `${(measurement.distanceMeters / 1000).toFixed(2)} km`
                  : `${measurement.distanceMeters.toFixed(1)} m`}
                {' · '}
                {measurement.bearingDegrees.toFixed(1)}°
              </strong>
              <small>
                {measurement.precision === 'terrain-aware'
                  ? 'DEPTH-SURFACE POINTS'
                  : 'GEODESIC / PROJECTED POINTS'}
              </small>
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

          {temporal.mode === 'forecast' ? (
            <div className="forecast-scene-badge">
              <span>PROVIDER FORECAST · 4D CURSOR</span>
              <strong>
                {forecastAtmosphere
                  ? `${weatherPhenomenon(forecastAtmosphere).toUpperCase()} · ${formatSourceTime(forecastAtmosphere.sourceTime)}`
                  : 'NO ALIGNED FORECAST SAMPLE'}
              </strong>
              <small>
                {forecastAtmosphere?.stale
                  ? 'STALE SOURCE SAMPLE · NOT LIVE OBSERVATION'
                  : 'FORECAST SAMPLE · NOT LIVE OBSERVATION'}
              </small>
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
              ['operations', 'OPS'],
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
                      | 'operations'
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

          <section
            className="weather-card intel-context-panel"
            data-source-state={
              activeAtmosphereError
                ? 'unavailable'
                : temporal.mode === 'forecast'
                  ? forecastAtmosphere?.stale
                    ? 'stale'
                    : forecastAtmosphere
                      ? 'forecast'
                      : forecastSeries
                        ? 'unavailable'
                        : 'loading'
                  : atmosphere?.live
                    ? 'live'
                    : atmosphere
                      ? 'fallback'
                      : 'loading'
            }
          >
            <div className="weather-card-head">
              <span>
                <small>ATMOSPHERE</small>
                <strong>
                  {temporal.mode === 'live'
                    ? weatherPhenomenon(atmosphere).toUpperCase()
                    : temporal.mode === 'forecast'
                      ? forecastAtmosphere
                        ? `${weatherPhenomenon(forecastAtmosphere).toUpperCase()} · FORECAST`
                        : 'FORECAST · NO SAMPLE'
                      : `${temporal.mode.toUpperCase()} · DATA PENDING`}
                </strong>
              </span>
              <span
                className={
                  activeAtmosphere && activeAtmosphere.fallback !== true
                    ? 'status-dot live'
                    : 'status-dot'
                }
              />
            </div>
            <div className="weather-metrics">
              <span>
                <small>TEMP</small>
                <strong>
                  {activeAtmosphere?.current?.temperatureC != null
                    ? `${activeAtmosphere.current.temperatureC.toFixed(1)}°C`
                    : '—'}
                </strong>
              </span>
              <span>
                <small>WIND</small>
                <strong>
                  {activeAtmosphere?.current?.windSpeedKph != null
                    ? `${activeAtmosphere.current.windSpeedKph.toFixed(0)} km/h`
                    : '—'}
                </strong>
              </span>
              <span>
                <small>CLOUD</small>
                <strong>
                  {activeAtmosphere?.current?.cloudCoverPercent != null
                    ? `${activeAtmosphere.current.cloudCoverPercent.toFixed(0)}%`
                    : '—'}
                </strong>
              </span>
            </div>
            <p>
              {activeAtmosphereError
                ? activeAtmosphereError
                : temporal.mode === 'forecast'
                  ? forecastAtmosphere
                    ? forecastAtmosphere.attribution ?? 'Provider-backed weather forecast'
                    : forecastSeries
                      ? 'No returned provider forecast sample aligns to this 4D cursor.'
                      : 'Forecast provider request pending.'
                  : temporal.mode !== 'live'
                    ? 'Current weather is hidden outside LIVE; provider forecast is available in FORECAST mode.'
                    : atmosphere?.attribution ?? 'Weather source pending'}
            </p>
            <div className="weather-source-meta">
              <span>
                {formatSourceTime(
                  activeAtmosphere?.sourceTime,
                  activeAtmosphere?.timezone
                )}
              </span>
              <span>FETCHED {formatDataAge(activeAtmosphere?.fetchedAt)}</span>
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

          <div className="intel-workspace intel-operations">
            <OperationalDataPanel
              latitude={city.latitude}
              longitude={city.longitude}
              cityId={city.id}
              temporalMode={temporal.mode}
              cursorIso={temporal.cursorIso}
              weatherCurrent={
                activeAtmosphere
                  ? {
                      live: temporal.mode === 'live' && activeAtmosphere.live,
                      state:
                        temporal.mode === 'forecast'
                          ? activeAtmosphere.stale
                            ? 'stale'
                            : activeAtmosphere.fallback
                              ? 'fallback'
                              : 'forecast'
                          : undefined,
                      provider: activeAtmosphere.attribution,
                      sourceTime: activeAtmosphere.sourceTime,
                      fetchedAt: activeAtmosphere.fetchedAt,
                      attribution: activeAtmosphere.attribution,
                      summary:
                        temporal.mode === 'forecast'
                          ? `${weatherPhenomenon(activeAtmosphere).toUpperCase()} FORECAST`
                          : weatherPhenomenon(activeAtmosphere).toUpperCase()
                    }
                  : null
              }
              airQualityCurrent={
                liveContext
                  ? {
                      live: liveContext.airQuality.source.live,
                      provider: liveContext.airQuality.source.provider,
                      sourceTime:
                        liveContext.airQuality.source.modelTime ??
                        liveContext.airQuality.current?.time ??
                        null,
                      fetchedAt: liveContext.airQuality.source.fetchedAt,
                      attribution: liveContext.airQuality.source.attribution,
                      summary:
                        liveContext.airQuality.current?.usAqi != null
                          ? `AQI ${liveContext.airQuality.current.usAqi.toFixed(0)}`
                          : 'AIR QUALITY SOURCE'
                    }
                  : null
              }
              seismicCurrent={
                liveContext
                  ? {
                      live: liveContext.seismic.source.live,
                      provider: liveContext.seismic.source.provider,
                      sourceTime: liveContext.seismic.source.generatedAt ?? null,
                      fetchedAt: liveContext.seismic.source.fetchedAt,
                      attribution: liveContext.seismic.source.attribution,
                      summary: `${liveContext.seismic.eventCount} RECENT EVENTS`
                    }
                  : null
              }
            />
          </div>
          <div className="intel-workspace intel-analysis">
            <SpatialAnalysisPanel
              mode={interactionMode}
              points={measurementPoints}
              measurement={measurement}
              onModeChange={changeInteractionMode}
              onReset={clearMeasurement}
            />
            <SpatialComparisonPanel
              a={observationA}
              b={observationB}
              comparison={spatialComparison}
              onCapture={captureObservation}
              onClear={clearComparison}
              onAnalyze={spatialComparison ? analyzeComparison : undefined}
            />
          </div>
          <div className="intel-workspace intel-ai">
            <AgentDock context={agentContext} handoff={agentHandoff} />
          </div>
          <div className="intel-workspace intel-scenario">
            <ScenarioPanel
              activeTemporalMode={temporal.mode}
              onScenarioApplied={(scenarioId, visual) => {
                setActiveOperatorScenario(null);
                setScenarioVisual(visual);
                clock.setMode('scenario', scenarioId);
              }}
              onReturnLive={() => {
                setActiveOperatorScenario(null);
                setScenarioVisual(null);
                clock.goLive();
              }}
            />
            <ScenarioComposerPanel
              context={{
                region: scope === 'world' ? 'GLOBAL' : city.name,
                temporal: temporalInstant,
                workset: spatialWorkset,
                incidents: spatialIncidents,
                observationA,
                observationB,
                geometry: worksetGeometry
              }}
              activeScenarioId={activeOperatorScenario?.id ?? null}
              onActivate={activateOperatorScenario}
              onDeactivate={deactivateOperatorScenario}
              onAnalyze={analyzeOperatorScenario}
            />
          </div>
          <div className="intel-workspace intel-quantum">
            <QuantumPanel />
          </div>
          <div className="intel-workspace intel-evidence">
            <EvidencePanel onSelectEvidence={setSelectedEvidence} />
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

          <EntityDossierPanel
            current={entityDossier}
            frozen={frozenDossier}
            onFreeze={() => {
              if (entityDossier) {
                setFrozenDossier(freezeSpatialEntityDossier(entityDossier));
              }
            }}
            onClearFrozen={() => setFrozenDossier(null)}
            onAnalyze={analyzeEntityDossier}
          />
          <SpatialWorksetPanel
            current={entityDossier}
            onLocate={locateEntityDossier}
            onAnalyze={analyzeEntityDossier}
          />
          <SpatialWorksetGeometryPanel
            geometry={worksetGeometry}
            onCenter={centerWorksetGeometry}
            onAnalyze={analyzeWorksetGeometry}
          />
          <SpatialInvestigationBoard
            workset={spatialWorkset}
            incidents={spatialIncidents}
            observationA={observationA}
            observationB={observationB}
            geometry={worksetGeometry}
            selectedEvidence={selectedEvidence}
            onAnalyze={analyzeSpatialInvestigation}
          />
          <SpatialIncidentPanel
            incidents={spatialIncidents}
            current={entityDossier}
            temporal={temporalInstant}
            region={scope === 'world' ? 'GLOBAL' : city.name}
            coordinate={{
              latitude: scope === 'world' ? 20 : city.latitude,
              longitude: scope === 'world' ? 0 : city.longitude,
              heightMeters: null
            }}
            onChange={setSpatialIncidents}
            onLocate={locateSpatialIncident}
            onAnalyze={analyzeSpatialIncident}
          />
          <TemporalEventNavigator
            clock={clock}
            state={temporal}
            events={temporalEvents}
            onScenarioEvent={restoreScenarioFromTemporalEvent}
          />
        </aside>
      </section>

      <TemporalRail
        clock={clock}
        state={temporal}
        events={temporalEvents}
        onScenarioEvent={restoreScenarioFromTemporalEvent}
      />
    </main>
  );
}
