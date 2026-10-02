import { JulianDate, Viewer } from 'cesium';

import type { SpatialTarget, TemporalInstant } from '../spatial-renderer';
import { solarStateAt, type SolarState } from '../solar-position';

export class SolarLightingController {
  #viewer: Viewer;
  #target: Pick<SpatialTarget, 'latitude' | 'longitude'> = {
    latitude: 20,
    longitude: 0
  };
  #time: TemporalInstant = {
    iso: new Date().toISOString(),
    mode: 'live'
  };
  #state: SolarState = solarStateAt(
    this.#time.iso,
    this.#target.latitude,
    this.#target.longitude
  );

  constructor(viewer: Viewer) {
    this.#viewer = viewer;
  }

  setTarget(target: SpatialTarget): SolarState {
    this.#target = {
      latitude: target.latitude,
      longitude: target.longitude
    };
    return this.#apply();
  }

  setTime(time: TemporalInstant): SolarState {
    this.#time = { ...time };
    return this.#apply();
  }

  state(): SolarState {
    return { ...this.#state };
  }

  #apply(): SolarState {
    const viewer = this.#viewer;
    this.#state = solarStateAt(
      this.#time.iso,
      this.#target.latitude,
      this.#target.longitude
    );

    viewer.clock.currentTime = JulianDate.fromIso8601(this.#time.iso);
    viewer.scene.globe.enableLighting = true;

    const sky = viewer.scene.skyAtmosphere;
    if (sky) {
      const elevation = this.#state.elevationDegrees;
      sky.brightnessShift =
        elevation >= 10
          ? 0
          : elevation >= -1
            ? -0.16
            : elevation >= -6
              ? -0.34
              : -0.55;
      sky.saturationShift =
        this.#state.phase === 'golden-hour'
          ? 0.08
          : this.#state.phase === 'night'
            ? -0.18
            : 0;
    }

    viewer.scene.requestRender();
    return this.state();
  }
}
