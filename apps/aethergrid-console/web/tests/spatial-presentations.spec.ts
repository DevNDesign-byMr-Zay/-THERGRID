import { expect, test } from '@playwright/test';
import { Cesium3DTileStyle, DataSourceCollection, PrimitiveCollection } from 'cesium';
import { NetworkOverlayLayer } from '../src/renderer/cesium/network-overlay-layer';

// Real Cesium geometry/collections; only the GPU scene is replaced in these boundary cases.
const snapshot = () => ({ id: 'geometry-contract', layerId: 'buildings', eventTime: '2026-10-12T12:00:00Z',
  sourceTime: '2026-10-01T12:00:00Z', fetchedAt: '2026-10-12T11:00:00Z', live: true, stale: false, fallback: false,
  attribution: 'OFFLINE PRESENTATION CONTRACT', nodes: [], edges: [], areas: [{ id: 'mapped-roof', kind: 'building' as const,
    positions: [[0,0],[.001,0],[.001,.001],[0,.001]].map(([longitude,latitude]) => ({ longitude, latitude })),
    properties: { heightM: 40, heightSource: 'height', roofShape: 'pyramidal', roofHeightM: 10, sourceFeatureId: 'source-roof' } }] });

async function withLayer(run: (layer: NetworkOverlayLayer, primitives: PrimitiveCollection, dataSources: DataSourceCollection) => void, owning = true) {
  const primitives = new PrimitiveCollection({ destroyPrimitives: owning });
  const dataSources = new DataSourceCollection();
  const layer = new NetworkOverlayLayer({ dataSources, scene: { primitives, requestRender() {} } } as any);
  await Promise.resolve();
  try { layer.apply(snapshot()); run(layer, primitives, dataSources); }
  finally { layer.destroy(); dataSources.destroy(); primitives.destroy(); }
}

test('wireframe has real roof edges with source picks and hides solid fill', async () => {
  await withLayer((layer, primitives) => {
    expect(primitives.length).toBe(2);
    expect((layer as any).setPresentation).toBeInstanceOf(Function);
    (layer as any).setPresentation('wireframe', 1);
    expect(primitives.get(0).show).toBe(false);
    expect(primitives.get(1).show).toBe(true);
    const edges = primitives.get(1).geometryInstances;
    expect(edges).toHaveLength(16); // 4 base, 4 walls, 4 eaves, 4 apex edges.
    for (const edge of edges) {
      expect(edge.id.sourceFeatureId).toBe('source-roof');
      expect(edge.id.aethergridSourceBuilding).toBe(true);
    }
  });
});

test('layer opacity does not compound on unchanged points or labels during replay', async () => {
  await withLayer((layer, _primitives, sources) => {
    const sample = snapshot();
    (sample.nodes as any[]).push({ id: 'mapped-point', kind: 'aircraft', position: { latitude: 0, longitude: 0, heightMeters: 10 }, label: 'Mapped point', intensity: .5, properties: { eventType: 'aircraft' } });
    layer.apply(sample);
    (layer as any).setPresentation('solid', .5);
    const entity = sources.get(0).entities.getById('mapped-point')!;
    const pointAlpha = entity.point!.color!.getValue().alpha;
    const outlineAlpha = entity.point!.outlineColor!.getValue().alpha;
    const labelAlpha = entity.label!.fillColor!.getValue().alpha;
    expect(pointAlpha).toBeCloseTo(.48);
    expect(outlineAlpha).toBeCloseTo(.175);
    expect(labelAlpha).toBeLessThanOrEqual(.5);
    for (let frame = 0; frame < 12; frame++) layer.setTime({ iso: '2026-10-12T12:00:00Z', mode: 'live' });
    expect(entity.point!.color!.getValue().alpha).toBeCloseTo(pointAlpha);
    expect(entity.point!.outlineColor!.getValue().alpha).toBeCloseTo(outlineAlpha);
    expect(entity.label!.fillColor!.getValue().alpha).toBeCloseTo(labelAlpha);
    (layer as any).setPresentation('solid', 0);
    expect(sources.get(0).show).toBe(false);
  });
});

test('holographic source massing and independent opacity change actual geometry alpha', async () => {
  await withLayer((layer, primitives) => {
    expect((layer as any).setPresentation).toBeInstanceOf(Function);
    (layer as any).setPresentation('holographic', .5);
    const fill = primitives.get(0);
    expect(fill.show).toBe(true);
    expect(fill.appearance.translucent).toBe(true);
    for (const instance of fill.geometryInstances) expect(instance.attributes.color.value[3]).toBeLessThan(64);
    (layer as any).setPresentation('solid', 0);
    expect(fill.show).toBe(false);
    expect(primitives.get(1).show).toBe(false);
    (layer as any).setPresentation('solid', 1);
    expect(fill.show).toBe(true);
    for (const instance of fill.geometryInstances) expect(instance.attributes.color.value[3]).toBe(255);
  });
});

test('source selection highlights mapped edges and replacement removes obsolete identity', async () => {
  await withLayer((layer, primitives) => {
    expect(primitives.length).toBe(2);
    layer.selectSourceFeature('source-roof');
    for (const instance of primitives.get(1).geometryInstances) expect([...instance.attributes.color.value]).toEqual([255,255,255,255]);
    const replacement = snapshot();
    replacement.areas[0].properties.sourceFeatureId = 'replacement';
    layer.apply(replacement);
    for (const instance of primitives.get(1).geometryInstances) expect([...instance.attributes.color.value]).not.toEqual([255,255,255,255]);
  });
});

test('presentation cycles reuse bounded primitives and hidden layers stay hidden', async () => {
  await withLayer((layer, primitives) => {
    expect((layer as any).setPresentation).toBeInstanceOf(Function);
    for (let cycle = 0; cycle < 12; cycle++) {
      for (const mode of ['solid','wireframe','grid','holographic']) (layer as any).setPresentation(mode, .4);
      expect(primitives.length).toBe(2);
    }
    layer.setVisible(false);
    (layer as any).setPresentation('wireframe', 1);
    expect(primitives.get(0).show).toBe(false);
    expect(primitives.get(1).show).toBe(false);
  });
});

test('source geometry teardown releases primitives even with non-owning collections', async () => {
  for (const owning of [true, false]) {
    await withLayer((layer, primitives) => {
      const resources = Array.from({ length: primitives.length }, (_, index) => primitives.get(index));
      layer.destroy();
      expect(primitives.length).toBe(0);
      for (const primitive of resources) expect(primitive.isDestroyed()).toBe(true);
      expect(() => layer.destroy()).not.toThrow();
    }, owning);
  }
});

test('geodetic grid opacity scales real line materials without compounding or changing visibility', async () => {
  const { GeodeticGridLayer } = await import('../src/renderer/cesium/geodetic-grid-layer');
  const globals = globalThis as any;
  const keys = ['HTMLCanvasElement','HTMLImageElement','HTMLVideoElement','ImageBitmap','OffscreenCanvas'];
  const originals = keys.map((key) => globals[key]);
  keys.forEach((key) => { globals[key] = class {}; });
  const primitives = new PrimitiveCollection();
  let grid: InstanceType<typeof GeodeticGridLayer> | null = null;
  try {
    grid = new GeodeticGridLayer({ primitives, requestRender() {} } as any);
    grid.setTime('2026-10-12T12:00:00Z');
    const lines = primitives.get(0);
    const original = lines.get(0).material.uniforms.color.alpha;
    expect((grid as any).setOpacity).toBeInstanceOf(Function);
    (grid as any).setOpacity(.25);
    expect(lines.get(0).material.uniforms.color.alpha).toBeCloseTo(original * .25);
    for (let frame = 0; frame < 12; frame++) grid.setTime('2026-10-12T12:00:00Z');
    expect(lines.get(0).material.uniforms.color.alpha).toBeCloseTo(original * .25);
    grid.setVisible(false); (grid as any).setOpacity(1);
    expect(lines.show).toBe(false);
  } finally {
    grid?.destroy(); primitives.destroy();
    keys.forEach((key,index) => { if (originals[index] === undefined) delete globals[key]; else globals[key] = originals[index]; });
  }
});

test('configured tile presentations switch actual wireframe flags and evaluate opacity', async () => {
  const { VisualModeController } = await import('../src/renderer/cesium/visual-mode-controller');
  const controller = new VisualModeController({ scene: { globe: {}, requestRender() {} } } as any);
  const tiles: any = { style: undefined, debugWireframe: false, showOutline: false };
  controller.setBuildings(tiles);
  controller.apply('wireframe' as any);
  expect(tiles.debugWireframe).toBe(true);
  expect((controller as any).setOpacity).toBeInstanceOf(Function);
  (controller as any).setOpacity(.25);
  controller.apply('solid');
  expect(tiles.debugWireframe).toBe(false);
  expect(tiles.style.color.evaluateColor({} as any).alpha).toBeCloseTo(.25);
});

test('solid tile opacity preserves the mapped color expression', async () => {
  const { VisualModeController } = await import('../src/renderer/cesium/visual-mode-controller');
  const controller = new VisualModeController({ scene: { globe: {}, requestRender() {} } } as any);
  const tiles: any = { style: new Cesium3DTileStyle({ color: 'color("#955b41")' }), debugWireframe: false };
  controller.setBuildings(tiles);
  (controller as any).setOpacity(.5);
  controller.apply('solid');
  const color = tiles.style.color.evaluateColor({} as any);
  expect(color.red).toBeCloseTo(149 / 255);
  expect(color.green).toBeCloseTo(91 / 255);
  expect(color.blue).toBeCloseTo(65 / 255);
  expect(color.alpha).toBeCloseTo(.5);
});

test('modeled comparison baseline opacity remains stable across scenario frames', async () => {
  await withLayer((layer, _primitives, sources) => {
    const sample: any = { ...snapshot(), layerId: 'energy', areas: [], edges: [{ id: 'mapped-edge', kind: 'transmission',
      from: { latitude: 0, longitude: 0 }, to: { latitude: .001, longitude: .001 }, intensity: .5 }] };
    layer.apply(sample);
    (layer as any).setPresentation('solid', .5);
    const frame = { iso: '2026-10-12T12:00:00Z', mode: 'scenario' as const,
      scenarioVisual: { stressFactor: 1.3, renewableBias: 0, storageStress: 0, weatherRisk: 0 } };
    layer.setTime(frame);
    const baseline = sources.get(0).entities.getById('mapped-edge:source-baseline')!;
    expect(baseline.show).toBe(true);
    for (let tick = 0; tick < 12; tick++) layer.setTime(frame);
    expect((baseline.polyline!.material as any).color.getValue().alpha).toBeCloseTo(.12);
  });
});
