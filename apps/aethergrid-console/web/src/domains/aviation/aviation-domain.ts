import type { TemporalMode } from '../../renderer/spatial-renderer';
import type {
  OverlayCoordinate,
  SpatialOverlayEdge,
  SpatialOverlaySnapshot
} from '../../renderer/overlays/spatial-overlay';

export type AircraftTruthState =
  | 'observed'
  | 'interpolated'
  | 'predicted'
  | 'stale';

export interface AviationAircraft {
  id: string;
  icaoHex: string | null;
  callsign: string | null;
  operator: string | null;
  flightNumber: string | null;
  registration: string | null;
  aircraftType: string | null;
  latitude: number;
  longitude: number;
  barometricAltitudeMeters: number | null;
  geometricAltitudeMeters: number | null;
  groundSpeedKnots: number | null;
  trackDegrees: number | null;
  verticalRateFpm: number | null;
  squawk: string | null;
  onGround: boolean;
  observedAt: string;
  truthState: AircraftTruthState;
}

export interface AviationRelationship {
  id: string;
  from: OverlayCoordinate;
  to: OverlayCoordinate;
  label?: string | null;
  sourceBacked: boolean;
  source?: string | null;
}

export interface AviationProviderSnapshot {
  totalAircraft?:number;
  displayedAircraft?:number;
  upstreamRefreshMs?:number|null;
  provider: string;
  sourceTime: string | null;
  fetchedAt: string;
  live: boolean;
  stale: boolean;
  fallback: boolean;
  attribution: string | null;
  aircraft: readonly AviationAircraft[];
  relationships: readonly AviationRelationship[];
}

export interface AviationTrackPoint extends OverlayCoordinate {
  observedAt: string;
  truthState: AircraftTruthState;
}

export interface AviationDomainState extends AviationProviderSnapshot {
  history: Readonly<Record<string, readonly AviationTrackPoint[]>>;
}

const MAX_HISTORY_POINTS = 24;

function finiteCoordinate(value: number): boolean {
  return Number.isFinite(value);
}

function validGeographicPosition(position: { latitude: number; longitude: number }): boolean {
  return (
    finiteCoordinate(position.latitude) &&
    finiteCoordinate(position.longitude) &&
    Math.abs(position.latitude) <= 90 &&
    Math.abs(position.longitude) <= 180
  );
}

const MAX_OBSERVED_TRACK_GAP_MS = 180_000;
const MAX_PLAUSIBLE_TRACK_SPEED_MPS = 500;
const TRACK_FIX_TOLERANCE_METERS = 1_000;
const EARTH_MEAN_RADIUS_METERS = 6_371_008.8;

/** A track segment is an endpoint connection, never a claimed observed flight path. */
function supportedObservedTrackLeg(from: AviationTrackPoint, to: AviationTrackPoint): boolean {
  if (
    from.truthState !== 'observed' ||
    to.truthState !== 'observed' ||
    !validGeographicPosition(from) ||
    !validGeographicPosition(to)
  ) return false;

  const durationMs = Date.parse(to.observedAt) - Date.parse(from.observedAt);
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > MAX_OBSERVED_TRACK_GAP_MS) {
    return false;
  }
  const radians = Math.PI / 180;
  const latitudeDelta = (to.latitude - from.latitude) * radians;
  const longitudeDelta = (to.longitude - from.longitude) * radians;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(from.latitude * radians) *
      Math.cos(to.latitude * radians) *
      Math.sin(longitudeDelta / 2) ** 2;
  const arc = 2 * Math.atan2(Math.sqrt(Math.min(1, haversine)), Math.sqrt(Math.max(0, 1 - haversine)));
  const distanceMeters = EARTH_MEAN_RADIUS_METERS * arc;
  return distanceMeters <= TRACK_FIX_TOLERANCE_METERS +
    MAX_PLAUSIBLE_TRACK_SPEED_MPS * (durationMs / 1_000);
}

function sourceAltitudeMeters(aircraft: AviationAircraft): number | null {
  const altitude =
    aircraft.geometricAltitudeMeters ?? aircraft.barometricAltitudeMeters;
  return altitude != null && Number.isFinite(altitude) ? altitude : null;
}

function aircraftPosition(aircraft: AviationAircraft): OverlayCoordinate {
  const altitudeMeters = sourceAltitudeMeters(aircraft);
  return {
    latitude: aircraft.latitude,
    longitude: aircraft.longitude,
    ...(altitudeMeters == null ? {} : { heightMeters: altitudeMeters })
  };
}

function observedOrStale(aircraft: AviationAircraft): boolean {
  return (
    aircraft.truthState === 'observed' ||
    aircraft.truthState === 'stale'
  );
}

function canRenderAircraftModel(aircraft: AviationAircraft): boolean {
  return (
    sourceAltitudeMeters(aircraft) != null &&
    aircraft.trackDegrees != null &&
    Number.isFinite(aircraft.trackDegrees)
  );
}

function trackPoint(aircraft: AviationAircraft): AviationTrackPoint {
  return {
    ...aircraftPosition(aircraft),
    observedAt: aircraft.observedAt,
    truthState: aircraft.truthState
  };
}

function appendTrackPoint(
  existing: readonly AviationTrackPoint[],
  point: AviationTrackPoint
): readonly AviationTrackPoint[] {
  const deduped = existing.filter(
    (candidate) => candidate.observedAt !== point.observedAt
  );
  return [...deduped, point]
    .sort(
      (a, b) =>
        Date.parse(a.observedAt) - Date.parse(b.observedAt)
    )
    .slice(-MAX_HISTORY_POINTS);
}

export function mergeAviationSnapshot(
  previous: AviationDomainState | null,
  incoming: AviationProviderSnapshot
): AviationDomainState {
  const sameProvider = previous
    ? previous.provider === incoming.provider
    : false;
  const currentIds=new Set(incoming.aircraft.map(a=>a.id));
  const nextHistory: Record<string, readonly AviationTrackPoint[]> =
    sameProvider ? Object.fromEntries(Object.entries(previous?.history ?? {}).filter(([id])=>currentIds.has(id))) : {};

  for (const aircraft of incoming.aircraft) {
    if (
      !validGeographicPosition(aircraft)
    ) {
      continue;
    }
    const existing = nextHistory[aircraft.id] ?? [];
    nextHistory[aircraft.id] = appendTrackPoint(existing, trackPoint(aircraft));
  }

  return {
    ...incoming,
    history: nextHistory
  };
}

export function sourceBackedRelationshipEdges(
  relationships: readonly AviationRelationship[]
): readonly SpatialOverlayEdge[] {
  return relationships
    .filter((relationship) => relationship.sourceBacked === true)
    .map((relationship) => ({
      id: `aviation:relationship:${relationship.id}`,
      kind: 'route' as const,
      from: relationship.from,
      to: relationship.to,
      label: relationship.label ?? undefined,
      intensity: 0.48,
      properties: {
        eventType: 'aviation-relationship',
        sourceBacked: true,
        relationshipSource: relationship.source ?? null
      }
    }));
}

function historyEdges(state: AviationDomainState): readonly SpatialOverlayEdge[] {
  const edges: SpatialOverlayEdge[] = [];
  for (const aircraft of state.aircraft.slice(0,300)) {
    const points = state.history[aircraft.id] ?? [];
    for (let index = 1; index < points.length; index += 1) {
      const from = points[index - 1];
      const to = points[index];
      if (!supportedObservedTrackLeg(from, to)) continue;
      edges.push({
        id: `aviation:track:${aircraft.id}:${index}`,
        kind: 'route',
        from,
        to,
        label: aircraft.callsign ?? aircraft.id,
        intensity: 0.58,
        validFrom: from.observedAt,
        properties: {
          eventType: 'aircraft-history',
          sourceBacked: true,
          aircraftId: aircraft.id,
          truthState: to.truthState,
          trackReconstruction: 'straight-line-observed-endpoints'
        }
      });
    }
  }
  return edges;
}

function aircraftLabel(aircraft: AviationAircraft): string {
  const identity =
    aircraft.flightNumber ??
    aircraft.callsign ??
    aircraft.registration ??
    aircraft.id;
  return aircraft.operator ? `${identity} · ${aircraft.operator}` : identity;
}

export function aviationOverlay(
  state: AviationDomainState,
  temporalMode: TemporalMode
): SpatialOverlaySnapshot | null {
  if (temporalMode !== 'live') return null;

  const nodes = state.aircraft
    .filter(
      (aircraft) =>
        observedOrStale(aircraft) &&
        validGeographicPosition(aircraft)
    )
    .map((aircraft) => ({
      id: `aviation:aircraft:${aircraft.id}`,
      kind: 'aircraft' as const,
      position: aircraftPosition(aircraft),
      label: aircraftLabel(aircraft),
      validFrom: aircraft.observedAt,
      intensity: aircraft.truthState === 'stale' ? 0.3 : 0.82,
      properties: {
        eventType: 'aircraft',
        sourceFeatureId: aircraft.id,
        icaoHex: aircraft.icaoHex,
        callsign: aircraft.callsign,
        operator: aircraft.operator,
        flightNumber: aircraft.flightNumber,
        registration: aircraft.registration,
        aircraftType: aircraft.aircraftType,
        groundSpeedKnots: aircraft.groundSpeedKnots,
        trackDegrees: aircraft.trackDegrees,
        verticalRateFpm: aircraft.verticalRateFpm,
        squawk: aircraft.squawk,
        onGround: aircraft.onGround,
        truthState: aircraft.truthState,
        observedAt: aircraft.observedAt,
        render3d: canRenderAircraftModel(aircraft)
      }
    }));

  return {
    id: `aviation:${state.provider}:${state.sourceTime ?? state.fetchedAt}`,
    layerId: 'aviation',
    eventTime: state.sourceTime ?? state.fetchedAt,
    sourceTime: state.sourceTime,
    fetchedAt: state.fetchedAt,
    live: state.live,
    stale: state.stale,
    fallback: state.fallback,
    attribution: state.attribution,
    nodes,
    edges: [
      ...historyEdges(state),
      ...sourceBackedRelationshipEdges(state.relationships)
    ]
  };
}
