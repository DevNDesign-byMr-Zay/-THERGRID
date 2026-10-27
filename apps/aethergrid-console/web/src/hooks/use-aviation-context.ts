import { useEffect, useMemo, useState } from 'react';
import {
  aviationOverlay as buildAviationOverlay,
  mergeAviationSnapshot,
  type AviationDomainState
} from '../domains/aviation/aviation-domain';
import { loadAviationSnapshot } from '../services/aviation-client';
import type { TemporalInstant } from '../renderer/spatial-renderer';

interface AviationContextOptions {
  scope: 'world' | 'city';
  city: { id: string; latitude: number; longitude: number };
  mode: TemporalInstant['mode'];
  enabled: boolean;
}

export function useAviationContext({ scope, city, mode, enabled }: AviationContextOptions) {
  const [aviationState, setAviationState] = useState<AviationDomainState | null>(null);
  const [aviationError, setAviationError] = useState<string | null>(null);

  useEffect(() => {
    setAviationState(null);setAviationError(null);
    if (!enabled || mode !== 'live') return;

    const controller = new AbortController();
    let timer: ReturnType<typeof globalThis.setTimeout> | null = null;

    const schedule = (delayMs: number) => {
      if (controller.signal.aborted) return;
      timer = globalThis.setTimeout(refresh, delayMs);
    };

    const refresh = () => {
      const query =
        scope === 'world'
          ? { scope: 'global' as const }
          : {
              scope: 'city' as const,
              latitude: city.latitude,
              longitude: city.longitude,
              radiusKm: 250
            };

      void loadAviationSnapshot(query, controller.signal)
        .then((incoming) => {
          if (controller.signal.aborted) return;
          setAviationState((previous) =>
            mergeAviationSnapshot(previous, incoming)
          );
          setAviationError(null);
          schedule(30_000);
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setAviationError(
            error instanceof Error ? error.message : String(error)
          );
          schedule(60_000);
        });
    };

    refresh();
    return () => {
      controller.abort();
      if (timer) globalThis.clearTimeout(timer);
    };
  }, [
    scope,
    city.id,
    city.latitude,
    city.longitude,
    mode,
    enabled
  ]);

  const aviationOverlay = useMemo(
    () =>
      aviationState
        ? buildAviationOverlay(aviationState, mode)
        : null,
    [aviationState, mode]
  );

  return { aviationState, aviationError, aviationOverlay };
}
