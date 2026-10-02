import {
  BoxEmitter,
  Cartesian2,
  Cartesian3,
  Color,
  Math as CesiumMath,
  Particle,
  ParticleSystem,
  Transforms,
  Viewer
} from 'cesium';

import type { AirQualityOverlaySnapshot } from '../overlays/atmospheric-overlay';
import type { TemporalInstant } from '../spatial-renderer';

const PARTICLE_IMAGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><circle cx="6" cy="6" r="4.2" fill="white"/></svg>'
)}`;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function categoryColor(category: string): Color {
  const css =
    category === 'good'
      ? '#72e6b8'
      : category === 'moderate'
        ? '#e4d06c'
        : category === 'unhealthy-sensitive'
          ? '#e7a461'
          : category === 'unhealthy'
            ? '#e1766f'
            : category === 'very-unhealthy'
              ? '#a678d0'
              : category === 'hazardous'
                ? '#a96078'
                : '#9fb3c3';
  return Color.fromCssColorString(css);
}

function driftUpdater(snapshot: AirQualityOverlaySnapshot) {
  const current = snapshot.current;
  const meteorologicalFrom = current?.windDirectionDegrees ?? 0;
  const toward = CesiumMath.toRadians((meteorologicalFrom + 180) % 360);
  const speedMps = Math.max(0, current?.windSpeedKph ?? 0) / 3.6;

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
  const wind = Cartesian3.add(
    Cartesian3.multiplyByScalar(east, Math.sin(toward) * speedMps * 0.28, new Cartesian3()),
    Cartesian3.multiplyByScalar(north, Math.cos(toward) * speedMps * 0.28, new Cartesian3()),
    new Cartesian3()
  );
  const localUp = new Cartesian3();

  return (particle: Particle) => {
    Cartesian3.normalize(particle.position, localUp);
    Cartesian3.multiplyByScalar(localUp, 0.12, localUp);
    Cartesian3.add(wind, localUp, particle.velocity);
  };
}

export class AirQualityLayer {
  #viewer: Viewer;
  #system: ParticleSystem | null = null;
  #snapshot: AirQualityOverlaySnapshot | null = null;
  #visible = true;
  #temporalMode: TemporalInstant['mode'] = 'live';

  constructor(viewer: Viewer) {
    this.#viewer = viewer;
  }

  apply(snapshot: AirQualityOverlaySnapshot): void {
    this.#snapshot = snapshot;
    this.#rebuild();
  }

  setVisible(visible: boolean): void {
    this.#visible = visible;
    this.#syncVisibility();
  }

  setTime(time: TemporalInstant): void {
    this.#temporalMode = time.mode;
    this.#syncVisibility();
  }

  destroy(): void {
    this.#remove();
    this.#snapshot = null;
  }

  #rebuild(): void {
    this.#remove();
    const snapshot = this.#snapshot;
    const current = snapshot?.current;
    if (!snapshot || !current || current.usAqi == null) return;

    const aqi = Math.max(0, current.usAqi);
    const pm25 = Math.max(0, current.pm25UgM3 ?? 0);
    const intensity = clamp(Math.max(aqi / 220, pm25 / 80), 0.08, 1);
    const color = categoryColor(current.category);
    const modelMatrix = Transforms.eastNorthUpToFixedFrame(
      Cartesian3.fromDegrees(
        snapshot.coordinate.longitude,
        snapshot.coordinate.latitude,
        260
      )
    );

    this.#system = new ParticleSystem({
      show: this.#visible && this.#temporalMode === 'live',
      image: PARTICLE_IMAGE,
      imageSize: new Cartesian2(3 + intensity * 3, 3 + intensity * 3),
      startColor: color.withAlpha(0.09 + intensity * 0.16),
      endColor: color.withAlpha(0.015),
      startScale: 0.7,
      endScale: 1.8,
      particleLife: 18 + intensity * 14,
      minimumSpeed: 0.15,
      maximumSpeed: 0.55,
      emissionRate: 10 + intensity * 95,
      emitter: new BoxEmitter(new Cartesian3(4_500, 4_500, 650)),
      modelMatrix,
      updateCallback: driftUpdater(snapshot)
    });

    this.#viewer.scene.primitives.add(this.#system);
    this.#viewer.scene.requestRender();
  }

  #syncVisibility(): void {
    if (this.#system) {
      this.#system.show = this.#visible && this.#temporalMode === 'live';
    }
    this.#viewer.scene.requestRender();
  }

  #remove(): void {
    if (!this.#system) return;
    this.#viewer.scene.primitives.remove(this.#system);
    this.#system = null;
  }
}
