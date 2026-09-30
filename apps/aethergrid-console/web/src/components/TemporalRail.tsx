import type { TemporalMode } from '../renderer/spatial-renderer';
import type { AethergridTemporalClock } from '../time/temporal-clock';
import type { TemporalState } from '../time/temporal-model';

const PAST_MINUTES = 6 * 60;
const FUTURE_MINUTES = 7 * 24 * 60;

function offsetMinutes(state: Readonly<TemporalState>): number {
  return Math.round((Date.parse(state.cursorIso) - Date.parse(state.liveIso)) / 60_000);
}

function labelForOffset(value: number): string {
  if (value === 0) return 'NOW';
  const sign = value > 0 ? '+' : '−';
  const absolute = Math.abs(value);
  if (absolute < 60) return `${sign}${absolute}m`;
  if (absolute < 24 * 60) return `${sign}${(absolute / 60).toFixed(1)}h`;
  return `${sign}${(absolute / (24 * 60)).toFixed(1)}d`;
}

function modeForOffset(value: number): TemporalMode {
  if (value === 0) return 'live';
  return value < 0 ? 'historical' : 'forecast';
}

interface TemporalRailProps {
  clock: AethergridTemporalClock;
  state: Readonly<TemporalState>;
}

export function TemporalRail({ clock, state }: TemporalRailProps) {
  const offset = offsetMinutes(state);

  return (
    <section className="temporal-rail" aria-label="4D time controls">
      <div className="temporal-modes" role="group" aria-label="Temporal mode">
        {(['live', 'historical', 'forecast', 'scenario'] as const).map((mode) => (
          <button
            className={state.mode === mode ? 'active' : ''}
            key={mode}
            type="button"
            onClick={() => clock.setMode(mode)}
          >
            {mode.toUpperCase()}
          </button>
        ))}
      </div>

      <button
        className="transport-button"
        type="button"
        aria-label={state.playing ? 'Pause time' : 'Play time'}
        onClick={() => (state.playing ? clock.pause() : clock.play())}
      >
        {state.playing ? 'Ⅱ' : '▶'}
      </button>

      <span className="time-edge">−6H</span>
      <input
        className="time-slider"
        type="range"
        min={-PAST_MINUTES}
        max={FUTURE_MINUTES}
        step={5}
        value={Math.max(-PAST_MINUTES, Math.min(FUTURE_MINUTES, offset))}
        aria-label="Time offset from live"
        onChange={(event) => {
          const minutes = Number(event.currentTarget.value);
          const target = new Date(Date.parse(state.liveIso) + minutes * 60_000).toISOString();
          clock.scrub(target, modeForOffset(minutes));
        }}
      />
      <span className="time-edge">+7D</span>

      <button className="live-button" type="button" onClick={() => clock.goLive()}>
        LIVE NOW
      </button>

      <output className="time-readout" aria-live="polite">
        <strong>{labelForOffset(offset)}</strong>
        <span>{new Date(state.cursorIso).toLocaleString()}</span>
      </output>
    </section>
  );
}
