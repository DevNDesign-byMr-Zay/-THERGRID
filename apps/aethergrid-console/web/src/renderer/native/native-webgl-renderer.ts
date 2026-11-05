import {
  clamp,
  normalizeLongitudeDelta,
  pointSegmentDistance,
  projectNative,
  nativeSourceFeatureId,
  nativeLayerVisible,
  nativeLayerOpacity,
  type NativeFrame,
  type ProjectedFeature,
} from './native-frame';
import { drawNativeCanvas } from './native-canvas';
import { NativeWebglDriver } from './native-webgl-driver';
import { unprojectGround } from './local-projection';
import {
  type AirQualityOverlaySnapshot,
  type AtmosphericOverlaySnapshot,
} from '../overlays/atmospheric-overlay';
import type { SpatialOverlayEdge, SpatialOverlaySnapshot } from '../overlays/spatial-overlay';
import { solarStateAt } from '../solar-position';

import type {
  LayerState,
  SpatialDetailLevel,
  SpatialFeatureSelection,
  SpatialJourneyPhase,
  SpatialPickPoint,
  SpatialPerformanceTier,
  SpatialRenderer,
  SpatialRendererConfig,
  SpatialRendererStatus,
  SpatialSurfacePoint,
  SpatialTarget,
  TemporalInstant,
  VisualMode,
} from '../spatial-renderer';

const INITIAL_TARGET: SpatialTarget = {
  latitude: 20,
  longitude: 0,
  rangeMeters: 11_800_000,
  pitchDegrees: -88,
  journey: 'global',
};

const INITIAL_TIME: TemporalInstant = {
  iso: new Date().toISOString(),
  mode: 'live',
};

export class NativeWebglSpatialRenderer implements SpatialRenderer {
  cameraSnapshot() {
    if (!this.#ready) return null;
    return {
      projection: 'local-projected' as const,
      latitude: this.#target.latitude,
      longitude: this.#target.longitude,
      heightMeters: this.#target.heightMeters ?? 0,
      headingDegrees: this.#target.headingDegrees ?? 0,
      pitchDegrees: this.#target.pitchDegrees ?? -55,
      rollDegrees: 0,
      target: { ...this.#target },
    };
  }
  readonly engine = 'native-webgl' as const;

  #container: HTMLElement | null = null;
  #canvas: HTMLCanvasElement | null = null;
  #driver: NativeWebglDriver | null = null;
  #context2d: CanvasRenderingContext2D | null = null;
  #ready = false;
  #degraded = false;
  #reason: string | null = null;
  #busy = false;
  #journeyGeneration = 0;
  #finishJourney: (() => void) | null = null;
  #journeyPhase: SpatialJourneyPhase = 'idle';
  #detailLevel: SpatialDetailLevel = 'world';
  #target: SpatialTarget = { ...INITIAL_TARGET };
  #time: TemporalInstant = { ...INITIAL_TIME };
  #mode: VisualMode = 'holographic';
  #performanceTier: SpatialPerformanceTier = 'balanced';
  #layers = new Map<string, LayerState>();
  #overlays = new Map<string, SpatialOverlaySnapshot>();
  #atmosphere: AtmosphericOverlaySnapshot | null = null;
  #airQuality: AirQualityOverlaySnapshot | null = null;
  #selectedId: string | null = null;
  #selectedSourceFeatureId: string | null = null;
  #selectedLayerId: string | null = null;
  #features: ProjectedFeature[] = [];
  #animationFrame: number | null = null;

  mount(container: HTMLElement): void {
    this.#container = container;
  }

  async initialize(_config: SpatialRendererConfig = {}): Promise<void> {
    if (!this.#container) throw new Error('Native renderer must be mounted before initialization');

    const canvas = document.createElement('canvas');
    canvas.className = 'native-spatial-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
    });
    this.#container.replaceChildren(canvas);
    this.#canvas = canvas;

    const gl = canvas.getContext('webgl', {
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: false,
    });

    if (gl) {
      this.#driver = new NativeWebglDriver(canvas, gl, () => this.#render());
    } else {
      this.#context2d = canvas.getContext('2d');
      if (!this.#context2d) throw new Error('No native canvas renderer is available');
      this.#degraded = true;
      this.#reason = 'WebGL unavailable; using Canvas2D source-overlay fallback';
    }

    this.#ready = true;
    this.resize();
    this.#render();
  }

  async flyTo(target: SpatialTarget): Promise<void> {
    this.#finishJourney?.();
    this.#finishJourney = null;
    if (this.#animationFrame != null) cancelAnimationFrame(this.#animationFrame);
    this.#animationFrame = null;
    const generation = ++this.#journeyGeneration;
    const start = { ...this.#target };
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      this.#target = { ...target };
      this.#busy = false;
      this.#journeyPhase = 'idle';
      this.#detailLevel = target.journey === 'global' ? 'world' : 'district';
      this.#render();
      return;
    }
    const duration = target.journey === 'global' ? 500 : target.journey === 'direct' ? 320 : 760;
    const startedAt = performance.now();
    this.#busy = true;

    await new Promise<void>((resolve) => {
      this.#finishJourney = resolve;
      const tick = (now: number) => {
        if (generation !== this.#journeyGeneration) {
          resolve();
          return;
        }
        const raw = clamp((now - startedAt) / duration, 0, 1);
        const eased = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
        const rangeStart = start.rangeMeters ?? 11_800_000;
        const rangeEnd = target.rangeMeters ?? 5_000;

        this.#target = {
          ...target,
          latitude: start.latitude + (target.latitude - start.latitude) * eased,
          longitude:
            start.longitude + normalizeLongitudeDelta(target.longitude - start.longitude) * eased,
          rangeMeters: rangeStart + (rangeEnd - rangeStart) * eased,
        };

        if (target.journey === 'global') {
          this.#journeyPhase = 'global';
          this.#detailLevel = 'world';
        } else if (raw < 0.25) {
          this.#journeyPhase = 'global';
          this.#detailLevel = 'world';
        } else if (raw < 0.5) {
          this.#journeyPhase = 'regional';
          this.#detailLevel = 'regional';
        } else if (raw < 0.78) {
          this.#journeyPhase = 'city';
          this.#detailLevel = 'city';
        } else {
          this.#journeyPhase = 'district';
          this.#detailLevel = 'district';
        }

        this.#render();
        if (raw < 1) {
          this.#animationFrame = requestAnimationFrame(tick);
        } else {
          this.#animationFrame = null;
          this.#finishJourney = null;
          this.#target = { ...target };
          this.#busy = false;
          this.#journeyPhase = 'idle';
          this.#detailLevel = target.journey === 'global' ? 'world' : 'district';
          this.#render();
          resolve();
        }
      };
      this.#animationFrame = requestAnimationFrame(tick);
    });
  }

  setTime(time: TemporalInstant): void {
    this.#time = { ...time };
    this.#render();
  }

  setLayers(layers: readonly LayerState[]): void {
    this.#layers = new Map(layers.map((layer) => [layer.id, { ...layer }]));
    this.#revalidateSelection();
    this.#render();
  }

  selectFeature(id: string | null): void {
    this.#selectedId = id;
    this.#selectedSourceFeatureId = null;
    this.#selectedLayerId = null;

    if (id) {
      for (const snapshot of this.#overlays.values()) {
        const item =
          snapshot.nodes.find((candidate) => candidate.id === id) ??
          snapshot.edges.find((candidate) => candidate.id === id) ??
          (snapshot.areas ?? []).find((candidate) => candidate.id === id);
        if (!item) continue;
        this.#selectedLayerId = snapshot.layerId;
        this.#selectedSourceFeatureId = nativeSourceFeatureId(item.id, item.properties);
        break;
      }
    }

    this.#render();
  }

  setVisualMode(mode: VisualMode): void {
    this.#mode = mode === 'reality' ? 'solid' : mode;
    this.#render();
  }

  setPerformanceTier(tier: SpatialPerformanceTier): void {
    this.#performanceTier = tier;
    this.resize();
  }

  applyOverlay(snapshot: SpatialOverlaySnapshot): void {
    this.#overlays.set(snapshot.layerId, snapshot);
    this.#revalidateSelection();
    this.#render();
  }

  clearOverlay(layerId: string): void {
    this.#overlays.delete(layerId);
    this.#revalidateSelection();
    this.#render();
  }

  applyAtmosphere(snapshot: AtmosphericOverlaySnapshot): void {
    this.#atmosphere = snapshot;
    this.#render();
  }

  clearAtmosphere(): void {
    this.#atmosphere = null;
    this.#render();
  }

  applyAirQuality(snapshot: AirQualityOverlaySnapshot): void {
    this.#airQuality = snapshot;
    this.#render();
  }

  clearAirQuality(): void {
    this.#airQuality = null;
    this.#render();
  }

  async pickSurface(point: SpatialPickPoint): Promise<SpatialSurfacePoint | null> {
    const canvas = this.#canvas;
    if (!canvas || canvas.clientWidth <= 0 || canvas.clientHeight <= 0) return null;

    const x = clamp((point.x / canvas.clientWidth) * 2 - 1, -1, 1);
    const y = clamp(1 - (point.y / canvas.clientHeight) * 2, -1, 1);
    const range = this.#target.rangeMeters ?? 11_800_000;
    const world = range > 1_500_000 || this.#target.journey === 'global';

    if (world) {
      return {
        latitude: clamp(y * 90, -90, 90),
        longitude: ((this.#target.longitude + x * 180 + 540) % 360) - 180,
        heightMeters: null,
        source: 'native-projection',
      };
    }

    const scale = Math.max(1_500, range * 0.92);
    const [eastMeters, northMeters] = unprojectGround(
      x * scale,
      y * scale,
      this.#target.headingDegrees ?? 0,
      this.#target.pitchDegrees ?? -55,
    );
    const metersPerLongitude =
      111_320 * Math.max(0.15, Math.cos((this.#target.latitude * Math.PI) / 180));

    return {
      latitude: clamp(this.#target.latitude + northMeters / 110_540, -90, 90),
      longitude: ((this.#target.longitude + eastMeters / metersPerLongitude + 540) % 360) - 180,
      heightMeters: null,
      source: 'native-projection',
    };
  }

  async pick(point: SpatialPickPoint): Promise<SpatialFeatureSelection | null> {
    const canvas = this.#canvas;
    if (!canvas) return null;

    let nearest: ProjectedFeature | null = null;
    let distance = 18;
    for (const feature of this.#features) {
      const sx = ((feature.x + 1) / 2) * canvas.clientWidth;
      const sy = ((1 - feature.y) / 2) * canvas.clientHeight;
      const candidate = Math.hypot(point.x - sx, point.y - sy);
      if (candidate < distance) {
        distance = candidate;
        nearest = feature;
      }
    }

    if (!nearest) {
      const edgePick = this.#pickEdge(point);
      if (edgePick) return edgePick;
      return null;
    }

    return {
      id: nearest.id,
      kind: nearest.kind,
      source: nearest.source,
      latitude: nearest.latitude,
      longitude: nearest.longitude,
      heightMeters: nearest.heightMeters,
      properties: nearest.properties,
    };
  }

  resize(): void {
    const canvas = this.#canvas;
    const container = this.#container;
    if (!canvas || !container) return;
    const dprCap =
      this.#performanceTier === 'quality' ? 2 : this.#performanceTier === 'balanced' ? 1.5 : 1;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, dprCap);
    const width = Math.max(1, Math.round(container.clientWidth * dpr));
    const height = Math.max(1, Math.round(container.clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    this.#render();
  }

  status(): SpatialRendererStatus {
    const solar = solarStateAt(this.#time.iso, this.#target.latitude, this.#target.longitude);
    return {
      engine: this.engine,
      ready: this.#ready && !this.#driver?.suspended,
      visualMode: this.#mode,
      degraded: this.#degraded || !!this.#driver?.suspended,
      busy: this.#busy,
      journeyPhase: this.#journeyPhase,
      detailLevel: this.#detailLevel,
      performanceTier: this.#performanceTier,
      buildingMode: this.#overlays.has('buildings') ? 'source-extruded' : 'none',
      solar,
      reason: `${this.#driver?.reason ?? this.#reason ?? 'Native renderer'} · Building massing is a wireframe fallback; facade materials and terrain detail are unavailable.`,
    };
  }

  destroy(): void {
    this.#journeyGeneration += 1;
    this.#finishJourney?.();
    this.#finishJourney = null;
    if (this.#animationFrame != null) cancelAnimationFrame(this.#animationFrame);
    this.#animationFrame = null;
    this.#overlays.clear();
    this.#selectedId = null;
    this.#selectedSourceFeatureId = null;
    this.#selectedLayerId = null;
    this.#features = [];
    this.#driver?.destroy();
    this.#driver = null;
    this.#context2d = null;
    this.#canvas?.remove();
    this.#canvas = null;
    this.#ready = false;
  }

  #render(): void {
    if (!this.#canvas || !this.#ready || this.#driver?.suspended) return;
    this.#features = [];

    if (this.#driver) this.#features = this.#driver.draw(this.#frame());
    else if (this.#context2d)
      this.#features = drawNativeCanvas(this.#context2d, this.#canvas, this.#frame());
  }

  #revalidateSelection(): void {
    if (!this.#selectedId) return;
    const layerId = this.#selectedLayerId;
    const snapshot = layerId ? this.#overlays.get(layerId) : undefined;
    const retained =
      snapshot &&
      nativeLayerVisible(this.#frame(), layerId!, true) &&
      nativeLayerOpacity(this.#frame(), layerId!) > 0 &&
      [...snapshot.nodes, ...snapshot.edges, ...(snapshot.areas ?? [])].some(
        (item) => nativeSourceFeatureId(item.id, item.properties) === this.#selectedSourceFeatureId,
      );
    if (!retained) {
      this.#selectedId = null;
      this.#selectedSourceFeatureId = null;
      this.#selectedLayerId = null;
    }
  }

  #pickEdge(point: SpatialPickPoint): SpatialFeatureSelection | null {
    const canvas = this.#canvas;
    if (!canvas) return null;

    let best: {
      edge: SpatialOverlayEdge;
      snapshot: SpatialOverlaySnapshot;
      distance: number;
    } | null = null;

    for (const snapshot of this.#overlays.values()) {
      if (!nativeLayerVisible(this.#frame(), snapshot.layerId, true)) continue;
      for (const edge of snapshot.edges) {
        const a = projectNative(this.#frame(), edge.from);
        const b = projectNative(this.#frame(), edge.to);
        const ax = ((a[0] + 1) / 2) * canvas.clientWidth;
        const ay = ((1 - a[1]) / 2) * canvas.clientHeight;
        const bx = ((b[0] + 1) / 2) * canvas.clientWidth;
        const by = ((1 - b[1]) / 2) * canvas.clientHeight;
        const distance = pointSegmentDistance(point.x, point.y, ax, ay, bx, by);
        if (distance <= 8 && (!best || distance < best.distance)) {
          best = { edge, snapshot, distance };
        }
      }
    }

    if (!best) return null;
    const midpoint = {
      latitude: (best.edge.from.latitude + best.edge.to.latitude) / 2,
      longitude: (best.edge.from.longitude + best.edge.to.longitude) / 2,
      heightMeters: ((best.edge.from.heightMeters ?? 0) + (best.edge.to.heightMeters ?? 0)) / 2,
    };

    return {
      id: best.edge.id,
      kind: best.edge.kind,
      source: best.snapshot.attribution ?? null,
      latitude: midpoint.latitude,
      longitude: midpoint.longitude,
      heightMeters: midpoint.heightMeters,
      properties: {
        layerId: best.snapshot.layerId,
        eventTime: best.snapshot.eventTime,
        sourceTime: best.snapshot.sourceTime,
        fetchedAt: best.snapshot.fetchedAt,
        live: best.snapshot.live,
        stale: best.snapshot.stale,
        fallback: best.snapshot.fallback,
        attribution: best.snapshot.attribution,
        ...best.edge.properties,
      },
    };
  }

  #frame(): NativeFrame {
    return {
      target: this.#target,
      time: this.#time,
      mode: this.#mode,
      performanceTier: this.#performanceTier,
      layers: this.#layers,
      overlays: this.#overlays,
      atmosphere: this.#atmosphere,
      airQuality: this.#airQuality,
      selectedSourceFeatureId: this.#selectedSourceFeatureId,
      selectedLayerId: this.#selectedLayerId,
    };
  }
}
