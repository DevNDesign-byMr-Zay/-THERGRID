import {
  Cartesian3,
  Color,
  ColorMaterialProperty,
  ConstantProperty,
  CustomDataSource,
  Entity,
  PointGraphics,
  PolylineGraphics,
  Viewer
} from 'cesium';

import {
  isActiveAt,
  overlayIntensity,
  type SpatialOverlayEdge,
  type SpatialOverlayNode,
  type SpatialOverlaySnapshot
} from '../overlays/spatial-overlay';

function coordinate(position: SpatialOverlayNode['position']): Cartesian3 {
  return Cartesian3.fromDegrees(
    position.longitude,
    position.latitude,
    position.heightMeters ?? 20
  );
}

function colorForIntensity(intensity: number, alpha = 1): Color {
  const bounded = overlayIntensity(intensity);
  return new Color(
    0.24 + bounded * 0.18,
    0.62 + bounded * 0.26,
    1,
    alpha
  );
}

function nodeColor(node: SpatialOverlayNode): Color {
  const intensity = overlayIntensity(node.intensity);
  if (node.kind === 'event' && node.properties?.eventType === 'earthquake') {
    return Color.fromCssColorString('#ff7b63').withAlpha(0.78 + intensity * 0.22);
  }
  return colorForIntensity(intensity, 0.96);
}

function nodeEntity(node: SpatialOverlayNode): Entity {
  const intensity = overlayIntensity(node.intensity);
  return new Entity({
    id: node.id,
    name: node.label ?? node.id,
    position: coordinate(node.position),
    point: new PointGraphics({
      pixelSize: 5 + intensity * 7,
      color: nodeColor(node),
      outlineColor: new ConstantProperty(Color.WHITE.withAlpha(0.35)),
      outlineWidth: 1.25,
      disableDepthTestDistance: 1_500_000
    }),
    properties: {
      overlayKind: node.kind,
      value: node.value ?? null,
      unit: node.unit ?? null,
      ...node.properties
    }
  });
}

function edgeEntity(edge: SpatialOverlayEdge): Entity {
  const intensity = overlayIntensity(edge.intensity);
  return new Entity({
    id: edge.id,
    name: edge.label ?? edge.id,
    polyline: new PolylineGraphics({
      positions: new ConstantProperty([
        coordinate(edge.from),
        coordinate(edge.to)
      ]),
      width: 1.4 + intensity * 2.8,
      material: new ColorMaterialProperty(colorForIntensity(intensity, 0.35 + intensity * 0.5)),
      clampToGround: false
    }),
    properties: {
      overlayKind: edge.kind,
      value: edge.value ?? null,
      unit: edge.unit ?? null,
      ...edge.properties
    }
  });
}

export class NetworkOverlayLayer {
  #viewer: Viewer;
  #source = new CustomDataSource('aethergrid-network-overlay');
  #snapshot: SpatialOverlaySnapshot | null = null;
  #nodeEntities = new Map<string, Entity>();
  #edgeEntities = new Map<string, Entity>();
  #visible = true;

  constructor(viewer: Viewer) {
    this.#viewer = viewer;
    void this.#viewer.dataSources.add(this.#source);
  }

  apply(snapshot: SpatialOverlaySnapshot): void {
    this.#snapshot = snapshot;
    this.#source.entities.removeAll();
    this.#nodeEntities.clear();
    this.#edgeEntities.clear();

    for (const node of snapshot.nodes) {
      const entity = this.#source.entities.add(nodeEntity(node));
      this.#nodeEntities.set(node.id, entity);
    }
    for (const edge of snapshot.edges) {
      const entity = this.#source.entities.add(edgeEntity(edge));
      this.#edgeEntities.set(edge.id, entity);
    }

    this.#source.show = this.#visible;
    this.#viewer.scene.requestRender();
  }

  setVisible(visible: boolean): void {
    this.#visible = visible;
    this.#source.show = visible;
    this.#viewer.scene.requestRender();
  }

  setTime(isoTime: string): void {
    const snapshot = this.#snapshot;
    if (!snapshot) return;

    for (const node of snapshot.nodes) {
      const entity = this.#nodeEntities.get(node.id);
      if (entity) entity.show = isActiveAt(node, isoTime);
    }
    for (const edge of snapshot.edges) {
      const entity = this.#edgeEntities.get(edge.id);
      if (entity) entity.show = isActiveAt(edge, isoTime);
    }

    if (this.#visible) this.#viewer.scene.requestRender();
  }

  provenance(): Pick<
    SpatialOverlaySnapshot,
    'id' | 'layerId' | 'eventTime' | 'sourceTime' | 'fetchedAt' | 'live' | 'stale' | 'fallback' | 'attribution'
  > | null {
    if (!this.#snapshot) return null;
    const {
      id,
      layerId,
      eventTime,
      sourceTime,
      fetchedAt,
      live,
      stale,
      fallback,
      attribution
    } = this.#snapshot;
    return { id, layerId, eventTime, sourceTime, fetchedAt, live, stale, fallback, attribution };
  }

  destroy(): void {
    this.#source.entities.removeAll();
    this.#viewer.dataSources.remove(this.#source, true);
    this.#snapshot = null;
    this.#nodeEntities.clear();
    this.#edgeEntities.clear();
  }
}
