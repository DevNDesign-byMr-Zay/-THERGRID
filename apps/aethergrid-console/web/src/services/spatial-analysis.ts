import type {
  SpatialSurfacePoint,
  TemporalInstant
} from '../renderer/spatial-renderer';
import type {
  SpatialOverlaySnapshot
} from '../renderer/overlays/spatial-overlay';

const EARTH_RADIUS_METERS = 6_371_008.8;

function radians(value: number): number {
  return (value * Math.PI) / 180;
}

function degrees(value: number): number {
  return (value * 180) / Math.PI;
}

function normalizedBearing(value: number): number {
  return ((value % 360) + 360) % 360;
}

export interface SpatialMeasurement {
  start: SpatialSurfacePoint;
  end: SpatialSurfacePoint;
  distanceMeters: number;
  bearingDegrees: number;
  elevationDeltaMeters: number | null;
  slopePercent: number | null;
  threeDimensionalDistanceMeters: number | null;
  midpoint: {
    latitude: number;
    longitude: number;
  };
  precision: 'terrain-aware' | 'ellipsoid-or-projection';
}

export function measureSpatialPoints(
  start: SpatialSurfacePoint,
  end: SpatialSurfacePoint
): SpatialMeasurement {
  const lat1 = radians(start.latitude);
  const lat2 = radians(end.latitude);
  const deltaLat = radians(end.latitude - start.latitude);
  const deltaLon = radians(end.longitude - start.longitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const centralAngle = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceMeters = EARTH_RADIUS_METERS * centralAngle;

  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  const bearingDegrees = normalizedBearing(degrees(Math.atan2(y, x)));

  const hasHeights =
    Number.isFinite(start.heightMeters) && Number.isFinite(end.heightMeters);
  const elevationDeltaMeters = hasHeights
    ? Number(end.heightMeters) - Number(start.heightMeters)
    : null;
  const slopePercent =
    elevationDeltaMeters != null && distanceMeters > 0.01
      ? (elevationDeltaMeters / distanceMeters) * 100
      : null;
  const threeDimensionalDistanceMeters =
    elevationDeltaMeters != null
      ? Math.hypot(distanceMeters, elevationDeltaMeters)
      : null;

  const bx = Math.cos(lat2) * Math.cos(deltaLon);
  const by = Math.cos(lat2) * Math.sin(deltaLon);
  const midpointLatitude = Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.sqrt(
      (Math.cos(lat1) + bx) ** 2 +
        by ** 2
    )
  );
  const midpointLongitude =
    radians(start.longitude) +
    Math.atan2(by, Math.cos(lat1) + bx);

  return {
    start,
    end,
    distanceMeters,
    bearingDegrees,
    elevationDeltaMeters,
    slopePercent,
    threeDimensionalDistanceMeters,
    midpoint: {
      latitude: degrees(midpointLatitude),
      longitude:
        ((degrees(midpointLongitude) + 540) % 360) - 180
    },
    precision:
      start.source === 'depth-surface' &&
      end.source === 'depth-surface'
        ? 'terrain-aware'
        : 'ellipsoid-or-projection'
  };
}

export function measurementToOverlay(
  measurement: SpatialMeasurement,
  time: TemporalInstant
): SpatialOverlaySnapshot {
  const startHeight = measurement.start.heightMeters ?? 6;
  const endHeight = measurement.end.heightMeters ?? 6;

  return {
    id: `operator-measurement:${time.iso}`,
    layerId: 'analysis',
    eventTime: time.iso,
    sourceTime: time.sourceTime ?? time.iso,
    fetchedAt: time.iso,
    live: false,
    stale: false,
    fallback: false,
    attribution: 'ÆTHERGRID operator geodesic measurement',
    nodes: [
      {
        id: 'measurement:start',
        kind: 'analysis-point',
        position: {
          latitude: measurement.start.latitude,
          longitude: measurement.start.longitude,
          heightMeters: startHeight + 3
        },
        label: 'Measurement start',
        intensity: 1,
        properties: {
          analysisType: 'measurement',
          point: 'start',
          surfaceSource: measurement.start.source
        }
      },
      {
        id: 'measurement:end',
        kind: 'analysis-point',
        position: {
          latitude: measurement.end.latitude,
          longitude: measurement.end.longitude,
          heightMeters: endHeight + 3
        },
        label: 'Measurement end',
        intensity: 1,
        properties: {
          analysisType: 'measurement',
          point: 'end',
          surfaceSource: measurement.end.source
        }
      }
    ],
    edges: [
      {
        id: 'measurement:line',
        kind: 'analysis-line',
        from: {
          latitude: measurement.start.latitude,
          longitude: measurement.start.longitude,
          heightMeters: startHeight + 3
        },
        to: {
          latitude: measurement.end.latitude,
          longitude: measurement.end.longitude,
          heightMeters: endHeight + 3
        },
        label: 'Operator measurement',
        value: measurement.distanceMeters,
        unit: 'm',
        intensity: 1,
        properties: {
          analysisType: 'measurement',
          bearingDegrees: measurement.bearingDegrees,
          precision: measurement.precision
        }
      }
    ]
  };
}

export function formatMeasurementDistance(distanceMeters: number): string {
  if (distanceMeters >= 1000) return `${(distanceMeters / 1000).toFixed(2)} km`;
  return `${distanceMeters.toFixed(distanceMeters >= 100 ? 0 : 1)} m`;
}
