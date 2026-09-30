import type {
  AirQualityOverlaySnapshot,
  AtmosphericOverlaySnapshot
} from '../overlays/atmospheric-overlay';
import type { SpatialOverlaySnapshot } from '../overlays/spatial-overlay';

import type {
  LayerState,
  SpatialFeatureSelection,
  SpatialPickPoint,
  SpatialRenderer,
  SpatialRendererConfig,
  SpatialRendererStatus,
  SpatialSurfacePoint,
  SpatialTarget,
  TemporalInstant,
  VisualMode
} from '../spatial-renderer';

export interface LegacyNativeSpatialBridge {
  initialize?(): Promise<void> | void;
  flyTo?(target: SpatialTarget): Promise<void> | void;
  setTime?(time: TemporalInstant): void;
  setLayers?(layers: readonly LayerState[]): void;
  selectFeature?(id: string | null): void;
  setVisualMode?(mode: VisualMode): void;
  applyOverlay?(snapshot: SpatialOverlaySnapshot): void;
  clearOverlay?(layerId: string): void;
  applyAtmosphere?(snapshot: AtmosphericOverlaySnapshot): void;
  clearAtmosphere?(): void;
  applyAirQuality?(snapshot: AirQualityOverlaySnapshot): void;
  clearAirQuality?(): void;
  pick?(point: SpatialPickPoint): Promise<SpatialFeatureSelection | null> | SpatialFeatureSelection | null;
  pickSurface?(point: SpatialPickPoint): Promise<SpatialSurfacePoint | null> | SpatialSurfacePoint | null;
  resize?(): void;
  destroy?(): void;
}

export class NativeSpatialRendererAdapter implements SpatialRenderer {
  readonly engine = 'native-webgl' as const;

  #container: HTMLElement | null = null;
  #bridge: LegacyNativeSpatialBridge;
  #ready = false;
  #bridgeAttached: boolean;
  #visualMode: VisualMode = 'holographic';

  constructor(bridge: LegacyNativeSpatialBridge = {}) {
    this.#bridge = bridge;
    this.#bridgeAttached = Object.keys(bridge).length > 0;
  }

  mount(container: HTMLElement): void {
    this.#container = container;
  }

  async initialize(_config: SpatialRendererConfig = {}): Promise<void> {
    if (!this.#container) throw new Error('Native renderer must be mounted before initialization');
    await this.#bridge.initialize?.();
    this.#ready = true;
  }

  async flyTo(target: SpatialTarget): Promise<void> {
    await this.#bridge.flyTo?.(target);
  }

  setTime(time: TemporalInstant): void {
    this.#bridge.setTime?.(time);
  }

  setLayers(layers: readonly LayerState[]): void {
    this.#bridge.setLayers?.(layers);
  }

  selectFeature(id: string | null): void {
    this.#bridge.selectFeature?.(id);
  }

  setVisualMode(mode: VisualMode): void {
    this.#visualMode = mode;
    this.#bridge.setVisualMode?.(mode);
  }

  applyOverlay(snapshot: SpatialOverlaySnapshot): void {
    this.#bridge.applyOverlay?.(snapshot);
  }

  clearOverlay(layerId: string): void {
    this.#bridge.clearOverlay?.(layerId);
  }

  applyAtmosphere(snapshot: AtmosphericOverlaySnapshot): void {
    this.#bridge.applyAtmosphere?.(snapshot);
  }

  clearAtmosphere(): void {
    this.#bridge.clearAtmosphere?.();
  }

  applyAirQuality(snapshot: AirQualityOverlaySnapshot): void {
    this.#bridge.applyAirQuality?.(snapshot);
  }

  clearAirQuality(): void {
    this.#bridge.clearAirQuality?.();
  }

  async pick(point: SpatialPickPoint): Promise<SpatialFeatureSelection | null> {
    return (await this.#bridge.pick?.(point)) ?? null;
  }

  async pickSurface(point: SpatialPickPoint): Promise<SpatialSurfacePoint | null> {
    return (await this.#bridge.pickSurface?.(point)) ?? null;
  }

  resize(): void {
    this.#bridge.resize?.();
  }

  status(): SpatialRendererStatus {
    return {
      engine: this.engine,
      ready: this.#ready,
      visualMode: this.#visualMode,
      degraded: !this.#bridgeAttached,
      reason: this.#bridgeAttached ? null : 'Verified v3 native renderer bridge is not attached to the migration shell yet'
    };
  }

  destroy(): void {
    this.#bridge.destroy?.();
    this.#ready = false;
  }
}
