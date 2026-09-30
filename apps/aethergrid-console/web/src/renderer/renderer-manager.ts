import type { AtmosphericOverlaySnapshot } from './overlays/atmospheric-overlay';
import type { SpatialOverlaySnapshot } from './overlays/spatial-overlay';

import type {
  LayerState,
  SpatialFeatureSelection,
  SpatialPickPoint,
  SpatialRenderer,
  SpatialRendererConfig,
  SpatialRendererStatus,
  SpatialTarget,
  TemporalInstant,
  VisualMode
} from './spatial-renderer';

export class RendererManager {
  #container: HTMLElement | null = null;
  #current: SpatialRenderer;
  #primary: SpatialRenderer;
  #fallback: SpatialRenderer;
  #config: SpatialRendererConfig = {};
  #layers: readonly LayerState[] = [];
  #time: TemporalInstant | null = null;
  #mode: VisualMode = 'solid';
  #overlays = new Map<string, SpatialOverlaySnapshot>();
  #atmosphere: AtmosphericOverlaySnapshot | null = null;

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
    if (!this.#container) throw new Error('renderer manager must be mounted before initialization');
    this.#config = { ...config };

    try {
      await this.#activate(this.#primary);
    } catch {
      this.#primary.destroy();
      await this.#activate(this.#fallback);
    }

    return this.#current.status();
  }

  async use(engine: SpatialRendererStatus['engine']): Promise<SpatialRendererStatus> {
    const next = engine === this.#primary.engine ? this.#primary : this.#fallback;
    if (next === this.#current && next.status().ready) return next.status();

    this.#current.destroy();
    await this.#activate(next);
    return this.#current.status();
  }

  async flyTo(target: SpatialTarget): Promise<void> {
    await this.#current.flyTo(target);
  }

  setTime(time: TemporalInstant): void {
    this.#time = { ...time };
    this.#current.setTime(time);
  }

  setLayers(layers: readonly LayerState[]): void {
    this.#layers = layers.map((layer) => ({ ...layer }));
    this.#current.setLayers(this.#layers);
  }

  selectFeature(id: string | null): void {
    this.#current.selectFeature(id);
  }

  setVisualMode(mode: VisualMode): void {
    this.#mode = mode;
    this.#current.setVisualMode(mode);
  }

  applyOverlay(snapshot: SpatialOverlaySnapshot): void {
    this.#overlays.set(snapshot.layerId, snapshot);
    this.#current.applyOverlay(snapshot);
  }

  clearOverlay(layerId: string): void {
    this.#overlays.delete(layerId);
    this.#current.clearOverlay(layerId);
  }

  applyAtmosphere(snapshot: AtmosphericOverlaySnapshot): void {
    this.#atmosphere = snapshot;
    this.#current.applyAtmosphere(snapshot);
  }

  clearAtmosphere(): void {
    this.#atmosphere = null;
    this.#current.clearAtmosphere();
  }

  async pick(point: SpatialPickPoint): Promise<SpatialFeatureSelection | null> {
    return this.#current.pick(point);
  }

  resize(): void {
    this.#current.resize();
  }

  status(): SpatialRendererStatus {
    return this.#current.status();
  }

  destroy(): void {
    this.#current.destroy();
  }

  async #activate(renderer: SpatialRenderer): Promise<void> {
    if (!this.#container) throw new Error('renderer manager is not mounted');
    renderer.mount(this.#container);
    await renderer.initialize(this.#config);
    renderer.setLayers(this.#layers);
    renderer.setVisualMode(this.#mode);
    for (const snapshot of this.#overlays.values()) renderer.applyOverlay(snapshot);
    if (this.#atmosphere) renderer.applyAtmosphere(this.#atmosphere);
    if (this.#time) renderer.setTime(this.#time);
    this.#current = renderer;
  }
}
