import type { TemporalMode } from '../renderer/spatial-renderer';

export type OperationalSourceId =
  | 'weather'
  | 'hazards'
  | 'hydrology'
  | 'energy'
  | 'transit'
  | 'air-quality'
  | 'seismic';

export type TemporalSupportState = 'available' | 'current-only' | 'pending-provider';

export interface OperationalTemporalCapability {
  id: OperationalSourceId;
  label: string;
  live: TemporalSupportState;
  historical: TemporalSupportState;
  forecast: TemporalSupportState;
  scenario: TemporalSupportState;
  note: string;
}

export const OPERATIONAL_TEMPORAL_CAPABILITIES: readonly OperationalTemporalCapability[] = [
  {
    id: 'weather',
    label: 'WEATHER',
    live: 'available',
    historical: 'pending-provider',
    forecast: 'available',
    scenario: 'pending-provider',
    note: 'Current atmosphere and provider-backed forecast sampling are implemented. Forecast values appear only when the selected 4D cursor aligns to an actual returned provider sample; historical weather remains unavailable.'
  },
  {
    id: 'hazards',
    label: 'HAZARDS',
    live: 'pending-provider',
    historical: 'pending-provider',
    forecast: 'pending-provider',
    scenario: 'pending-provider',
    note: 'NWS/provider alert support becomes available only after the backend provider route is present and returns source-backed data.'
  },
  {
    id: 'hydrology',
    label: 'HYDROLOGY',
    live: 'pending-provider',
    historical: 'pending-provider',
    forecast: 'pending-provider',
    scenario: 'pending-provider',
    note: 'Gauge and modeled-water time series require provider timestamps; no hydrology value is inferred locally.'
  },
  {
    id: 'energy',
    label: 'ENERGY',
    live: 'pending-provider',
    historical: 'pending-provider',
    forecast: 'pending-provider',
    scenario: 'pending-provider',
    note: 'Regional energy telemetry must be source-backed. Scenario values remain modeled and are never relabeled as live telemetry.'
  },
  {
    id: 'transit',
    label: 'TRANSIT',
    live: 'pending-provider',
    historical: 'pending-provider',
    forecast: 'pending-provider',
    scenario: 'pending-provider',
    note: 'Live vehicles require decoded GTFS-Realtime positions. Empty or unavailable feeds remain visibly unavailable.'
  },
  {
    id: 'air-quality',
    label: 'AIR QUALITY',
    live: 'available',
    historical: 'current-only',
    forecast: 'current-only',
    scenario: 'current-only',
    note: 'The current implementation is live/current-only and is hidden outside LIVE mode.'
  },
  {
    id: 'seismic',
    label: 'SEISMIC',
    live: 'available',
    historical: 'current-only',
    forecast: 'current-only',
    scenario: 'current-only',
    note: 'The current implementation is a recent-event live feed and is not replayed as historical truth.'
  }
] as const;

export function temporalSupportFor(
  capability: OperationalTemporalCapability,
  mode: TemporalMode
): TemporalSupportState {
  if (mode === 'live') return capability.live;
  if (mode === 'historical') return capability.historical;
  if (mode === 'forecast') return capability.forecast;
  return capability.scenario;
}

export function temporalCapabilityById(
  id: OperationalSourceId
): OperationalTemporalCapability {
  const capability = OPERATIONAL_TEMPORAL_CAPABILITIES.find((item) => item.id === id);
  if (!capability) throw new Error(`unknown operational temporal source: ${id}`);
  return capability;
}
