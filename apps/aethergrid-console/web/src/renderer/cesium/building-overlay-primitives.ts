import {
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  GeometryInstance,
  PerInstanceColorAppearance,
  PolygonGeometry,
  PolygonHierarchy,
  PolylineColorAppearance,
  PolylineGeometry,
  Primitive,
  type Scene,
  WallGeometry,
} from 'cesium';

import { buildingEdges, buildingGeometry } from '../overlays/building-geometry';
import { buildingAreaColor } from '../overlays/color-mapping';
import type { SpatialOverlaySnapshot } from '../overlays/spatial-overlay';
import type { VisualMode } from '../spatial-renderer';
import { coordinate, overlaySourceFeatureId } from './network-overlay-entities';

export class BuildingOverlayPrimitives {
  #buildingPrimitive: Primitive | null = null;
  #buildingLines: Primitive | null = null;
  #fillStyles: { id: object; value: Uint8Array; base: Color }[] = [];
  #lineStyles: { id: { sourceFeatureId: string }; value: Uint8Array }[] = [];

  constructor(private readonly scene: Scene) {}

  apply(
    snapshot: SpatialOverlaySnapshot,
    provenance: Readonly<Record<string, unknown>>,
    visible: boolean,
  ): void {
    const instances = (snapshot.areas ?? [])
      .filter((area) => area.kind === 'building' && area.positions.length >= 3)
      .flatMap((area) => {
        const massing = buildingGeometry(area);
        if (!massing) return [];
        const minHeightM = massing.baseM;
        const heightM = massing.topM;
        const hierarchy = new PolygonHierarchy(
          massing.ring.map((position) =>
            Cartesian3.fromDegrees(position.longitude, position.latitude),
          ),
          massing.holes.map(
            (ring) =>
              new PolygonHierarchy(
                ring.map((position) =>
                  Cartesian3.fromDegrees(position.longitude, position.latitude),
                ),
              ),
          ),
        );
        const sourceFeatureId = overlaySourceFeatureId(area.id, area.properties);
        const id = {
          aethergridSourceBuilding: true,
          id: area.id,
          sourceFeatureId,
          label: area.label ?? area.id,
          latitude: Number(area.properties?.centroidLatitude ?? Number.NaN),
          longitude: Number(area.properties?.centroidLongitude ?? Number.NaN),
          heightM,
          properties: {
            ...provenance,
            ...area.properties,
            overlayKind: area.kind,
            heightCategory: massing.heightCategory,
            roofRefinement: massing.roofRefinement,
            geometryLimitation: massing.limitation,
            sourceName: area.label ?? area.id,
          },
        };

        const bodyColor = buildingAreaColor(area, 1);
        const body = new GeometryInstance({
          id,
          geometry: new PolygonGeometry({
            polygonHierarchy: hierarchy,
            height: minHeightM,
            extrudedHeight: massing.wallTopM,
            closeTop: !massing.roofFaces.length,
            closeBottom: true,
            vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
          }),
          attributes: {
            color: ColorGeometryInstanceAttribute.fromColor(bodyColor),
          },
        });
        this.#fillStyles.push({ id, value: body.attributes.color.value, base: bodyColor });
        const roofArea = {
          ...area,
          properties: {
            ...area.properties,
            buildingColor: area.properties?.roofColor,
            buildingMaterial: area.properties?.roofMaterial,
          },
        };
        const roofs = massing.roofFaces.map((face, index) => {
          const roofId = { ...id, geometryPart: `roof:${index}` };
          const base = buildingAreaColor(roofArea, 1);
          const instance = new GeometryInstance({
            id: roofId,
            geometry: new PolygonGeometry({
              polygonHierarchy: new PolygonHierarchy(
                face.map((p) => Cartesian3.fromDegrees(p.longitude, p.latitude, p.heightMeters)),
              ),
              perPositionHeight: true,
              vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
            }),
            attributes: { color: ColorGeometryInstanceAttribute.fromColor(base) },
          });
          this.#fillStyles.push({ id: roofId, value: instance.attributes.color.value, base });
          return instance;
        });
        // A single-plane roof is not a floating sheet: fill the upper facade
        // between the common eave height and the mapped per-vertex roof heights.
        const roofWalls = massing.roofWallFaces.map((face, index) => {
          const wallId = { ...id, geometryPart: `roof-wall:${index}` };
          const wallColor = buildingAreaColor(area, 1);
          const wall = new GeometryInstance({
            id: wallId,
            geometry: new WallGeometry({
              positions: [
                Cartesian3.fromDegrees(face[0].longitude, face[0].latitude),
                Cartesian3.fromDegrees(face[1].longitude, face[1].latitude),
              ],
              minimumHeights: [face[0].heightMeters!, face[1].heightMeters!],
              maximumHeights: [face[3].heightMeters!, face[2].heightMeters!],
              vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
            }),
            attributes: { color: ColorGeometryInstanceAttribute.fromColor(wallColor) },
          });
          this.#fillStyles.push({
            id: wallId,
            value: wall.attributes.color.value,
            base: wallColor,
          });
          return wall;
        });
        return [body, ...roofs, ...roofWalls];
      });

    if (!instances.length) return;

    const primitive = new Primitive({
      geometryInstances: instances,
      appearance: new PerInstanceColorAppearance({
        closed: true,
        translucent: false,
        flat: false,
      }),
      asynchronous: false,
    });
    primitive.show = visible;
    this.scene.primitives.add(primitive);
    this.#buildingPrimitive = primitive;
    const lines = (snapshot.areas ?? []).flatMap((area) =>
      area.kind !== 'building'
        ? []
        : buildingEdges(area).map(([from, to], index) => {
            const sourceFeatureId = overlaySourceFeatureId(area.id, area.properties);
            const id = {
              aethergridSourceBuilding: true,
              id: area.id,
              sourceFeatureId,
              geometryPart: `edge:${index}`,
              label: area.label ?? area.id,
              latitude: area.properties?.centroidLatitude,
              longitude: area.properties?.centroidLongitude,
              heightM: area.properties?.heightM,
              properties: {
                ...provenance,
                ...area.properties,
                overlayKind: area.kind,
                heightCategory: buildingGeometry(area)?.heightCategory,
                roofRefinement: buildingGeometry(area)?.roofRefinement,
                geometryLimitation: buildingGeometry(area)?.limitation,
              },
            };
            const instance = new GeometryInstance({
              id,
              geometry: new PolylineGeometry({
                positions: [coordinate(from), coordinate(to)],
                width: 1.5,
                vertexFormat: PolylineColorAppearance.VERTEX_FORMAT,
              }),
              attributes: { color: ColorGeometryInstanceAttribute.fromColor(Color.CYAN) },
            });
            this.#lineStyles.push({ id, value: instance.attributes.color.value });
            return instance;
          }),
    );
    if (lines.length) {
      this.#buildingLines = new Primitive({
        geometryInstances: lines,
        appearance: new PolylineColorAppearance({ translucent: true }),
        asynchronous: false,
      });
      this.scene.primitives.add(this.#buildingLines);
    }
    this.scene.requestRender();
  }

  clear(): void {
    for (const primitive of [this.#buildingPrimitive, this.#buildingLines]) {
      if (!primitive || primitive.isDestroyed()) continue;
      this.scene.primitives.remove(primitive);
      if (!primitive.isDestroyed()) primitive.destroy();
    }
    this.#buildingPrimitive = null;
    this.#buildingLines = null;
    this.#fillStyles = [];
    this.#lineStyles = [];
  }

  #writeColor(primitive: Primitive | null, id: object, value: Uint8Array, color: Color): void {
    const bytes = ColorGeometryInstanceAttribute.toValue(color);
    value.set(bytes);
    if (primitive?.ready) primitive.getGeometryInstanceAttributes(id).color = bytes;
  }

  setPresentation(
    mode: VisualMode,
    opacity: number,
    visible: boolean,
    selectedSourceFeatureId: string | null,
  ): void {
    const alpha =
      (mode === 'holographic' ? 0.12 : mode === 'grid' ? 0.18 : mode === 'xray' ? 0.2 : 1) *
      opacity;
    if (this.#buildingPrimitive) {
      this.#buildingPrimitive.show = visible && opacity > 0 && mode !== 'wireframe';
      const translucent = alpha < 1;
      if (this.#buildingPrimitive.appearance.translucent !== translucent)
        this.#buildingPrimitive.appearance = new PerInstanceColorAppearance({
          closed: !translucent,
          translucent,
          flat: false,
        });
      for (const style of this.#fillStyles)
        this.#writeColor(
          this.#buildingPrimitive,
          style.id,
          style.value,
          (mode === 'holographic'
            ? Color.fromCssColorString('#46eaff')
            : mode === 'xray'
              ? Color.fromCssColorString('#6bc7ff')
              : style.base
          ).withAlpha(alpha),
        );
    }
    if (this.#buildingLines) {
      this.#buildingLines.show = visible && opacity > 0;
      for (const style of this.#lineStyles) {
        const selected = style.id.sourceFeatureId === selectedSourceFeatureId;
        const base = selected
          ? Color.WHITE
          : mode === 'solid' || mode === 'reality'
            ? Color.fromCssColorString('#324351')
            : Color.fromCssColorString('#58efff');
        this.#writeColor(
          this.#buildingLines,
          style.id,
          style.value,
          base.withAlpha(
            (selected ? 1 : mode === 'solid' || mode === 'reality' ? 0.35 : 0.9) * opacity,
          ),
        );
      }
    }
  }
}
