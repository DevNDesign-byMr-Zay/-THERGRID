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
  #lastTickMs = 0;

  constructor(now = new Date()) {
    const iso = now.toISOString();
    this.#state = {
      mode: 'live',
      cursorIso: iso,
      liveIso: iso,
      playing: false,
      playbackRate: 60,
      scenarioId: null
    };
  }

  snapshot(): Readonly<TemporalState> {
    return Object.freeze({ ...this.#state });
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
    this.#state.mode = mode;
    this.#state.scenarioId = mode === 'scenario' ? scenarioId : null;
    if (mode === 'live') this.#state.cursorIso = this.#state.liveIso;
    this.#emit();
  }

  scrub(isoTime: string, mode: TemporalMode = this.#state.mode): void {
    this.#state.cursorIso = assertIsoInstant(isoTime, 'temporal cursor');
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
      scenarioId: null
    };
    this.#stopTimer();
    this.#emit();
  }

  setPlaybackRate(rate: number): void {
    if (!Number.isFinite(rate) || rate <= 0) throw new RangeError('playback rate must be positive');
    this.#state.playbackRate = Math.min(MAX_RATE, Math.max(MIN_RATE, rate));
    this.#emit();
  }

  play(): void {
    if (this.#state.playing) return;
    this.#state.playing = true;
    this.#lastTickMs = Date.now();
    this.#timer = globalThis.setInterval(() => this.#tick(), 100);
    this.#emit();
  }

  pause(): void {
    if (!this.#state.playing) return;
    this.#state.playing = false;
    this.#stopTimer();
    this.#emit();
  }

  step(seconds: number): void {
    if (!Number.isFinite(seconds)) throw new TypeError('step seconds must be finite');
    const next = Date.parse(this.#state.cursorIso) + seconds * 1000;
    this.#state.cursorIso = new Date(next).toISOString();
    if (this.#state.mode === 'live') this.#state.mode = seconds === 0 ? 'live' : 'historical';
    this.#emit();
  }

  destroy(): void {
    this.#stopTimer();
    this.#listeners.clear();
  }

  #tick(): void {
    if (!this.#state.playing) return;
    const nowMs = Date.now();
    const elapsedSeconds = Math.max(0, (nowMs - this.#lastTickMs) / 1000);
    this.#lastTickMs = nowMs;
    const next = Date.parse(this.#state.cursorIso) + elapsedSeconds * this.#state.playbackRate * 1000;
    this.#state.cursorIso = new Date(next).toISOString();
    this.#emit();
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
