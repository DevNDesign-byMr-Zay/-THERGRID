import type { SpatialOverlaySnapshot } from '../renderer/overlays/spatial-overlay';
import type { TemporalInstant } from '../renderer/spatial-renderer';
import type { SpatialWorksetItem } from './spatial-workset';

export interface SpatialWorksetGeometryNode {
  canonicalId: string;
  displayName: string;
  latitude: number;
  longitude: number;
  heightMeters: number;
  region: string;
  capturedAt: string;
}

export interface SpatialWorksetGeometryEdge {
  id: string;
  fromCanonicalId: string;
  toCanonicalId: string;
  distanceMeters: number;
}

export interface SpatialWorksetGeometrySummary {
  authoritative: false;
  relationshipBasis: 'minimum-spanning-analysis';
  positionedEntityCount: number;
  omittedEntityCount: number;
  edgeCount: number;
  totalTreeDistanceMeters: number;
  maximumPairDistanceMeters: number;
  centroid: {
    latitude: number;
    longitude: number;
  } | null;
  temporalSpanMs: number | null;
  regions: readonly string[];
  nodes: readonly SpatialWorksetGeometryNode[];
  edges: readonly SpatialWorksetGeometryEdge[];
}

const EARTH_RADIUS_METERS = 6_371_008.8;

function radians(value: number): number {
  return (value * Math.PI) / 180;
}

function degrees(value: number): number {
  return (value * 180) / Math.PI;
}

export function greatCircleDistanceMeters(
  a: Pick<SpatialWorksetGeometryNode, 'latitude' | 'longitude'>,
  b: Pick<SpatialWorksetGeometryNode, 'latitude' | 'longitude'>
): number {
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const deltaLat = lat2 - lat1;
  const deltaLon = radians(b.longitude - a.longitude);
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

function positionedNodes(
  items: readonly SpatialWorksetItem[]
): SpatialWorksetGeometryNode[] {
  return items.flatMap((item) => {
    const position = item.dossier.entity.position;
    if (
      position.latitude == null ||
      position.longitude == null ||
      !Number.isFinite(position.latitude) ||
      !Number.isFinite(position.longitude)
    ) {
      return [];
    }

    return [
      {
        canonicalId: item.canonicalId,
        displayName: item.dossier.entity.displayName,
        latitude: position.latitude,
        longitude: position.longitude,
        heightMeters:
          position.heightMeters != null && Number.isFinite(position.heightMeters)
            ? position.heightMeters
            : 24,
        region: item.dossier.region,
        capturedAt: item.dossier.generatedAt
      }
    ];
  });
}

function sphericalCentroid(
  nodes: readonly SpatialWorksetGeometryNode[]
): SpatialWorksetGeometrySummary['centroid'] {
  if (!nodes.length) return null;

  let x = 0;
  let y = 0;
  let z = 0;
  for (const node of nodes) {
    const lat = radians(node.latitude);
    const lon = radians(node.longitude);
    x += Math.cos(lat) * Math.cos(lon);
    y += Math.cos(lat) * Math.sin(lon);
    z += Math.sin(lat);
  }

  x /= nodes.length;
  y /= nodes.length;
  z /= nodes.length;

  const longitude = Math.atan2(y, x);
  const hyp = Math.sqrt(x * x + y * y);
  const latitude = Math.atan2(z, hyp);

  return {
    latitude: degrees(latitude),
    longitude: degrees(longitude)
  };
}

function minimumSpanningEdges(
  nodes: readonly SpatialWorksetGeometryNode[]
): SpatialWorksetGeometryEdge[] {
  if (nodes.length < 2) return [];

  const visited = new Set<number>([0]);
  const edges: SpatialWorksetGeometryEdge[] = [];

  while (visited.size < nodes.length) {
    let best:
      | {
          from: number;
          to: number;
          distanceMeters: number;
        }
      | null = null;

    for (const from of visited) {
      for (let to = 0; to < nodes.length; to += 1) {
        if (visited.has(to)) continue;
        const distanceMeters = greatCircleDistanceMeters(
          nodes[from],
          nodes[to]
        );
        if (!best || distanceMeters < best.distanceMeters) {
          best = { from, to, distanceMeters };
        }
      }
    }

    if (!best) break;
    visited.add(best.to);
    const fromNode = nodes[best.from];
    const toNode = nodes[best.to];
    edges.push({
      id: `workset-analysis:${fromNode.canonicalId}:${toNode.canonicalId}`,
      fromCanonicalId: fromNode.canonicalId,
      toCanonicalId: toNode.canonicalId,
      distanceMeters: best.distanceMeters
    });
  }

  return edges;
}

function maximumPairDistance(
  nodes: readonly SpatialWorksetGeometryNode[]
): number {
  let maximum = 0;
  for (let first = 0; first < nodes.length; first += 1) {
    for (let second = first + 1; second < nodes.length; second += 1) {
      maximum = Math.max(
        maximum,
        greatCircleDistanceMeters(nodes[first], nodes[second])
      );
    }
  }
  return maximum;
}

function temporalSpanMs(
  nodes: readonly SpatialWorksetGeometryNode[]
): number | null {
  const timestamps = nodes
    .map((node) => Date.parse(node.capturedAt))
    .filter(Number.isFinite);
  if (!timestamps.length) return null;
  return Math.max(...timestamps) - Math.min(...timestamps);
}

export function buildSpatialWorksetGeometry(
  items: readonly SpatialWorksetItem[]
): SpatialWorksetGeometrySummary {
  const nodes = positionedNodes(items);
  const edges = minimumSpanningEdges(nodes);
  return {
    authoritative: false,
    relationshipBasis: 'minimum-spanning-analysis',
    positionedEntityCount: nodes.length,
    omittedEntityCount: Math.max(0, items.length - nodes.length),
    edgeCount: edges.length,
    totalTreeDistanceMeters: edges.reduce(
      (total, edge) => total + edge.distanceMeters,
      0
    ),
    maximumPairDistanceMeters: maximumPairDistance(nodes),
    centroid: sphericalCentroid(nodes),
    temporalSpanMs: temporalSpanMs(nodes),
    regions: Object.freeze([...new Set(nodes.map((node) => node.region))]),
    nodes: Object.freeze(nodes),
    edges: Object.freeze(edges)
  };
}

export function spatialWorksetGeometryToOverlay(
  geometry: SpatialWorksetGeometrySummary,
  temporal: TemporalInstant
): SpatialOverlaySnapshot {
  const byId = new Map(
    geometry.nodes.map((node) => [node.canonicalId, node])
  );

  return {
    id: 'operator-workset-geometry',
    layerId: 'workset-analysis',
    eventTime: temporal.iso,
    sourceTime: null,
    fetchedAt: null,
    live: false,
    stale: false,
    fallback: false,
    attribution: 'Local operator analytical geometry · non-authoritative',
    nodes: geometry.nodes.map((node) => ({
      id: `workset-analysis-node:${node.canonicalId}`,
      kind: 'analysis-point' as const,
      position: {
        latitude: node.latitude,
        longitude: node.longitude,
        heightMeters: node.heightMeters + 18
      },
      label: node.displayName,
      intensity: 0.78,
      properties: {
        analysisType: 'workset-geometry',
        relationshipBasis: geometry.relationshipBasis,
        authoritative: false,
        canonicalId: node.canonicalId,
        region: node.region,
        capturedAt: node.capturedAt,
        sourceFeatureId: node.canonicalId,
        sourceDataset: 'local-operator-workset-geometry'
      }
    })),
    edges: geometry.edges.flatMap((edge) => {
      const from = byId.get(edge.fromCanonicalId);
      const to = byId.get(edge.toCanonicalId);
      if (!from || !to) return [];
      return [
        {
          id: edge.id,
          kind: 'analysis-line' as const,
          from: {
            latitude: from.latitude,
            longitude: from.longitude,
            heightMeters: from.heightMeters + 18
          },
          to: {
            latitude: to.latitude,
            longitude: to.longitude,
            heightMeters: to.heightMeters + 18
          },
          label: 'Operator analytical relationship',
          value: edge.distanceMeters,
          unit: 'm',
          intensity: 0.66,
          properties: {
            analysisType: 'workset-geometry',
            relationshipBasis: geometry.relationshipBasis,
            authoritative: false,
            fromCanonicalId: edge.fromCanonicalId,
            toCanonicalId: edge.toCanonicalId,
            distanceMeters: edge.distanceMeters,
            sourceFeatureId: edge.id,
            sourceDataset: 'local-operator-workset-geometry'
          }
        }
      ];
    }),
    areas: []
  };
}
