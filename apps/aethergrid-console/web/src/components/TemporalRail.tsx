import type { TemporalMode } from '../renderer/spatial-renderer';
import {
  TEMPORAL_RAIL_FUTURE_MINUTES,
  TEMPORAL_RAIL_PAST_MINUTES,
  temporalEventInRailWindow,
  temporalEventNavigationMode,
  temporalEventRailPercent,
  type TemporalNavigatorEvent
} from '../services/temporal-event-navigator';
import type { AethergridTemporalClock } from '../time/temporal-clock';
import type { TemporalState } from '../time/temporal-model';

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
  events?: readonly TemporalNavigatorEvent[];
  onScenarioEvent?(event: TemporalNavigatorEvent): void;
}

function dataModeCopy(mode: TemporalMode): {
  label: string;
  detail: string;
} {
  if (mode === 'live') {
    return {
      label: 'LIVE SOURCES',
      detail: 'Current weather · AQI · seismic · mapped spatial context'
    };
  }
  if (mode === 'forecast') {
    return {
      label: 'FORECAST + STATIC',
      detail: 'Provider weather sample when available · AQI/seismic hidden · mapped spatial context'
    };
  }
  if (mode === 'scenario') {
    return {
      label: 'MODELED + STATIC',
      detail: 'Current map topology · modeled scenario effects · live feeds hidden'
    };
  }
  return {
    label: 'STATIC MAP CONTEXT',
    detail: 'Solar time is computed · current weather/AQI/seismic hidden'
  };
}

export function TemporalRail({
  clock,
  state,
  events = [],
  onScenarioEvent
}: TemporalRailProps) {
  const offset = offsetMinutes(state);
  const dataMode = dataModeCopy(state.mode);
  const railEvents = events.filter((event) =>
    temporalEventInRailWindow(event, state.liveIso)
  );

  const jumpToEvent = (event: TemporalNavigatorEvent) => {
    const mode = temporalEventNavigationMode(event, state.liveIso);
    clock.pause();
    if (mode === 'live') {
      clock.goLive();
      return;
    }
    if (mode === 'scenario') {
      if (event.scenarioId && onScenarioEvent) {
        onScenarioEvent(event);
        return;
      }
      clock.setMode('scenario', event.scenarioId);
      clock.scrub(event.timeIso, 'scenario');
      return;
    }
    clock.scrub(event.timeIso, mode);
  };

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
        disabled={state.mode === 'live'}
        aria-label={
          state.mode === 'live'
            ? 'Live time advances automatically'
            : state.playing
              ? 'Pause time'
              : 'Play time'
        }
        onClick={() => (state.playing ? clock.pause() : clock.play())}
      >
        {state.mode === 'live' ? '●' : state.playing ? 'Ⅱ' : '▶'}
      </button>

      <span className="time-edge">−6H</span>
      <div className="time-slider-wrap">
        <input
          className="time-slider"
          type="range"
          min={-TEMPORAL_RAIL_PAST_MINUTES}
          max={TEMPORAL_RAIL_FUTURE_MINUTES}
          step={5}
          value={Math.max(
            -TEMPORAL_RAIL_PAST_MINUTES,
            Math.min(TEMPORAL_RAIL_FUTURE_MINUTES, offset)
          )}
          aria-label="Time offset from live"
          onChange={(event) => {
            const minutes = Number(event.currentTarget.value);
            const target = new Date(
              Date.parse(state.liveIso) + minutes * 60_000
            ).toISOString();
            clock.scrub(target, modeForOffset(minutes));
          }}
        />
        <div className="time-event-markers" aria-hidden="false">
          {railEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              className="time-event-marker"
              data-event-type={event.type}
              data-event-severity={event.severity ?? undefined}
              style={{ left: `${temporalEventRailPercent(event, state.liveIso)}%` }}
              aria-label={`Jump to ${event.label}`}
              title={`${event.label} · ${new Date(event.timeIso).toLocaleString()}`}
              onClick={() => jumpToEvent(event)}
            />
          ))}
        </div>
      </div>
      <span className="time-edge">+7D</span>

      <button className="live-button" type="button" onClick={() => clock.goLive()}>
        LIVE NOW
      </button>

      <div className="temporal-data-status" data-mode={state.mode}>
        <strong>{dataMode.label}</strong>
        <span>{dataMode.detail}</span>
      </div>

      <output className="time-readout" aria-live="polite">
        <strong>{labelForOffset(offset)}</strong>
        <span>{new Date(state.cursorIso).toLocaleString()}</span>
      </output>
    </section>
  );
}
