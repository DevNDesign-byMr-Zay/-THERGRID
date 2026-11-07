import {
  BoxGraphics,
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Color,
  ColorMaterialProperty,
  ConstantProperty,
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
  type Viewer,
  WallGraphics,
} from 'cesium';

import { buildingAreaColor, edgeColor, nodeColor } from '../overlays/color-mapping';
import {
  overlayIntensity,
  type SpatialOverlayArea,
  type SpatialOverlayEdge,
  type SpatialOverlayNode,
} from '../overlays/spatial-overlay';
import { aircraftModelUri } from './aircraft-model';

export function overlaySourceFeatureId(
  id: string,
  properties: Readonly<Record<string, unknown>> | undefined,
): string {
  const value = properties?.sourceFeatureId;
  return typeof value === 'string' && value.trim() ? value.trim() : id;
}

export function coordinate(position: SpatialOverlayNode['position']): Cartesian3 {
  return Cartesian3.fromDegrees(position.longitude, position.latitude, position.heightMeters ?? 20);
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

function aircraftHeading(node: SpatialOverlayNode): number {
  const value = Number(node.properties?.trackDegrees);
  return Number.isFinite(value) ? value : 0;
}

export function nodeEntity(
  node: SpatialOverlayNode,
  provenance: Readonly<Record<string, unknown>>,
  viewer: Viewer,
): Entity {
  const intensity = overlayIntensity(node.intensity);
  const position = coordinate(node.position);
  const aircraft = node.kind === 'aircraft' && node.properties?.eventType === 'aircraft';
  const aircraftModel = aircraft && node.properties?.render3d === true;
  const staleAircraft = aircraft && node.properties?.truthState === 'stale';
  const urbanLight = node.properties?.presentationType === 'urban-illumination';

  return new Entity({
    id: node.id,
    name: node.label ?? node.id,
    position,
    orientation: aircraftModel
      ? Transforms.headingPitchRollQuaternion(
          position,
          new HeadingPitchRoll(CesiumMath.toRadians(aircraftHeading(node) - 90), 0, 0),
        )
      : undefined,
    point: new PointGraphics({
      pixelSize: aircraft
        ? 4 + intensity * 3
        : urbanLight
          ? 1.2 + intensity * 1.8
          : 5 + intensity * 7,
      color: aircraft
        ? Color.fromCssColorString(staleAircraft ? '#8193a1' : '#70e7ff').withAlpha(
            staleAircraft ? 0.58 : 0.92,
          )
        : nodeColor(node),
      outlineColor: new ConstantProperty(Color.WHITE.withAlpha(0.35)),
      outlineWidth: urbanLight ? 0 : aircraft ? 0.8 : 1.25,
      distanceDisplayCondition: new ConstantProperty(
        aircraft
          ? new DistanceDisplayCondition(aircraftModel ? 850_000 : 0, nodeFarDistance(node))
          : new DistanceDisplayCondition(0, nodeFarDistance(node)),
      ),
      disableDepthTestDistance:
        node.kind === 'city' || node.kind === 'event'
          ? Number.POSITIVE_INFINITY
          : aircraft
            ? 0
            : 1_500_000,
    }),
    model: aircraftModel
      ? new ModelGraphics({
          // ModelVisualizer checks show before creating the model; distanceDisplayCondition runs later.
          show: new CallbackProperty(() => {
            const cameraPosition = viewer.camera?.positionWC;
            return (
              !cameraPosition ||
              Cartesian3.distanceSquared(cameraPosition, position) <= 900_000 * 900_000
            );
          }, false),
          uri: aircraftModelUri,
          scale: 8,
          minimumPixelSize: 12,
          maximumScale: 18,
          color: Color.fromCssColorString(staleAircraft ? '#71828f' : '#79eaff').withAlpha(
            staleAircraft ? 0.62 : 0.96,
          ),
          silhouetteColor: Color.fromCssColorString('#dff8ff').withAlpha(0.68),
          silhouetteSize: 0.5,
          distanceDisplayCondition: new ConstantProperty(new DistanceDisplayCondition(0, 900_000)),
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
          distanceDisplayCondition: new ConstantProperty(new DistanceDisplayCondition(0, 420_000)),
          disableDepthTestDistance: 0,
        })
      : undefined,
    properties: {
      overlayKind: node.kind,
      sourceName: node.label ?? node.id,
      value: node.value ?? null,
      unit: node.unit ?? null,
      ...provenance,
      ...node.properties,
    },
  });
}

export function edgeWidth(edge: SpatialOverlayEdge, intensity: number): number {
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

export function edgeEntity(
  edge: SpatialOverlayEdge,
  provenance: Readonly<Record<string, unknown>>,
): Entity {
  const intensity = overlayIntensity(edge.intensity);
  return new Entity({
    id: edge.id,
    name: edge.label ?? edge.id,
    polyline: new PolylineGraphics({
      positions: new ConstantProperty([coordinate(edge.from), coordinate(edge.to)]),
      width: edgeWidth(edge, intensity),
      material: new ColorMaterialProperty(edgeColor(edge, intensity)),
      distanceDisplayCondition: new ConstantProperty(
        new DistanceDisplayCondition(0, edgeFarDistance(edge)),
      ),
      clampToGround:
        edge.properties?.eventType !== 'aircraft-history' &&
        edge.properties?.eventType !== 'aviation-relationship' &&
        (edge.kind === 'route' ||
          edge.kind === 'waterway' ||
          edge.kind === 'coastline' ||
          edge.properties?.eventType === 'nws-alert-boundary'),
    }),
    properties: {
      overlayKind: edge.kind,
      sourceName: edge.label ?? edge.id,
      value: edge.value ?? null,
      unit: edge.unit ?? null,
      ...provenance,
      ...edge.properties,
    },
  });
}

export function scenarioGhostEntity(
  edge: SpatialOverlayEdge,
  provenance: Readonly<Record<string, unknown>>,
): Entity {
  const intensity = overlayIntensity(edge.intensity);
  return new Entity({
    id: `${edge.id}:source-baseline`,
    name: `${edge.label ?? edge.id} · source baseline`,
    show: false,
    polyline: new PolylineGraphics({
      positions: new ConstantProperty([coordinate(edge.from), coordinate(edge.to)]),
      width: Math.max(1, edgeWidth(edge, intensity) * 0.72),
      material: new ColorMaterialProperty(Color.fromCssColorString('#91a0ad').withAlpha(0.24)),
      distanceDisplayCondition: new ConstantProperty(
        new DistanceDisplayCondition(0, edgeFarDistance(edge)),
      ),
      clampToGround: false,
    }),
    properties: {
      overlayKind: 'scenario-baseline',
      sourceEdgeId: edge.id,
      ...provenance,
    },
  });
}

export function areaEntity(
  area: SpatialOverlayArea,
  provenance: Readonly<Record<string, unknown>>,
): Entity {
  const positions = area.positions.map((position) => coordinate(position));
  const water = area.kind === 'water';
  const building = area.kind === 'building';
  const minHeightM = Math.max(0, Number(area.properties?.minHeightM ?? 0));
  const heightM = Math.max(minHeightM + 3.2, Number(area.properties?.heightM ?? minHeightM + 12));
  const sourceBacked = area.properties?.sourceBacked === true;
  const buildingFill = buildingAreaColor(area, sourceBacked ? 0.94 : 0.58);
  const buildingRoof = buildingAreaColor(area, sourceBacked ? 1 : 0.7);
  const buildingOutline = buildingAreaColor(area, sourceBacked ? 0.48 : 0.24);
  const buildingMinimumHeights = building ? positions.map(() => minHeightM) : undefined;
  const buildingMaximumHeights = building ? positions.map(() => heightM) : undefined;
  const centroidLatitude = Number(area.properties?.centroidLatitude);
  const centroidLongitude = Number(area.properties?.centroidLongitude);
  const boxWidthM = Math.max(4, Number(area.properties?.bboxWidthM ?? 4));
  const boxDepthM = Math.max(4, Number(area.properties?.bboxDepthM ?? 4));
  const headingDegrees = Number(area.properties?.headingDegrees ?? 0);
  const buildingPosition =
    building && Number.isFinite(centroidLatitude) && Number.isFinite(centroidLongitude)
      ? Cartesian3.fromDegrees(
          centroidLongitude,
          centroidLatitude,
          minHeightM + (heightM - minHeightM) / 2,
        )
      : undefined;
  const buildingOrientation = buildingPosition
    ? Transforms.headingPitchRollQuaternion(
        buildingPosition,
        new HeadingPitchRoll(CesiumMath.toRadians(headingDegrees), 0, 0),
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
              new Cartesian3(boxWidthM, boxDepthM, Math.max(3.2, heightM - minHeightM)),
            ),
            material: new ColorMaterialProperty(buildingAreaColor(area, sourceBacked ? 0.38 : 0.2)),
            outline: true,
            outlineColor: buildingOutline.withAlpha(sourceBacked ? 0.62 : 0.32),
            distanceDisplayCondition: new ConstantProperty(
              new DistanceDisplayCondition(0, areaFarDistance(area)),
            ),
          })
        : undefined,
    polygon: new PolygonGraphics({
      hierarchy: new ConstantProperty(new PolygonHierarchy(positions)),
      material: new ColorMaterialProperty(
        building
          ? buildingRoof
          : water
            ? Color.fromCssColorString('#2eb9e8').withAlpha(0.22)
            : Color.fromCssColorString('#59d99a').withAlpha(0.18),
      ),
      outline: true,
      outlineColor: building
        ? buildingOutline
        : water
          ? Color.fromCssColorString('#70ddff').withAlpha(0.45)
          : Color.fromCssColorString('#83e8b7').withAlpha(0.34),
      distanceDisplayCondition: new ConstantProperty(
        new DistanceDisplayCondition(0, areaFarDistance(area)),
      ),
      perPositionHeight: !building,
      height: building ? new ConstantProperty(heightM) : undefined,
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
            new DistanceDisplayCondition(0, areaFarDistance(area)),
          ),
        })
      : undefined,
    properties: {
      overlayKind: area.kind,
      sourceName: area.label ?? area.id,
      ...provenance,
      ...area.properties,
    },
  });
}
