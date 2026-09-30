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
} from '../spatial-renderer';

export interface LegacyNativeSpatialBridge {
  initialize?(): Promise<void> | void;
  flyTo?(target: SpatialTarget): Promise<void> | void;
  setTime?(time: TemporalInstant): void;
  setLayers?(layers: readonly LayerState[]): void;
  selectFeature?(id: string | null): void;
  setVisualMode?(mode: VisualMode): void;
  pick?(point: SpatialPickPoint): Promise<SpatialFeatureSelection | null> | SpatialFeatureSelection | null;
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

  async pick(point: SpatialPickPoint): Promise<SpatialFeatureSelection | null> {
    return (await this.#bridge.pick?.(point)) ?? null;
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
