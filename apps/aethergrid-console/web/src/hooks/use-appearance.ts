import { useEffect, useState } from 'react';

export type AppearanceMode = 'dark' | 'light' | 'system';
export type ResolvedAppearance = 'dark' | 'light';

const APPEARANCE_KEY = 'aethergrid.operator.appearance.v4';
const LEGACY_SETTINGS_KEY = 'aethergrid.operator.settings.v2';

function validMode(value: unknown): AppearanceMode | null {
  return value === 'dark' || value === 'light' || value === 'system' ? value : null;
}

function initialMode(): AppearanceMode {
  try {
    const direct = validMode(localStorage.getItem(APPEARANCE_KEY));
    if (direct) return direct;

    const legacy = JSON.parse(localStorage.getItem(LEGACY_SETTINGS_KEY) || '{}') as {
      theme?: unknown;
    };
    return validMode(legacy.theme) ?? 'dark';
  } catch {
    return 'dark';
  }
}

function resolve(mode: AppearanceMode): ResolvedAppearance {
  if (mode !== 'system') return mode;
  return globalThis.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function useAppearance() {
  const [mode, setModeState] = useState<AppearanceMode>(initialMode);
  const [resolved, setResolved] = useState<ResolvedAppearance>(() => resolve(mode));

  useEffect(() => {
    const media = globalThis.matchMedia?.('(prefers-color-scheme: light)');
    const apply = () => {
      const next = resolve(mode);
      setResolved(next);
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
    };

    apply();
    media?.addEventListener('change', apply);
    return () => media?.removeEventListener('change', apply);
  }, [mode]);

  const setMode = (next: AppearanceMode) => {
    setModeState(next);
    try {
      localStorage.setItem(APPEARANCE_KEY, next);
    } catch {
      // Locked/private browsing can reject storage; the in-memory preference still applies.
    }
  };

  const cycle = () => {
    setMode(mode === 'dark' ? 'light' : mode === 'light' ? 'system' : 'dark');
  };

  return { mode, resolved, setMode, cycle } as const;
}
