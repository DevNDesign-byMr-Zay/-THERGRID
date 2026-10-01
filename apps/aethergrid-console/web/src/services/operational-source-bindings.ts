export interface OperationalSourceBindings {
  gaugeId: string | null;
  energyRegion: string | null;
  updatedAt: string | null;
}

interface StoredBindings extends OperationalSourceBindings {
  scopeId: string;
}

const STORAGE_KEY = 'aethergrid.operator.operational-source-bindings.v1';
export const OPERATIONAL_SOURCE_BINDINGS_EVENT =
  'aethergrid:operational-source-bindings-changed';

const EMPTY_BINDINGS: OperationalSourceBindings = {
  gaugeId: null,
  energyRegion: null,
  updatedAt: null
};

function boundedScopeId(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/gu, '')
    .trim()
    .slice(0, 96);
}

function normalizeGaugeId(value: unknown): string | null {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!normalized) return null;
  if (!/^[A-Z0-9_-]{1,32}$/u.test(normalized)) {
    throw new Error(
      'NOAA gauge ID must use 1–32 letters, numbers, underscores, or hyphens.'
    );
  }
  return normalized;
}

function normalizeEnergyRegion(value: unknown): string | null {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (!normalized) return null;
  if (!/^[A-Z0-9_-]{2,20}$/u.test(normalized)) {
    throw new Error(
      'EIA region code must use 2–20 letters, numbers, underscores, or hyphens.'
    );
  }
  return normalized;
}

function validStoredBinding(value: unknown): value is StoredBindings {
  if (!value || typeof value !== 'object') return false;
  const binding = value as Partial<StoredBindings>;
  return (
    typeof binding.scopeId === 'string' &&
    (binding.gaugeId == null || typeof binding.gaugeId === 'string') &&
    (binding.energyRegion == null || typeof binding.energyRegion === 'string') &&
    (binding.updatedAt == null || typeof binding.updatedAt === 'string')
  );
}

function loadStoredBindings(): StoredBindings[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(validStoredBinding).slice(0, 64);
  } catch {
    return [];
  }
}

function writeStoredBindings(bindings: readonly StoredBindings[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings.slice(0, 64)));
}

function notify(scopeId: string): void {
  globalThis.dispatchEvent?.(
    new CustomEvent(OPERATIONAL_SOURCE_BINDINGS_EVENT, {
      detail: { scopeId }
    })
  );
}

export function loadOperationalSourceBindings(
  scopeId: string
): OperationalSourceBindings {
  const normalizedScope = boundedScopeId(scopeId);
  if (!normalizedScope) return { ...EMPTY_BINDINGS };

  const match = loadStoredBindings().find(
    (binding) => binding.scopeId === normalizedScope
  );
  if (!match) return { ...EMPTY_BINDINGS };

  try {
    return {
      gaugeId: normalizeGaugeId(match.gaugeId),
      energyRegion: normalizeEnergyRegion(match.energyRegion),
      updatedAt: match.updatedAt
    };
  } catch {
    return { ...EMPTY_BINDINGS };
  }
}

export function saveOperationalSourceBindings(
  scopeId: string,
  input: {
    gaugeId?: string | null;
    energyRegion?: string | null;
  }
): OperationalSourceBindings {
  const normalizedScope = boundedScopeId(scopeId);
  if (!normalizedScope) throw new Error('A city or coordinate scope is required.');

  const next: OperationalSourceBindings = {
    gaugeId: normalizeGaugeId(input.gaugeId),
    energyRegion: normalizeEnergyRegion(input.energyRegion),
    updatedAt: new Date().toISOString()
  };

  const stored = loadStoredBindings().filter(
    (binding) => binding.scopeId !== normalizedScope
  );
  stored.unshift({ scopeId: normalizedScope, ...next });
  writeStoredBindings(stored);
  notify(normalizedScope);
  return next;
}

export function clearOperationalSourceBindings(
  scopeId: string
): OperationalSourceBindings {
  const normalizedScope = boundedScopeId(scopeId);
  if (!normalizedScope) return { ...EMPTY_BINDINGS };

  writeStoredBindings(
    loadStoredBindings().filter(
      (binding) => binding.scopeId !== normalizedScope
    )
  );
  notify(normalizedScope);
  return { ...EMPTY_BINDINGS };
}
