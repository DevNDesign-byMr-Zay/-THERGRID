import { Color } from 'cesium';
import { hazardHex, hydrologyHex } from '../native/native-palette';
import type { SpatialScenarioVisual } from '../spatial-renderer';
import {
  overlayIntensity,
  type SpatialOverlayArea,
  type SpatialOverlayEdge,
  type SpatialOverlayNode
} from './spatial-overlay';

function colorForIntensity(intensity: number, alpha = 1): Color {
  const bounded = overlayIntensity(intensity);
  return new Color(
    0.24 + bounded * 0.18,
    0.62 + bounded * 0.26,
    1,
    alpha
  );
}

function hazardColor(severity: unknown, alpha = 0.96): Color {
  return Color.fromCssColorString(hazardHex(severity)).withAlpha(alpha);
}

function hydrologyColor(band: unknown, alpha = 0.96): Color {
  return Color.fromCssColorString(hydrologyHex(band)).withAlpha(alpha);
}

function nodeColor(node: SpatialOverlayNode): Color {
  const intensity = overlayIntensity(node.intensity);
  if (node.properties?.analysisType === 'measurement') {
    return Color.fromCssColorString('#c9a7ff').withAlpha(0.98);
  }
  if (node.properties?.analysisType === 'workset-geometry') {
    return Color.fromCssColorString('#63ffc5').withAlpha(0.96);
  }
  if (node.properties?.analysisType === 'scenario-model') {
    return Color.fromCssColorString('#d991ff').withAlpha(0.96);
  }
  if (node.properties?.presentationType === 'urban-illumination') {
    return Color.fromCssColorString('#ffd37d').withAlpha(0.58 + intensity * 0.34);
  }
  if (node.kind === 'event' && node.properties?.eventType === 'nws-alert') {
    return hazardColor(node.properties?.severity, 0.8 + intensity * 0.2);
  }
  if (node.kind === 'event' && node.properties?.eventType === 'operator-incident') {
    const severity = String(node.properties?.severity ?? 'info');
    const incidentColor =
      severity === 'critical'
        ? '#ff4f63'
        : severity === 'high'
          ? '#ff806b'
          : severity === 'medium'
            ? '#f0b45f'
            : severity === 'low'
              ? '#e0d778'
              : '#8dc9ff';
    return Color.fromCssColorString(incidentColor).withAlpha(0.78 + intensity * 0.22);
  }
  if (node.kind === 'event' && node.properties?.eventType === 'earthquake') {
    return Color.fromCssColorString('#ff7b63').withAlpha(0.78 + intensity * 0.22);
  }
  if (node.kind === 'transit' && node.properties?.eventType === 'gtfs-vehicle') {
    return Color.fromCssColorString('#70e7ff').withAlpha(0.78 + intensity * 0.22);
  }
  if (node.kind === 'sensor' && node.properties?.eventType === 'noaa-nwps-gauge') {
    return hydrologyColor(node.properties?.floodBand, 0.8 + intensity * 0.2);
  }
  if (node.kind === 'city') {
    const category = String(node.properties?.category || 'unknown');
    const cityColor =
      category === 'good'
        ? '#63ffc5'
        : category === 'moderate'
          ? '#f1d66d'
          : category === 'unhealthy-sensitive'
            ? '#f5a05d'
            : category === 'unhealthy'
              ? '#ff6f69'
              : category === 'very-unhealthy'
                ? '#b97cff'
                : category === 'hazardous'
                  ? '#d85d88'
                  : '#70e7ff';
    return Color.fromCssColorString(cityColor).withAlpha(0.86 + intensity * 0.14);
  }
  return colorForIntensity(intensity, 0.96);
}

function buildingAreaColor(area: SpatialOverlayArea, alpha = 0.76): Color {
  const rawColor = String(area.properties?.buildingColor ?? '').trim();
  const normalizedColor =
    rawColor && !rawColor.startsWith('#') && /^[0-9a-f]{6}$/iu.test(rawColor)
      ? `#${rawColor}`
      : rawColor;
  if (normalizedColor) {
    const parsed = Color.fromCssColorString(normalizedColor);
    if (parsed) return parsed.withAlpha(alpha);
  }

  const material = String(area.properties?.buildingMaterial ?? '').toLowerCase();
  const sourceBacked = area.properties?.sourceBacked === true;
  const base =
    material.includes('glass')
      ? '#6baec4'
      : material.includes('brick')
        ? '#8f665b'
        : material.includes('metal') || material.includes('steel')
          ? '#657887'
          : material.includes('stone')
            ? '#85847d'
            : material.includes('concrete')
              ? '#6f7880'
              : material.includes('wood')
                ? '#846e5e'
                : sourceBacked
                  ? '#637b8a'
                  : '#536370';
  return Color.fromCssColorString(base).withAlpha(alpha);
}

function edgeColor(edge: SpatialOverlayEdge, intensity: number): Color {
  if (edge.properties?.eventType === 'nws-alert-boundary') {
    return hazardColor(edge.properties?.severity, 0.46 + intensity * 0.42);
  }
  if (edge.kind === 'analysis-line' && edge.properties?.analysisType === 'measurement') {
    return Color.fromCssColorString('#c9a7ff').withAlpha(0.9);
  }
  if (edge.kind === 'analysis-line' && edge.properties?.analysisType === 'workset-geometry') {
    return Color.fromCssColorString('#63ffc5').withAlpha(0.72 + intensity * 0.2);
  }
  if (edge.kind === 'analysis-line' && edge.properties?.analysisType === 'scenario-model') {
    return Color.fromCssColorString('#d991ff').withAlpha(0.64 + intensity * 0.26);
  }
  if (edge.kind === 'flow' && edge.properties?.vectorType === 'wind') {
    return Color.fromCssColorString('#7de9ff').withAlpha(0.42 + intensity * 0.42);
  }
  if (edge.kind === 'waterway' || edge.kind === 'coastline') {
    return Color.fromCssColorString('#48cfff').withAlpha(0.42 + intensity * 0.4);
  }
  if (edge.kind === 'route') {
    return Color.fromCssColorString('#a6b8c8').withAlpha(0.26 + intensity * 0.34);
  }
  return colorForIntensity(intensity, 0.35 + intensity * 0.5);
}

function scenarioColor(
  scenario: SpatialScenarioVisual,
  intensity: number,
  alpha: number
): Color {
  if (scenario.renewableBias > 0.25) {
    return Color.fromCssColorString('#63ffc5').withAlpha(alpha);
  }
  if (scenario.weatherRisk > 0.55) {
    return Color.fromCssColorString('#ff7f6b').withAlpha(alpha);
  }
  if (scenario.storageStress > 0.45) {
    return Color.fromCssColorString('#f2aa62').withAlpha(alpha);
  }
  if (scenario.stressFactor > 1.06) {
    return Color.fromCssColorString('#ffbd73').withAlpha(alpha);
  }
  return colorForIntensity(intensity, alpha);
}

export {
  buildingAreaColor,
  colorForIntensity,
  edgeColor,
  hazardColor,
  hydrologyColor,
  nodeColor,
  scenarioColor
};
