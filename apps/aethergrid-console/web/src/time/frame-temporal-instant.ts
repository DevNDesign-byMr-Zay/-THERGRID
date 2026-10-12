import type { AtmosphericOverlaySnapshot } from '../renderer/overlays/atmospheric-overlay';
import type { SpatialScenarioVisual, TemporalInstant } from '../renderer/spatial-renderer';
import type { TemporalState } from './temporal-model';

/** Clock context and a dataset's observation time are separate receipts. */
export function frameTemporalInstant(
  state: Readonly<TemporalState>,
  scenarioVisual: SpatialScenarioVisual | null = null,
  forecast: AtmosphericOverlaySnapshot | null = null
): TemporalInstant {
  const aligned = state.mode === 'forecast' && forecast && forecast.fallback !== true &&
    (forecast.live || forecast.stale) && Date.parse(forecast.eventTime) === Date.parse(state.cursorIso);
  return {
    iso: state.cursorIso, mode: state.mode,
    sourceTime: aligned ? forecast.sourceTime : null,
    liveReferenceIso: state.liveIso,
    range: state.playbackRange ? { ...state.playbackRange } : null,
    scenarioId: state.scenarioId, scenarioVisual
  };
}
