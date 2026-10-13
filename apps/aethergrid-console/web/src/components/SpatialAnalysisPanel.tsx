import type {
  SpatialInteractionMode,
  SpatialSurfacePoint
} from '../renderer/spatial-renderer';
import {
  formatMeasurementDistance,
  type SpatialMeasurement
} from '../services/spatial-analysis';
import type { SpatialAreaMeasurement } from '../services/spatial-area';


interface SpatialAnalysisPanelProps {
  mode: SpatialInteractionMode;
  points: readonly SpatialSurfacePoint[];
  measurement: SpatialMeasurement | null;
  area: SpatialAreaMeasurement | null;
  areaUnavailable: boolean;
  onFinishArea(): void;
  onModeChange(mode: SpatialInteractionMode): void;
  onReset(): void;
}

function pointLabel(point: SpatialSurfacePoint): string {
  return `${point.latitude.toFixed(5)}°, ${point.longitude.toFixed(5)}°`;
}

function sourceLabel(point: SpatialSurfacePoint): string {
  if (point.source === 'depth-surface') return 'DEPTH SURFACE';
  if (point.source === 'terrain') return 'TERRAIN';
  if (point.source === 'ellipsoid') return 'ELLIPSOID';
  return 'NATIVE PROJECTION';
}

export function SpatialAnalysisPanel({
  mode,
  points,
  measurement,
  area,
  areaUnavailable,
  onFinishArea,
  onModeChange,
  onReset
}: SpatialAnalysisPanelProps) {
  return (
    <section className="spatial-analysis-panel">
      <div className="analysis-head">
        <span>
          <small>SPATIAL ANALYSIS</small>
          <strong>MEASURE</strong>
        </span>
        <div role="group" aria-label="Spatial interaction mode">
          <button
            type="button"
            className={mode === 'inspect' ? 'active' : ''}
            onClick={() => onModeChange('inspect')}
          >
            INSPECT
          </button>
          <button
            type="button"
            className={mode === 'measure' ? 'active' : ''}
            onClick={() => onModeChange('measure')}
          >
            MEASURE
          </button>
          <button type="button" aria-pressed={mode === 'measure-area'} className={mode === 'measure-area' ? 'active' : ''} onClick={() => onModeChange('measure-area')}>AREA</button>
        </div>
      </div>

      <p className="analysis-instruction">
        {mode === 'measure-area' ? area ? 'Area complete. Select another point to start a new polygon.' : 'Select at least three vertices, then finish the polygon.' : mode === 'measure'
          ? points.length === 0
            ? 'Select the first geographic point in the scene.'
            : points.length === 1
              ? 'Select the second geographic point.'
              : 'Measurement complete. Select another point to begin a new measurement.'
          : 'Inspect mode selects mapped features and provenance.'}
      </p>

      {points.length ? (
        <div className="analysis-points">
          {points.map((point, index) => (
            <div key={`${index}:${point.latitude}:${point.longitude}`}>
              <span>{mode === 'measure-area' || area ? index + 1 : index === 0 ? 'A' : 'B'}</span>
              <strong>{pointLabel(point)}</strong>
              <small>{sourceLabel(point)}</small>
            </div>
          ))}
        </div>
      ) : null}

      {mode === 'measure-area' && !area ? <button type="button" disabled={points.length < 3} onClick={onFinishArea}>Finish area</button> : null}
      {areaUnavailable ? <p role="status">Area unavailable: invalid, intersecting, polar or oversized polygon. Clear and select a simple local polygon.</p> : null}
      {area ? <dl className="analysis-results"><div><dt>AREA</dt><dd>{area.areaSquareMeters.toLocaleString(undefined, { maximumFractionDigits: 1 })} m²</dd></div><div><dt>PERIMETER</dt><dd>{formatMeasurementDistance(area.perimeterMeters)}</dd></div></dl> : null}

      {measurement ? (
        <dl className="analysis-results">
          <div>
            <dt>DISTANCE</dt>
            <dd>{formatMeasurementDistance(measurement.distanceMeters)}</dd>
          </div>
          <div>
            <dt>BEARING</dt>
            <dd>{measurement.bearingDegrees.toFixed(1)}°</dd>
          </div>
          <div>
            <dt>ELEVATION Δ</dt>
            <dd>
              {measurement.elevationDeltaMeters == null
                ? 'N/A'
                : `${measurement.elevationDeltaMeters.toFixed(1)} m`}
            </dd>
          </div>
          <div>
            <dt>SLOPE</dt>
            <dd>
              {measurement.slopePercent == null
                ? 'N/A'
                : `${measurement.slopePercent.toFixed(2)}%`}
            </dd>
          </div>
        </dl>
      ) : null}

      <div className="analysis-boundary">
        <strong>
          {area || mode === 'measure-area' ? 'LOCAL TANGENT-PLANE AREA' : measurement?.precision === 'terrain-aware'
            ? 'DEPTH-SURFACE MEASUREMENT'
            : 'GEODESIC / PROJECTED MEASUREMENT'}
        </strong>
        <span>
          {area || mode === 'measure-area' ? 'Horizontal local projection, not terrain surface area. Limited to 20 km radius, below 85° latitude; self-intersections are unavailable.' : 'Native fallback cannot claim terrain elevation. Elevation/slope appear only when both picked surfaces provide heights.'}
        </span>
      </div>

      <button
        className="analysis-reset"
        type="button"
        disabled={!points.length && !measurement}
        onClick={onReset}
      >
        CLEAR MEASUREMENT
      </button>
    </section>
  );
}
