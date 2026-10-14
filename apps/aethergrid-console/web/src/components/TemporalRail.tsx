import { useLayoutEffect, useMemo, useRef } from 'react';
import type { TemporalMode } from '../renderer/spatial-renderer';
import type { AtmosphericForecastSeries } from '../services/city-environment';
import { forecastFrameInstants, forecastInstant } from '../time/forecast-frames';
import {
  temporalEventInRailWindow,
  temporalEventNavigationMode,
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

interface TemporalRailProps {
  clock: AethergridTemporalClock;
  state: Readonly<TemporalState>;
  events?: readonly TemporalNavigatorEvent[];
  forecastSeries?: AtmosphericForecastSeries | null;
  forecastError?: string | null;
  onHeightChange?(height: number): void;
  onRetryForecast?(): void;
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
    detail: 'Persisted observations unavailable · Historical building reconstruction unavailable · Solar time is computed · current weather/AQI/seismic hidden'
  };
}

export function TemporalRail({
  clock,
  state,
  events = [],
  forecastSeries = null,
  forecastError = null,
  onHeightChange,
  onRetryForecast,
  onScenarioEvent
}: TemporalRailProps) {
  const railRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const node = railRef.current;
    if (!node || !onHeightChange) return;
    const measure = () => onHeightChange(Math.ceil(node.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [onHeightChange]);
  const timeLabel = (iso: string) => `${new Date(iso).toLocaleString(undefined, { timeZone: 'UTC' })} UTC`;
  const offset = offsetMinutes(state);
  const dataMode = dataModeCopy(state.mode);
  const samples = useMemo(() => forecastFrameInstants(forecastSeries), [forecastSeries]);
  const sampleIndex = samples.indexOf(state.cursorIso);
  const forecast = state.mode === 'forecast';
  const forecastLoading = forecast && !forecastSeries && !forecastError;
  const canSelect = forecast && samples.length > 0;
  const range = state.playbackRange;
  const replaySamples = range ? samples.filter((iso) => iso >= range.start && iso <= range.end) : [];
  const replayIndex = replaySamples.indexOf(state.cursorIso);
  const canPlay = canSelect && replayIndex >= 0 && replayIndex < replaySamples.length - 1;
  const issued = forecastInstant(forecastSeries?.modelRunAt, forecastSeries?.utcOffsetSeconds);
  const fetched = forecastInstant(forecastSeries?.fetchedAt);
  const chooseSample = (index: number) => {
    const iso = replaySamples[index];
    if (iso) clock.scrub(iso, 'forecast');
  };
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
    <section ref={railRef} className="temporal-rail" aria-label="4D time controls">
      <div className="temporal-modes" role="group" aria-label="Temporal mode">
        {(['live', 'historical', 'forecast', 'scenario'] as const).map((mode) => (
          <button
            className={state.mode === mode ? 'active' : ''}
            key={mode}
            type="button"
            aria-pressed={state.mode === mode}
            onClick={() => clock.setMode(mode)}
          >
            {mode.toUpperCase()}
          </button>
        ))}
      </div>

      <button
        className="transport-button"
        type="button"
        disabled={!state.playing && !canPlay}
        aria-label={state.playing ? 'Pause source samples' : 'Play source samples'}
        onClick={() => (state.playing ? clock.pause() : clock.play())}
      >
        {state.mode === 'live' ? '●' : state.playing ? 'Ⅱ' : '▶'}
      </button>

      <label className="replay-rate">REPLAY
        <select aria-label="Replay speed" value={state.playbackRate} disabled={!canSelect}
          onChange={(event) => clock.setPlaybackRate(Number(event.currentTarget.value))}>
          {[1, 60, 3600, 86400].map((rate) => <option key={rate} value={rate}>{rate}×</option>)}
        </select>
      </label>
      <div className="source-time-selection">
        <select aria-label="Forecast valid time" disabled={!canSelect} value={sampleIndex < 0 ? '' : state.cursorIso}
          onChange={(event) => clock.scrub(event.currentTarget.value, 'forecast')}>
          <option value="" disabled>{canSelect ? 'Cursor outside source samples' : 'Source samples unavailable'}</option>
          {samples.map((iso) => <option key={iso} value={iso}>{timeLabel(iso)}</option>)}
        </select>
        <input
          className="time-slider"
          type="range"
          min={0}
          max={Math.max(0, replaySamples.length - 1)}
          step={1}
          value={Math.max(0, replayIndex)}
          disabled={!canSelect || replaySamples.length === 0}
          aria-label="Source sample index"
          aria-valuetext={replayIndex >= 0 ? replaySamples[replayIndex] : 'No selected source sample in replay window'}
          onChange={(event) => chooseSample(Number(event.currentTarget.value))}
        />
      </div>
      <button className="first-source-sample" type="button" disabled={!canSelect || replaySamples.length === 0} onClick={() => chooseSample(0)}>First source sample</button>

      <button className="live-button" type="button" onClick={() => clock.goLive()}>
        LIVE NOW
      </button>

      {canSelect && range && <details className="forecast-replay-range">
        <summary>Forecast replay range</summary>
        <div className="forecast-range-fields">
          <label>START
            <select aria-label="Forecast range start" value={range.start}
              onChange={(event) => clock.setPlaybackRange(event.currentTarget.value, range.end)}>
              {samples.map((iso) => <option key={iso} value={iso} disabled={iso > range.end}>{timeLabel(iso)}</option>)}
            </select>
          </label>
          <label>END
            <select aria-label="Forecast range end" value={range.end}
              onChange={(event) => clock.setPlaybackRange(range.start, event.currentTarget.value)}>
              {samples.map((iso) => <option key={iso} value={iso} disabled={iso < range.start}>{timeLabel(iso)}</option>)}
            </select>
          </label>
          <span>{replaySamples.length} replay frames{replayIndex < 0 ? ' · Cursor outside replay window' : ''}</span>
        </div>
      </details>}

      <div className="temporal-data-status" data-mode={state.mode}>
        <strong>{dataMode.label}</strong>
        <span>{dataMode.detail}</span>
        {forecast && <span className="forecast-coverage" data-state={forecastLoading ? 'loading' : forecastError || !canSelect || sampleIndex < 0 ? 'unavailable' : forecastSeries?.stale ? 'stale' : 'forecast'}>
          {forecastError ? `UNAVAILABLE · ${forecastError}` : forecastLoading ? 'LOADING · Awaiting source-valid forecast instants' : !canSelect ? 'UNAVAILABLE · No source-valid forecast instants' :
            `${forecastSeries?.stale ? 'STALE · ' : ''}${samples.length} source samples · ${sampleIndex < 0 ? 'Cursor unavailable · ' : ''}Gaps are not reconstructed`}
          {canSelect && ` · ${forecastSeries?.provider ?? 'Provider unknown'} · MODEL RUN ${issued ? timeLabel(issued) : 'UNKNOWN'} · FETCHED ${fetched ? timeLabel(fetched) : 'UNKNOWN'}`}
        </span>}
        {forecast && !forecastLoading && !canSelect && onRetryForecast && <button className="forecast-retry" type="button" onClick={onRetryForecast}>Retry forecast</button>}
        {state.mode === 'scenario' && <span>Replay unavailable without a supported modeled range</span>}
      </div>

      <output className="time-readout" data-cursor={state.cursorIso}>
        <strong>{labelForOffset(offset)}</strong>
        <span>{timeLabel(state.cursorIso)}</span>
      </output>
      {railEvents.length > 0 && <div className="local-time-events" role="group" aria-label="Operator-local time references">
        <span>LOCAL REFERENCES</span>
        {railEvents.map((event) => <button key={event.id} type="button" aria-label={`Jump to ${event.label}`}
          title={`${event.provenance} · ${event.timeIso} · does not establish historical availability`}
          onClick={() => jumpToEvent(event)}>{event.label}</button>)}
      </div>}
    </section>
  );
}
