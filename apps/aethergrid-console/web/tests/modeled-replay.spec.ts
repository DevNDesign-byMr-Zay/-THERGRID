import { expect, test } from '@playwright/test';
import { AethergridTemporalClock } from '../src/time/temporal-clock';
import { createSpatialBookmark, saveSpatialBookmarks, loadSpatialBookmarks } from '../src/services/view-bookmarks';
import { createOperatorSession, loadOperatorSessions, saveOperatorSessions } from '../src/services/operator-session';

const start = '2026-10-12T12:00:00.000Z';
const end = '2026-10-12T13:00:00.000Z';
function withClock(run: (clock: AethergridTemporalClock, advance: (ms: number) => void) => void) {
  const original = { now: Date.now, set: globalThis.setInterval, clear: globalThis.clearInterval };
  let now = Date.parse(start), sequence = 0;
  const timers = new Map<number, () => void>();
  Date.now = () => now;
  globalThis.setInterval = ((callback: () => void) => { timers.set(++sequence, callback); return sequence; }) as any;
  globalThis.clearInterval = ((id: number) => timers.delete(id)) as any;
  const clock = new AethergridTemporalClock(new Date(now));
  try { run(clock, (ms) => { now += ms; [...timers.values()].forEach((callback) => callback()); }); }
  finally { clock.destroy(); Date.now = original.now; globalThis.setInterval = original.set; globalThis.clearInterval = original.clear; }
}

test('operator modeled replay advances continuously, preserves pause and stops at declared end', () => {
  withClock((clock, advance) => {
    clock.setMode('scenario', 'operator-a');
    expect((clock as any).setModeledRange).toBeInstanceOf(Function);
    (clock as any).setModeledRange(start, end);
    clock.setPlaybackRate(3600); clock.play(); advance(500);
    expect(clock.snapshot().cursorIso).toBe('2026-10-12T12:30:00.000Z');
    clock.pause(); advance(5000);
    expect(clock.snapshot().cursorIso).toBe('2026-10-12T12:30:00.000Z');
    clock.play(); advance(500);
    expect(clock.snapshot().cursorIso).toBe(end);
    expect(clock.snapshot().playing).toBe(false);
  });
});

test('modeled range cannot authorize replay for another scenario, mode or cursor', () => {
  withClock((clock) => {
    clock.setMode('scenario', 'operator-a'); clock.play();
    expect(clock.snapshot().playing).toBe(false);
    expect((clock as any).setModeledRange).toBeInstanceOf(Function);
    expect(() => (clock as any).setModeledRange(end, start)).toThrow();
    expect(() => (clock as any).setModeledRange(start, start)).toThrow();
    (clock as any).setModeledRange(start, end);
    clock.scrub('2026-10-12T11:00:00Z'); clock.play();
    expect(clock.snapshot().playing).toBe(false);
    clock.scrub(start); clock.play(); clock.setMode('scenario', 'operator-b');
    clock.play(); expect(clock.snapshot().playing).toBe(false);
    clock.setMode('live');
    expect(() => (clock as any).setModeledRange(start, end)).toThrow();
  });
});

test('replacement source coverage cancels modeled transport and forecasts still emit exact samples', () => {
  withClock((clock, advance) => {
    clock.setMode('scenario', 'operator-a');
    expect((clock as any).setModeledRange).toBeInstanceOf(Function);
    (clock as any).setModeledRange(start, end); clock.play(); clock.setPlaybackSamples(null);
    expect(clock.snapshot().playing).toBe(false);
    clock.setMode('forecast'); clock.scrub(start); clock.setPlaybackSamples([start, end]);
    clock.setPlaybackRate(3600); clock.play(); advance(500);
    expect(clock.snapshot().cursorIso).toBe(start);
    advance(500); expect(clock.snapshot().cursorIso).toBe(end);
  });
});

test('restored source windows survive pending coverage without silently accepting missing endpoints', () => {
  withClock((clock) => {
    clock.setMode('forecast'); clock.scrub(start);
    expect((clock as any).restorePlaybackRange).toBeInstanceOf(Function);
    (clock as any).restorePlaybackRange({ start, end });
    clock.setPlaybackSamples(null);
    expect(clock.snapshot().playbackRange).toEqual({ start, end });
    clock.setPlaybackSamples([start, '2026-10-12T15:00:00Z']); clock.play();
    expect(clock.snapshot().playing).toBe(false);
    expect(clock.snapshot().playbackRange).toEqual({ start, end });
    clock.setPlaybackSamples([start, end]); clock.play();
    expect(clock.snapshot().playing).toBe(true);
  });
});

test('saved replay windows are copied while legacy cursor-only bookmarks remain readable', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
  try {
    const range = { start, end };
    const bookmark = createSpatialBookmark({ name: 'Source window', scope: 'city', target: { latitude: 40, longitude: -74 }, visualMode: 'solid', temporalMode: 'forecast', cursorIso: start, useCase: null, layers: [], playbackRange: range } as any);
    range.end = '2026-10-12T15:00:00Z';
    expect((bookmark as any).playbackRange.end).toBe(end);
    const saved = saveSpatialBookmarks([bookmark]);
    (bookmark as any).playbackRange.end = '2026-10-12T16:00:00Z';
    expect((saved[0] as any).playbackRange.end).toBe(end);
    const legacy = { ...saved[0] }; delete (legacy as any).playbackRange;
    saveSpatialBookmarks([legacy]);
    expect(loadSpatialBookmarks()).toHaveLength(1);
  } finally { if (original) Object.defineProperty(globalThis, 'localStorage', original); else delete (globalThis as any).localStorage; }
});

test('malformed saved session replay windows are withheld before restore', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
  try {
    const session = createOperatorSession('Broken window', { view: { scope: 'city', target: { latitude: 40, longitude: -74 }, visualMode: 'solid', temporalMode: 'forecast', cursorIso: start, layers: [], useCase: null, playbackRange: { start: end, end: start } }, interactionMode: 'inspect', measurementPoints: [], measurementFrame: null, observationA: null, observationB: null, frozenDossier: null, operatorScenario: null, workset: [], incidents: [] });
    saveOperatorSessions([session]);
    expect(loadOperatorSessions()).toEqual([]);
  } finally { if (original) Object.defineProperty(globalThis, 'localStorage', original); else delete (globalThis as any).localStorage; }
});
