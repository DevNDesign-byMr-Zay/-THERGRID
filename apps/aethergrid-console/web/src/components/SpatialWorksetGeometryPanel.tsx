import type { SpatialWorksetGeometrySummary } from '../services/spatial-workset-geometry';

interface SpatialWorksetGeometryPanelProps {
  geometry: SpatialWorksetGeometrySummary;
  onCenter(): void;
  onAnalyze(geometry: SpatialWorksetGeometrySummary): void;
}

function distanceLabel(meters: number): string {
  if (meters >= 1_000_000) return `${(meters / 1_000_000).toFixed(2)} Mm`;
  if (meters >= 1_000) return `${(meters / 1_000).toFixed(2)} km`;
  return `${meters.toFixed(0)} m`;
}

function durationLabel(milliseconds: number | null): string {
  if (milliseconds == null) return '—';
  const minutes = milliseconds / 60_000;
  if (minutes < 60) return `${minutes.toFixed(0)}m`;
  const hours = minutes / 60;
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export function SpatialWorksetGeometryPanel({
  geometry,
  onCenter,
  onAnalyze
}: SpatialWorksetGeometryPanelProps) {
  return (
    <section className="workset-geometry-panel intel-context-panel">
      <div className="workset-geometry-head">
        <span>
          <small>SPATIAL RELATIONSHIP GRAPH</small>
          <strong>MINIMUM-SPANNING ANALYSIS</strong>
        </span>
        <em>LOCAL</em>
      </div>

      <div className="workset-geometry-summary">
        <span>
          <small>POSITIONED</small>
          <strong>{geometry.positionedEntityCount}</strong>
        </span>
        <span>
          <small>ANALYSIS LINKS</small>
          <strong>{geometry.edgeCount}</strong>
        </span>
        <span>
          <small>REGIONS</small>
          <strong>{geometry.regions.length}</strong>
        </span>
      </div>

      <div className="workset-geometry-metrics">
        <div>
          <small>TREE DISTANCE</small>
          <strong>{distanceLabel(geometry.totalTreeDistanceMeters)}</strong>
        </div>
        <div>
          <small>MAX SEPARATION</small>
          <strong>{distanceLabel(geometry.maximumPairDistanceMeters)}</strong>
        </div>
        <div>
          <small>CAPTURE SPAN</small>
          <strong>{durationLabel(geometry.temporalSpanMs)}</strong>
        </div>
      </div>

      {geometry.centroid ? (
        <p className="workset-geometry-centroid">
          Centroid · {geometry.centroid.latitude.toFixed(5)}°,{' '}
          {geometry.centroid.longitude.toFixed(5)}°
        </p>
      ) : (
        <p className="workset-geometry-centroid">
          Pin positioned entities to generate analytical geometry.
        </p>
      )}

      {geometry.omittedEntityCount ? (
        <p className="workset-geometry-warning">
          {geometry.omittedEntityCount} pinned item
          {geometry.omittedEntityCount === 1 ? '' : 's'} omitted because no
          usable geographic coordinate is stored.
        </p>
      ) : null}

      <div className="workset-geometry-actions">
        <button
          type="button"
          disabled={!geometry.centroid}
          onClick={onCenter}
        >
          CENTER GRAPH
        </button>
        <button
          type="button"
          disabled={geometry.positionedEntityCount < 2}
          onClick={() => onAnalyze(geometry)}
        >
          ANALYZE WITH AUREN
        </button>
      </div>

      <div className="analysis-boundary workset-geometry-boundary">
        <strong>ANALYTICAL GEOMETRY · NON-AUTHORITATIVE</strong>
        <span>
          Lines are the minimum spanning tree of operator-pinned coordinates.
          They show spatial proximity only and do not assert physical,
          electrical, transit, ownership, dependency, or causal relationships.
        </span>
      </div>
    </section>
  );
}
