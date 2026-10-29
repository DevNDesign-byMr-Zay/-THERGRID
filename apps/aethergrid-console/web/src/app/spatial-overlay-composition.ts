import type { AtmosphericOverlaySnapshot } from '../renderer/overlays/atmospheric-overlay';
import type { SpatialOverlaySnapshot } from '../renderer/overlays/spatial-overlay';
import type { TemporalMode } from '../renderer/spatial-renderer';
import { atmosphereToWindOverlay } from '../services/city-environment';
import {
  airQualityToOverlay,
  seismicToOverlay,
  type CityLiveSnapshot
} from '../services/city-live-context';
import type { GtfsTransitContext } from '../services/gtfs-transit';
import type { NoaaHydrologyContext } from '../services/noaa-hydrology';
import type { NwsHazardContext } from '../services/nws-hazards';

type Scope = 'world' | 'city';

export interface CityOverlayInputs {
  scope: Scope;
  temporalMode: TemporalMode;
  activeAtmosphere: AtmosphericOverlaySnapshot | null;
  atmosphere: AtmosphericOverlaySnapshot | null;
  liveContext: CityLiveSnapshot | null;
  hazardContext: NwsHazardContext | null;
  transitContext: GtfsTransitContext | null;
  hydrologyContext: NoaaHydrologyContext | null;
}

export function deriveCityContextOverlays({
  scope,
  temporalMode,
  activeAtmosphere,
  atmosphere,
  liveContext,
  hazardContext,
  transitContext,
  hydrologyContext
}: CityOverlayInputs) {
  const city = scope === 'city';
  const current = city && temporalMode === 'live';
  return {
    windOverlay:
      city &&
      activeAtmosphere &&
      (temporalMode === 'live' ||
        temporalMode === 'forecast' ||
        temporalMode === 'historical')
        ? atmosphereToWindOverlay(activeAtmosphere)
        : null,
    seismicOverlay:
      current && liveContext ? seismicToOverlay(liveContext) : null,
    hazardOverlay:
      current && hazardContext && !hazardContext.fallback
        ? hazardContext.overlay
        : null,
    transitOverlay:
      current && transitContext && !transitContext.fallback && !transitContext.unconfigured
        ? transitContext.overlay
        : null,
    hydrologyOverlay:
      current && hydrologyContext && !hydrologyContext.fallback
        ? hydrologyContext.overlay
        : null,
    airQualityOverlay:
      current && liveContext
        ? airQualityToOverlay(liveContext, {
            windSpeedKph: atmosphere?.current?.windSpeedKph,
            windDirectionDegrees: atmosphere?.current?.windDirectionDegrees
          })
        : null
  };
}

export interface OverlayCompositionInputs {
  scope: Scope;
  worldOverlay: SpatialOverlaySnapshot | null;
  aviationOverlay: SpatialOverlaySnapshot | null;
  radarSnapshot: SpatialOverlaySnapshot | null;
  semanticOverlays: readonly SpatialOverlaySnapshot[];
  activeIllumination: SpatialOverlaySnapshot | null;
  powerOverlay: SpatialOverlaySnapshot | null;
  windOverlay: SpatialOverlaySnapshot | null;
  seismicOverlay: SpatialOverlaySnapshot | null;
  hazardOverlay: SpatialOverlaySnapshot | null;
  transitOverlay: SpatialOverlaySnapshot | null;
  hydrologyOverlay: SpatialOverlaySnapshot | null;
  incidentOverlay: SpatialOverlaySnapshot | null;
  worksetGeometryOverlay: SpatialOverlaySnapshot | null;
  operatorScenarioOverlay: SpatialOverlaySnapshot | null;
  measurementOverlay: SpatialOverlaySnapshot | null;
}

export function composeSpatialOverlays({
  scope,
  worldOverlay,
  aviationOverlay,
  radarSnapshot,
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
}: OverlayCompositionInputs): SpatialOverlaySnapshot[] {
  const contextualOverlays =
    scope === 'world'
      ? [
          worldOverlay,
          incidentOverlay,
          worksetGeometryOverlay,
          operatorScenarioOverlay,
          measurementOverlay
        ]
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
        ];

  return [aviationOverlay, radarSnapshot, ...contextualOverlays].filter(
    (snapshot): snapshot is SpatialOverlaySnapshot => Boolean(snapshot)
  );
}
