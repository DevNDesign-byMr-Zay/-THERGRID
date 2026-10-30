import { useEffect, useMemo, useState } from 'react';
import type { TemporalInstant } from '../renderer/spatial-renderer';
import { loadNwsHazards, type NwsHazardContext } from '../services/nws-hazards';
import { loadGtfsTransit, type GtfsTransitContext } from '../services/gtfs-transit';
import { loadNoaaHydrologyContext, type NoaaHydrologyContext } from '../services/noaa-hydrology';
import { loadOperationalSourceBindings, OPERATIONAL_SOURCE_BINDINGS_EVENT, type OperationalSourceBindings } from '../services/operational-source-bindings';

export function useOperationalContext({ scope, mode, city }: {
  scope: 'world' | 'city'; mode: TemporalInstant['mode'];
  city: { id: string; latitude: number; longitude: number };
}) {
  const [hazardContext, setHazardContext] = useState<NwsHazardContext | null>(null);
  const [hazardError, setHazardError] = useState<string | null>(null);
  const [transitContext, setTransitContext] = useState<GtfsTransitContext | null>(null);
  const [transitError, setTransitError] = useState<string | null>(null);
  const [operationalBindings, setOperationalBindings] =
    useState<OperationalSourceBindings>({
      gaugeId: null,
      energyRegion: null,
      updatedAt: null
    });
  const [hydrologyContext, setHydrologyContext] =
    useState<NoaaHydrologyContext | null>(null);
  const [hydrologyError, setHydrologyError] = useState<string | null>(null);
  const operationalBindingScope = useMemo(
    () => `coord:${city.latitude.toFixed(5)}:${city.longitude.toFixed(5)}`,
    [city.latitude, city.longitude]
  );

  useEffect(() => {
    const syncBindings = () => {
      setOperationalBindings(
        loadOperationalSourceBindings(operationalBindingScope)
      );
    };
    const onBindingChange = (event: Event) => {
      const detail = (event as CustomEvent<{ scopeId?: string }>).detail;
      if (detail?.scopeId === operationalBindingScope) syncBindings();
    };

    syncBindings();
    globalThis.addEventListener(
      OPERATIONAL_SOURCE_BINDINGS_EVENT,
      onBindingChange
    );
    return () =>
      globalThis.removeEventListener(
        OPERATIONAL_SOURCE_BINDINGS_EVENT,
        onBindingChange
      );
  }, [operationalBindingScope]);

  useEffect(() => {
    if (
      scope !== 'city' ||
      mode !== 'live' ||
      !operationalBindings.gaugeId
    ) {
      setHydrologyContext(null);
      setHydrologyError(null);
      return;
    }

    const controller = new AbortController();
    const refresh = () => {
      void loadNoaaHydrologyContext(
        operationalBindings.gaugeId as string,
        controller.signal
      )
        .then((next) => {
          if (!controller.signal.aborted) {
            setHydrologyContext(next);
            setHydrologyError(null);
          }
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setHydrologyContext(null);
          setHydrologyError(
            error instanceof Error ? error.message : String(error)
          );
        });
    };

    refresh();
    const timer = globalThis.setInterval(refresh, 60_000);
    return () => {
      controller.abort();
      globalThis.clearInterval(timer);
    };
  }, [scope, mode, operationalBindings.gaugeId]);

  useEffect(() => {
    if (mode !== 'live') {
      setHazardContext(null);
      setHazardError(null);
      return;
    }

    const controller = new AbortController();
    const refresh = () => {
      void loadNwsHazards(city.latitude, city.longitude, controller.signal)
        .then((next) => {
          if (!controller.signal.aborted) {
            setHazardContext(next);
            setHazardError(null);
          }
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setHazardContext(null);
          setHazardError(error instanceof Error ? error.message : String(error));
        });
    };

    refresh();
    const timer = globalThis.setInterval(refresh, 60_000);
    return () => {
      controller.abort();
      globalThis.clearInterval(timer);
    };
  }, [city.id, city.latitude, city.longitude, mode]);

  useEffect(() => {
    if (scope !== 'city' || mode !== 'live') {
      setTransitContext(null);
      setTransitError(null);
      return;
    }

    const controller = new AbortController();
    const refresh = () => {
      void loadGtfsTransit(city.id, controller.signal)
        .then((next) => {
          if (!controller.signal.aborted) {
            setTransitContext(next);
            setTransitError(null);
          }
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          setTransitContext(null);
          setTransitError(error instanceof Error ? error.message : String(error));
        });
    };

    refresh();
    const timer = globalThis.setInterval(refresh, 30_000);
    return () => {
      controller.abort();
      globalThis.clearInterval(timer);
    };
  }, [scope, city.id, mode]);

  return { operationalBindings, hydrologyContext, hydrologyError, hazardContext, hazardError, transitContext, transitError };
}
