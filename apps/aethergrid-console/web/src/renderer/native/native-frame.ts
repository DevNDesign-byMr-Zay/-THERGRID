import { projectLocal } from './local-projection';
import type { OverlayCoordinate, SpatialOverlaySnapshot } from '../overlays/spatial-overlay';
import type {
  AirQualityOverlaySnapshot,
  AtmosphericOverlaySnapshot,
} from '../overlays/atmospheric-overlay';
import type {
  LayerState,
  SpatialTarget,
  TemporalInstant,
  VisualMode,
  SpatialPerformanceTier,
} from '../spatial-renderer';
import { visualColor, type Rgba } from './native-palette';
export interface NativeWeatherLine {
  from: readonly [number, number];
  to: readonly [number, number];
  color: Rgba;
}

export interface NativeWeatherPoint {
  position: readonly [number, number];
  color: Rgba;
  size: number;
}

export interface NativeWeatherGeometry {
  lines: readonly NativeWeatherLine[];
  points: readonly NativeWeatherPoint[];
}

export interface ProjectedFeature {
  id: string;
  kind: string;
  source: string | null;
  x: number;
  y: number;
  latitude: number;
  longitude: number;
  heightMeters: number;
  properties: Readonly<Record<string, unknown>>;
}

export interface NativeFrame {
  target: SpatialTarget;
  time: TemporalInstant;
  mode: VisualMode;
  performanceTier: SpatialPerformanceTier;
  layers: ReadonlyMap<string, LayerState>;
  overlays: ReadonlyMap<string, SpatialOverlaySnapshot>;
  atmosphere: AtmosphericOverlaySnapshot | null;
  airQuality: AirQualityOverlaySnapshot | null;
  selectedSourceFeatureId: string | null;
  selectedLayerId: string | null;
}
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
export function normalizeLongitudeDelta(longitude: number): number {
  return ((longitude + 540) % 360) - 180;
}
export function fractional(value: number): number {
  return value - Math.floor(value);
}
export function deterministicUnit(index: number, salt: number): number {
  return fractional(Math.sin(index * 12.9898 + salt * 78.233) * 43_758.5453);
}
export function wrapNdc(value: number): number {
  return ((((value + 1) % 2) + 2) % 2) - 1;
}
export function pointSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
export function projectNative(
  frame: NativeFrame,
  position: OverlayCoordinate,
): readonly [number, number] {
  const range = frame.target.rangeMeters ?? 11_800_000;
  const world = range > 1_500_000 || frame.target.journey === 'global';

  if (world) {
    const lonDelta = normalizeLongitudeDelta(position.longitude - frame.target.longitude);
    return [clamp(lonDelta / 180, -1.1, 1.1), clamp(position.latitude / 90, -1.05, 1.05)];
  }

  const metersPerLon = 111_320 * Math.max(0.15, Math.cos((frame.target.latitude * Math.PI) / 180));
  const dx = normalizeLongitudeDelta(position.longitude - frame.target.longitude) * metersPerLon;
  const dy = (position.latitude - frame.target.latitude) * 110_540;
  const scale = Math.max(1_500, range * 0.92);
  const [right, vertical] = projectLocal(
    dx,
    dy,
    position.heightMeters ?? 0,
    frame.target.headingDegrees ?? 0,
    frame.target.pitchDegrees ?? -55,
  );
  return [clamp(right / scale, -1.2, 1.2), clamp(vertical / scale, -1.2, 1.2)];
}
export function nativeSourceFeatureId(
  id: string,
  properties: Readonly<Record<string, unknown>> | undefined,
): string {
  const value = properties?.sourceFeatureId;
  return typeof value === 'string' && value.trim() ? value.trim() : id;
}
export function nativeSelectedSource(
  frame: NativeFrame,
  layerId: string,
  id: string,
  properties: Readonly<Record<string, unknown>> | undefined,
): boolean {
  if (!frame.selectedSourceFeatureId || frame.selectedLayerId !== layerId) {
    return false;
  }
  return nativeSourceFeatureId(id, properties) === frame.selectedSourceFeatureId;
}
export function nativeVisualColor(frame: NativeFrame, base: Rgba): Rgba {
  return visualColor(base, frame.mode);
}
export function nativeLayerVisible(frame: NativeFrame, id: string, fallback: boolean): boolean {
  return (frame.layers.get(id)?.visible ?? fallback) && nativeLayerOpacity(frame, id) > 0;
}
export function nativeLayerOpacity(frame: NativeFrame, id: string): number {
  const value = frame.layers.get(id)?.opacity ?? 1;
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
}
