import {
  Credit,
  ImageryLayer,
  UrlTemplateImageryProvider,
  WebMercatorTilingScheme,
  type Viewer,
} from 'cesium';
import type { TemporalInstant } from '../spatial-renderer';
import type { RadarRasterFrame } from '../overlays/spatial-overlay';

/** Native georeferenced radar tiles; reflectivity colors retain their source meaning in every view. */
export class RadarWeatherLayer {
  #viewer: Viewer;
  #cache = new Map<string, ImageryLayer>();
  #active: ImageryLayer | null = null;
  #coverage: ImageryLayer | null = null;
  #visible = true;
  #live = true;
  #opacity = 0.68;
  #showCoverage = false;
  constructor(viewer: Viewer) {
    this.#viewer = viewer;
  }
  apply(frame: RadarRasterFrame) {
    let layer = this.#cache.get(frame.urlTemplate);
    if (!layer) {
      const provider = new UrlTemplateImageryProvider({
        url: frame.urlTemplate,
        maximumLevel: frame.maximumLevel,
        tilingScheme: new WebMercatorTilingScheme(),
        credit: new Credit(
          'Weather radar by <a href="https://www.rainviewer.com/">RainViewer</a>',
          true,
        ),
      });
      provider.errorEvent.addEventListener((error) => {
        error.retry = error.timesRetried < 2;
        if (!error.retry && typeof window !== 'undefined')
          window.dispatchEvent(
            new CustomEvent('aethergrid:radar-error', {
              detail: 'Radar tiles could not load. The base map remains available.',
            }),
          );
      });
      layer = new ImageryLayer(provider, { alpha: this.#opacity });
      this.#viewer.imageryLayers.add(layer);
      this.#cache.set(frame.urlTemplate, layer);
    }
    this.#active = layer;
    this.#showCoverage = frame.coverageVisible;
    if (frame.coverageVisible && !this.#coverage) {
      this.#coverage = new ImageryLayer(
        new UrlTemplateImageryProvider({
          url: frame.coverageUrl,
          maximumLevel: 7,
          tilingScheme: new WebMercatorTilingScheme(),
        }),
        { alpha: 0.28 },
      );
      this.#viewer.imageryLayers.add(this.#coverage);
    }
    while (this.#cache.size > 3) {
      const [key, old] = this.#cache.entries().next().value!;
      this.#cache.delete(key);
      this.#viewer.imageryLayers.remove(old, true);
    }
    this.#present();
  }
  setTime(time: TemporalInstant) {
    this.#live = time.mode === 'live';
    this.#present();
  }
  setVisible(visible: boolean, opacity = 0.68) {
    this.#visible = visible;
    this.#opacity = Math.max(0, Math.min(1, opacity));
    this.#present();
  }
  #present() {
    for (const layer of this.#cache.values()) {
      layer.show = this.#visible && this.#live && layer === this.#active;
      layer.alpha = this.#opacity;
    }
    if (this.#coverage) this.#coverage.show = this.#visible && this.#live && this.#showCoverage;
    this.#viewer.scene.requestRender();
  }
  destroy() {
    for (const layer of this.#cache.values()) this.#viewer.imageryLayers.remove(layer, true);
    if (this.#coverage) this.#viewer.imageryLayers.remove(this.#coverage, true);
    this.#cache.clear();
    this.#coverage = null;
    this.#active = null;
  }
}
