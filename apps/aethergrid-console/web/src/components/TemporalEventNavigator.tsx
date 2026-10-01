import { useMemo, useState } from 'react';

import type { AethergridTemporalClock } from '../time/temporal-clock';
import type { TemporalState } from '../time/temporal-model';
import {
  filterTemporalNavigatorEvents,
  temporalEventNavigationMode,
  type TemporalNavigatorEvent
} from '../services/temporal-event-navigator';

interface TemporalEventNavigatorProps {
  clock: AethergridTemporalClock;
  state: Readonly<TemporalState>;
  events: readonly TemporalNavigatorEvent[];
}

function timeLabel(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : value;
}

export function TemporalEventNavigator({
  clock,
  state,
  events
}: TemporalEventNavigatorProps) {
  const [filters, setFilters] = useState({
    incidents: true,
    captures: true,
    scenarios: true
  });

  const filtered = useMemo(
    () => filterTemporalNavigatorEvents(events, filters),
    [events, filters]
  );

  const currentIndex = useMemo(() => {
    if (!filtered.length) return -1;
    const cursor = Date.parse(state.cursorIso);
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    filtered.forEach((event, index) => {
      const distance = Math.abs(Date.parse(event.timeIso) - cursor);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });
    return nearestIndex;
  }, [filtered, state.cursorIso]);

  const jump = (event: TemporalNavigatorEvent) => {
    const mode = temporalEventNavigationMode(event, state.liveIso);
    clock.pause();
    if (mode === 'live') {
      clock.goLive();
      return;
    }
    if (mode === 'scenario') {
      clock.setMode('scenario', event.scenarioId);
      clock.scrub(event.timeIso, 'scenario');
      return;
    }
    clock.scrub(event.timeIso, mode);
  };

  const move = (direction: -1 | 1) => {
    if (!filtered.length) return;
    const base = currentIndex < 0 ? 0 : currentIndex;
    const next = Math.max(0, Math.min(filtered.length - 1, base + direction));
    jump(filtered[next]);
  };

  return (
    <section className="temporal-event-navigator" aria-label="4D event navigator">
      <div className="temporal-event-head">
        <span>
          <small>4D EVENT NAVIGATOR</small>
          <strong>{filtered.length} VISIBLE RECORDS</strong>
        </span>
        <em>LOCAL / CAPTURED</em>
      </div>

      <div className="temporal-event-controls">
        <button
          type="button"
          className={filters.incidents ? 'active' : ''}
          onClick={() =>
            setFilters((current) => ({
              ...current,
              incidents: !current.incidents
            }))
          }
        >
          INCIDENTS
        </button>
        <button
          type="button"
          className={filters.captures ? 'active' : ''}
          onClick={() =>
            setFilters((current) => ({
              ...current,
              captures: !current.captures
            }))
          }
        >
          A/B CAPTURES
        </button>
        <button
          type="button"
          className={filters.scenarios ? 'active' : ''}
          onClick={() =>
            setFilters((current) => ({
              ...current,
              scenarios: !current.scenarios
            }))
          }
        >
          SCENARIOS
        </button>
        <button type="button" disabled={!filtered.length} onClick={() => move(-1)}>
          PREV
        </button>
        <button type="button" disabled={!filtered.length} onClick={() => move(1)}>
          NEXT
        </button>
      </div>

      {filtered.length ? (
        <div className="temporal-event-list">
          {filtered.map((event) => (
            <button
              type="button"
              key={event.id}
              className={
                currentIndex >= 0 && filtered[currentIndex]?.id === event.id
                  ? 'active'
                  : ''
              }
              data-event-type={event.type}
              data-event-severity={event.severity ?? undefined}
              onClick={() => jump(event)}
            >
              <span>
                <small>
                  {event.type === 'operator-incident'
                    ? 'OPERATOR INCIDENT'
                    : event.type === 'observation-a'
                      ? 'FRAME A'
                      : event.type === 'observation-b'
                        ? 'FRAME B'
                        : event.type === 'scenario-start'
                          ? 'SCENARIO START'
                          : 'SCENARIO END'}
                </small>
                <strong>{event.label}</strong>
              </span>
              <em>{timeLabel(event.timeIso)}</em>
              <p>{event.detail}</p>
            </button>
          ))}
        </div>
      ) : (
        <p className="temporal-event-empty">
          No filtered operator incidents or captured A/B frames are available.
        </p>
      )}

      <div className="analysis-boundary temporal-event-boundary">
        <strong>TIME NAVIGATION · NON-AUTHORITATIVE</strong>
        <span>
          Jumping to an old LIVE capture converts the view to historical context.
          Operator incidents remain local annotations; captured frames remain
          operator analysis snapshots; scenario markers remain modeled
          hypothetical bounds rather than observations or forecasts.
        </span>
      </div>
    </section>
  );
}
