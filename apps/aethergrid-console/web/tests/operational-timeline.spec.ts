import { expect, test } from '@playwright/test';
import { AethergridTemporalClock } from '../src/time/temporal-clock';

// Only time/interval scheduling is doubled; the real production clock emits frames.
function withClock(run: (clock: AethergridTemporalClock, advance: (ms: number, tick?: boolean) => void, timers: Map<number, () => void>) => void) {
  const originalNow = Date.now;
  const originalSet = globalThis.setInterval;
  const originalClear = globalThis.clearInterval;
  let now = Date.parse('2026-10-11T12:00:00Z');
  let next = 0;
  const timers = new Map<number, () => void>();
  Date.now = () => now;
  globalThis.setInterval = ((callback: () => void) => { timers.set(++next, callback); return next; }) as any;
  globalThis.clearInterval = ((id: number) => timers.delete(id)) as any;
  const clock = new AethergridTemporalClock(new Date(now));
  try { run(clock, (ms, tick = true) => { now += ms; if (tick) [...timers.values()].forEach((callback) => callback()); }, timers); }
  finally { clock.destroy(); Date.now = originalNow; globalThis.setInterval = originalSet; globalThis.clearInterval = originalClear; }
}

test('LIVE cannot replay or retain a past cursor', () => {
  withClock((clock) => {
    clock.play();
    expect(clock.snapshot().playing).toBe(false);
    clock.scrub('2026-10-10T12:00:00Z', 'live');
    expect(clock.snapshot().cursorIso).toBe('2026-10-11T12:00:00.000Z');
  });
});

test('unavailable historical and forecast coverage cannot replay', () => {
  withClock((clock) => {
    for (const mode of ['historical', 'forecast', 'scenario'] as const) {
      clock.setMode(mode); clock.play();
      expect(clock.snapshot().playing).toBe(false);
    }
  });
});

test('source replay emits exact sorted frames, skips gaps and stops at the end', () => {
  withClock((clock, advance) => {
    clock.setMode('forecast');
    clock.setPlaybackSamples(['2026-10-11T15:00:00Z', 'bad', '2026-10-11T13:00:00Z', '2026-10-11T12:00:00Z', '2026-10-11T13:00:00Z']);
    clock.setPlaybackRate(3600);
    const emitted: string[] = [];
    clock.subscribe((state) => emitted.push(state.cursorIso));
    clock.play(); advance(1000);
    expect(clock.snapshot().cursorIso).toBe('2026-10-11T13:00:00.000Z');
    advance(1000);
    expect(clock.snapshot().cursorIso).toBe('2026-10-11T13:00:00.000Z');
    advance(1000);
    expect(clock.snapshot().cursorIso).toBe('2026-10-11T15:00:00.000Z');
    expect(clock.snapshot().playing).toBe(false);
    expect(emitted).not.toContain('2026-10-11T14:00:00.000Z');
    clock.play(); expect(clock.snapshot().playing).toBe(false);
  });
});

test('scrub, mode and replaced coverage cancel transport without clamping restored cursors', () => {
  withClock((clock, advance) => {
    const samples = ['2026-10-11T12:00:00Z', '2026-10-11T13:00:00Z'];
    clock.setMode('forecast'); clock.setPlaybackSamples(samples); clock.play();
    clock.scrub('2026-10-11T12:30:00Z');
    expect(clock.snapshot().playing).toBe(false);
    clock.play(); expect(clock.snapshot().playing).toBe(false);
    expect(clock.snapshot().cursorIso).toBe('2026-10-11T12:30:00.000Z');
    clock.scrub(samples[0]); clock.play(); clock.setMode('live');
    expect(clock.snapshot().playing).toBe(false);
    clock.setMode('forecast'); clock.scrub(samples[0]); clock.setPlaybackSamples(samples); clock.play();
    clock.setPlaybackSamples(null); expect(clock.snapshot().playing).toBe(false);
    advance(1000); expect(clock.snapshot().cursorIso).toBe('2026-10-11T12:00:00.000Z');
  });
});

test('pause resumes partial source intervals while scrub and coverage reset progress', () => {
  withClock((clock, advance) => {
    const samples = ['2026-10-11T12:00:00Z', '2026-10-11T13:00:00Z'];
    clock.setMode('forecast'); clock.setPlaybackSamples(samples); clock.setPlaybackRate(3600);
    clock.play(); advance(450); advance(50, false); clock.pause(); advance(5000);
    expect(clock.snapshot().cursorIso).toBe('2026-10-11T12:00:00.000Z');
    clock.play(); advance(500);
    expect(clock.snapshot().cursorIso).toBe('2026-10-11T13:00:00.000Z');
    expect(clock.snapshot().playing).toBe(false);
    clock.scrub(samples[0]); clock.play(); advance(500); clock.pause();
    clock.scrub(samples[0]); clock.play(); advance(500);
    expect(clock.snapshot().cursorIso).toBe('2026-10-11T12:00:00.000Z');
    clock.setPlaybackSamples(samples); clock.play(); advance(500);
    expect(clock.snapshot().cursorIso).toBe('2026-10-11T12:00:00.000Z');
    clock.setPlaybackRange(samples[0], samples[1]); clock.play(); advance(500);
    expect(clock.snapshot().cursorIso).toBe('2026-10-11T12:00:00.000Z');
    clock.setMode('live'); clock.setMode('forecast'); clock.scrub(samples[0]); clock.setPlaybackSamples(samples);
    clock.play(); advance(500);
    expect(clock.snapshot().cursorIso).toBe('2026-10-11T12:00:00.000Z');
  });
});

test('rate validation and clock teardown leave no replay timers', () => {
  withClock((clock, _advance, timers) => {
    expect(() => clock.setPlaybackRate(Number.NaN)).toThrow();
    expect(() => clock.setPlaybackRate(0)).toThrow();
    clock.setMode('forecast'); clock.setPlaybackSamples(['2026-10-11T12:00:00Z','2026-10-11T13:00:00Z']); clock.play();
    clock.destroy(); expect(timers.size).toBe(0);
  });
});

test('frame metadata separates the live clock reference from unavailable observation timestamps', async () => {
  const path = '../src/time/frame-temporal-instant';
  const { frameTemporalInstant } = await import(path);
  const state = { mode: 'historical', cursorIso: '2026-10-10T12:00:00.000Z', liveIso: '2026-10-12T17:00:00.000Z', playing: false, playbackRate: 60, scenarioId: null };
  expect(frameTemporalInstant(state).sourceTime).toBeNull();
  expect(frameTemporalInstant(state).liveReferenceIso).toBe('2026-10-12T17:00:00.000Z');
  expect(frameTemporalInstant({ ...state, mode: 'scenario' }).sourceTime).toBeNull();
  const forecast = { live: true, fallback: false, eventTime: state.cursorIso, sourceTime: state.cursorIso };
  expect(frameTemporalInstant({ ...state, mode: 'forecast' }, null, forecast).sourceTime).toBe('2026-10-10T12:00:00.000Z');
  expect(frameTemporalInstant({ ...state, mode: 'forecast' }, null, { ...forecast, eventTime: state.liveIso }).sourceTime).toBeNull();
});

test('operator forecast range stops at its selected source endpoint without clamping the cursor', () => {
  withClock((clock, advance) => {
    clock.setMode('forecast');
    clock.setPlaybackSamples(['2026-10-11T12:00:00Z', '2026-10-11T13:00:00Z', '2026-10-11T15:00:00Z']);
    clock.setPlaybackRange('2026-10-11T12:00:00Z', '2026-10-11T13:00:00Z');
    clock.setPlaybackRate(3600); clock.play(); advance(1000);
    expect(clock.snapshot().cursorIso).toBe('2026-10-11T13:00:00.000Z');
    expect(clock.snapshot().playing).toBe(false);
    clock.scrub('2026-10-11T15:00:00Z'); clock.play();
    expect(clock.snapshot().cursorIso).toBe('2026-10-11T15:00:00.000Z');
    expect(clock.snapshot().playing).toBe(false);
    expect(() => clock.setPlaybackRange('2026-10-11T12:30:00Z', '2026-10-11T15:00:00Z')).toThrow();
    expect(() => clock.setPlaybackRange('2026-10-11T15:00:00Z', '2026-10-11T12:00:00Z')).toThrow();
  });
});

test('captured comparison frames copy their selected replay range', async () => {
  const path = '../src/services/spatial-comparison';
  const { captureSpatialObservation } = await import(path);
  const temporal = { mode: 'forecast', iso: '2026-10-11T12:00:00Z', range: { start: '2026-10-11T12:00:00Z', end: '2026-10-11T13:00:00Z' } };
  const captured = captureSpatialObservation({ region: 'contract', latitude: 40, longitude: -74, temporal, visualMode: 'solid', useCase: null, cityIdentity: null, atmosphere: null, liveContext: null, selection: null, measurement: null });
  temporal.range.end = '2026-10-11T15:00:00Z';
  expect(captured.temporal.range.end).toBe('2026-10-11T13:00:00Z');
});

function dossierInput(mode = 'forecast', stale = false) {
  return { region: 'contract', temporal: { mode, iso: '2026-10-11T12:00:00Z' }, visualMode: 'solid', useCase: null,
    selection: { id: 'mapped', kind: 'building', properties: { sourceDataset: 'osm-overpass' } }, measurement: null,
    observationA: null, observationB: null, cityIdentity: null, liveContext: null,
    atmosphere: { id: 'forecast-contract', coordinate: { latitude: 40, longitude: -74 }, current: null, timezone: 'UTC', utcOffsetSeconds: 0,
      live: true, fallback: false, stale, eventTime: '2026-10-11T12:00:00Z', sourceTime: '2026-10-11T12:00:00Z', fetchedAt: '2026-10-11T11:00:00Z', attribution: 'OFFLINE FORECAST CONTRACT' } };
}

test('entity evidence retains forecast identity', async () => {
  const path = '../src/services/spatial-entity-dossier';
  const { buildSpatialEntityDossier } = await import(path);
  const forecast = buildSpatialEntityDossier(dossierInput()).contextSources[0];
  expect(forecast.state).toBe('forecast'); expect(forecast.dataset).toBe('weather-forecast');
});

test('entity evidence never promotes stale weather to live', async () => {
  const path = '../src/services/spatial-entity-dossier';
  const { buildSpatialEntityDossier } = await import(path);
  expect(buildSpatialEntityDossier(dossierInput('forecast', true)).contextSources[0].state).toBe('stale');
});

test('entity evidence excludes current weather from historical frames', async () => {
  const path = '../src/services/spatial-entity-dossier';
  const { buildSpatialEntityDossier } = await import(path);
  expect(buildSpatialEntityDossier(dossierInput('historical')).contextSources).toEqual([]);
});
