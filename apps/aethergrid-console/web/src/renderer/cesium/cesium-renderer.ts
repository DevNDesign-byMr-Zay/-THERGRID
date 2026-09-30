import {
  Cartesian2,
  BoundingSphere,
  Cartesian3,
  Cesium3DTileFeature,
  Cesium3DTileset,
  HeadingPitchRange,
  Ion,
  JulianDate,
  Math as CesiumMath,
  Terrain,
  Viewer,
  createOsmBuildingsAsync
} from 'cesium';

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

import { GeodeticGridLayer } from './geodetic-grid-layer';

const DEFAULT_RANGE_METERS = 2_500;

function featureId(feature: Cesium3DTileFeature): string | null {
  const candidates = ['id', '@id', 'osm_id', 'elementId', 'name'];
  for (const key of candidates) {
    const value = feature.getProperty(key);
    if (value != null && String(value).trim()) return String(value);
  }
  return null;
}

function featureProperties(feature: Cesium3DTileFeature): Readonly<Record<string, unknown>> {
  const names = feature.getPropertyIds();
  return Object.freeze(
    Object.fromEntries(names.map((name) => [name, feature.getProperty(name)]))
  );
}

export class CesiumSpatialRenderer implements SpatialRenderer {
  readonly engine = 'cesium' as const;

  #container: HTMLElement | null = null;
  #viewer: Viewer | null = null;
  #buildings: Cesium3DTileset | null = null;
  #grid: GeodeticGridLayer | null = null;
  #visualMode: VisualMode = 'solid';
  #layers = new Map<string, LayerState>();
  #ready = false;
  #degraded = false;
  #reason: string | null = null;

  mount(container: HTMLElement): void {
    this.#container = container;
  }

  async initialize(config: SpatialRendererConfig = {}): Promise<void> {
    if (!this.#container) throw new Error('Cesium renderer must be mounted before initialization');
    if (!config.cesiumIonToken) {
      this.#degraded = true;
      this.#reason = 'Cesium ion token is not configured';
      throw new Error(this.#reason);
    }

    Ion.defaultAccessToken = config.cesiumIonToken;

    this.#viewer = new Viewer(this.#container, {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      terrain: Terrain.fromWorldTerrain({
        requestVertexNormals: true,
        requestWaterMask: true
      })
    });

    this.#viewer.scene.globe.enableLighting = true;
    this.#viewer.scene.globe.depthTestAgainstTerrain = true;
    this.#grid = new GeodeticGridLayer(this.#viewer.scene);

    try {
      this.#buildings = await createOsmBuildingsAsync({
        enableShowOutline: true,
        showOutline: true
      });
      this.#viewer.scene.primitives.add(this.#buildings);
    } catch (error) {
      this.#degraded = true;
      this.#reason =
        error instanceof Error ? `OSM Buildings unavailable: ${error.message}` : 'OSM Buildings unavailable';
    }

    this.#ready = true;
    this.#applyLayerVisibility();
  }

  async flyTo(target: SpatialTarget): Promise<void> {
    const viewer = this.#requireViewer();
    const destination = Cartesian3.fromDegrees(
      target.longitude,
      target.latitude,
      Math.max(0, target.heightMeters ?? 0)
    );
    viewer.camera.flyToBoundingSphere(
      new BoundingSphere(destination, Math.max(10, target.rangeMeters ?? DEFAULT_RANGE_METERS)),
      {
        offset: new HeadingPitchRange(
          CesiumMath.toRadians(target.headingDegrees ?? 0),
          CesiumMath.toRadians(target.pitchDegrees ?? -35),
          Math.max(50, target.rangeMeters ?? DEFAULT_RANGE_METERS)
        ),
        duration: 1.8
      }
    );
  }

  setTime(time: TemporalInstant): void {
    const viewer = this.#requireViewer();
    viewer.clock.currentTime = JulianDate.fromIso8601(time.iso);
    this.#grid?.setTime(time.iso);
    viewer.scene.requestRender();
  }

  setLayers(layers: readonly LayerState[]): void {
    this.#layers = new Map(layers.map((layer) => [layer.id, { ...layer }]));
    this.#applyLayerVisibility();
  }

  selectFeature(_id: string | null): void {
    // Selection styling will be bound to the semantic entity resolver in the
    // next integration batch. The contract exists now so Cesium and native
    // renderers share the same state transition.
  }

  setVisualMode(mode: VisualMode): void {
    this.#visualMode = mode;
    const viewer = this.#viewer;
    if (!viewer) return;

    const holographic = mode === 'holographic' || mode === 'xray';
    viewer.scene.globe.showGroundAtmosphere = !holographic;
    viewer.scene.highDynamicRange = mode === 'reality' || mode === 'solid';
    if (this.#buildings) {
      this.#buildings.show = this.#layerVisible('buildings', true);
      this.#buildings.showOutline = mode !== 'reality';
    }
    viewer.scene.requestRender();
  }

  async pick(point: SpatialPickPoint): Promise<SpatialFeatureSelection | null> {
    const viewer = this.#requireViewer();
    const picked = viewer.scene.pick(new Cartesian2(point.x, point.y));
    if (!(picked instanceof Cesium3DTileFeature)) return null;

    const cartesian = viewer.scene.pickPosition(new Cartesian2(point.x, point.y));
    const cartographic = cartesian
      ? viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian)
      : null;

    return {
      id: featureId(picked) ?? 'cesium-feature',
      kind: String(picked.getProperty('building') || picked.getProperty('type') || '3d-tile'),
      source: 'cesium-osm-buildings',
      latitude: cartographic ? CesiumMath.toDegrees(cartographic.latitude) : undefined,
      longitude: cartographic ? CesiumMath.toDegrees(cartographic.longitude) : undefined,
      heightMeters: cartographic?.height,
      properties: featureProperties(picked)
    };
  }

  resize(): void {
    this.#viewer?.resize();
  }

  status(): SpatialRendererStatus {
    return {
      engine: this.engine,
      ready: this.#ready,
      visualMode: this.#visualMode,
      degraded: this.#degraded,
      reason: this.#reason
    };
  }

  destroy(): void {
    if (this.#viewer && !this.#viewer.isDestroyed()) this.#viewer.destroy();
    this.#viewer = null;
    this.#grid?.destroy();
    this.#grid = null;
    this.#buildings = null;
    this.#ready = false;
  }

  #requireViewer(): Viewer {
    if (!this.#viewer) throw new Error('Cesium renderer is not initialized');
    return this.#viewer;
  }

  #layerVisible(id: string, fallback: boolean): boolean {
    return this.#layers.get(id)?.visible ?? fallback;
  }

  #applyLayerVisibility(): void {
    if (!this.#viewer) return;
    this.#viewer.scene.globe.show = this.#layerVisible('terrain', true);
    if (this.#buildings) this.#buildings.show = this.#layerVisible('buildings', true);
    this.#grid?.setVisible(this.#layerVisible('grid', true));
    this.#viewer.scene.requestRender();
  }
}
