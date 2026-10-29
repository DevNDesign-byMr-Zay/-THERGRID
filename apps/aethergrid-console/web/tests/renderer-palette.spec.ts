import { expect, test } from '@playwright/test';
import { Color } from 'cesium';
import {
  buildingAreaColor,
  colorForIntensity,
  edgeColor,
  hazardColor,
  hydrologyColor,
  nodeColor,
  scenarioColor
} from '../src/renderer/overlays/color-mapping';
import {
  css,
  hazardHex,
  hydrologyHex,
  layerColor,
  mix,
  rgba,
  visualColor
} from '../src/renderer/native/native-palette';
import {
  solarTilePalette,
  tileModePalette
} from '../src/renderer/cesium/visual-mode-palette';

test('native palette preserves source severity and layer colors with alpha', () => {
  expect(css(rgba('#c9a7ff', 0.94))).toBe('rgba(201, 167, 255, 0.94)');
  expect(hazardHex('SEVERE')).toBe('#ff704f');
  expect(hazardHex('unclassified')).toBe('#f08a73');
  expect(hydrologyHex('action')).toBe('#8dd7ff');
  expect(hydrologyHex('unknown')).toBe('#62c7e9');
  expect(css(layerColor('energy'))).toBe('rgba(112, 231, 255, 0.9)');
  expect(css(layerColor('roads'))).toBe('rgba(154, 169, 183, 0.58)');
  expect(css(layerColor('hydrology', 'sensor'))).toBe('rgba(98, 199, 233, 0.94)');
});

test('native interpolation and distinct visual-mode tints preserve transparency', () => {
  const source = rgba('#ff0000', 0.8);
  expect(mix(source, rgba('#0000ff', 0.4), 0)).toEqual(source);
  expect(mix(source, rgba('#0000ff', 0.4), 1)).toEqual(rgba('#0000ff', 0.4));
  expect(mix(source, rgba('#0000ff', 0.4), 0.5)).toEqual({
    r: 0.5, g: 0, b: 0.5, a: 0.6000000000000001
  });
  const holographic = visualColor(source, 'holographic');
  expect(holographic.r).toBeCloseTo(0.52);
  expect(holographic.g).toBeCloseTo(0.72 * 234 / 255);
  expect(holographic.a).toBe(0.8);
  expect(css(visualColor(source, 'xray'))).toBe('rgba(191, 121, 140, 0.635)');
  expect(css(visualColor(source, 'operations'))).toBe('rgba(225, 40, 48, 0.8)');
  expect(visualColor(source, 'solid')).toEqual(source);
  expect(visualColor(source, 'grid')).toEqual(source);
  expect(visualColor(source, 'wireframe')).toEqual(source);
  expect(visualColor(source, 'reality')).toEqual(source);
});

test('Cesium visual modes preserve independent opacity and outline palettes', () => {
  expect(tileModePalette('xray', 0.5)).toEqual({
    colorExpression: 'color("#6bc7ff", 0.1)',
    outlineHex: '#83ddff',
    outlineAlpha: 0.85
  });
  expect(tileModePalette('holographic', 0.5)).toEqual({
    colorExpression: 'color("#46eaff", 0.06)',
    outlineHex: '#58efff',
    outlineAlpha: 0.96
  });
  expect(tileModePalette('grid', 0.5).colorExpression).toBe('color("#6ca8c9", 0.09)');
  expect(tileModePalette('operations', 0.5).colorExpression).toBe('color("#6ca8c9", 0.29)');
});

test('Cesium solid palette keeps mapped building colors and solar phase alpha', () => {
  const mapped = 'color("#955b41")';
  expect(solarTilePalette('day', 1, mapped).colorExpression).toBeNull();
  expect(solarTilePalette('day', 0.5, mapped).colorExpression)
    .toBe('(color("#955b41")) * vec4(1.0, 1.0, 1.0, 0.5)');
  expect(solarTilePalette('golden-hour', 0.5, mapped).colorExpression)
    .toBe('(color("#955b41")) * color("#d8b18a", 0.47)');
  expect(solarTilePalette('twilight', 0.5, mapped)).toEqual({
    colorExpression: '(color("#955b41")) * color("#59657a", 0.45)',
    outlineHex: '#a69bc7',
    outlineAlpha: 0.28
  });
  expect(solarTilePalette('night', 1, mapped)).toEqual({
    colorExpression: '(color("#955b41")) * color("#273243", 0.88)',
    outlineHex: '#e4a35b',
    outlineAlpha: 0.34
  });
});

test('Cesium alert and river-band palettes match native severity mappings', () => {
  for (const severity of ['EXTREME', 'severe', 'moderate', 'minor', 'unknown']) {
    const expected = Color.fromCssColorString(hazardHex(severity)).withAlpha(0.67);
    const actual = hazardColor(severity, 0.67);
    expect(actual.red).toBeCloseTo(expected.red, 8);
    expect(actual.green).toBeCloseTo(expected.green, 8);
    expect(actual.blue).toBeCloseTo(expected.blue, 8);
    expect(actual.alpha).toBeCloseTo(0.67, 8);
  }
  for (const band of ['major', 'moderate', 'minor', 'action', 'unknown']) {
    const expected = Color.fromCssColorString(hydrologyHex(band)).withAlpha(0.82);
    const actual = hydrologyColor(band, 0.82);
    expect(actual.red).toBeCloseTo(expected.red, 8);
    expect(actual.green).toBeCloseTo(expected.green, 8);
    expect(actual.blue).toBeCloseTo(expected.blue, 8);
  }
});

test('Cesium source nodes retain measured-event and river severity provenance', () => {
  const position = { longitude: -73.98, latitude: 40.75 };
  const nws = nodeColor({
    id: 'alert',
    kind: 'event',
    position,
    intensity: 0.5,
    properties: { eventType: 'nws-alert', severity: 'severe' }
  });
  expect(nws.red).toBeCloseTo(hazardColor('severe').red);
  expect(nws.alpha).toBeCloseTo(0.9);
  const gauge = nodeColor({
    id: 'gauge',
    kind: 'sensor',
    position,
    intensity: 0.5,
    properties: { eventType: 'noaa-nwps-gauge', floodBand: 'action' }
  });
  expect(gauge.blue).toBeCloseTo(hydrologyColor('action').blue);
  expect(gauge.alpha).toBeCloseTo(0.9);
  expect(nodeColor({
    id: 'unknown-city',
    kind: 'city',
    position,
    properties: { category: 'unknown' }
  }).alpha).toBeCloseTo(0.93);
});

test('Cesium building and analysis colors preserve alpha and source material identity', () => {
  const geometry = { id: 'building', kind: 'building' as const, positions: [] };
  const source = buildingAreaColor({
    ...geometry,
    properties: { buildingMaterial: 'glass', sourceBacked: true }
  }, 0.55);
  const expected = Color.fromCssColorString('#6baec4');
  expect(source.red).toBeCloseTo(expected.red);
  expect(source.alpha).toBeCloseTo(0.55);
  const note = edgeColor({
    id: 'note',
    kind: 'analysis-line',
    from: { longitude: 0, latitude: 0 },
    to: { longitude: 1, latitude: 1 },
    properties: { analysisType: 'workset-geometry' }
  }, 0.5);
  expect(note.green).toBeCloseTo(Color.fromCssColorString('#63ffc5').green);
  expect(note.alpha).toBeCloseTo(0.82);
});

test('Cesium modeled scenario palette retains risk priority and bounded default intensity', () => {
  const scenario = {
    renewableBias: 0,
    weatherRisk: 0.7,
    storageStress: 0,
    stressFactor: 1
  } as Parameters<typeof scenarioColor>[0];
  const alert = scenarioColor(scenario, 0.6, 0.44);
  expect(alert.red).toBeCloseTo(Color.fromCssColorString('#ff7f6b').red);
  expect(alert.alpha).toBeCloseTo(0.44);
  expect(colorForIntensity(2, 0.7).green).toBeCloseTo(0.88);
  expect(colorForIntensity(-1, 0.7).green).toBeCloseTo(0.62);
});
