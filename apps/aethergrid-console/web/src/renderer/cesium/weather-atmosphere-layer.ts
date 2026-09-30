import {
  BoxEmitter,
  Cartesian2,
  Cartesian3,
  CloudCollection,
  Color,
  Math as CesiumMath,
  Particle,
  ParticleSystem,
  Transforms,
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

const RAIN_IMAGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="24"><line x1="2" y1="1" x2="2" y2="23" stroke="white" stroke-width="1.6" stroke-linecap="round"/></svg>'
)}`;

const SNOW_IMAGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="4.5" fill="white"/></svg>'
)}`;

function weatherVelocity(
  snapshot: AtmosphericOverlaySnapshot,
  fallSpeedMetersPerSecond: number
): (particle: Particle) => void {
  const origin = Cartesian3.fromDegrees(
    snapshot.coordinate.longitude,
    snapshot.coordinate.latitude,
    0
  );
  const up = Cartesian3.normalize(origin, new Cartesian3());
  let east = Cartesian3.cross(Cartesian3.UNIT_Z, up, new Cartesian3());
  if (Cartesian3.magnitudeSquared(east) < 1e-8) {
    east = Cartesian3.cross(Cartesian3.UNIT_Y, up, east);
  }
  Cartesian3.normalize(east, east);
  const north = Cartesian3.normalize(
    Cartesian3.cross(up, east, new Cartesian3()),
    new Cartesian3()
  );

  const meteorologicalFrom = snapshot.current?.windDirectionDegrees ?? 0;
  const towardRadians = CesiumMath.toRadians((meteorologicalFrom + 180) % 360);
  const windMetersPerSecond = Math.max(0, snapshot.current?.windSpeedKph ?? 0) / 3.6;
  const wind = Cartesian3.add(
    Cartesian3.multiplyByScalar(east, Math.sin(towardRadians) * windMetersPerSecond, new Cartesian3()),
    Cartesian3.multiplyByScalar(north, Math.cos(towardRadians) * windMetersPerSecond, new Cartesian3()),
    new Cartesian3()
  );
  const down = new Cartesian3();

  return (particle: Particle) => {
    Cartesian3.normalize(particle.position, down);
    Cartesian3.multiplyByScalar(down, -fallSpeedMetersPerSecond, down);
    Cartesian3.add(down, wind, particle.velocity);
  };
}

export class WeatherAtmosphereLayer {
  #viewer: Viewer;
  #clouds: CloudCollection;
  #snapshot: AtmosphericOverlaySnapshot | null = null;
  #precipitation: ParticleSystem | null = null;
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
    this.#rebuildPrecipitation();
    this.#applyFog();
    this.#viewer.scene.requestRender();
  }

  setVisible(visible: boolean): void {
    this.#visible = visible;
    this.#clouds.show = visible;
    if (this.#precipitation) this.#precipitation.show = visible;
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
    this.#removePrecipitation();
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

  #rebuildPrecipitation(): void {
    this.#removePrecipitation();
    const snapshot = this.#snapshot;
    const current = snapshot?.current;
    if (!snapshot || !current) return;

    const phenomenon = weatherPhenomenon(snapshot);
    const snow = phenomenon === 'snow';
    const rain = phenomenon === 'rain' || phenomenon === 'thunderstorm';
    if (!snow && !rain) return;

    const precipitation = Math.max(0.1, current.precipitationMm ?? 0.1);
    const emissionRate = snow
      ? clamp(70 + precipitation * 90, 70, 420)
      : clamp(130 + precipitation * 180, 130, 850);
    const modelMatrix = Transforms.eastNorthUpToFixedFrame(
      Cartesian3.fromDegrees(
        snapshot.coordinate.longitude,
        snapshot.coordinate.latitude,
        1_700
      )
    );

    this.#precipitation = new ParticleSystem({
      show: this.#visible,
      image: snow ? SNOW_IMAGE : RAIN_IMAGE,
      imageSize: snow ? new Cartesian2(7, 7) : new Cartesian2(2, 18),
      startColor: Color.WHITE.withAlpha(snow ? 0.78 : 0.62),
      endColor: Color.WHITE.withAlpha(0.08),
      startScale: snow ? 0.8 : 1,
      endScale: snow ? 1.1 : 0.72,
      particleLife: snow ? 5.5 : 2.8,
      minimumSpeed: snow ? 4 : 18,
      maximumSpeed: snow ? 9 : 32,
      emissionRate,
      emitter: new BoxEmitter(new Cartesian3(5_200, 5_200, 1_800)),
      modelMatrix,
      updateCallback: weatherVelocity(snapshot, snow ? 9 : 38)
    });

    this.#viewer.scene.primitives.add(this.#precipitation);
  }

  #removePrecipitation(): void {
    if (!this.#precipitation) return;
    this.#viewer.scene.primitives.remove(this.#precipitation);
    this.#precipitation = null;
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
