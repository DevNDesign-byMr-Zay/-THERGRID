import type {
  AirQualityOverlaySnapshot,
  AtmosphericOverlaySnapshot
} from '../overlays/atmospheric-overlay';
import {
  Cartesian2,
  Cesium3DTileFeature,
  Cesium3DTileset,
  Color,
  EllipsoidTerrainProvider,
  Entity,
  Ion,
  JulianDate,
  OpenStreetMapImageryProvider,
  Math as CesiumMath,
  Terrain,
  Viewer,
  createGooglePhotorealistic3DTileset,
  createOsmBuildingsAsync
} from 'cesium';
import { spatialRenderFrameKey } from '../../time/render-frame';

import type { SpatialOverlaySnapshot } from '../overlays/spatial-overlay';

import type {
  LayerState,
  SpatialFeatureSelection,
  SpatialCameraSnapshot,
  SpatialPickPoint,
  SpatialRenderer,
  SpatialRendererConfig,
  SpatialDetailLevel,
  SpatialJourneyPhase,
  SpatialPerformanceTier,
  SpatialRendererStatus,
  SpatialSolarStatus,
  SpatialSurfacePoint,
  SpatialTarget,
  TemporalInstant,
  VisualMode
} from '../spatial-renderer';

import { AirQualityLayer } from './air-quality-layer';
import { CameraJourneyController } from './camera-journey-controller';
import { pickCesiumSurface } from './surface-picking';
import { GeodeticGridLayer } from './geodetic-grid-layer';
import { NetworkOverlayLayer } from './network-overlay-layer';
import { SolarLightingController } from './solar-lighting-controller';
import { VisualModeController } from './visual-mode-controller';
import { WeatherAtmosphereLayer } from './weather-atmosphere-layer';

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

  cameraSnapshot(): SpatialCameraSnapshot | null {
    if (!this.#viewer || !this.#ready) return null;
    const camera = this.#viewer.camera, position = camera.positionCartographic;
    return { projection: 'geocentric', latitude: CesiumMath.toDegrees(position.latitude), longitude: CesiumMath.toDegrees(position.longitude),
      heightMeters: position.height, headingDegrees: CesiumMath.toDegrees(camera.heading), pitchDegrees: CesiumMath.toDegrees(camera.pitch), rollDegrees: CesiumMath.toDegrees(camera.roll) };
  }

  #container: HTMLElement | null = null;
  #viewer: Viewer | null = null;
  #buildings: Cesium3DTileset | null = null;
  #ionEnabled = false;
  #realityTiles: Cesium3DTileset | null = null;
  #grid: GeodeticGridLayer | null = null;
  #cameraJourney: CameraJourneyController | null = null;
  #visualController: VisualModeController | null = null;
  #weather: WeatherAtmosphereLayer | null = null;
  #airQuality: AirQualityLayer | null = null;
  #solarLighting: SolarLightingController | null = null;
  #overlays = new Map<string, NetworkOverlayLayer>();
  #visualMode: VisualMode = 'solid';
  #appliedVisualMode: VisualMode = 'solid';
  #performanceTier: SpatialPerformanceTier = 'balanced';
  #selectedTile: { feature: Cesium3DTileFeature; color: Color } | null = null;
  #layers = new Map<string, LayerState>();
  #time: TemporalInstant | null = null;
  #renderFrameKey: string | null = null;
  #motionQuery: MediaQueryList | null = null;
  #initialClockAnimation = false;
  #onCameraInput = (event: Event) => {
    if (this.#motionQuery?.matches !== true || (event.type === 'pointermove' && !(event as PointerEvent).buttons)) return;
    this.#viewer?.scene.requestRender();
  };
  #onMotionChange = () => {
    if (!this.#viewer) return;
    this.#viewer.scene.requestRenderMode = this.#motionQuery?.matches === true;
    this.#viewer.clock.shouldAnimate = this.#motionQuery?.matches ? false : this.#initialClockAnimation;
    this.#renderFrameKey = null;
    this.#viewer.scene.requestRender();
  };
  #ready = false;
  #degraded = false;
  #busy = false;
  #journeyPhase: SpatialJourneyPhase = 'idle';
  #journeyGeneration = 0;
  #detailLevel: SpatialDetailLevel = 'district';
  #solar: SpatialSolarStatus | null = null;
  #reason: string | null = null;

  mount(container: HTMLElement): void {
    this.#container = container;
  }

  async initialize(config: SpatialRendererConfig = {}): Promise<void> {
    if (!this.#container) throw new Error('Cesium renderer must be mounted before initialization');

    const ionEnabled = Boolean(config.cesiumIonToken);
    this.#ionEnabled = ionEnabled;
    if (config.cesiumIonToken) Ion.defaultAccessToken = config.cesiumIonToken;

    this.#motionQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    this.#viewer = new Viewer(this.#container, {
      requestRenderMode: this.#motionQuery?.matches === true,
      maximumRenderTimeChange: Number.POSITIVE_INFINITY,
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      sceneModePicker: false,
      selectionIndicator: true,
      shadows: true,
      timeline: false,
      baseLayer: ionEnabled ? undefined : false,
      ...(ionEnabled
        ? {
            terrain: Terrain.fromWorldTerrain({
              requestVertexNormals: true,
              requestWaterMask: true
            })
          }
        : {
            terrainProvider: new EllipsoidTerrainProvider()
          })
    });

    this.#initialClockAnimation = this.#viewer.clock.shouldAnimate;
    this.#motionQuery?.addEventListener('change', this.#onMotionChange);
    for (const type of ['wheel', 'pointerdown', 'pointermove', 'pointerup']) this.#viewer.canvas.addEventListener(type, this.#onCameraInput, {passive: true});
    this.#onMotionChange();
    if (!ionEnabled) {
      try {
        const osmLayer = this.#viewer.imageryLayers.addImageryProvider(
          new OpenStreetMapImageryProvider({
            url: 'https://tile.openstreetmap.org/'
          })
        );
        osmLayer.brightness = 0.44;
        osmLayer.contrast = 1.26;
        osmLayer.saturation = 0.46;
        osmLayer.gamma = 0.86;
      } catch {
        // The Cesium ellipsoid + source-backed overlays remain usable if imagery is unavailable.
      }
    }

    this.#viewer.scene.globe.baseColor =
      Color.fromCssColorString('#06111c');
    this.#viewer.scene.globe.enableLighting = true;
    this.#viewer.scene.globe.depthTestAgainstTerrain = ionEnabled;
    if (this.#viewer.scene.skyAtmosphere) {
      this.#viewer.scene.skyAtmosphere.show = true;
    }
    this.#grid = new GeodeticGridLayer(this.#viewer.scene);
    this.#cameraJourney = new CameraJourneyController(this.#viewer.camera);
    this.#visualController = new VisualModeController(this.#viewer, {
      realityEnabled: config.realityEnabled
    });
    this.#weather = new WeatherAtmosphereLayer(this.#viewer);
    this.#airQuality = new AirQualityLayer(this.#viewer);
    this.#solarLighting = new SolarLightingController(this.#viewer);

    if (ionEnabled) {
      try {
        // The factory forwards all constructor options; its generated type omits these.
        const buildingOptions: Cesium3DTileset.ConstructorOptions = {
          enableDebugWireframe: true,
          enableShowOutline: true,
          showOutline: true
        };
        this.#buildings = await createOsmBuildingsAsync(buildingOptions);
        this.#viewer.scene.primitives.add(this.#buildings);
        this.#visualController.setBuildings(this.#buildings);
        this.#applyDetailForPhase(
          this.#journeyPhase === 'idle' ? 'district' : this.#journeyPhase
        );
      } catch {
        this.#buildings = null;
        this.#visualController.setBuildings(null);
      }
    } else {
      this.#buildings = null;
      this.#visualController.setBuildings(null);
    }

    if (config.realityEnabled && ionEnabled) {
      try {
        this.#realityTiles = await createGooglePhotorealistic3DTileset();
        this.#realityTiles.show = false;
        this.#viewer.scene.primitives.add(this.#realityTiles);
        this.#visualController.setRealityTiles(this.#realityTiles);
      } catch (error) {
        this.#realityTiles = null;
        this.#visualController.setRealityTiles(
          null,
          error instanceof Error
            ? `Photorealistic 3D Tiles unavailable: ${error.message}`
            : 'Photorealistic 3D Tiles unavailable'
        );
      }
    } else {
      this.#visualController.setRealityTiles(null);
    }

    this.#ready = true;
    this.setVisualMode(this.#visualMode);
    this.#applyLayerVisibility();
  }

  async flyTo(target: SpatialTarget): Promise<void> {
    this.#requireViewer();
    if (!this.#cameraJourney) throw new Error('Cesium camera journey is not initialized');

    const generation = ++this.#journeyGeneration;
    this.#busy = true;
    this.#solar = this.#solarLighting?.setTarget(target) ?? this.#solar;
    if (this.#solar) this.#visualController?.setSolarPhase(this.#solar.phase);
    try {
      await this.#cameraJourney.flyTo(target, (phase) => {
        this.#journeyPhase = phase;
        this.#applyDetailForPhase(phase);
      });
    } finally {
      if (generation === this.#journeyGeneration) {
        this.#busy = false;
        this.#journeyPhase = 'idle';
        if (target.journey === 'global') this.#applyDetailForPhase('global');
        else this.#applyDetailForPhase('district');
      }
    }
  }

  setTime(time: TemporalInstant): void {
    const viewer = this.#requireViewer();
    const key = spatialRenderFrameKey(time);
    const unchanged = this.#motionQuery?.matches === true && this.#renderFrameKey === key;
    this.#time = { ...time };
    this.#renderFrameKey = key;
    if (unchanged) { viewer.clock.currentTime = JulianDate.fromIso8601(time.iso); return; }
    this.#solar = this.#solarLighting?.setTime(time) ?? this.#solar;
    if (this.#solar) this.#visualController?.setSolarPhase(this.#solar.phase);
    this.#grid?.setTime(time.iso);
    for (const overlay of this.#overlays.values()) overlay.setTime(time);
    this.#weather?.setTime(time);
    this.#airQuality?.setTime(time);
    viewer.scene.requestRender();
  }

  setLayers(layers: readonly LayerState[]): void {
    this.#layers = new Map(layers.map((layer) => [layer.id, { ...layer }]));
    this.#applyLayerVisibility();
  }

  selectFeature(id: string | null): void {
    const viewer = this.#viewer;
    if (!viewer) return;
    if (id == null) {
      this.#clearSelection();
      viewer.scene.requestRender();
      return;
    }

    if (viewer.selectedEntity?.id === id) return;
    if (this.#selectedTile && featureId(this.#selectedTile.feature) === id) return;
  }

  setVisualMode(mode: VisualMode): void {
    this.#visualMode = mode;
    if (!this.#visualController) return;
    const result = this.#visualController.apply(mode);
    this.#appliedVisualMode = result.applied;
    this.#grid?.setVisualMode(result.applied);
    this.#degraded = result.degraded;
    this.#reason = result.reason;
    this.#applyLayerVisibility();
  }

  setPerformanceTier(tier: SpatialPerformanceTier): void {
    this.#performanceTier = tier;
    const viewer = this.#viewer;
    if (!viewer) return;

    viewer.resolutionScale =
      tier === 'quality' ? 1 : tier === 'balanced' ? 0.84 : 0.66;
    const phase =
      this.#journeyPhase === 'idle' ? 'district' : this.#journeyPhase;
    this.#applyDetailForPhase(phase);
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
    overlay.setPresentation(this.#appliedVisualMode, this.#layers.get(snapshot.layerId)?.opacity ?? 1);
    if (this.#time) overlay.setTime(this.#time);
    const sourceBuildingsSuppressed =
      snapshot.layerId === 'buildings' &&
      this.#ionEnabled &&
      this.#buildings != null;
    overlay.setVisible(
      sourceBuildingsSuppressed
        ? false
        : this.#layerVisible(snapshot.layerId, true)
    );
    if (snapshot.layerId === 'buildings' && this.#buildings) {
      this.#buildings.show = this.#buildingsShouldShow();
    }
    viewer.scene.requestRender();
  }

  clearOverlay(layerId: string): void {
    const overlay = this.#overlays.get(layerId);
    if (!overlay) return;
    overlay.destroy();
    this.#overlays.delete(layerId);
    if (layerId === 'buildings' && this.#buildings) {
      this.#buildings.show = this.#buildingsShouldShow();
      this.#viewer?.scene.requestRender();
    }
  }

  applyAtmosphere(snapshot: AtmosphericOverlaySnapshot): void {
    this.#weather?.apply(snapshot);
    this.#weather?.setVisible(this.#layerVisible('weather', true));
  }

  clearAtmosphere(): void {
    this.#weather?.setVisible(false);
  }

  applyAirQuality(snapshot: AirQualityOverlaySnapshot): void {
    this.#airQuality?.apply(snapshot);
    this.#airQuality?.setVisible(this.#layerVisible('air', true));
  }

  clearAirQuality(): void {
    this.#airQuality?.setVisible(false);
  }

  async pickSurface(point: SpatialPickPoint): Promise<SpatialSurfacePoint | null> {
    return pickCesiumSurface(this.#requireViewer(), point, this.#ionEnabled);
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
      this.#clearSelection();
      this.#selectedTile = {
        feature: picked,
        color: Color.clone(picked.color, new Color())
      };
      picked.color = Color.fromCssColorString('#78efff').withAlpha(1);
      viewer.scene.requestRender();
      return {
        id: featureId(picked) ?? 'cesium-feature',
        kind: String(picked.getProperty('building') || picked.getProperty('type') || '3d-tile'),
        source:
          this.#appliedVisualMode === 'reality'
            ? 'google-photorealistic-3d-tiles'
            : 'cesium-osm-buildings',
        latitude: cartographic ? CesiumMath.toDegrees(cartographic.latitude) : undefined,
        longitude: cartographic ? CesiumMath.toDegrees(cartographic.longitude) : undefined,
        heightMeters: cartographic?.height,
        properties: featureProperties(picked)
      };
    }

    const primitiveFeature = picked?.id;
    if (
      primitiveFeature &&
      typeof primitiveFeature === 'object' &&
      primitiveFeature.aethergridSourceBuilding === true
    ) {
      this.#clearSelection();
      const layerId = typeof primitiveFeature.properties?.layerId === 'string' ? primitiveFeature.properties.layerId : 'buildings';
      this.#overlays.get(layerId)?.selectSourceFeature(String(primitiveFeature.sourceFeatureId ?? primitiveFeature.id));
      const latitude = Number(primitiveFeature.latitude);
      const longitude = Number(primitiveFeature.longitude);
      const heightMeters = Number(primitiveFeature.heightM);
      return {
        id: String(primitiveFeature.id ?? primitiveFeature.sourceFeatureId ?? 'source-building'),
        kind: 'building',
        source: 'openstreetmap-source-extrusion',
        latitude: Number.isFinite(latitude) ? latitude : undefined,
        longitude: Number.isFinite(longitude) ? longitude : undefined,
        heightMeters: Number.isFinite(heightMeters) ? heightMeters : undefined,
        properties:
          primitiveFeature.properties &&
          typeof primitiveFeature.properties === 'object'
            ? primitiveFeature.properties
            : {}
      };
    }

    const entity = picked?.id;
    if (entity instanceof Entity) {
      this.#clearSelection();
      viewer.selectedEntity = entity;
      const properties = entity.properties?.getValue(viewer.clock.currentTime) as
        | Record<string, unknown>
        | undefined;
      const layerId =
        typeof properties?.layerId === 'string' ? properties.layerId : null;
      const rawSourceFeatureId = properties?.sourceFeatureId;
      const sourceFeatureId =
        typeof rawSourceFeatureId === 'string' && rawSourceFeatureId.trim()
          ? rawSourceFeatureId.trim()
          : entity.id;
      if (layerId) {
        this.#overlays.get(layerId)?.selectSourceFeature(sourceFeatureId);
      }
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

    this.#clearSelection();
    viewer.scene.requestRender();
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
      busy: this.#busy,
      journeyPhase: this.#journeyPhase,
      detailLevel: this.#detailLevel,
      performanceTier: this.#performanceTier,
      buildingMode:
        this.#ionEnabled && this.#buildings
          ? 'cesium-osm'
          : this.#overlays.has('buildings')
            ? 'source-extruded'
            : 'none',
      solar: this.#solar,
      reason: this.#reason
    };
  }

  destroy(): void {
    for (const type of ['wheel', 'pointerdown', 'pointermove', 'pointerup']) this.#viewer?.canvas.removeEventListener(type, this.#onCameraInput);
    this.#motionQuery?.removeEventListener('change', this.#onMotionChange);
    this.#motionQuery = null;
    this.#renderFrameKey = null;
    this.#journeyGeneration += 1;
    this.#clearSelection();
    this.#cameraJourney?.cancel();
    this.#cameraJourney = null;
    this.#visualController = null;
    this.#weather?.destroy();
    this.#weather = null;
    this.#airQuality?.destroy();
    this.#airQuality = null;
    this.#solarLighting = null;
    for (const overlay of this.#overlays.values()) overlay.destroy();
    this.#overlays.clear();
    this.#grid?.destroy();
    this.#grid = null;
    if (this.#viewer && !this.#viewer.isDestroyed()) this.#viewer.destroy();
    this.#viewer = null;
    this.#buildings = null;
    this.#realityTiles = null;
    this.#time = null;
    this.#ready = false;
  }

  #clearSelection(): void {
    if (this.#selectedTile) {
      this.#selectedTile.feature.color = Color.clone(this.#selectedTile.color, new Color());
      this.#selectedTile = null;
    }
    for (const overlay of this.#overlays.values()) {
      overlay.clearSelection();
    }
    if (this.#viewer) this.#viewer.selectedEntity = undefined;
  }

  #applyDetailForPhase(phase: Exclude<SpatialJourneyPhase, 'idle'>): void {
    const viewer = this.#viewer;
    if (!viewer) return;

    const detail: Record<
      Exclude<SpatialJourneyPhase, 'idle'>,
      { level: SpatialDetailLevel; terrainSse: number; buildingSse: number }
    > = {
      global: { level: 'world', terrainSse: 5.2, buildingSse: 30 },
      regional: { level: 'regional', terrainSse: 3.6, buildingSse: 22 },
      city: { level: 'city', terrainSse: 2.2, buildingSse: 16 },
      district: { level: 'district', terrainSse: 1.4, buildingSse: 10 }
    };

    const next = detail[phase];
    const detailMultiplier =
      this.#performanceTier === 'quality'
        ? 0.82
        : this.#performanceTier === 'balanced'
          ? 1.12
          : 1.62;
    this.#detailLevel = next.level;
    viewer.scene.globe.maximumScreenSpaceError =
      next.terrainSse * detailMultiplier;
    if (this.#buildings) {
      this.#buildings.maximumScreenSpaceError =
        next.buildingSse * detailMultiplier;
      this.#buildings.show = this.#buildingsShouldShow();
    }
    if (this.#realityTiles) {
      this.#realityTiles.maximumScreenSpaceError =
        next.buildingSse * detailMultiplier;
    }
    this.#applyLayerVisibility();
    viewer.scene.requestRender();
  }

  #buildingsShouldShow(): boolean {
    return (
      this.#appliedVisualMode !== 'reality' &&
      this.#layerVisible('buildings', true) &&
      (this.#detailLevel === 'city' || this.#detailLevel === 'district')
    );
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
    const realityActive =
      this.#appliedVisualMode === 'reality' && this.#realityTiles != null;
    this.#viewer.scene.globe.show = realityActive
      ? false
      : this.#layerVisible('terrain', true);
    if (this.#realityTiles) this.#realityTiles.show = realityActive;
    if (this.#buildings) {
      this.#buildings.show = realityActive ? false : this.#buildingsShouldShow() && (this.#layers.get('buildings')?.opacity ?? 1) > 0;
    }
    this.#visualController?.setOpacity(this.#layers.get('buildings')?.opacity ?? 1);
    this.#grid?.setVisible(this.#layerVisible('grid', true));
    this.#grid?.setOpacity(this.#layers.get('grid')?.opacity ?? 1);
    this.#weather?.setVisible(this.#layerVisible('weather', true));
    this.#airQuality?.setVisible(this.#layerVisible('air', true));
    for (const [layerId, overlay] of this.#overlays) {
      overlay.setPresentation(this.#appliedVisualMode, this.#layers.get(layerId)?.opacity ?? 1);
      const sourceBuildingsSuppressed =
        layerId === 'buildings' &&
        this.#ionEnabled &&
        this.#buildings != null;
      overlay.setVisible(
        sourceBuildingsSuppressed
          ? false
          : this.#layerVisible(layerId, true)
      );
    }
    this.#viewer.scene.requestRender();
  }
}
