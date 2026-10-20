import type { RadarManifest } from '../services/weather-radar';
export function RadarControls({
  manifest,
  error,
  index,
  playing,
  coverage,
  onIndex,
  onPlaying,
  onCoverage,
}: {
  manifest: RadarManifest | null;
  error: string | null;
  index: number;
  playing: boolean;
  coverage: boolean;
  onIndex(value: number): void;
  onPlaying(value: boolean): void;
  onCoverage(value: boolean): void;
}) {
  const frame = manifest?.frames[index];
  return (
    <section
      className="radar-controls"
      aria-label="Weather radar"
      data-radar-frame={frame?.time ?? ''}
      data-source-state={
        error ? 'unavailable' : manifest?.stale ? 'stale' : manifest ? 'observed' : 'loading'
      }
    >
      <div>
        <strong>WEATHER RADAR</strong>
        <small>
          {error
            ? 'UNAVAILABLE'
            : manifest?.stale
              ? 'STALE COMPOSITE'
              : manifest
                ? 'OBSERVED COMPOSITES'
                : 'CONNECTING'}
        </small>
      </div>
      {manifest ? (
        <>
          <div className="radar-actions">
            <button type="button" onClick={() => onPlaying(!playing)} aria-pressed={playing}>
              {playing ? 'PAUSE RADAR' : 'PLAY RADAR'}
            </button>
            <input
              aria-label="Radar frame"
              type="range"
              min="0"
              max={manifest.frames.length - 1}
              value={index}
              onChange={(e) => {
                onPlaying(false);
                onIndex(Number(e.target.value));
              }}
            />
            <label>
              <input
                type="checkbox"
                checked={coverage}
                onChange={(e) => onCoverage(e.target.checked)}
              />
              Coverage
            </label>
          </div>
          <time dateTime={frame?.time}>{frame ? new Date(frame.time).toLocaleString() : ''}</time>
          <small>Rain → heavy precipitation · snow colors · gaps ≠ clear weather</small>
          <a href={manifest.attributionUrl} target="_blank" rel="noreferrer">
            Weather radar by RainViewer
          </a>
        </>
      ) : (
        <small>{error ?? 'Loading recent radar frames…'}</small>
      )}
    </section>
  );
}
