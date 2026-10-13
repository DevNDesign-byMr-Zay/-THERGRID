import type { TemporalInstant } from '../renderer/spatial-renderer';

/** Live-clock receipts update independently of the displayed spatial frame. */
export function spatialRenderFrame(time: TemporalInstant): TemporalInstant {
  return {iso: time.iso, mode: time.mode, sourceTime: time.sourceTime ?? null,
    range: time.range ? {...time.range} : null, scenarioId: time.scenarioId ?? null,
    scenarioVisual: time.scenarioVisual ? {...time.scenarioVisual} : null};
}

export function spatialRenderFrameKey(time: TemporalInstant): string {
  return JSON.stringify(spatialRenderFrame(time));
}
