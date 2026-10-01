import type { TemporalMode } from '../renderer/spatial-renderer';
import type { SpatialIncident } from './spatial-incidents';
import type { SpatialObservation } from './spatial-comparison';

export type TemporalNavigatorEventType =
  | 'operator-incident'
  | 'observation-a'
  | 'observation-b';

export interface TemporalNavigatorEvent {
  id: string;
  type: TemporalNavigatorEventType;
  timeIso: string;
  endIso: string | null;
  label: string;
  detail: string;
  originalMode: TemporalMode;
  scenarioId: string | null;
  authoritative: false;
  provenance: 'operator-local' | 'captured-frame';
  severity: string | null;
  status: string | null;
  canonicalId: string | null;
}

export interface TemporalNavigatorFilters {
  incidents: boolean;
  captures: boolean;
}

export const TEMPORAL_RAIL_PAST_MINUTES = 6 * 60;
export const TEMPORAL_RAIL_FUTURE_MINUTES = 7 * 24 * 60;

function eventFromObservation(
  observation: SpatialObservation,
  slot: 'A' | 'B'
): TemporalNavigatorEvent {
  return {
    id: `observation:${slot}:${observation.id}`,
    type: slot === 'A' ? 'observation-a' : 'observation-b',
    timeIso: observation.temporal.iso,
    endIso: null,
    label: `FRAME ${slot} · ${observation.region}`,
    detail:
      observation.selectedEntity?.canonicalId ??
      `${observation.coordinate.latitude.toFixed(4)}, ${observation.coordinate.longitude.toFixed(4)}`,
    originalMode: observation.temporal.mode,
    scenarioId: observation.temporal.scenarioId ?? null,
    authoritative: false,
    provenance: 'captured-frame',
    severity: null,
    status: null,
    canonicalId: observation.selectedEntity?.canonicalId ?? null
  };
}

export function buildTemporalNavigatorEvents(
  incidents: readonly SpatialIncident[],
  observationA: SpatialObservation | null,
  observationB: SpatialObservation | null
): TemporalNavigatorEvent[] {
  const events: TemporalNavigatorEvent[] = incidents.map((incident) => ({
    id: `incident:${incident.id}`,
    type: 'operator-incident',
    timeIso: incident.observedAt,
    endIso: incident.resolvedAt,
    label: incident.title,
    detail: `${incident.category.toUpperCase()} · ${incident.anchor.region}`,
    originalMode: incident.temporalMode,
    scenarioId: incident.scenarioId,
    authoritative: false,
    provenance: 'operator-local',
    severity: incident.severity,
    status: incident.status,
    canonicalId: incident.anchor.canonicalId
  }));

  if (observationA) events.push(eventFromObservation(observationA, 'A'));
  if (observationB) events.push(eventFromObservation(observationB, 'B'));

  return events
    .filter((event) => Number.isFinite(Date.parse(event.timeIso)))
    .sort((a, b) => Date.parse(a.timeIso) - Date.parse(b.timeIso));
}

export function filterTemporalNavigatorEvents(
  events: readonly TemporalNavigatorEvent[],
  filters: TemporalNavigatorFilters
): TemporalNavigatorEvent[] {
  return events.filter((event) =>
    event.type === 'operator-incident' ? filters.incidents : filters.captures
  );
}

export function temporalEventOffsetMinutes(
  event: TemporalNavigatorEvent,
  liveIso: string
): number {
  return Math.round((Date.parse(event.timeIso) - Date.parse(liveIso)) / 60_000);
}

export function temporalEventInRailWindow(
  event: TemporalNavigatorEvent,
  liveIso: string
): boolean {
  const offset = temporalEventOffsetMinutes(event, liveIso);
  return (
    offset >= -TEMPORAL_RAIL_PAST_MINUTES &&
    offset <= TEMPORAL_RAIL_FUTURE_MINUTES
  );
}

export function temporalEventRailPercent(
  event: TemporalNavigatorEvent,
  liveIso: string
): number {
  const offset = temporalEventOffsetMinutes(event, liveIso);
  const span = TEMPORAL_RAIL_PAST_MINUTES + TEMPORAL_RAIL_FUTURE_MINUTES;
  return Math.max(
    0,
    Math.min(100, ((offset + TEMPORAL_RAIL_PAST_MINUTES) / span) * 100)
  );
}

export function temporalEventNavigationMode(
  event: TemporalNavigatorEvent,
  liveIso: string
): TemporalMode {
  if (event.originalMode === 'scenario') return 'scenario';
  const delta = Date.parse(event.timeIso) - Date.parse(liveIso);
  if (Math.abs(delta) < 30_000) return 'live';
  return delta < 0 ? 'historical' : 'forecast';
}
