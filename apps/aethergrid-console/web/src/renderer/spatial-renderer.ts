import type { AtmosphericOverlaySnapshot } from './overlays/atmospheric-overlay';
import type { SpatialOverlaySnapshot } from './overlays/spatial-overlay';

export type SpatialEngine = 'cesium' | 'native-webgl';

export type VisualMode =
  | 'solid'
  | 'xray'
  | 'holographic'
  | 'operations'
  | 'reality';

export type TemporalMode = 'live' | 'historical' | 'forecast' | 'scenario';

export interface SpatialTarget {
  id?: string;
  latitude: number;
  longitude: number;
  heightMeters?: number;
  rangeMeters?: number;
  headingDegrees?: number;
  pitchDegrees?: number;
}

export interface TemporalInstant {
  iso: string;
  mode: TemporalMode;
  sourceTime?: string | null;
  scenarioId?: string | null;
}

export interface LayerState {
  id: string;
  visible: boolean;
  opacity?: number;
}

export interface SpatialFeatureSelection {
  id: string;
  kind: string;
  source?: string | null;
  latitude?: number;
  longitude?: number;
  heightMeters?: number;
  properties?: Readonly<Record<string, unknown>>;
}

export interface SpatialPickPoint {
  x: number;
  y: number;
}

export interface SpatialRendererConfig {
  cesiumIonToken?: string | null;
  worldTerrainAssetId?: number | null;
  osmBuildingsAssetId?: number | null;
  realityEnabled?: boolean;
}

export interface SpatialRendererStatus {
  engine: SpatialEngine;
  ready: boolean;
  visualMode: VisualMode;
  degraded: boolean;
  reason?: string | null;
}

export interface SpatialRenderer {
  readonly engine: SpatialEngine;

  mount(container: HTMLElement): void;
  initialize(config?: SpatialRendererConfig): Promise<void>;
  flyTo(target: SpatialTarget): Promise<void>;
  setTime(time: TemporalInstant): void;
  setLayers(layers: readonly LayerState[]): void;
  selectFeature(id: string | null): void;
  setVisualMode(mode: VisualMode): void;
  applyOverlay(snapshot: SpatialOverlaySnapshot): void;
  clearOverlay(layerId: string): void;
  applyAtmosphere(snapshot: AtmosphericOverlaySnapshot): void;
  clearAtmosphere(): void;
  pick(point: SpatialPickPoint): Promise<SpatialFeatureSelection | null>;
  resize(): void;
  status(): SpatialRendererStatus;
  destroy(): void;
}
