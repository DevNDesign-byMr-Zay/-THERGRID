import type { TemporalMode } from '../renderer/spatial-renderer';
import type { TemporalState } from './temporal-model';
import { assertIsoInstant } from './temporal-model';

export type TemporalListener = (state: Readonly<TemporalState>) => void;

const MIN_RATE = 0.25;
const MAX_RATE = 86_400;

export class AethergridTemporalClock {
  #state: TemporalState;
  #listeners = new Set<TemporalListener>();
  #timer: ReturnType<typeof globalThis.setInterval> | null = null;
  #liveTimer: ReturnType<typeof globalThis.setInterval> | null = null;
  #lastTickMs = 0;
  #playbackSamples: readonly number[] = [];
  #playheadMs = 0;

  constructor(now = new Date()) {
    const iso = now.toISOString();
    this.#state = {
      mode: 'live',
      cursorIso: iso,
      liveIso: iso,
      playing: false,
      playbackRate: 60,
      playbackRange: null,
      scenarioId: null
    };
    this.#startLiveTimer();
  }

  snapshot(): Readonly<TemporalState> {
    return Object.freeze({ ...this.#state, playbackRange: this.#state.playbackRange ? Object.freeze({ ...this.#state.playbackRange }) : null });
  }

  subscribe(listener: TemporalListener): () => void {
    this.#listeners.add(listener);
    listener(this.snapshot());
    return () => this.#listeners.delete(listener);
  }

  setLiveReference(isoTime: string): void {
    const liveIso = assertIsoInstant(isoTime, 'live reference');
    this.#state.liveIso = liveIso;
    if (this.#state.mode === 'live') this.#state.cursorIso = liveIso;
    this.#emit();
  }

  setMode(mode: TemporalMode, scenarioId: string | null = null): void {
    this.pause();
    if (mode !== this.#state.mode) { this.#playbackSamples = []; this.#state.playbackRange = null; }
    this.#state.mode = mode;
    this.#state.scenarioId = mode === 'scenario' ? scenarioId : null;
    if (mode === 'live') this.#state.cursorIso = this.#state.liveIso;
    this.#playheadMs = Date.parse(this.#state.cursorIso);
    this.#emit();
  }

  scrub(isoTime: string, mode: TemporalMode = this.#state.mode): void {
    const cursor = assertIsoInstant(isoTime, 'temporal cursor');
    this.pause();
    if (mode !== this.#state.mode) { this.#playbackSamples = []; this.#state.playbackRange = null; }
    this.#state.cursorIso = mode === 'live' ? this.#state.liveIso : cursor;
    this.#playheadMs = Date.parse(this.#state.cursorIso);
    this.#state.mode = mode;
    if (mode !== 'scenario') this.#state.scenarioId = null;
    this.#emit();
  }

  goLive(isoTime = new Date().toISOString()): void {
    const liveIso = assertIsoInstant(isoTime, 'live time');
    this.#state = {
      ...this.#state,
      mode: 'live',
      cursorIso: liveIso,
      liveIso,
      playing: false,
      playbackRange: null,
      scenarioId: null
    };
    this.#stopTimer();
    this.#playbackSamples = [];
    this.#playheadMs = Date.parse(liveIso);
    this.#emit();
  }

  setPlaybackSamples(samples: readonly string[] | null): void {
    this.pause();
    this.#playheadMs = Date.parse(this.#state.cursorIso);
    this.#playbackSamples = Object.freeze(
      [...new Set((samples ?? []).map((iso) => Date.parse(iso)).filter(Number.isFinite))]
        .sort((a, b) => a - b)
    );
    const start = this.#playbackSamples[0];
    const end = this.#playbackSamples.at(-1);
    this.#state.playbackRange = start == null || end == null ? null : { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
    this.#emit();
  }

  setPlaybackRange(startIso: string, endIso: string): void {
    const start = assertIsoInstant(startIso, 'replay start');
    const end = assertIsoInstant(endIso, 'replay end');
    if (Date.parse(end) < Date.parse(start) || !this.#playbackSamples.includes(Date.parse(start)) || !this.#playbackSamples.includes(Date.parse(end))) {
      throw new RangeError('replay endpoints must be ordered source samples');
    }
    this.pause();
    this.#state.playbackRange = { start, end };
    this.#playheadMs = Date.parse(this.#state.cursorIso);
    this.#emit();
  }

  setPlaybackRate(rate: number): void {
    if (!Number.isFinite(rate) || rate <= 0) throw new RangeError('playback rate must be positive');
    this.#state.playbackRate = Math.min(MAX_RATE, Math.max(MIN_RATE, rate));
    this.#emit();
  }

  play(): void {
    if (this.#state.playing || (this.#state.mode !== 'forecast' && this.#state.mode !== 'historical')) return;
    const cursor = Date.parse(this.#state.cursorIso);
    const index = this.#playbackSamples.indexOf(cursor);
    const range = this.#state.playbackRange;
    if (index < 0 || !range || cursor < Date.parse(range.start) || cursor >= Date.parse(range.end)) return;
    this.#state.playing = true;
    this.#lastTickMs = Date.now();
    this.#timer = globalThis.setInterval(() => this.#tick(), 100);
    this.#emit();
  }

  pause(): void {
    if (!this.#state.playing) return;
    this.#advancePlayback();
    this.#state.playing = false;
    this.#stopTimer();
    this.#emit();
  }

  step(seconds: number): void {
    if (!Number.isFinite(seconds)) throw new TypeError('step seconds must be finite');
    const next = Date.parse(this.#state.cursorIso) + seconds * 1000;
    this.scrub(new Date(next).toISOString(), this.#state.mode === 'live' && seconds !== 0 ? 'historical' : this.#state.mode);
  }

  destroy(): void {
    this.#stopTimer();
    if (this.#liveTimer != null) globalThis.clearInterval(this.#liveTimer);
    this.#liveTimer = null;
    this.#listeners.clear();
  }

  #startLiveTimer(): void {
    if (this.#liveTimer != null) return;
    this.#liveTimer = globalThis.setInterval(() => {
      const liveIso = new Date().toISOString();
      this.#state.liveIso = liveIso;
      if (this.#state.mode === 'live' && !this.#state.playing) {
        this.#state.cursorIso = liveIso;
      }
      this.#emit();
    }, 1_000);
  }

  #tick(): void {
    if (!this.#state.playing) return;
    this.#advancePlayback();
    this.#emit();
  }

  #advancePlayback(): void {
    const nowMs = Date.now();
    const elapsedSeconds = Math.max(0, (nowMs - this.#lastTickMs) / 1000);
    this.#lastTickMs = nowMs;
    const end = this.#state.playbackRange ? Date.parse(this.#state.playbackRange.end) : null;
    if (end == null) { this.#state.playing = false; this.#stopTimer(); return; }
    this.#playheadMs = Math.min(end, this.#playheadMs + elapsedSeconds * this.#state.playbackRate * 1000);
    const next = this.#playbackSamples.findLast((sample) => sample <= this.#playheadMs);
    if (next != null) this.#state.cursorIso = new Date(next).toISOString();
    if (this.#playheadMs >= end) {
      this.#state.playing = false;
      this.#stopTimer();
    }
  }

  #stopTimer(): void {
    if (this.#timer != null) globalThis.clearInterval(this.#timer);
    this.#timer = null;
  }

  #emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.#listeners) listener(snapshot);
  }
}
