import {
  Cartesian2,
  Cartesian3,
  CloudCollection,
  Color,
  Math as CesiumMath,
  Viewer
} from 'cesium';

import {
  weatherPhenomenon,
  type AtmosphericOverlaySnapshot
} from '../overlays/atmospheric-overlay';

interface FogBaseline {
  enabled: boolean;
  density: number;
  visualDensityScalar: number;
  minimumBrightness: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class WeatherAtmosphereLayer {
  #viewer: Viewer;
  #clouds: CloudCollection;
  #snapshot: AtmosphericOverlaySnapshot | null = null;
  #visible = true;
  #baselineFog: FogBaseline;

  constructor(viewer: Viewer) {
    this.#viewer = viewer;
    this.#clouds = new CloudCollection({
      noiseDetail: 16
    });
    this.#viewer.scene.primitives.add(this.#clouds);
    this.#baselineFog = {
      enabled: viewer.scene.fog.enabled,
      density: viewer.scene.fog.density,
      visualDensityScalar: viewer.scene.fog.visualDensityScalar,
      minimumBrightness: viewer.scene.fog.minimumBrightness
    };
  }

  apply(snapshot: AtmosphericOverlaySnapshot): void {
    this.#snapshot = snapshot;
    this.#rebuildClouds();
    this.#applyFog();
    this.#viewer.scene.requestRender();
  }

  setVisible(visible: boolean): void {
    this.#visible = visible;
    this.#clouds.show = visible;
    if (visible) this.#applyFog();
    else this.#restoreFog();
    this.#viewer.scene.requestRender();
  }

  setTime(isoTime: string): void {
    if (!this.#snapshot?.current || !this.#visible) return;
    const timestamp = Date.parse(isoTime);
    if (!Number.isFinite(timestamp)) return;

    const current = this.#snapshot.current;
    const phaseHours = timestamp / 3_600_000;
    const speed = Math.max(0, current.windSpeedKph ?? 0);
    const direction = CesiumMath.toRadians(current.windDirectionDegrees ?? 0);
    const drift = phaseHours * Math.max(0.015, speed / 1800);

    this.#clouds.noiseOffset = new Cartesian3(
      Math.sin(direction) * drift,
      Math.cos(direction) * drift,
      phaseHours * 0.002
    );
    this.#viewer.scene.requestRender();
  }

  destroy(): void {
    this.#restoreFog();
    if (!this.#clouds.isDestroyed()) {
      this.#viewer.scene.primitives.remove(this.#clouds);
      this.#clouds.destroy();
    }
    this.#snapshot = null;
  }

  #rebuildClouds(): void {
    this.#clouds.removeAll();
    const snapshot = this.#snapshot;
    const current = snapshot?.current;
    if (!snapshot || !current) return;

    const cover = clamp(current.cloudCoverPercent ?? 0, 0, 100);
    const count = Math.round((cover / 100) * 26);
    const brightness = current.isDay === false ? 0.36 : 0.72;
    const cloudColor =
      weatherPhenomenon(snapshot) === 'thunderstorm'
        ? Color.fromCssColorString('#a9b3c2').withAlpha(0.9)
        : Color.WHITE.withAlpha(0.88);

    for (let index = 0; index < count; index += 1) {
      const angle = index * 2.399963229728653;
      const normalizedRadius = Math.sqrt((index + 1) / Math.max(1, count));
      const radiusDegrees = normalizedRadius * 0.026;
      const latitude = snapshot.coordinate.latitude + Math.sin(angle) * radiusDegrees;
      const longitude =
        snapshot.coordinate.longitude +
        (Math.cos(angle) * radiusDegrees) /
          Math.max(0.2, Math.cos((snapshot.coordinate.latitude * Math.PI) / 180));
      const height = 1_500 + (index % 5) * 180;
      const width = 780 + (index % 7) * 115;
      const depth = 310 + (index % 4) * 75;

      this.#clouds.add({
        position: Cartesian3.fromDegrees(longitude, latitude, height),
        scale: new Cartesian2(1.4 + (index % 3) * 0.22, 0.78 + (index % 4) * 0.08),
        maximumSize: new Cartesian3(width, width * 0.65, depth),
        slice: 0.35 + (index % 5) * 0.08,
        brightness,
        color: cloudColor
      });
    }

    this.#clouds.show = this.#visible;
  }

  #applyFog(): void {
    if (!this.#visible) return;
    const current = this.#snapshot?.current;
    if (!current) {
      this.#restoreFog();
      return;
    }

    const phenomenon = weatherPhenomenon(this.#snapshot);
    const visibility = Math.max(100, current.visibilityM ?? 100_000);
    const foggy = phenomenon === 'fog' || visibility < 8_000;

    if (!foggy) {
      this.#restoreFog();
      return;
    }

    const visibilityFactor = clamp(1 - visibility / 8_000, 0, 1);
    this.#viewer.scene.fog.enabled = true;
    this.#viewer.scene.fog.density = 0.0007 + visibilityFactor * 0.0016;
    this.#viewer.scene.fog.visualDensityScalar = 0.22 + visibilityFactor * 0.48;
    this.#viewer.scene.fog.minimumBrightness = current.isDay === false ? 0.08 : 0.22;
  }

  #restoreFog(): void {
    const fog = this.#viewer.scene.fog;
    fog.enabled = this.#baselineFog.enabled;
    fog.density = this.#baselineFog.density;
    fog.visualDensityScalar = this.#baselineFog.visualDensityScalar;
    fog.minimumBrightness = this.#baselineFog.minimumBrightness;
  }
}
