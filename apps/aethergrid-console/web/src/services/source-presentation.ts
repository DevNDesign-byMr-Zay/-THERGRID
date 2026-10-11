export type SourcePresentationState =
  | 'live' | 'stale' | 'simulated' | 'fallback' | 'unavailable' | 'loading' | 'mapped';

/** A successful fetch is not proof of a fresh observation or measured topology. */
export function sourcePresentationState(input: {
  loading?: boolean;
  unavailable?: boolean;
  live?: boolean;
  stale?: boolean;
  simulated?: boolean;
  mapped?: boolean;
  fallback?: boolean;
}): SourcePresentationState {
  if (input.unavailable) return 'unavailable';
  if (input.loading) return 'loading';
  if (input.simulated) return 'simulated';
  if (input.stale) return 'stale';
  if (input.mapped) return 'mapped';
  if (input.live) return 'live';
  if (input.fallback) return 'fallback';
  return 'unavailable';
}
