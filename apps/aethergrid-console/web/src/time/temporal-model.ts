import type { TemporalMode } from '../renderer/spatial-renderer';

export interface TimeRange {
  start: string;
  end: string;
}

export interface TemporalSnapshot<T = unknown> {
  layerId: string;
  mode: TemporalMode;
  eventTime: string;
  sourceTime: string | null;
  fetchedAt: string | null;
  data: T;
}

export interface TemporalLayer<T = unknown> {
  readonly id: string;
  availableRange(): TimeRange | null;
  supports(isoTime: string, mode: TemporalMode): boolean;
  sample(isoTime: string, mode: TemporalMode): Promise<TemporalSnapshot<T>>;
}

export interface TemporalState {
  mode: TemporalMode;
  cursorIso: string;
  liveIso: string;
  playing: boolean;
  playbackRate: number;
  scenarioId: string | null;
}

export const TEMPORAL_MODES: readonly TemporalMode[] = [
  'live',
  'historical',
  'forecast',
  'scenario'
] as const;

export function assertIsoInstant(value: string, label = 'time'): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new TypeError(`${label} must be an ISO-8601 compatible instant`);
  }
  return new Date(timestamp).toISOString();
}

export function clampToRange(isoTime: string, range: TimeRange): string {
  const value = Date.parse(assertIsoInstant(isoTime));
  const start = Date.parse(assertIsoInstant(range.start, 'range start'));
  const end = Date.parse(assertIsoInstant(range.end, 'range end'));
  if (end < start) throw new RangeError('time range end must not precede start');
  return new Date(Math.min(end, Math.max(start, value))).toISOString();
}
