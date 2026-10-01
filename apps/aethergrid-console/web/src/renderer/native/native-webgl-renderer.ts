import {
  weatherPhenomenon,
  type AirQualityOverlaySnapshot,
  type AtmosphericOverlaySnapshot
} from '../overlays/atmospheric-overlay';
import type {
  OverlayCoordinate,
  SpatialOverlayEdge,
  SpatialOverlaySnapshot
} from '../overlays/spatial-overlay';
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
  VisualMode
} from '../spatial-renderer';

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface NativeWeatherLine {
  from: readonly [number, number];
  to: readonly [number, number];
  color: Rgba;
}

interface NativeWeatherPoint {
  position: readonly [number, number];
  color: Rgba;
  size: number;
}

interface NativeWeatherGeometry {
  lines: readonly NativeWeatherLine[];
  points: readonly NativeWeatherPoint[];
}

interface ProjectedFeature {
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

const INITIAL_TARGET: SpatialTarget = {
  latitude: 20,
  longitude: 0,
  rangeMeters: 11_800_000,
  pitchDegrees: -88,
  journey: 'global'
};

const INITIAL_TIME: TemporalInstant = {
  iso: new Date().toISOString(),
  mode: 'live'
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rgba(hex: string, alpha = 1): Rgba {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);
  return {
    r: ((value >> 16) & 255) / 255,
    g: ((value >> 8) & 255) / 255,
    b: (value & 255) / 255,
    a: alpha
  };
}

function css(color: Rgba): string {
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(
    color.b * 255
  )}, ${color.a})`;
}

function mix(a: Rgba, b: Rgba, amount: number): Rgba {
  const t = clamp(amount, 0, 1);
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
    a: a.a + (b.a - a.a) * t
  };
}

function layerColor(layerId: string, kind = ''): Rgba {
  if (layerId === 'analysis') return rgba('#c9a7ff', 0.94);
  if (layerId === 'energy') return rgba('#70e7ff', 0.9);
  if (layerId === 'roads') return rgba('#9aa9b7', 0.58);
  if (layerId === 'water') return rgba('#38bde8', 0.72);
  if (layerId === 'green') return rgba('#64d99b', 0.64);
  if (layerId === 'seismic' || kind === 'event') return rgba('#ff806b', 0.95);
  if (layerId === 'world' && kind === 'city') return rgba('#7ee8ff', 0.96);
  return rgba('#8db7cf', 0.72);
}

function normalizeLongitudeDelta(longitude: number): number {
  return ((longitude + 540) % 360) - 180;
}

function fractional(value: number): number {
  return value - Math.floor(value);
}

function deterministicUnit(index: number, salt: number): number {
  return fractional(Math.sin(index * 12.9898 + salt * 78.233) * 43_758.5453);
}

function wrapNdc(value: number): number {
  return ((((value + 1) % 2) + 2) % 2) - 1;
}

function pointSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export class NativeWebglSpatialRenderer implements SpatialRenderer {
  readonly engine = 'native-webgl' as const;

  #container: HTMLElement | null = null;
  #canvas: HTMLCanvasElement | null = null;
  #gl: WebGLRenderingContext | null = null;
  #context2d: CanvasRenderingContext2D | null = null;
  #program: WebGLProgram | null = null;
  #positionLocation = -1;
  #colorLocation = -1;
  #pointSizeLocation = -1;
  #ready = false;
  #degraded = false;
  #reason: string | null = null;
  #busy = false;
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
      height: '100%'
    });
    this.#container.replaceChildren(canvas);
    this.#canvas = canvas;

    this.#gl = canvas.getContext('webgl', {
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: false
    });

    if (this.#gl) {
      this.#initializeWebgl(this.#gl);
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
    const start = { ...this.#target };
    const duration = target.journey === 'global' ? 500 : target.journey === 'direct' ? 320 : 760;
    const startedAt = performance.now();
    this.#busy = true;

    await new Promise<void>((resolve) => {
      const tick = (now: number) => {
        const raw = clamp((now - startedAt) / duration, 0, 1);
        const eased = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
        const rangeStart = start.rangeMeters ?? 11_800_000;
        const rangeEnd = target.rangeMeters ?? 5_000;

        this.#target = {
          ...target,
          latitude: start.latitude + (target.latitude - start.latitude) * eased,
          longitude:
            start.longitude +
            normalizeLongitudeDelta(target.longitude - start.longitude) * eased,
          rangeMeters: rangeStart + (rangeEnd - rangeStart) * eased
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
          this.#target = { ...target };
          this.#busy = false;
          this.#journeyPhase = 'idle';
          this.#detailLevel =
            target.journey === 'global' ? 'world' : 'district';
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
        this.#selectedSourceFeatureId = this.#sourceFeatureId(
          item.id,
          item.properties
        );
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
    this.#render();
  }

  clearOverlay(layerId: string): void {
    this.#overlays.delete(layerId);
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
        longitude:
          ((this.#target.longitude + x * 180 + 540) % 360) - 180,
        heightMeters: null,
        source: 'native-projection'
      };
    }

    const scale = Math.max(1_500, range * 0.92);
    const eastMeters = x * scale;
    const northMeters = y * scale;
    const metersPerLongitude =
      111_320 *
      Math.max(
        0.15,
        Math.cos((this.#target.latitude * Math.PI) / 180)
      );

    return {
      latitude: clamp(
        this.#target.latitude + northMeters / 110_540,
        -90,
        90
      ),
      longitude:
        ((this.#target.longitude + eastMeters / metersPerLongitude + 540) %
          360) -
        180,
      heightMeters: null,
      source: 'native-projection'
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
      properties: nearest.properties
    };
  }

  resize(): void {
    const canvas = this.#canvas;
    const container = this.#container;
    if (!canvas || !container) return;
    const dprCap =
      this.#performanceTier === 'quality'
        ? 2
        : this.#performanceTier === 'balanced'
          ? 1.5
          : 1;
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
    const solar = solarStateAt(
      this.#time.iso,
      this.#target.latitude,
      this.#target.longitude
    );
    return {
      engine: this.engine,
      ready: this.#ready,
      visualMode: this.#mode,
      degraded: this.#degraded,
      busy: this.#busy,
      journeyPhase: this.#journeyPhase,
      detailLevel: this.#detailLevel,
      performanceTier: this.#performanceTier,
      solar,
      reason: this.#reason
    };
  }

  destroy(): void {
    if (this.#animationFrame != null) cancelAnimationFrame(this.#animationFrame);
    this.#animationFrame = null;
    this.#overlays.clear();
    this.#selectedId = null;
    this.#selectedSourceFeatureId = null;
    this.#selectedLayerId = null;
    this.#features = [];
    this.#program = null;
    this.#gl = null;
    this.#context2d = null;
    this.#canvas?.remove();
    this.#canvas = null;
    this.#ready = false;
  }

  #initializeWebgl(gl: WebGLRenderingContext): void {
    const vertexSource = `
      attribute vec2 a_position;
      attribute vec4 a_color;
      attribute float a_pointSize;
      varying vec4 v_color;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        gl_PointSize = a_pointSize;
        v_color = a_color;
      }
    `;
    const fragmentSource = `
      precision mediump float;
      varying vec4 v_color;
      void main() {
        gl_FragColor = v_color;
      }
    `;

    const vertex = this.#shader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = this.#shader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!program) throw new Error('Native WebGL program allocation failed');
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Native WebGL link failed');
    }
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    this.#program = program;
    this.#positionLocation = gl.getAttribLocation(program, 'a_position');
    this.#colorLocation = gl.getAttribLocation(program, 'a_color');
    this.#pointSizeLocation = gl.getAttribLocation(program, 'a_pointSize');
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  #shader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Native WebGL shader allocation failed');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'Native WebGL shader compile failed');
    }
    return shader;
  }

  #project(position: OverlayCoordinate): readonly [number, number] {
    const range = this.#target.rangeMeters ?? 11_800_000;
    const world = range > 1_500_000 || this.#target.journey === 'global';

    if (world) {
      const lonDelta = normalizeLongitudeDelta(
        position.longitude - this.#target.longitude
      );
      return [
        clamp(lonDelta / 180, -1.1, 1.1),
        clamp(position.latitude / 90, -1.05, 1.05)
      ];
    }

    const metersPerLon =
      111_320 * Math.max(0.15, Math.cos((this.#target.latitude * Math.PI) / 180));
    const dx =
      normalizeLongitudeDelta(position.longitude - this.#target.longitude) *
      metersPerLon;
    const dy = (position.latitude - this.#target.latitude) * 110_540;
    const scale = Math.max(1_500, range * 0.92);
    return [clamp(dx / scale, -1.2, 1.2), clamp(dy / scale, -1.2, 1.2)];
  }

  #render(): void {
    if (!this.#canvas || !this.#ready) return;
    this.#features = [];

    if (this.#gl && this.#program) this.#renderWebgl();
    else if (this.#context2d) this.#render2d();
  }

  #background(): Rgba {
    const solar = solarStateAt(
      this.#time.iso,
      this.#target.latitude,
      this.#target.longitude
    );
    let color =
      solar.phase === 'night'
        ? rgba('#030711')
        : solar.phase === 'twilight'
          ? rgba('#0b1220')
          : solar.phase === 'golden-hour'
            ? rgba('#17151a')
            : rgba('#07111d');

    if (
      this.#time.mode === 'live' &&
      this.#layerVisible('air', true) &&
      this.#airQuality?.current?.usAqi != null
    ) {
      const haze = clamp(this.#airQuality.current.usAqi / 300, 0, 0.38);
      color = mix(color, rgba('#7b746e'), haze);
    }

    if (
      (this.#time.mode === 'live' || this.#time.mode === 'forecast') &&
      this.#layerVisible('weather', true) &&
      (this.#atmosphere?.current?.cloudCoverPercent ?? 0) > 75
    ) {
      color = mix(color, rgba('#26313b'), 0.18);
    }

    return color;
  }

  #sourceFeatureId(
    id: string,
    properties: Readonly<Record<string, unknown>> | undefined
  ): string {
    const value = properties?.sourceFeatureId;
    return typeof value === 'string' && value.trim() ? value.trim() : id;
  }

  #isSelectedSource(
    layerId: string,
    id: string,
    properties: Readonly<Record<string, unknown>> | undefined
  ): boolean {
    if (id === this.#selectedId) return true;
    if (!this.#selectedSourceFeatureId || this.#selectedLayerId !== layerId) {
      return false;
    }
    return (
      this.#sourceFeatureId(id, properties) === this.#selectedSourceFeatureId
    );
  }

  #visualColor(base: Rgba): Rgba {
    if (this.#mode === 'holographic') {
      return mix(base, rgba('#55eaff', base.a), 0.72);
    }
    if (this.#mode === 'xray') {
      return mix(base, rgba('#8bdcff', Math.min(base.a, 0.5)), 0.55);
    }
    if (this.#mode === 'operations') {
      return mix(base, rgba('#78b6dc', base.a), 0.22);
    }
    return base;
  }

  #decorativeDensity(): number {
    return this.#performanceTier === 'quality'
      ? 1
      : this.#performanceTier === 'balanced'
        ? 0.72
        : 0.42;
  }

  #airGeometry(): NativeWeatherGeometry {
    if (
      this.#time.mode !== 'live' ||
      !this.#layerVisible('air', true) ||
      !this.#airQuality?.current ||
      this.#airQuality.current.usAqi == null
    ) {
      return { lines: [], points: [] };
    }

    const current = this.#airQuality.current;
    const aqi = Math.max(0, current.usAqi ?? 0);
    const pm25 = Math.max(0, current.pm25UgM3 ?? 0);
    const intensity = clamp(Math.max(aqi / 220, pm25 / 80), 0.08, 1);
    const categoryColor =
      current.category === 'good'
        ? '#72e6b8'
        : current.category === 'moderate'
          ? '#e4d06c'
          : current.category === 'unhealthy-sensitive'
            ? '#e7a461'
            : current.category === 'unhealthy'
              ? '#e1766f'
              : current.category === 'very-unhealthy'
                ? '#a678d0'
                : current.category === 'hazardous'
                  ? '#a96078'
                  : '#9fb3c3';

    const timestamp = Date.parse(this.#time.iso);
    const seconds = Number.isFinite(timestamp) ? timestamp / 1000 : 0;
    const windFrom = current.windDirectionDegrees ?? 0;
    const toward = ((windFrom + 180) * Math.PI) / 180;
    const speed = Math.max(0, current.windSpeedKph ?? 0);
    const driftX = Math.sin(toward) * speed * 0.00012;
    const driftY = Math.cos(toward) * speed * 0.00005;
    const count = Math.max(
      8,
      Math.round((22 + intensity * 86) * this.#decorativeDensity())
    );
    const points: NativeWeatherPoint[] = [];

    for (let index = 0; index < count; index += 1) {
      const seedX = deterministicUnit(index, 21.41);
      const seedY = deterministicUnit(index, 27.13);
      const depth = deterministicUnit(index, 31.79);
      const x = wrapNdc(seedX * 2 - 1 + seconds * driftX);
      const y = clamp(
        -0.65 + seedY * 1.32 + seconds * driftY,
        -0.94,
        0.82
      );
      points.push({
        position: [x, y],
        color: rgba(categoryColor, 0.025 + intensity * (0.08 + depth * 0.1)),
        size: 2.2 + intensity * 3.4 + depth * 2.2
      });
    }

    return { lines: [], points };
  }

  #weatherGeometry(): NativeWeatherGeometry {
    if (
      (this.#time.mode !== 'live' && this.#time.mode !== 'forecast') ||
      !this.#layerVisible('weather', true) ||
      !this.#atmosphere?.current
    ) {
      return { lines: [], points: [] };
    }

    const current = this.#atmosphere.current;
    const phenomenon = weatherPhenomenon(this.#atmosphere);
    const timestamp = Date.parse(this.#time.iso);
    const seconds = Number.isFinite(timestamp) ? timestamp / 1000 : 0;
    const cloudCover = clamp(current.cloudCoverPercent ?? 0, 0, 100);
    const precipitation = Math.max(0, current.precipitationMm ?? 0);
    const windSpeed = Math.max(0, current.windSpeedKph ?? 0);
    const windFrom = current.windDirectionDegrees ?? 0;
    const windToward = ((windFrom + 180) * Math.PI) / 180;
    const windX = Math.sin(windToward);
    const windY = Math.cos(windToward);

    const lines: NativeWeatherLine[] = [];
    const points: NativeWeatherPoint[] = [];

    const cloudCount = Math.round(
      (cloudCover / 100) * 72 * this.#decorativeDensity()
    );
    const cloudDrift = seconds * Math.min(80, windSpeed) * 0.00016;
    for (let index = 0; index < cloudCount; index += 1) {
      const seedX = deterministicUnit(index, 3.17);
      const seedY = deterministicUnit(index, 8.41);
      const depth = deterministicUnit(index, 5.73);
      const x = wrapNdc(seedX * 2 - 1 + cloudDrift * windX);
      const y = clamp(0.2 + seedY * 0.72 + cloudDrift * windY * 0.18, -0.95, 0.96);
      points.push({
        position: [x, y],
        color: rgba('#c4d0db', 0.05 + (cloudCover / 100) * 0.16),
        size: 5 + depth * 13
      });
    }

    const forecastPresentation =
      this.#time.mode === 'forecast' &&
      (phenomenon === 'rain' ||
        phenomenon === 'snow' ||
        phenomenon === 'thunderstorm' ||
        phenomenon === 'mixed');
    const presentationPrecipitation =
      precipitation > 0.02 ? precipitation : forecastPresentation ? 0.1 : 0;
    const precipitationActive =
      presentationPrecipitation > 0.02 &&
      (phenomenon === 'rain' ||
        phenomenon === 'snow' ||
        phenomenon === 'thunderstorm' ||
        phenomenon === 'mixed');
    if (precipitationActive) {
      const count = Math.max(
        8,
        Math.round(
          (18 + clamp(presentationPrecipitation / 8, 0, 1) * 90) *
            this.#decorativeDensity()
        )
      );
      const snow = phenomenon === 'snow';
      const fallRate = snow ? 0.045 : 0.13;
      const windLean = clamp(windSpeed / 85, 0, 0.7) * windX;

      for (let index = 0; index < count; index += 1) {
        const seedX = deterministicUnit(index, 2.11);
        const seedY = deterministicUnit(index, 7.91);
        const phase = fractional(seedY + seconds * fallRate);
        const y = 1 - phase * 2;
        const x = wrapNdc(
          seedX * 2 - 1 +
            seconds * windLean * (snow ? 0.002 : 0.0035) +
            (snow ? Math.sin(seconds * 0.7 + index) * 0.025 : 0)
        );

        if (snow) {
          points.push({
            position: [x, y],
            color: rgba('#e8f4ff', 0.42 + clamp(presentationPrecipitation / 8, 0, 1) * 0.3),
            size: 2.2 + deterministicUnit(index, 4.13) * 3
          });
        } else {
          const length = 0.045 + clamp(presentationPrecipitation / 8, 0, 1) * 0.07;
          lines.push({
            from: [x, y],
            to: [
              clamp(x + windLean * length * 0.75, -1.08, 1.08),
              clamp(y - length, -1.08, 1.08)
            ],
            color: rgba(
              '#9ddcff',
              0.22 + clamp(presentationPrecipitation / 8, 0, 1) * 0.42
            )
          });
        }
      }
    }

    if (phenomenon === 'fog') {
      const visibility = Math.max(250, current.visibilityM ?? 10_000);
      const fogStrength = 1 - clamp(visibility / 10_000, 0, 1);
      const fogCount = Math.max(
        10,
        Math.round((24 + fogStrength * 54) * this.#decorativeDensity())
      );
      for (let index = 0; index < fogCount; index += 1) {
        const x = deterministicUnit(index, 11.23) * 2 - 1;
        const y = -0.82 + deterministicUnit(index, 13.37) * 0.62;
        points.push({
          position: [x, y],
          color: rgba('#b9c8d2', 0.05 + fogStrength * 0.16),
          size: 8 + deterministicUnit(index, 17.81) * 18
        });
      }
    }

    return { lines, points };
  }

  #collectGeometry(): {
    linePositions: number[];
    lineColors: number[];
    pointPositions: number[];
    pointColors: number[];
    pointSizes: number[];
  } {
    const linePositions: number[] = [];
    const lineColors: number[] = [];
    const pointPositions: number[] = [];
    const pointColors: number[] = [];
    const pointSizes: number[] = [];

    const addLine = (
      from: OverlayCoordinate,
      to: OverlayCoordinate,
      color: Rgba
    ) => {
      const a = this.#project(from);
      const b = this.#project(to);
      linePositions.push(a[0], a[1], b[0], b[1]);
      for (let index = 0; index < 2; index += 1) {
        lineColors.push(color.r, color.g, color.b, color.a);
      }
    };

    if (this.#layerVisible('grid', true)) {
      const grid = this.#visualColor(rgba('#4b89a8', 0.14));
      for (let index = -4; index <= 4; index += 1) {
        const value = index / 4;
        linePositions.push(-1, value, 1, value, value, -1, value, 1);
        for (let repeat = 0; repeat < 4; repeat += 1) {
          lineColors.push(grid.r, grid.g, grid.b, grid.a);
        }
      }
    }

    const weather = this.#weatherGeometry();
    for (const line of weather.lines) {
      linePositions.push(
        line.from[0],
        line.from[1],
        line.to[0],
        line.to[1]
      );
      for (let repeat = 0; repeat < 2; repeat += 1) {
        lineColors.push(
          line.color.r,
          line.color.g,
          line.color.b,
          line.color.a
        );
      }
    }
    for (const point of weather.points) {
      pointPositions.push(point.position[0], point.position[1]);
      pointColors.push(
        point.color.r,
        point.color.g,
        point.color.b,
        point.color.a
      );
      pointSizes.push(point.size);
    }

    const air = this.#airGeometry();
    for (const point of air.points) {
      pointPositions.push(point.position[0], point.position[1]);
      pointColors.push(
        point.color.r,
        point.color.g,
        point.color.b,
        point.color.a
      );
      pointSizes.push(point.size);
    }

    for (const snapshot of this.#overlays.values()) {
      if (!this.#layerVisible(snapshot.layerId, true)) continue;
      const scenario = this.#time.mode === 'scenario' ? this.#time.scenarioVisual : null;
      const base = this.#visualColor(layerColor(snapshot.layerId));

      for (const edge of snapshot.edges) {
        let color = base;
        const windEdge =
          edge.kind === 'flow' && edge.properties?.vectorType === 'wind';
        const worksetGeometryEdge =
          edge.properties?.analysisType === 'workset-geometry';
        const scenarioModelEdge =
          edge.properties?.analysisType === 'scenario-model';
        if (scenarioModelEdge) {
          color = rgba('#d991ff', 0.86);
        } else if (worksetGeometryEdge) {
          color = rgba('#63ffc5', 0.78);
        } else if (windEdge && this.#time.mode === 'live') {
          const timestamp = Date.parse(this.#time.iso);
          const phase = Number.isFinite(timestamp) ? timestamp / 1000 : 0;
          const pulse = 0.5 + 0.5 * Math.sin(phase * 0.72 + (edge.intensity ?? 0.5) * 4.7);
          color = rgba('#7de9ff', 0.34 + pulse * 0.48);
        } else if (
          scenario &&
          snapshot.layerId === 'energy' &&
          (edge.kind === 'transmission' || edge.kind === 'distribution')
        ) {
          color =
            scenario.renewableBias > 0.25
              ? rgba('#63ffc5', 0.96)
              : scenario.weatherRisk > 0.55
                ? rgba('#ff7f6b', 0.96)
                : scenario.storageStress > 0.45
                  ? rgba('#f2aa62', 0.96)
                  : rgba('#ffbd73', 0.92);
          addLine(edge.from, edge.to, rgba('#91a0ad', 0.22));
        }
        if (
          this.#isSelectedSource(
            snapshot.layerId,
            edge.id,
            edge.properties
          )
        ) {
          color = rgba('#ffffff', 1);
        }
        addLine(edge.from, edge.to, color);
      }

      for (const area of snapshot.areas ?? []) {
        const selected = this.#isSelectedSource(
          snapshot.layerId,
          area.id,
          area.properties
        );
        const areaColor = selected
          ? rgba('#ffffff', 0.96)
          : this.#visualColor(layerColor(snapshot.layerId, area.kind));
        for (let index = 1; index < area.positions.length; index += 1) {
          addLine(area.positions[index - 1], area.positions[index], areaColor);
        }
      }

      for (const node of snapshot.nodes) {
        const point = this.#project(node.position);
        const urbanLight =
          node.properties?.presentationType === 'urban-illumination';
        const worksetGeometryNode =
          node.properties?.analysisType === 'workset-geometry';
        const scenarioModelNode =
          node.properties?.analysisType === 'scenario-model';
        const timestamp = Date.parse(this.#time.iso);
        const phase = Number.isFinite(timestamp) ? timestamp / 1000 : 0;
        const lightPulse =
          0.5 +
          0.5 *
            Math.sin(
              phase * 0.12 +
                node.id.length * 0.71 +
                (node.intensity ?? 0.5) * 4.2
            );
        const operatorIncident =
          node.properties?.eventType === 'operator-incident';
        const incidentSeverity = String(node.properties?.severity ?? 'info');
        const incidentColor =
          incidentSeverity === 'critical'
            ? '#ff4f63'
            : incidentSeverity === 'high'
              ? '#ff806b'
              : incidentSeverity === 'medium'
                ? '#f0b45f'
                : incidentSeverity === 'low'
                  ? '#e0d778'
                  : '#8dc9ff';
        let color = urbanLight
          ? rgba(
              '#ffd37d',
              0.48 +
                (node.intensity ?? 0.5) * 0.22 +
                lightPulse * 0.2
            )
          : operatorIncident
            ? rgba(incidentColor, 0.96)
            : scenarioModelNode
              ? rgba('#d991ff', 0.96)
              : worksetGeometryNode
                ? rgba('#63ffc5', 0.96)
                : this.#visualColor(layerColor(snapshot.layerId, node.kind));
        const selected = this.#isSelectedSource(
          snapshot.layerId,
          node.id,
          node.properties
        );
        if (selected) color = rgba('#ffffff', 1);
        pointPositions.push(point[0], point[1]);
        pointColors.push(color.r, color.g, color.b, color.a);
        pointSizes.push(
          selected
            ? 13
            : (6 + clamp(node.intensity ?? 0.5, 0, 1) * 6) *
                (urbanLight ? 0.88 + lightPulse * 0.2 : 1)
        );
        this.#features.push({
          id: node.id,
          kind: node.kind,
          source: snapshot.attribution ?? null,
          x: point[0],
          y: point[1],
          latitude: node.position.latitude,
          longitude: node.position.longitude,
          heightMeters: node.position.heightMeters ?? 0,
          properties: {
            layerId: snapshot.layerId,
            eventTime: snapshot.eventTime,
            sourceTime: snapshot.sourceTime,
            fetchedAt: snapshot.fetchedAt,
            live: snapshot.live,
            stale: snapshot.stale,
            fallback: snapshot.fallback,
            attribution: snapshot.attribution,
            ...node.properties
          }
        });
      }
    }

    return {
      linePositions,
      lineColors,
      pointPositions,
      pointColors,
      pointSizes
    };
  }

  #renderWebgl(): void {
    const gl = this.#gl;
    const program = this.#program;
    const canvas = this.#canvas;
    if (!gl || !program || !canvas) return;

    const background = this.#background();
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(background.r, background.g, background.b, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);

    const geometry = this.#collectGeometry();
    this.#drawWebgl(
      gl.LINES,
      geometry.linePositions,
      geometry.lineColors,
      new Array(geometry.linePositions.length / 2).fill(1)
    );
    this.#drawWebgl(
      gl.POINTS,
      geometry.pointPositions,
      geometry.pointColors,
      geometry.pointSizes
    );
  }

  #drawWebgl(
    mode: number,
    positions: readonly number[],
    colors: readonly number[],
    sizes: readonly number[]
  ): void {
    const gl = this.#gl;
    if (!gl || !this.#program || !positions.length) return;
    const count = positions.length / 2;

    const positionBuffer = gl.createBuffer();
    const colorBuffer = gl.createBuffer();
    const sizeBuffer = gl.createBuffer();
    if (!positionBuffer || !colorBuffer || !sizeBuffer) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.#positionLocation);
    gl.vertexAttribPointer(this.#positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.#colorLocation);
    gl.vertexAttribPointer(this.#colorLocation, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sizes), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(this.#pointSizeLocation);
    gl.vertexAttribPointer(this.#pointSizeLocation, 1, gl.FLOAT, false, 0, 0);

    gl.drawArrays(mode, 0, count);
    gl.deleteBuffer(positionBuffer);
    gl.deleteBuffer(colorBuffer);
    gl.deleteBuffer(sizeBuffer);
  }

  #render2d(): void {
    const context = this.#context2d;
    const canvas = this.#canvas;
    if (!context || !canvas) return;

    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.fillStyle = css(this.#background());
    context.fillRect(0, 0, width, height);

    const toScreen = (position: OverlayCoordinate) => {
      const projected = this.#project(position);
      return [
        ((projected[0] + 1) / 2) * width,
        ((1 - projected[1]) / 2) * height
      ] as const;
    };

    if (this.#layerVisible('grid', true)) {
      context.strokeStyle = css(this.#visualColor(rgba('#4b89a8', 0.14)));
      context.lineWidth = 1;
      context.beginPath();
      for (let index = -4; index <= 4; index += 1) {
        const x = ((index / 4 + 1) / 2) * width;
        const y = ((1 - index / 4) / 2) * height;
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.moveTo(0, y);
        context.lineTo(width, y);
      }
      context.stroke();
    }

    const weather = this.#weatherGeometry();
    context.lineCap = 'round';
    for (const line of weather.lines) {
      context.strokeStyle = css(line.color);
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(
        ((line.from[0] + 1) / 2) * width,
        ((1 - line.from[1]) / 2) * height
      );
      context.lineTo(
        ((line.to[0] + 1) / 2) * width,
        ((1 - line.to[1]) / 2) * height
      );
      context.stroke();
    }
    for (const point of weather.points) {
      context.fillStyle = css(point.color);
      context.beginPath();
      context.arc(
        ((point.position[0] + 1) / 2) * width,
        ((1 - point.position[1]) / 2) * height,
        Math.max(1, point.size / 2),
        0,
        Math.PI * 2
      );
      context.fill();
    }

    const air = this.#airGeometry();
    for (const point of air.points) {
      context.fillStyle = css(point.color);
      context.beginPath();
      context.arc(
        ((point.position[0] + 1) / 2) * width,
        ((1 - point.position[1]) / 2) * height,
        Math.max(1, point.size / 2),
        0,
        Math.PI * 2
      );
      context.fill();
    }

    for (const snapshot of this.#overlays.values()) {
      if (!this.#layerVisible(snapshot.layerId, true)) continue;
      const base = this.#visualColor(layerColor(snapshot.layerId));

      for (const edge of snapshot.edges) {
        const a = toScreen(edge.from);
        const b = toScreen(edge.to);
        const windEdge =
          edge.kind === 'flow' && edge.properties?.vectorType === 'wind';
        const worksetGeometryEdge =
          edge.properties?.analysisType === 'workset-geometry';
        const scenarioModelEdge =
          edge.properties?.analysisType === 'scenario-model';
        const timestamp = Date.parse(this.#time.iso);
        const phase = Number.isFinite(timestamp) ? timestamp / 1000 : 0;
        const pulse = 0.5 + 0.5 * Math.sin(phase * 0.72 + (edge.intensity ?? 0.5) * 4.7);
        const selected = this.#isSelectedSource(
          snapshot.layerId,
          edge.id,
          edge.properties
        );
        context.strokeStyle = selected
          ? '#ffffff'
          : css(
              scenarioModelEdge
                ? rgba('#d991ff', 0.86)
                : worksetGeometryEdge
                  ? rgba('#63ffc5', 0.78)
                  : windEdge && this.#time.mode === 'live'
                    ? rgba('#7de9ff', 0.34 + pulse * 0.48)
                    : base
            );
        context.lineWidth = selected
          ? 3
          : snapshot.layerId === 'energy'
            ? 1.8
            : windEdge
              ? 1.2 + (edge.intensity ?? 0.5) * 1.2
              : 1;
        context.beginPath();
        context.moveTo(a[0], a[1]);
        context.lineTo(b[0], b[1]);
        context.stroke();
      }

      for (const area of snapshot.areas ?? []) {
        const selected = this.#isSelectedSource(
          snapshot.layerId,
          area.id,
          area.properties
        );
        context.strokeStyle = selected
          ? '#ffffff'
          : css(this.#visualColor(layerColor(snapshot.layerId, area.kind)));
        context.lineWidth = selected ? 2.5 : 1;
        context.beginPath();
        area.positions.forEach((position, index) => {
          const point = toScreen(position);
          if (index === 0) context.moveTo(point[0], point[1]);
          else context.lineTo(point[0], point[1]);
        });
        context.closePath();
        context.stroke();
      }

      for (const node of snapshot.nodes) {
        const point = this.#project(node.position);
        const x = ((point[0] + 1) / 2) * width;
        const y = ((1 - point[1]) / 2) * height;
        const selected = this.#isSelectedSource(
          snapshot.layerId,
          node.id,
          node.properties
        );
        const urbanLight =
          node.properties?.presentationType === 'urban-illumination';
        const worksetGeometryNode =
          node.properties?.analysisType === 'workset-geometry';
        const scenarioModelNode =
          node.properties?.analysisType === 'scenario-model';
        const timestamp = Date.parse(this.#time.iso);
        const phase = Number.isFinite(timestamp) ? timestamp / 1000 : 0;
        const lightPulse =
          0.5 +
          0.5 *
            Math.sin(
              phase * 0.12 +
                node.id.length * 0.71 +
                (node.intensity ?? 0.5) * 4.2
            );
        context.fillStyle = selected
          ? '#ffffff'
          : css(
              scenarioModelNode
                ? rgba('#d991ff', 0.96)
                : worksetGeometryNode
                  ? rgba('#63ffc5', 0.96)
                  : urbanLight
                    ? rgba(
                        '#ffd37d',
                        0.48 +
                          (node.intensity ?? 0.5) * 0.22 +
                          lightPulse * 0.2
                      )
                    : this.#visualColor(
                        layerColor(snapshot.layerId, node.kind)
                      )
            );
        context.beginPath();
        context.arc(x, y, selected ? 6 : 3.5 + clamp(node.intensity ?? 0.5, 0, 1) * 2.5, 0, Math.PI * 2);
        context.fill();

        this.#features.push({
          id: node.id,
          kind: node.kind,
          source: snapshot.attribution ?? null,
          x: point[0],
          y: point[1],
          latitude: node.position.latitude,
          longitude: node.position.longitude,
          heightMeters: node.position.heightMeters ?? 0,
          properties: {
            layerId: snapshot.layerId,
            eventTime: snapshot.eventTime,
            sourceTime: snapshot.sourceTime,
            fetchedAt: snapshot.fetchedAt,
            live: snapshot.live,
            stale: snapshot.stale,
            fallback: snapshot.fallback,
            attribution: snapshot.attribution,
            ...node.properties
          }
        });
      }
    }
  }

  #pickEdge(point: SpatialPickPoint): SpatialFeatureSelection | null {
    const canvas = this.#canvas;
    if (!canvas) return null;

    let best:
      | {
          edge: SpatialOverlayEdge;
          snapshot: SpatialOverlaySnapshot;
          distance: number;
        }
      | null = null;

    for (const snapshot of this.#overlays.values()) {
      if (!this.#layerVisible(snapshot.layerId, true)) continue;
      for (const edge of snapshot.edges) {
        const a = this.#project(edge.from);
        const b = this.#project(edge.to);
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
      heightMeters:
        ((best.edge.from.heightMeters ?? 0) + (best.edge.to.heightMeters ?? 0)) / 2
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
        ...best.edge.properties
      }
    };
  }

  #layerVisible(id: string, fallback: boolean): boolean {
    return this.#layers.get(id)?.visible ?? fallback;
  }
}
