import type { AtmosphericForecastSeries } from '../services/city-environment';

/** A provider-local time is not an instant unless its own forecast supplies an offset. */
export function forecastInstant(value: string | null | undefined, offset?: number | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?$/u.test(value)) return null;
  const zoned = /Z$|[+-]\d{2}:\d{2}$/u.test(value);
  if (!zoned && (offset == null || !Number.isFinite(offset) || Math.abs(offset) > 86_400)) return null;
  const local = value.replace(/(?:Z|[+-]\d{2}:\d{2})$/u, '');
  const localMs = Date.parse(`${local}Z`);
  if (!Number.isFinite(localMs) || new Date(localMs).toISOString().slice(0, 16) !== local.slice(0, 16)) return null;
  const parsed = Date.parse(zoned ? value : `${value}Z`);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed - (zoned ? 0 : offset! * 1000)).toISOString();
}

export function forecastFrameInstants(series: AtmosphericForecastSeries | null): readonly string[] {
  if (!series?.sourceBacked) return [];
  return Object.freeze([...new Set(series.samples
    .map((sample) => forecastInstant(sample.time, series.utcOffsetSeconds))
    .filter((iso): iso is string => iso !== null))].sort());
}
