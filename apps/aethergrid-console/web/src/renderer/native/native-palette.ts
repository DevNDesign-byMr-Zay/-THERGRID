import type { VisualMode } from '../spatial-renderer';

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Callers must supply a six-digit #RRGGBB literal. Invalid-input handling stays
// unchanged during this behavior-preserving extraction; do not pass user strings.
export function rgba(hex: string, alpha = 1): Rgba {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);
  return {
    r: ((value >> 16) & 255) / 255,
    g: ((value >> 8) & 255) / 255,
    b: (value & 255) / 255,
    a: alpha
  };
}

export function css(color: Rgba): string {
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(
    color.b * 255
  )}, ${color.a})`;
}

export function mix(a: Rgba, b: Rgba, amount: number): Rgba {
  const t = clamp(amount, 0, 1);
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
    a: a.a + (b.a - a.a) * t
  };
}

export function hazardHex(severity: unknown): string {
  const normalized = String(severity ?? '').toLowerCase();
  if (normalized === 'extreme') return '#ff3b52';
  if (normalized === 'severe') return '#ff704f';
  if (normalized === 'moderate') return '#f2b65f';
  if (normalized === 'minor') return '#e2d86c';
  return '#f08a73';
}

export function hydrologyHex(band: unknown): string {
  const normalized = String(band ?? '').toLowerCase();
  if (normalized === 'major') return '#ff4f63';
  if (normalized === 'moderate') return '#ff8a5b';
  if (normalized === 'minor') return '#f0c477';
  if (normalized === 'action') return '#8dd7ff';
  return '#62c7e9';
}

export function layerColor(layerId: string, kind = ''): Rgba {
  if (layerId === 'analysis') return rgba('#c9a7ff', 0.94);
  if (layerId === 'energy') return rgba('#70e7ff', 0.9);
  if (layerId === 'roads') return rgba('#9aa9b7', 0.58);
  if (layerId === 'water') return rgba('#38bde8', 0.72);
  if (layerId === 'green') return rgba('#64d99b', 0.64);
  if (layerId === 'buildings') return rgba('#6d8998', 0.68);
  if (layerId === 'illumination') return rgba('#ffd37d', 0.72);
  if (layerId === 'hazards') return rgba('#ff704f', 0.92);
  if (layerId === 'hydrology' || kind === 'sensor') return rgba('#62c7e9', 0.94);
  if (layerId === 'transit' || kind === 'transit') return rgba('#70e7ff', 0.94);
  if (layerId === 'seismic' || kind === 'event') return rgba('#ff806b', 0.95);
  if (layerId === 'world' && kind === 'city') return rgba('#7ee8ff', 0.96);
  return rgba('#8db7cf', 0.72);
}

export function visualColor(base: Rgba, mode: VisualMode): Rgba {
  if (mode === 'holographic') {
    return mix(base, rgba('#55eaff', base.a), 0.72);
  }
  if (mode === 'xray') {
    return mix(base, rgba('#8bdcff', Math.min(base.a, 0.5)), 0.55);
  }
  if (mode === 'operations') {
    return mix(base, rgba('#78b6dc', base.a), 0.22);
  }
  return base;
}
