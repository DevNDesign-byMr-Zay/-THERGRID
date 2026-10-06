export type OverlayNodeKind =
  | 'substation'
  | 'generation'
  | 'storage'
  | 'load'
  | 'transit'
  | 'sensor'
  | 'city'
  | 'asset'
  | 'event'
  | 'analysis-point'
  | 'aircraft';

export type OverlayEdgeKind =
  | 'transmission'
  | 'distribution'
  | 'route'
  | 'waterway'
  | 'coastline'
  | 'flow'
  | 'dependency'
  | 'impact'
  | 'analysis-line';

export type OverlayAreaKind = 'water' | 'green';

export interface OverlayCoordinate {
  latitude: number;
  longitude: number;
  heightMeters?: number;
}

export interface SpatialOverlayNode {
  id: string;
  kind: OverlayNodeKind;
  position: OverlayCoordinate;
  label?: string;
  value?: number | null;
  unit?: string | null;
  intensity?: number;
  validFrom?: string | null;
  validTo?: string | null;
  properties?: Readonly<Record<string, unknown>>;
}

export interface SpatialOverlayEdge {
  id: string;
  kind: OverlayEdgeKind;
  from: OverlayCoordinate;
  to: OverlayCoordinate;
  label?: string;
  value?: number | null;
  unit?: string | null;
  intensity?: number;
  validFrom?: string | null;
  validTo?: string | null;
  properties?: Readonly<Record<string, unknown>>;
}

export interface SpatialOverlayArea {
  id: string;
  kind: OverlayAreaKind;
  positions: readonly OverlayCoordinate[];
  label?: string;
  intensity?: number;
  validFrom?: string | null;
  validTo?: string | null;
  properties?: Readonly<Record<string, unknown>>;
}

export interface SpatialOverlaySnapshot {
  id: string;
  layerId: string;
  eventTime: string;
  sourceTime: string | null;
  fetchedAt: string | null;
  live: boolean;
  stale: boolean;
  fallback: boolean;
  attribution?: string | null;
  nodes: readonly SpatialOverlayNode[];
  edges: readonly SpatialOverlayEdge[];
  areas?: readonly SpatialOverlayArea[];
}

export function isActiveAt(
  item: Pick<SpatialOverlayNode, 'validFrom' | 'validTo'>,
  isoTime: string
): boolean {
  const cursor = Date.parse(isoTime);
  if (!Number.isFinite(cursor)) return false;
  const start = item.validFrom ? Date.parse(item.validFrom) : Number.NEGATIVE_INFINITY;
  const end = item.validTo ? Date.parse(item.validTo) : Number.POSITIVE_INFINITY;
  return cursor >= start && cursor <= end;
}

export function overlayIntensity(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, Number(value)));
}
