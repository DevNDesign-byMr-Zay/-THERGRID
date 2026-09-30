import {
  Cartesian3,
  Color,
  Material,
  Polyline,
  PolylineCollection,
  Scene
} from 'cesium';

const LONGITUDE_STEP = 15;
const LATITUDE_STEP = 15;
const SAMPLE_STEP = 5;
const GRID_HEIGHT_METERS = 260;

function range(start: number, stop: number, step: number): number[] {
  const values: number[] = [];
  for (let value = start; value <= stop; value += step) values.push(value);
  return values;
}

function gridMaterial(alpha: number): Material {
  return Material.fromType(Material.ColorType, {
    color: new Color(0.3, 0.84, 1, alpha)
  });
}

export class GeodeticGridLayer {
  #scene: Scene;
  #collection: PolylineCollection;
  #lines: Polyline[] = [];
  #visible = true;

  constructor(scene: Scene) {
    this.#scene = scene;
    this.#collection = new PolylineCollection();
    this.#scene.primitives.add(this.#collection);
    this.#build();
  }

  setVisible(visible: boolean): void {
    this.#visible = visible;
    this.#collection.show = visible;
    this.#scene.requestRender();
  }

  setTime(isoTime: string): void {
    const timestamp = Date.parse(isoTime);
    if (!Number.isFinite(timestamp)) return;

    const phase = ((timestamp / 1000) % 86_400) / 86_400;
    const pulse = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
    const alpha = 0.11 + pulse * 0.13;

    for (let index = 0; index < this.#lines.length; index += 1) {
      const linePhase = (index % 12) / 12;
      const localPulse = 0.72 + 0.28 * Math.sin((phase + linePhase) * Math.PI * 2);
      const material = this.#lines[index].material;
      material.uniforms.color = new Color(0.3, 0.84, 1, alpha * localPulse);
    }

    if (this.#visible) this.#scene.requestRender();
  }

  destroy(): void {
    if (!this.#collection.isDestroyed()) {
      this.#scene.primitives.remove(this.#collection);
      this.#collection.destroy();
    }
    this.#lines = [];
  }

  #build(): void {
    for (let longitude = -180; longitude < 180; longitude += LONGITUDE_STEP) {
      const positions = range(-85, 85, SAMPLE_STEP).map((latitude) =>
        Cartesian3.fromDegrees(longitude, latitude, GRID_HEIGHT_METERS)
      );
      this.#lines.push(
        this.#collection.add({
          positions,
          width: longitude % 45 === 0 ? 1.25 : 0.7,
          material: gridMaterial(longitude % 45 === 0 ? 0.2 : 0.1)
        })
      );
    }

    for (let latitude = -75; latitude <= 75; latitude += LATITUDE_STEP) {
      const positions = range(-180, 180, SAMPLE_STEP).map((longitude) =>
        Cartesian3.fromDegrees(longitude, latitude, GRID_HEIGHT_METERS)
      );
      this.#lines.push(
        this.#collection.add({
          positions,
          width: latitude === 0 || latitude % 45 === 0 ? 1.25 : 0.7,
          material: gridMaterial(latitude === 0 || latitude % 45 === 0 ? 0.2 : 0.1)
        })
      );
    }
  }
}
