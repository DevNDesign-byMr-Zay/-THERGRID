import type { VisualMode } from '../spatial-renderer';
import type { SolarPhase } from '../solar-position';

interface TilePalette {
  colorExpression: string;
  outlineHex: string;
  outlineAlpha: number;
}

interface SolarTilePalette {
  colorExpression: string | null;
  outlineHex: string;
  outlineAlpha: number;
}

export function tileModePalette(mode: VisualMode, opacity: number): TilePalette {
  if (mode === 'xray') {
    return {
      colorExpression: `color("#6bc7ff", ${0.2 * opacity})`,
      outlineHex: '#83ddff',
      outlineAlpha: 0.85
    };
  }
  if (mode === 'holographic') {
    return {
      colorExpression: `color("#46eaff", ${0.12 * opacity})`,
      outlineHex: '#58efff',
      outlineAlpha: 0.96
    };
  }
  return {
    colorExpression: `color("#6ca8c9", ${(mode === 'grid' ? 0.18 : 0.58) * opacity})`,
    outlineHex: '#88dcff',
    outlineAlpha: 0.58
  };
}

export function solarTilePalette(
  phase: SolarPhase,
  opacity: number,
  mappedColor: string
): SolarTilePalette {
  if (phase === 'day') {
    return {
      colorExpression: opacity === 1 ? null : `(${mappedColor}) * vec4(1.0, 1.0, 1.0, ${opacity})`,
      outlineHex: '#000000',
      outlineAlpha: 0.45
    };
  }
  const [tint, alpha] = phase === 'golden-hour'
    ? ['#d8b18a', 0.94]
    : phase === 'twilight'
      ? ['#59657a', 0.9]
      : ['#273243', 0.88];
  return {
    colorExpression: `(${mappedColor}) * color("${tint}", ${alpha * opacity})`,
    outlineHex: phase === 'night' ? '#e4a35b' : phase === 'twilight' ? '#a69bc7' : '#000000',
    outlineAlpha: phase === 'night' ? 0.34 : phase === 'twilight' ? 0.28 : 0.45
  };
}
