import {
  Cartesian3,
  Color,
  ColorMaterialProperty,
  ConstantProperty,
  CustomDataSource,
  DistanceDisplayCondition,
  Entity,
  PointGraphics,
  PolygonGraphics,
  PolygonHierarchy,
  PolylineGraphics,
  Viewer
} from 'cesium';

import type { SpatialScenarioVisual, TemporalInstant } from '../spatial-renderer';

import {
  isActiveAt,
  overlayIntensity,
  type SpatialOverlayArea,
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
  if (node.kind === 'city') {
    const category = String(node.properties?.category || 'unknown');
    const cityColor =
      category === 'good'
        ? '#63ffc5'
        : category === 'moderate'
          ? '#f1d66d'
          : category === 'unhealthy-sensitive'
            ? '#f5a05d'
            : category === 'unhealthy'
              ? '#ff6f69'
              : category === 'very-unhealthy'
                ? '#b97cff'
                : category === 'hazardous'
                  ? '#d85d88'
                  : '#70e7ff';
    return Color.fromCssColorString(cityColor).withAlpha(0.86 + intensity * 0.14);
  }
  return colorForIntensity(intensity, 0.96);
}


function nodeFarDistance(node: SpatialOverlayNode): number {
  if (node.kind === 'city' || node.kind === 'event') return 30_000_000;
  if (node.kind === 'generation') return 320_000;
  if (node.kind === 'substation') return 220_000;
  return 180_000;
}

function edgeFarDistance(edge: SpatialOverlayEdge): number {
  if (edge.kind === 'coastline') return 180_000;
  if (edge.kind === 'waterway') return 110_000;
  if (edge.kind === 'route') return 80_000;
  if (edge.kind === 'transmission' || edge.kind === 'distribution') return 220_000;
  return 140_000;
}

function areaFarDistance(area: SpatialOverlayArea): number {
  return area.kind === 'water' ? 100_000 : 80_000;
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
      distanceDisplayCondition: new ConstantProperty(
        new DistanceDisplayCondition(0, nodeFarDistance(node))
      ),
      disableDepthTestDistance:
        node.kind === 'city' || node.kind === 'event'
          ? Number.POSITIVE_INFINITY
          : 1_500_000
    }),
    properties: {
      overlayKind: node.kind,
      value: node.value ?? null,
      unit: node.unit ?? null,
      ...node.properties
    }
  });
}

function edgeColor(edge: SpatialOverlayEdge, intensity: number): Color {
  if (edge.kind === 'waterway' || edge.kind === 'coastline') {
    return Color.fromCssColorString('#48cfff').withAlpha(0.42 + intensity * 0.4);
  }
  if (edge.kind === 'route') {
    return Color.fromCssColorString('#a6b8c8').withAlpha(0.26 + intensity * 0.34);
  }
  return colorForIntensity(intensity, 0.35 + intensity * 0.5);
}

function edgeWidth(edge: SpatialOverlayEdge, intensity: number): number {
  return edge.kind === 'coastline'
    ? 2.6
    : edge.kind === 'waterway'
      ? 2.2
      : edge.kind === 'route'
        ? 1.1 + intensity * 1.4
        : 1.4 + intensity * 2.8;
}

function scenarioColor(
  scenario: SpatialScenarioVisual,
  intensity: number,
  alpha: number
): Color {
  if (scenario.renewableBias > 0.25) {
    return Color.fromCssColorString('#63ffc5').withAlpha(alpha);
  }
  if (scenario.weatherRisk > 0.55) {
    return Color.fromCssColorString('#ff7f6b').withAlpha(alpha);
  }
  if (scenario.storageStress > 0.45) {
    return Color.fromCssColorString('#f2aa62').withAlpha(alpha);
  }
  if (scenario.stressFactor > 1.06) {
    return Color.fromCssColorString('#ffbd73').withAlpha(alpha);
  }
  return colorForIntensity(intensity, alpha);
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
      width: edgeWidth(edge, intensity),
      material: new ColorMaterialProperty(edgeColor(edge, intensity)),
      distanceDisplayCondition: new ConstantProperty(
        new DistanceDisplayCondition(0, edgeFarDistance(edge))
      ),
      clampToGround: edge.kind === 'route' || edge.kind === 'waterway' || edge.kind === 'coastline'
    }),
    properties: {
      overlayKind: edge.kind,
      value: edge.value ?? null,
      unit: edge.unit ?? null,
      ...edge.properties
    }
  });
}

function areaEntity(area: SpatialOverlayArea): Entity {
  const positions = area.positions.map((position) => coordinate(position));
  const water = area.kind === 'water';
  return new Entity({
    id: area.id,
    name: area.label ?? area.id,
    polygon: new PolygonGraphics({
      hierarchy: new ConstantProperty(new PolygonHierarchy(positions)),
      material: new ColorMaterialProperty(
        water
          ? Color.fromCssColorString('#2eb9e8').withAlpha(0.22)
          : Color.fromCssColorString('#59d99a').withAlpha(0.18)
      ),
      outline: true,
      outlineColor: water
        ? Color.fromCssColorString('#70ddff').withAlpha(0.45)
        : Color.fromCssColorString('#83e8b7').withAlpha(0.34),
      distanceDisplayCondition: new ConstantProperty(
        new DistanceDisplayCondition(0, areaFarDistance(area))
      ),
      perPositionHeight: true
    }),
    properties: {
      overlayKind: area.kind,
      ...area.properties
    }
  });
}

export class NetworkOverlayLayer {
  #viewer: Viewer;
  #source = new CustomDataSource('aethergrid-network-overlay');
  #snapshot: SpatialOverlaySnapshot | null = null;
  #nodeEntities = new Map<string, Entity>();
  #edgeEntities = new Map<string, Entity>();
  #areaEntities = new Map<string, Entity>();
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
    this.#areaEntities.clear();

    for (const node of snapshot.nodes) {
      const entity = this.#source.entities.add(nodeEntity(node));
      this.#nodeEntities.set(node.id, entity);
    }
    for (const edge of snapshot.edges) {
      const entity = this.#source.entities.add(edgeEntity(edge));
      this.#edgeEntities.set(edge.id, entity);
    }
    for (const area of snapshot.areas ?? []) {
      if (area.positions.length < 3) continue;
      const entity = this.#source.entities.add(areaEntity(area));
      this.#areaEntities.set(area.id, entity);
    }

    this.#source.show = this.#visible;
    this.#viewer.scene.requestRender();
  }

  setVisible(visible: boolean): void {
    this.#visible = visible;
    this.#source.show = visible;
    this.#viewer.scene.requestRender();
  }

  setTime(time: TemporalInstant): void {
    const snapshot = this.#snapshot;
    if (!snapshot) return;

    const scenario =
      time.mode === 'scenario' ? time.scenarioVisual ?? null : null;
    const timestamp = Date.parse(time.iso);
    const temporalPhase = Number.isFinite(timestamp)
      ? timestamp / 1000
      : 0;

    for (const node of snapshot.nodes) {
      const entity = this.#nodeEntities.get(node.id);
      if (!entity) continue;

      entity.show = isActiveAt(node, time.iso);
      const point = entity.point;
      if (!point) continue;

      const intensity = overlayIntensity(node.intensity);
      const baseSize = 5 + intensity * 7;
      const powerNode =
        node.kind === 'generation' ||
        node.kind === 'substation' ||
        node.kind === 'asset';

      if (scenario && powerNode) {
        const pulse = 0.5 + 0.5 * Math.sin(temporalPhase * 0.32 + intensity * 5.1);
        const stressBoost = Math.max(0, scenario.stressFactor - 1);
        point.pixelSize = new ConstantProperty(
          baseSize * (1 + stressBoost * 0.9 + pulse * 0.14)
        );
        point.color = new ConstantProperty(
          scenarioColor(scenario, intensity, 0.88 + pulse * 0.1)
        );
      } else {
        point.pixelSize = new ConstantProperty(baseSize);
        point.color = new ConstantProperty(nodeColor(node));
      }
    }

    for (const edge of snapshot.edges) {
      const entity = this.#edgeEntities.get(edge.id);
      if (!entity) continue;

      entity.show = isActiveAt(edge, time.iso);
      const polyline = entity.polyline;
      if (!polyline) continue;

      const intensity = overlayIntensity(edge.intensity);
      const powerEdge =
        edge.kind === 'transmission' || edge.kind === 'distribution';

      if (scenario && powerEdge) {
        const pulse = 0.5 + 0.5 * Math.sin(temporalPhase * 0.38 + intensity * 6.3);
        const stressBoost = Math.max(0, scenario.stressFactor - 1);
        polyline.width = new ConstantProperty(
          edgeWidth(edge, intensity) * (1 + stressBoost * 1.4 + pulse * 0.22)
        );
        polyline.material = new ColorMaterialProperty(
          scenarioColor(scenario, intensity, 0.5 + pulse * 0.35)
        );
      } else {
        polyline.width = new ConstantProperty(edgeWidth(edge, intensity));
        polyline.material = new ColorMaterialProperty(edgeColor(edge, intensity));
      }
    }

    for (const area of snapshot.areas ?? []) {
      const entity = this.#areaEntities.get(area.id);
      if (entity) entity.show = isActiveAt(area, time.iso);
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
