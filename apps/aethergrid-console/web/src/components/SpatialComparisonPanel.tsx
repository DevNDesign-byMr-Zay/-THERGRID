import {
  downloadSpatialComparison,
  type SpatialComparison,
  type SpatialObservation
} from '../services/spatial-comparison';

interface SpatialComparisonPanelProps {
  a: SpatialObservation | null;
  b: SpatialObservation | null;
  comparison: SpatialComparison | null;
  onCapture(slot: 'a' | 'b'): void;
  onClear(): void;
  onAnalyze?(): void;
}

function frameSummary(observation: SpatialObservation | null): string {
  if (!observation) return 'NOT CAPTURED';
  return `${observation.region} · ${observation.temporal.mode.toUpperCase()}`;
}

function frameTime(observation: SpatialObservation | null): string {
  if (!observation) return '—';
  const time = new Date(observation.temporal.iso);
  return Number.isFinite(time.getTime()) ? time.toLocaleString() : observation.temporal.iso;
}

export function SpatialComparisonPanel({
  a,
  b,
  comparison,
  onCapture,
  onClear,
  onAnalyze
}: SpatialComparisonPanelProps) {
  return (
    <section className="spatial-comparison-panel">
      <div className="comparison-head">
        <span>
          <small>FRAME COMPARISON</small>
          <strong>A / B</strong>
        </span>
        <button type="button" disabled={!a && !b} onClick={onClear}>
          CLEAR
        </button>
      </div>

      <div className="comparison-frames">
        {([
          ['a', 'FRAME A', a],
          ['b', 'FRAME B', b]
        ] as const).map(([slot, label, observation]) => (
          <div key={slot}>
            <span>{label}</span>
            <strong>{frameSummary(observation)}</strong>
            <small>{frameTime(observation)}</small>
            <button type="button" onClick={() => onCapture(slot)}>
              {observation ? 'RECAPTURE' : 'CAPTURE'}
            </button>
          </div>
        ))}
      </div>

      {comparison ? (
        <>
          <div className="comparison-meta">
            <span>
              <small>FRAME Δ</small>
              <strong>{comparison.frameSeparationSeconds.toFixed(0)}s</strong>
            </span>
            <span>
              <small>CAPTURE Δ</small>
              <strong>{comparison.capturedSeparationSeconds.toFixed(0)}s</strong>
            </span>
            <span>
              <small>COMPARABLE</small>
              <strong>{comparison.metricDeltas.length}</strong>
            </span>
          </div>

          <div className="comparison-deltas">
            {comparison.metricDeltas.length ? (
              comparison.metricDeltas.map((metric) => (
                <div key={metric.key}>
                  <span>{metric.label}</span>
                  <small>
                    {metric.a.toFixed(2)}{metric.unit ? ` ${metric.unit}` : ''} →{' '}
                    {metric.b.toFixed(2)}{metric.unit ? ` ${metric.unit}` : ''}
                  </small>
                  <strong>
                    {metric.delta >= 0 ? '+' : ''}
                    {metric.delta.toFixed(2)}
                    {metric.unit ? ` ${metric.unit}` : ''}
                  </strong>
                </div>
              ))
            ) : (
              <p>No numeric metrics are simultaneously available in both frames.</p>
            )}
          </div>

          <div className="comparison-actions">
            <button
              type="button"
              onClick={() => downloadSpatialComparison(comparison)}
            >
              EXPORT ANALYSIS JSON
            </button>
            {onAnalyze ? (
              <button type="button" onClick={onAnalyze}>
                ANALYZE WITH AUREN
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <p className="comparison-empty">
          Capture two frames to compare only mutually available metrics.
        </p>
      )}

      <div className="analysis-boundary">
        <strong>OPERATOR ANALYSIS · NON-AUTHORITATIVE</strong>
        <span>
          Missing metrics stay missing. Exported comparison packages are separate from the server evidence ledger.
        </span>
      </div>
    </section>
  );
}
