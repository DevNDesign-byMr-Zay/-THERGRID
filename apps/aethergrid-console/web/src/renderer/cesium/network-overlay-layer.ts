import {
  Cartesian2,
  Cartesian3,
  BoxGraphics,
  Color,
  ColorMaterialProperty,
  ConstantProperty,
  CustomDataSource,
  DistanceDisplayCondition,
  Entity,
  HeadingPitchRoll,
  HorizontalOrigin,
  LabelGraphics,
  Math as CesiumMath,
  ModelGraphics,
  PointGraphics,
  PolygonGraphics,
  PolygonHierarchy,
  PolylineGraphics,
  Transforms,
  VerticalOrigin,
  Viewer,
  WallGraphics
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

function hazardColor(severity: unknown, alpha = 0.96): Color {
  const normalized = String(severity ?? '').toLowerCase();
  const color =
    normalized === 'extreme'
      ? '#ff3b52'
      : normalized === 'severe'
        ? '#ff704f'
        : normalized === 'moderate'
          ? '#f2b65f'
          : normalized === 'minor'
            ? '#e2d86c'
            : '#f08a73';
  return Color.fromCssColorString(color).withAlpha(alpha);
}

function hydrologyColor(band: unknown, alpha = 0.96): Color {
  const normalized = String(band ?? '').toLowerCase();
  const color =
    normalized === 'major'
      ? '#ff4f63'
      : normalized === 'moderate'
        ? '#ff8a5b'
        : normalized === 'minor'
          ? '#f0c477'
          : normalized === 'action'
            ? '#8dd7ff'
            : '#62c7e9';
  return Color.fromCssColorString(color).withAlpha(alpha);
}

function nodeColor(node: SpatialOverlayNode): Color {
  const intensity = overlayIntensity(node.intensity);
  if (node.properties?.analysisType === 'measurement') {
    return Color.fromCssColorString('#c9a7ff').withAlpha(0.98);
  }
  if (node.properties?.analysisType === 'workset-geometry') {
    return Color.fromCssColorString('#63ffc5').withAlpha(0.96);
  }
  if (node.properties?.analysisType === 'scenario-model') {
    return Color.fromCssColorString('#d991ff').withAlpha(0.96);
  }
  if (node.properties?.presentationType === 'urban-illumination') {
    return Color.fromCssColorString('#ffd37d').withAlpha(0.58 + intensity * 0.34);
  }
  if (node.kind === 'event' && node.properties?.eventType === 'nws-alert') {
    return hazardColor(node.properties?.severity, 0.8 + intensity * 0.2);
  }
  if (node.kind === 'event' && node.properties?.eventType === 'operator-incident') {
    const severity = String(node.properties?.severity ?? 'info');
    const incidentColor =
      severity === 'critical'
        ? '#ff4f63'
        : severity === 'high'
          ? '#ff806b'
          : severity === 'medium'
            ? '#f0b45f'
            : severity === 'low'
              ? '#e0d778'
              : '#8dc9ff';
    return Color.fromCssColorString(incidentColor).withAlpha(0.78 + intensity * 0.22);
  }
  if (node.kind === 'event' && node.properties?.eventType === 'earthquake') {
    return Color.fromCssColorString('#ff7b63').withAlpha(0.78 + intensity * 0.22);
  }
  if (node.kind === 'transit' && node.properties?.eventType === 'gtfs-vehicle') {
    return Color.fromCssColorString('#70e7ff').withAlpha(0.78 + intensity * 0.22);
  }
  if (node.kind === 'sensor' && node.properties?.eventType === 'noaa-nwps-gauge') {
    return hydrologyColor(node.properties?.floodBand, 0.8 + intensity * 0.2);
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
  if (node.kind === 'city' || node.kind === 'event' || node.kind === 'aircraft') {
    return 30_000_000;
  }
  if (node.kind === 'generation') return 320_000;
  if (node.kind === 'substation') return 220_000;
  if (node.kind === 'transit') return 180_000;
  return 180_000;
}

function edgeFarDistance(edge: SpatialOverlayEdge): number {
  if (edge.properties?.eventType === 'nws-alert-boundary') return 2_000_000;
  if (edge.kind === 'coastline') return 180_000;
  if (edge.kind === 'waterway') return 110_000;
  if (edge.kind === 'route') return 80_000;
  if (edge.kind === 'transmission' || edge.kind === 'distribution') return 220_000;
  return 140_000;
}

function areaFarDistance(area: SpatialOverlayArea): number {
  if (area.kind === 'building') return 90_000;
  return area.kind === 'water' ? 100_000 : 80_000;
}

function buildingAreaColor(area: SpatialOverlayArea, alpha = 0.76): Color {
  const rawColor = String(area.properties?.buildingColor ?? '').trim();
  const normalizedColor =
    rawColor && !rawColor.startsWith('#') && /^[0-9a-f]{6}$/iu.test(rawColor)
      ? `#${rawColor}`
      : rawColor;
  if (normalizedColor) {
    const parsed = Color.fromCssColorString(normalizedColor);
    if (parsed) return parsed.withAlpha(alpha);
  }

  const material = String(area.properties?.buildingMaterial ?? '').toLowerCase();
  const sourceBacked = area.properties?.sourceBacked === true;
  const base =
    material.includes('glass')
      ? '#6baec4'
      : material.includes('brick')
        ? '#8f665b'
        : material.includes('metal') || material.includes('steel')
          ? '#657887'
          : material.includes('stone')
            ? '#85847d'
            : material.includes('concrete')
              ? '#6f7880'
              : material.includes('wood')
                ? '#846e5e'
                : sourceBacked
                  ? '#637b8a'
                  : '#536370';
  return Color.fromCssColorString(base).withAlpha(alpha);
}

function provenanceProperties(
  snapshot: SpatialOverlaySnapshot
): Readonly<Record<string, unknown>> {
  return {
    layerId: snapshot.layerId,
    overlayId: snapshot.id,
    eventTime: snapshot.eventTime,
    sourceTime: snapshot.sourceTime,
    fetchedAt: snapshot.fetchedAt,
    live: snapshot.live,
    stale: snapshot.stale,
    fallback: snapshot.fallback,
    attribution: snapshot.attribution
  };
}

function aircraftHeading(node: SpatialOverlayNode): number {
  const value = Number(node.properties?.trackDegrees);
  return Number.isFinite(value) ? value : 0;
}

function nodeEntity(
  node: SpatialOverlayNode,
  provenance: Readonly<Record<string, unknown>>
): Entity {
  const intensity = overlayIntensity(node.intensity);
  const position = coordinate(node.position);
  const aircraft =
    node.kind === 'aircraft' && node.properties?.eventType === 'aircraft';
  const aircraftModel = aircraft && node.properties?.render3d === true;
  const staleAircraft = aircraft && node.properties?.truthState === 'stale';
  const urbanLight =
    node.properties?.presentationType === 'urban-illumination';

  return new Entity({
    id: node.id,
    name: node.label ?? node.id,
    position,
    orientation: aircraftModel
      ? Transforms.headingPitchRollQuaternion(
          position,
          new HeadingPitchRoll(
            CesiumMath.toRadians(aircraftHeading(node)),
            0,
            0
          )
        )
      : undefined,
    point: new PointGraphics({
      pixelSize: aircraft
        ? 4 + intensity * 3
        : urbanLight
          ? 1.2 + intensity * 1.8
          : 5 + intensity * 7,
      color: aircraft
        ? Color.fromCssColorString(
            staleAircraft ? '#8193a1' : '#70e7ff'
          ).withAlpha(staleAircraft ? 0.58 : 0.92)
        : nodeColor(node),
      outlineColor: new ConstantProperty(Color.WHITE.withAlpha(0.35)),
      outlineWidth: urbanLight ? 0 : aircraft ? 0.8 : 1.25,
      distanceDisplayCondition: new ConstantProperty(
        aircraft
          ? new DistanceDisplayCondition(850_000, nodeFarDistance(node))
          : new DistanceDisplayCondition(0, nodeFarDistance(node))
      ),
      disableDepthTestDistance:
        node.kind === 'city' || node.kind === 'event' || aircraft
          ? Number.POSITIVE_INFINITY
          : 1_500_000
    }),
    model: aircraftModel
      ? new ModelGraphics({
          uri: '/models/aethergrid-aircraft.gltf',
          scale: 8,
          minimumPixelSize: 12,
          maximumScale: 18,
          color: Color.fromCssColorString(
            staleAircraft ? '#71828f' : '#79eaff'
          ).withAlpha(staleAircraft ? 0.62 : 0.96),
          silhouetteColor: Color.fromCssColorString('#dff8ff').withAlpha(0.68),
          silhouetteSize: 0.5,
          distanceDisplayCondition: new ConstantProperty(
            new DistanceDisplayCondition(0, 900_000)
          )
        })
      : undefined,
    label: aircraft
      ? new LabelGraphics({
          text: node.label ?? node.id,
          font: '11px Inter, sans-serif',
          fillColor: Color.fromCssColorString('#edf8ff'),
          outlineColor: Color.fromCssColorString('#06101a').withAlpha(0.94),
          outlineWidth: 3,
          horizontalOrigin: HorizontalOrigin.CENTER,
          verticalOrigin: VerticalOrigin.BOTTOM,
          pixelOffset: new Cartesian2(0, -18),
          showBackground: true,
          backgroundColor: Color.fromCssColorString('#06101a').withAlpha(0.72),
          distanceDisplayCondition: new ConstantProperty(
            new DistanceDisplayCondition(0, 420_000)
          ),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        })
      : undefined,
    properties: {
      overlayKind: node.kind,
      sourceName: node.label ?? node.id,
      value: node.value ?? null,
      unit: node.unit ?? null,
      ...provenance,
      ...node.properties
    }
  });
}

function edgeColor(edge: SpatialOverlayEdge, intensity: number): Color {
  if (edge.properties?.eventType === 'nws-alert-boundary') {
    return hazardColor(edge.properties?.severity, 0.46 + intensity * 0.42);
  }
  if (edge.kind === 'analysis-line' && edge.properties?.analysisType === 'measurement') {
    return Color.fromCssColorString('#c9a7ff').withAlpha(0.9);
  }
  if (edge.kind === 'analysis-line' && edge.properties?.analysisType === 'workset-geometry') {
    return Color.fromCssColorString('#63ffc5').withAlpha(0.72 + intensity * 0.2);
  }
  if (edge.kind === 'analysis-line' && edge.properties?.analysisType === 'scenario-model') {
    return Color.fromCssColorString('#d991ff').withAlpha(0.64 + intensity * 0.26);
  }
  if (edge.kind === 'flow' && edge.properties?.vectorType === 'wind') {
    return Color.fromCssColorString('#7de9ff').withAlpha(0.42 + intensity * 0.42);
  }
  if (edge.kind === 'waterway' || edge.kind === 'coastline') {
    return Color.fromCssColorString('#48cfff').withAlpha(0.42 + intensity * 0.4);
  }
  if (edge.kind === 'route') {
    return Color.fromCssColorString('#a6b8c8').withAlpha(0.26 + intensity * 0.34);
  }
  return colorForIntensity(intensity, 0.35 + intensity * 0.5);
}

function edgeWidth(edge: SpatialOverlayEdge, intensity: number): number {
  if (edge.properties?.eventType === 'nws-alert-boundary') {
    return 2.1 + intensity * 2.4;
  }
  if (edge.kind === 'analysis-line' && edge.properties?.analysisType === 'measurement') {
    return 3.1;
  }
  if (edge.kind === 'analysis-line' && edge.properties?.analysisType === 'workset-geometry') {
    return 1.6 + intensity * 1.8;
  }
  if (edge.kind === 'analysis-line' && edge.properties?.analysisType === 'scenario-model') {
    return 2 + intensity * 2.2;
  }
  if (edge.kind === 'flow' && edge.properties?.vectorType === 'wind') {
    return 1.1 + intensity * 1.8;
  }
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

function edgeEntity(
  edge: SpatialOverlayEdge,
  provenance: Readonly<Record<string, unknown>>
): Entity {
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
      clampToGround:
        edge.properties?.eventType !== 'aircraft-history' &&
        edge.properties?.eventType !== 'aviation-relationship' &&
        (edge.kind === 'route' ||
          edge.kind === 'waterway' ||
          edge.kind === 'coastline' ||
          edge.properties?.eventType === 'nws-alert-boundary')
    }),
    properties: {
      overlayKind: edge.kind,
      sourceName: edge.label ?? edge.id,
      value: edge.value ?? null,
      unit: edge.unit ?? null,
      ...provenance,
      ...edge.properties
    }
  });
}

function scenarioGhostEntity(
  edge: SpatialOverlayEdge,
  provenance: Readonly<Record<string, unknown>>
): Entity {
  const intensity = overlayIntensity(edge.intensity);
  return new Entity({
    id: `${edge.id}:source-baseline`,
    name: `${edge.label ?? edge.id} · source baseline`,
    show: false,
    polyline: new PolylineGraphics({
      positions: new ConstantProperty([
        coordinate(edge.from),
        coordinate(edge.to)
      ]),
      width: Math.max(1, edgeWidth(edge, intensity) * 0.72),
      material: new ColorMaterialProperty(
        Color.fromCssColorString('#91a0ad').withAlpha(0.24)
      ),
      distanceDisplayCondition: new ConstantProperty(
        new DistanceDisplayCondition(0, edgeFarDistance(edge))
      ),
      clampToGround: false
    }),
    properties: {
      overlayKind: 'scenario-baseline',
      sourceEdgeId: edge.id,
      ...provenance
    }
  });
}

function areaEntity(
  area: SpatialOverlayArea,
  provenance: Readonly<Record<string, unknown>>
): Entity {
  const positions = area.positions.map((position) => coordinate(position));
  const water = area.kind === 'water';
  const building = area.kind === 'building';
  const minHeightM = Math.max(0, Number(area.properties?.minHeightM ?? 0));
  const heightM = Math.max(
    minHeightM + 3.2,
    Number(area.properties?.heightM ?? minHeightM + 12)
  );
  const sourceBacked = area.properties?.sourceBacked === true;
  const buildingFill = buildingAreaColor(area, sourceBacked ? 0.94 : 0.58);
  const buildingRoof = buildingAreaColor(area, sourceBacked ? 1 : 0.7);
  const buildingOutline = buildingAreaColor(area, sourceBacked ? 0.48 : 0.24);
  const buildingMinimumHeights = building
    ? positions.map(() => minHeightM)
    : undefined;
  const buildingMaximumHeights = building
    ? positions.map(() => heightM)
    : undefined;
  const centroidLatitude = Number(area.properties?.centroidLatitude);
  const centroidLongitude = Number(area.properties?.centroidLongitude);
  const boxWidthM = Math.max(4, Number(area.properties?.bboxWidthM ?? 4));
  const boxDepthM = Math.max(4, Number(area.properties?.bboxDepthM ?? 4));
  const headingDegrees = Number(area.properties?.headingDegrees ?? 0);
  const buildingPosition =
    building &&
    Number.isFinite(centroidLatitude) &&
    Number.isFinite(centroidLongitude)
      ? Cartesian3.fromDegrees(
          centroidLongitude,
          centroidLatitude,
          minHeightM + (heightM - minHeightM) / 2
        )
      : undefined;
  const buildingOrientation = buildingPosition
    ? Transforms.headingPitchRollQuaternion(
        buildingPosition,
        new HeadingPitchRoll(CesiumMath.toRadians(headingDegrees), 0, 0)
      )
    : undefined;

  return new Entity({
    id: area.id,
    name: area.label ?? area.id,
    position: buildingPosition,
    orientation: buildingOrientation,
    box:
      building && buildingPosition
        ? new BoxGraphics({
            dimensions: new ConstantProperty(
              new Cartesian3(
                boxWidthM,
                boxDepthM,
                Math.max(3.2, heightM - minHeightM)
              )
            ),
            material: new ColorMaterialProperty(
              buildingAreaColor(area, sourceBacked ? 0.38 : 0.2)
            ),
            outline: true,
            outlineColor: buildingOutline.withAlpha(sourceBacked ? 0.62 : 0.32),
            distanceDisplayCondition: new ConstantProperty(
              new DistanceDisplayCondition(0, areaFarDistance(area))
            )
          })
        : undefined,
    polygon: new PolygonGraphics({
      hierarchy: new ConstantProperty(new PolygonHierarchy(positions)),
      material: new ColorMaterialProperty(
        building
          ? buildingRoof
          : water
            ? Color.fromCssColorString('#2eb9e8').withAlpha(0.22)
            : Color.fromCssColorString('#59d99a').withAlpha(0.18)
      ),
      outline: true,
      outlineColor: building
        ? buildingOutline
        : water
          ? Color.fromCssColorString('#70ddff').withAlpha(0.45)
          : Color.fromCssColorString('#83e8b7').withAlpha(0.34),
      distanceDisplayCondition: new ConstantProperty(
        new DistanceDisplayCondition(0, areaFarDistance(area))
      ),
      perPositionHeight: !building,
      height: building ? new ConstantProperty(heightM) : undefined
    }),
    wall: building
      ? new WallGraphics({
          positions: new ConstantProperty(positions),
          minimumHeights: new ConstantProperty(buildingMinimumHeights),
          maximumHeights: new ConstantProperty(buildingMaximumHeights),
          material: new ColorMaterialProperty(buildingFill),
          outline: true,
          outlineColor: buildingOutline,
          distanceDisplayCondition: new ConstantProperty(
            new DistanceDisplayCondition(0, areaFarDistance(area))
          )
        })
      : undefined,
    properties: {
      overlayKind: area.kind,
      sourceName: area.label ?? area.id,
      ...provenance,
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
  #scenarioGhostEntities = new Map<string, Entity>();
  #areaEntities = new Map<string, Entity>();
  #selectedSourceFeatureId: string | null = null;
  #time: TemporalInstant | null = null;
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
    this.#scenarioGhostEntities.clear();
    this.#areaEntities.clear();

    const provenance = provenanceProperties(snapshot);

    for (const node of snapshot.nodes) {
      const entity = this.#source.entities.add(nodeEntity(node, provenance));
      this.#nodeEntities.set(node.id, entity);
    }
    for (const edge of snapshot.edges) {
      const entity = this.#source.entities.add(edgeEntity(edge, provenance));
      this.#edgeEntities.set(edge.id, entity);

      if (
        snapshot.layerId === 'energy' &&
        (edge.kind === 'transmission' || edge.kind === 'distribution')
      ) {
        const ghost = this.#source.entities.add(
          scenarioGhostEntity(edge, provenance)
        );
        this.#scenarioGhostEntities.set(edge.id, ghost);
      }
    }
    for (const area of snapshot.areas ?? []) {
      if (area.positions.length < 3) continue;
      const entity = this.#source.entities.add(areaEntity(area, provenance));
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

  selectSourceFeature(sourceFeatureId: string | null): void {
    this.#selectedSourceFeatureId = sourceFeatureId;
    if (this.#time) this.setTime(this.#time);
    else this.#applySelectionHighlight();
  }

  clearSelection(): void {
    if (!this.#selectedSourceFeatureId) return;
    this.#selectedSourceFeatureId = null;
    if (this.#time) this.setTime(this.#time);
    else this.#viewer.scene.requestRender();
  }

  setTime(time: TemporalInstant): void {
    this.#time = { ...time };
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
      const urbanLight =
        node.properties?.presentationType === 'urban-illumination';
      const baseSize = urbanLight
        ? 1.2 + intensity * 1.8
        : 5 + intensity * 7;
      const powerNode =
        !urbanLight &&
        (node.kind === 'generation' ||
          node.kind === 'substation' ||
          node.kind === 'asset');

      if (urbanLight) {
        const pulse =
          0.5 +
          0.5 *
            Math.sin(
              temporalPhase * 0.12 +
                node.id.length * 0.71 +
                intensity * 4.2
            );
        point.pixelSize = new ConstantProperty(
          baseSize * (0.9 + pulse * 0.34)
        );
        point.color = new ConstantProperty(
          Color.fromCssColorString('#ffd37d').withAlpha(
            0.22 + intensity * 0.18 + pulse * 0.18
          )
        );
      } else if (
        time.mode === 'live' &&
        (node.kind === 'city' ||
          (node.kind === 'event' && node.properties?.eventType === 'earthquake'))
      ) {
        const pulse =
          0.5 +
          0.5 *
            Math.sin(
              temporalPhase * (node.kind === 'city' ? 0.85 : 1.7) +
                node.id.length * 0.41
            );
        const magnitudeBoost =
          node.kind === 'event'
            ? Math.max(0, Number(node.properties?.magnitude ?? node.value ?? 0)) * 0.07
            : 0;
        point.pixelSize = new ConstantProperty(
          baseSize * (0.92 + pulse * 0.34 + magnitudeBoost)
        );
        point.color = new ConstantProperty(nodeColor(node).withAlpha(0.68 + pulse * 0.3));
      } else if (scenario && powerNode) {
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
      const windEdge =
        edge.kind === 'flow' && edge.properties?.vectorType === 'wind';

      const ghost = this.#scenarioGhostEntities.get(edge.id);
      if (ghost) {
        ghost.show =
          Boolean(scenario) &&
          entity.show &&
          isActiveAt(edge, time.iso);
      }

      if (windEdge && time.mode === 'live') {
        const pulse = 0.5 + 0.5 * Math.sin(temporalPhase * 0.72 + intensity * 4.7);
        polyline.width = new ConstantProperty(
          edgeWidth(edge, intensity) * (0.88 + pulse * 0.34)
        );
        polyline.material = new ColorMaterialProperty(
          Color.fromCssColorString('#7de9ff').withAlpha(0.34 + pulse * 0.48)
        );
      } else if (scenario && powerEdge) {
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

    this.#applySelectionHighlight();
    if (this.#visible) this.#viewer.scene.requestRender();
  }

  #sourceFeatureId(
    id: string,
    properties: Readonly<Record<string, unknown>> | undefined
  ): string {
    const value = properties?.sourceFeatureId;
    return typeof value === 'string' && value.trim() ? value.trim() : id;
  }

  #applySelectionHighlight(): void {
    const snapshot = this.#snapshot;
    const selected = this.#selectedSourceFeatureId;
    if (!snapshot || !selected) return;

    for (const node of snapshot.nodes) {
      if (this.#sourceFeatureId(node.id, node.properties) !== selected) continue;
      const entity = this.#nodeEntities.get(node.id);
      if (!entity?.point) continue;
      const intensity = overlayIntensity(node.intensity);
      entity.point.pixelSize = new ConstantProperty(
        Math.max(12, (5 + intensity * 7) * 1.35)
      );
      entity.point.outlineColor = new ConstantProperty(
        Color.fromCssColorString('#ffffff').withAlpha(0.98)
      );
      entity.point.outlineWidth = new ConstantProperty(2.4);
    }

    for (const edge of snapshot.edges) {
      if (this.#sourceFeatureId(edge.id, edge.properties) !== selected) continue;
      const entity = this.#edgeEntities.get(edge.id);
      if (!entity?.polyline) continue;
      const intensity = overlayIntensity(edge.intensity);
      entity.polyline.width = new ConstantProperty(
        Math.max(3.4, edgeWidth(edge, intensity) * 1.75)
      );
      entity.polyline.material = new ColorMaterialProperty(
        Color.fromCssColorString('#ffffff').withAlpha(0.94)
      );
    }

    for (const area of snapshot.areas ?? []) {
      if (this.#sourceFeatureId(area.id, area.properties) !== selected) continue;
      const entity = this.#areaEntities.get(area.id);
      if (!entity?.polygon) continue;
      entity.polygon.outlineColor = new ConstantProperty(
        Color.fromCssColorString('#ffffff').withAlpha(0.92)
      );
    }
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
    this.#selectedSourceFeatureId = null;
    this.#time = null;
    this.#nodeEntities.clear();
    this.#edgeEntities.clear();
    this.#scenarioGhostEntities.clear();
    this.#areaEntities.clear();
  }
}
