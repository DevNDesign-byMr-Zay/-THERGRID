import { useEffect, useMemo, useState } from 'react';

import type {
  SpatialPerformanceMode,
  SpatialPerformanceTier
} from '../renderer/spatial-renderer';

const STORAGE_KEY = 'aethergrid.operator.spatial-performance.v4';

function validMode(value: unknown): SpatialPerformanceMode | null {
  return value === 'auto' ||
    value === 'quality' ||
    value === 'balanced' ||
    value === 'efficiency'
    ? value
    : null;
}

function initialMode(): SpatialPerformanceMode {
  try {
    return validMode(localStorage.getItem(STORAGE_KEY)) ?? 'auto';
  } catch {
    return 'auto';
  }
}

interface NavigatorCapability {
  hardwareConcurrency?: number;
  deviceMemory?: number;
}

export function resolveAutomaticSpatialPerformance(): SpatialPerformanceTier {
  const navigatorCapability = globalThis.navigator as Navigator & NavigatorCapability;
  const cores = Number(navigatorCapability?.hardwareConcurrency ?? 0);
  const memoryGb = Number(navigatorCapability?.deviceMemory ?? 0);
  const width = globalThis.innerWidth || 1440;
  const reducedMotion =
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  if (
    reducedMotion ||
    width <= 760 ||
    (memoryGb > 0 && memoryGb <= 4) ||
    (cores > 0 && cores <= 4)
  ) {
    return 'efficiency';
  }

  if (
    width <= 1280 ||
    (memoryGb > 0 && memoryGb <= 8) ||
    (cores > 0 && cores <= 8)
  ) {
    return 'balanced';
  }

  return 'quality';
}

export function useSpatialPerformance() {
  const [mode, setModeState] = useState<SpatialPerformanceMode>(initialMode);
  const [autoTier, setAutoTier] = useState<SpatialPerformanceTier>(
    resolveAutomaticSpatialPerformance
  );

  useEffect(() => {
    const media = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    const refresh = () => setAutoTier(resolveAutomaticSpatialPerformance());

    globalThis.addEventListener?.('resize', refresh);
    media?.addEventListener('change', refresh);
    return () => {
      globalThis.removeEventListener?.('resize', refresh);
      media?.removeEventListener('change', refresh);
    };
  }, []);

  const resolved = useMemo<SpatialPerformanceTier>(
    () => (mode === 'auto' ? autoTier : mode),
    [mode, autoTier]
  );

  const setMode = (next: SpatialPerformanceMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private/locked-down browsing can reject storage. The in-memory setting still applies.
    }
    setModeState(next);
  };

  return { mode, resolved, setMode } as const;
}
