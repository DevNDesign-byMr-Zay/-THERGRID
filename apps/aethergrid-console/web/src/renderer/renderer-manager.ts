import type {
  AirQualityOverlaySnapshot,
  AtmosphericOverlaySnapshot
} from './overlays/atmospheric-overlay';
import type { SpatialOverlaySnapshot } from './overlays/spatial-overlay';

import type {
  LayerState,
  SpatialFeatureSelection,
  SpatialCameraSnapshot,
  SpatialPickPoint,
  SpatialRenderer,
  SpatialRendererConfig,
  SpatialRendererStatus,
  SpatialSurfacePoint,
  SpatialPerformanceTier,
  SpatialTarget,
  TemporalInstant,
  VisualMode
} from './spatial-renderer';

export class RendererManager {
  #container: HTMLElement | null = null;
  #disposed = false;
  #current: SpatialRenderer;
  #primary: SpatialRenderer;
  #fallback: SpatialRenderer;
  #config: SpatialRendererConfig = {};
  #layers: readonly LayerState[] = [];
  #time: TemporalInstant | null = null;
  #mode: VisualMode = 'solid';
  #performanceTier: SpatialPerformanceTier = 'balanced';
  #overlays = new Map<string, SpatialOverlaySnapshot>();
  #atmosphere: AtmosphericOverlaySnapshot | null = null;
  #airQuality: AirQualityOverlaySnapshot | null = null;
  #selectedFeatureId: string | null = null;
  #failoverReason: string | null = null;
  #transitioning = false;
  #pendingTarget: SpatialTarget | null = null;

  constructor(primary: SpatialRenderer, fallback: SpatialRenderer) {
    this.#primary = primary;
    this.#fallback = fallback;
    this.#current = primary;
  }

  get engine(): SpatialRendererStatus['engine'] {
    return this.#current.engine;
  }

  mount(container: HTMLElement): void {
    this.#container = container;
  }

  async initialize(config: SpatialRendererConfig = {}): Promise<SpatialRendererStatus> {
    if (this.#disposed) throw new Error('renderer manager is disposed');
    if (!this.#container) throw new Error('renderer manager must be mounted before initialization');
    this.#config = { ...config };

    try {
      await this.#activate(this.#primary);
      this.#failoverReason = null;
    } catch (error) {
      if (this.#disposed) throw new Error('renderer manager is disposed');
      this.#primary.destroy();
      this.#failoverReason = this.#errorMessage(error);
      await this.#activate(this.#fallback);
    }

    return this.#current.status();
  }

  async use(engine: SpatialRendererStatus['engine']): Promise<SpatialRendererStatus> {
    if (this.#transitioning) throw new Error('Renderer transition already in progress');
    const next = engine === this.#primary.engine ? this.#primary : this.#fallback;
    if (next === this.#current && next.status().ready) return this.status();

    const previous = this.#current;
    this.#transitioning = true;
    try {
      previous.destroy();
      try {
        await this.#activate(next);
        this.#failoverReason = null;
      } catch (error) {
        next.destroy();
        if (next === this.#primary) {
          this.#failoverReason = this.#errorMessage(error);
          await this.#activate(this.#fallback);
        } else {
          try { await this.#activate(previous); } catch { previous.destroy(); }
          throw error;
        }
      }
    } finally {
      this.#transitioning = false;
    }
    if (this.#pendingTarget) {
      const target = this.#pendingTarget;
      this.#pendingTarget = null;
      await this.#current.flyTo(target);
    }
    return this.status();
  }

  async flyTo(target: SpatialTarget): Promise<void> {
    if (this.#transitioning) { this.#pendingTarget = { ...target }; return; }
    await this.#current.flyTo(target);
  }

  setTime(time: TemporalInstant): void {
    this.#time = { ...time };
    if (this.#transitioning) return;
    this.#current.setTime(time);
  }

  setLayers(layers: readonly LayerState[]): void {
    this.#layers = layers.map((layer) => ({ ...layer }));
    if (this.#transitioning) return;
    this.#current.setLayers(this.#layers);
  }

  selectFeature(id: string | null): void {
    this.#selectedFeatureId = id;
    if (this.#transitioning) return;
    this.#current.selectFeature(id);
  }

  setVisualMode(mode: VisualMode): void {
    this.#mode = mode;
    if (this.#transitioning) return;
    this.#current.setVisualMode(mode);
  }

  setPerformanceTier(tier: SpatialPerformanceTier): void {
    this.#performanceTier = tier;
    if (this.#transitioning) return;
    this.#current.setPerformanceTier(tier);
  }

  applyOverlay(snapshot: SpatialOverlaySnapshot): void {
    this.#overlays.set(snapshot.layerId, snapshot);
    if (this.#transitioning) return;
    this.#current.applyOverlay(snapshot);
  }

  clearOverlay(layerId: string): void {
    this.#overlays.delete(layerId);
    if (this.#transitioning) return;
    this.#current.clearOverlay(layerId);
  }

  applyAtmosphere(snapshot: AtmosphericOverlaySnapshot): void {
    this.#atmosphere = snapshot;
    if (this.#transitioning) return;
    this.#current.applyAtmosphere(snapshot);
  }

  clearAtmosphere(): void {
    this.#atmosphere = null;
    if (this.#transitioning) return;
    this.#current.clearAtmosphere();
  }

  applyAirQuality(snapshot: AirQualityOverlaySnapshot): void {
    this.#airQuality = snapshot;
    if (this.#transitioning) return;
    this.#current.applyAirQuality(snapshot);
  }

  clearAirQuality(): void {
    this.#airQuality = null;
    if (this.#transitioning) return;
    this.#current.clearAirQuality();
  }

  async pick(point: SpatialPickPoint): Promise<SpatialFeatureSelection | null> {
    if (this.#transitioning) return null;
    return this.#current.pick(point);
  }

  async pickSurface(point: SpatialPickPoint): Promise<SpatialSurfacePoint | null> {
    if (this.#transitioning) return null;
    return this.#current.pickSurface(point);
  }

  resize(): void {
    if (this.#transitioning) return;
    this.#current.resize();
  }

  cameraSnapshot(): SpatialCameraSnapshot | null {
    if (this.#transitioning) return null;
    return this.#current.cameraSnapshot?.() ?? null;
  }

  status(): SpatialRendererStatus {
    const current = this.#current.status();
    if (this.#transitioning) return { ...current, ready: false, busy: true, reason: 'Switching spatial renderer' };
    if (this.#current !== this.#fallback || !this.#failoverReason) return current;

    return {
      ...current,
      degraded: true,
      reason: `Cesium unavailable · ${this.#failoverReason}`
    };
  }

  destroy(): void {
    this.#disposed = true;
    this.#container = null;
    this.#primary.destroy();
    this.#fallback.destroy();
  }

  #errorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.replace(/\s+/gu, ' ').trim().slice(0, 240) || 'unknown renderer failure';
  }

  async #activate(renderer: SpatialRenderer): Promise<void> {
    if (this.#disposed) throw new Error('renderer manager is disposed');
    if (!this.#container) throw new Error('renderer manager is not mounted');
    renderer.mount(this.#container);
    await renderer.initialize(this.#config);
    if (this.#disposed) {
      renderer.destroy();
      throw new Error('renderer manager is disposed');
    }
    renderer.setLayers(this.#layers);
    renderer.setVisualMode(this.#mode);
    renderer.setPerformanceTier(this.#performanceTier);
    for (const snapshot of this.#overlays.values()) renderer.applyOverlay(snapshot);
    if (this.#atmosphere) renderer.applyAtmosphere(this.#atmosphere);
    if (this.#airQuality) renderer.applyAirQuality(this.#airQuality);
    if (this.#time) renderer.setTime(this.#time);
    if (this.#selectedFeatureId) {
      renderer.selectFeature(this.#selectedFeatureId);
    }
    this.#current = renderer;
  }
}
