import {
  Cartesian2,
  Cesium3DTileFeature,
  Cesium3DTileset,
  Entity,
  Ion,
  JulianDate,
  Math as CesiumMath,
  Terrain,
  Viewer,
  createOsmBuildingsAsync
} from 'cesium';

import type { SpatialOverlaySnapshot } from '../overlays/spatial-overlay';

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

import { CameraJourneyController } from './camera-journey-controller';
import { GeodeticGridLayer } from './geodetic-grid-layer';
import { NetworkOverlayLayer } from './network-overlay-layer';

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
  #cameraJourney: CameraJourneyController | null = null;
  #overlays = new Map<string, NetworkOverlayLayer>();
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
    this.#cameraJourney = new CameraJourneyController(this.#viewer.camera);

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
    this.#requireViewer();
    if (!this.#cameraJourney) throw new Error('Cesium camera journey is not initialized');
    await this.#cameraJourney.flyTo(target);
  }

  setTime(time: TemporalInstant): void {
    const viewer = this.#requireViewer();
    viewer.clock.currentTime = JulianDate.fromIso8601(time.iso);
    this.#grid?.setTime(time.iso);
    for (const overlay of this.#overlays.values()) overlay.setTime(time.iso);
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

  applyOverlay(snapshot: SpatialOverlaySnapshot): void {
    const viewer = this.#requireViewer();
    let overlay = this.#overlays.get(snapshot.layerId);
    if (!overlay) {
      overlay = new NetworkOverlayLayer(viewer);
      this.#overlays.set(snapshot.layerId, overlay);
    }
    overlay.apply(snapshot);
    overlay.setVisible(this.#layerVisible(snapshot.layerId, true));
  }

  clearOverlay(layerId: string): void {
    const overlay = this.#overlays.get(layerId);
    if (!overlay) return;
    overlay.destroy();
    this.#overlays.delete(layerId);
  }

  async pick(point: SpatialPickPoint): Promise<SpatialFeatureSelection | null> {
    const viewer = this.#requireViewer();
    const screen = new Cartesian2(point.x, point.y);
    const picked = viewer.scene.pick(screen);

    const cartesian = viewer.scene.pickPosition(screen);
    const cartographic = cartesian
      ? viewer.scene.globe.ellipsoid.cartesianToCartographic(cartesian)
      : null;

    if (picked instanceof Cesium3DTileFeature) {
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

    const entity = picked?.id;
    if (entity instanceof Entity) {
      const properties = entity.properties?.getValue(viewer.clock.currentTime) as
        | Record<string, unknown>
        | undefined;
      return {
        id: entity.id,
        kind: String(properties?.overlayKind ?? 'overlay-entity'),
        source: 'aethergrid-spatial-overlay',
        latitude: cartographic ? CesiumMath.toDegrees(cartographic.latitude) : undefined,
        longitude: cartographic ? CesiumMath.toDegrees(cartographic.longitude) : undefined,
        heightMeters: cartographic?.height,
        properties: properties ? Object.freeze({ ...properties }) : undefined
      };
    }

    return null;
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
    this.#cameraJourney?.cancel();
    this.#cameraJourney = null;
    for (const overlay of this.#overlays.values()) overlay.destroy();
    this.#overlays.clear();
    this.#grid?.destroy();
    this.#grid = null;
    if (this.#viewer && !this.#viewer.isDestroyed()) this.#viewer.destroy();
    this.#viewer = null;
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
    for (const [layerId, overlay] of this.#overlays) {
      overlay.setVisible(this.#layerVisible(layerId, true));
    }
    this.#viewer.scene.requestRender();
  }
}
