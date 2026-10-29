import {
  Cesium3DTileStyle,
  Cesium3DTileset,
  Color,
  Viewer
} from 'cesium';

import type { VisualMode } from '../spatial-renderer';
import type { SolarPhase } from '../solar-position';
import { solarTilePalette, tileModePalette } from './visual-mode-palette';

export interface VisualModeResult {
  requested: VisualMode;
  applied: VisualMode;
  degraded: boolean;
  reason: string | null;
}

export class VisualModeController {
  #viewer: Viewer;
  #buildings: Cesium3DTileset | null = null;
  #realityTiles: Cesium3DTileset | null = null;
  #realityError: string | null = null;
  #realityEnabled = false;
  #mode: VisualMode = 'solid';
  #solarPhase: SolarPhase = 'day';
  #opacity = 1;
  #mappedColor = 'color("white")';
  #mappedStyle: Cesium3DTileStyle | undefined;

  constructor(viewer: Viewer, options: { realityEnabled?: boolean } = {}) {
    this.#viewer = viewer;
    this.#realityEnabled = options.realityEnabled === true;
  }

  setBuildings(tileset: Cesium3DTileset | null): void {
    this.#buildings = tileset;
    this.#mappedStyle = tileset?.style;
    const color = tileset?.style?.style?.color;
    this.#mappedColor = typeof color === 'string' ? color : 'color("white")';
  }

  setOpacity(opacity: number): void {
    const next = Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1;
    if (next === this.#opacity) return;
    this.#opacity = next;
    this.apply(this.#mode);
  }


  setRealityTiles(tileset: Cesium3DTileset | null, error: string | null = null): void {
    this.#realityTiles = tileset;
    this.#realityError = error;
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
    if (buildings) buildings.debugWireframe = mode === 'wireframe';

    if (mode === 'reality') {
      if (!this.#realityEnabled) {
        this.#applySolid();
        return {
          requested: mode,
          applied: 'solid',
          degraded: true,
          reason: 'Reality mode requires a configured photorealistic 3D Tiles provider'
        };
      }

      if (!this.#realityTiles) {
        this.#applySolid();
        return {
          requested: mode,
          applied: 'solid',
          degraded: true,
          reason:
            this.#realityError ??
            'Photorealistic 3D Tiles are unavailable; SOLID mode remains active'
        };
      }

      viewer.scene.globe.showGroundAtmosphere = true;
      viewer.scene.highDynamicRange = true;
      if (buildings) {
        buildings.style = undefined;
        buildings.showOutline = false;
      }
      viewer.scene.requestRender();
      return {
        requested: mode,
        applied: 'reality',
        degraded: false,
        reason: null
      };
    }

    viewer.scene.globe.showGroundAtmosphere = mode !== 'holographic' && mode !== 'xray';
    viewer.scene.highDynamicRange = mode === 'solid';

    if (!buildings) {
      viewer.scene.requestRender();
      return {
        requested: mode,
        applied: mode,
        degraded: false,
        reason: null
      };
    }

    if (mode === 'solid' || mode === 'wireframe') {
      this.#applySolid();
    } else {
      const palette = tileModePalette(mode, this.#opacity);
      buildings.style = new Cesium3DTileStyle({ color: palette.colorExpression });
      buildings.showOutline = true;
      buildings.outlineColor = Color.fromCssColorString(palette.outlineHex).withAlpha(palette.outlineAlpha);
    }

    viewer.scene.requestRender();
    return {
      requested: mode,
      applied: mode,
      degraded: false,
      reason: null
    };
  }

  #applySolid(): void {
    const buildings = this.#buildings;
    this.#viewer.scene.globe.showGroundAtmosphere = true;
    this.#viewer.scene.highDynamicRange = true;
    if (buildings) {
      const palette = solarTilePalette(this.#solarPhase, this.#opacity, this.#mappedColor);
      buildings.style = palette.colorExpression == null
        ? this.#mappedStyle
        : new Cesium3DTileStyle({ color: palette.colorExpression });
      buildings.showOutline = true;
      buildings.outlineColor = Color.fromCssColorString(palette.outlineHex).withAlpha(palette.outlineAlpha);
    }
    this.#viewer.scene.requestRender();
  }
}
