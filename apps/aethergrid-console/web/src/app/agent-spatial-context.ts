import { GRID_VIEWS } from '../services/agent-grid-actions';
import type { LayerState, SpatialFeatureSelection, TemporalMode, VisualMode } from '../renderer/spatial-renderer';
import type { AtmosphericOverlaySnapshot } from '../renderer/overlays/atmospheric-overlay';
import type { CityIdentitySummary } from '../services/city-power-overlay';
import type { CityLiveSnapshot } from '../services/city-live-context';
import type { SpatialEntityDossier } from '../services/spatial-entity-dossier';
import type { NwsHazardContext } from '../services/nws-hazards';
import type { GtfsTransitContext } from '../services/gtfs-transit';
import type { NoaaHydrologyContext } from '../services/noaa-hydrology';
import type { CityTarget } from './city-targets';

export interface AgentSpatialContextInputs {
  scope: 'city' | 'world';
  city: CityTarget;
  visualMode: VisualMode;
  layers: readonly LayerState[];
  temporal: { mode: TemporalMode; cursorIso: string };
  activeUseCase: string | null;
  cityIdentity: CityIdentitySummary | null;
  selection: SpatialFeatureSelection | null;
  entityDossier: SpatialEntityDossier | null;
  activeAtmosphere: AtmosphericOverlaySnapshot | null;
  liveContext: CityLiveSnapshot | null;
  hazardContext: NwsHazardContext | null;
  transitContext: GtfsTransitContext | null;
  hydrologyContext: NoaaHydrologyContext | null;
}

/** Build an advisory, source-preserving agent snapshot without querying providers or changing UI state. */
export function buildAgentSpatialContext({
  scope, city, visualMode, layers, temporal, activeUseCase, cityIdentity,
  selection, entityDossier, activeAtmosphere, liveContext, hazardContext,
  transitContext, hydrologyContext
}: AgentSpatialContextInputs) {
  return {
      region: scope === 'world' ? 'Global' : city.name,
      view: visualMode,
      layers: layers.map(({id,visible})=>({id,visible})),
      availableViews: GRID_VIEWS,
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
  };
}
