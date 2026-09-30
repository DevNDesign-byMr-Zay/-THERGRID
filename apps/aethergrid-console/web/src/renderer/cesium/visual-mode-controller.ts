import {
  Cesium3DTileStyle,
  Cesium3DTileset,
  Color,
  Viewer
} from 'cesium';

import type { VisualMode } from '../spatial-renderer';
import type { SolarPhase } from '../solar-position';

export interface VisualModeResult {
  requested: VisualMode;
  applied: VisualMode;
  degraded: boolean;
  reason: string | null;
}

export class VisualModeController {
  #viewer: Viewer;
  #buildings: Cesium3DTileset | null = null;
  #realityEnabled = false;
  #mode: VisualMode = 'solid';
  #solarPhase: SolarPhase = 'day';

  constructor(viewer: Viewer, options: { realityEnabled?: boolean } = {}) {
    this.#viewer = viewer;
    this.#realityEnabled = options.realityEnabled === true;
  }

  setBuildings(tileset: Cesium3DTileset | null): void {
    this.#buildings = tileset;
  }

  setSolarPhase(phase: SolarPhase): void {
    if (this.#solarPhase === phase) return;
    this.#solarPhase = phase;
    this.apply(this.#mode);
  }

  apply(mode: VisualMode): VisualModeResult {
    this.#mode = mode;
    const buildings = this.#buildings;
    const viewer = this.#viewer;

    if (mode === 'reality' && !this.#realityEnabled) {
      this.#applySolid();
      return {
        requested: mode,
        applied: 'solid',
        degraded: true,
        reason: 'Reality mode requires a configured photorealistic 3D Tiles provider'
      };
    }

    viewer.scene.globe.showGroundAtmosphere = mode !== 'holographic' && mode !== 'xray';
    viewer.scene.highDynamicRange = mode === 'reality' || mode === 'solid';

    if (!buildings) {
      viewer.scene.requestRender();
      return {
        requested: mode,
        applied: mode,
        degraded: true,
        reason: '3D building tiles are unavailable'
      };
    }

    if (mode === 'solid' || mode === 'reality') {
      this.#applySolid(mode === 'reality');
    } else if (mode === 'xray') {
      buildings.style = new Cesium3DTileStyle({
        color: 'color("#6bc7ff", 0.20)'
      });
      buildings.showOutline = true;
      buildings.outlineColor = Color.fromCssColorString('#83ddff').withAlpha(0.85);
    } else if (mode === 'holographic') {
      buildings.style = new Cesium3DTileStyle({
        color: 'color("#46eaff", 0.12)'
      });
      buildings.showOutline = true;
      buildings.outlineColor = Color.fromCssColorString('#58efff').withAlpha(0.96);
    } else {
      buildings.style = new Cesium3DTileStyle({
        color: 'color("#6ca8c9", 0.58)'
      });
      buildings.showOutline = true;
      buildings.outlineColor = Color.fromCssColorString('#88dcff').withAlpha(0.58);
    }

    viewer.scene.requestRender();
    return {
      requested: mode,
      applied: mode,
      degraded: false,
      reason: null
    };
  }

  #applySolid(reality = false): void {
    const buildings = this.#buildings;
    this.#viewer.scene.globe.showGroundAtmosphere = true;
    this.#viewer.scene.highDynamicRange = true;
    if (buildings) {
      if (reality || this.#solarPhase === 'day') {
        buildings.style = undefined;
      } else if (this.#solarPhase === 'golden-hour') {
        buildings.style = new Cesium3DTileStyle({
          color: 'color("#d8b18a", 0.94)'
        });
      } else if (this.#solarPhase === 'twilight') {
        buildings.style = new Cesium3DTileStyle({
          color: 'color("#59657a", 0.90)'
        });
      } else {
        buildings.style = new Cesium3DTileStyle({
          color: 'color("#273243", 0.88)'
        });
      }

      buildings.showOutline = !reality;
      buildings.outlineColor = reality
        ? Color.TRANSPARENT
        : this.#solarPhase === 'night'
          ? Color.fromCssColorString('#e4a35b').withAlpha(0.34)
          : this.#solarPhase === 'twilight'
            ? Color.fromCssColorString('#a69bc7').withAlpha(0.28)
            : Color.BLACK.withAlpha(0.45);
    }
    this.#viewer.scene.requestRender();
  }
}
