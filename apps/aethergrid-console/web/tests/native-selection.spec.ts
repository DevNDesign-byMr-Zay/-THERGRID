import { expect, test } from '@playwright/test';
import { NativeWebglSpatialRenderer as NativeWebglRenderer } from '../src/renderer/native/native-webgl-renderer';

test('native selection expires when a scene id is reused for a different source or cleared', async () => {
  const globals = globalThis as any;
  const oldDocument = globals.document;
  const fills: string[] = [];
  const context: any = new Proxy({ fillStyle: '', fill() { fills.push(this.fillStyle); } }, {
    get(target, key) { return key in target ? target[key] : () => {}; }
  });
  const canvas: any = { style: {}, clientWidth: 800, clientHeight: 600, width: 800, height: 600,
    getContext: (kind: string) => kind === '2d' ? context : null, remove() {}, setAttribute() {} };
  globals.document = { createElement: () => canvas };
  const renderer = new NativeWebglRenderer();
  const overlay: any = { id: 'selection-test', layerId: 'buildings', eventTime: '2026-10-12T12:00:00Z',
    nodes: [{ id: 'reused', kind: 'sensor', position: { latitude: 0, longitude: 0 }, properties: { sourceFeatureId: 'source-a' } }], edges: [], areas: [] };
  const lastFill = () => fills.at(-1);
  try {
    renderer.mount({ style: {}, clientWidth: 800, clientHeight: 600, replaceChildren() {} } as any);
    await renderer.initialize();
    renderer.applyOverlay(overlay);
    renderer.selectFeature('reused');
    expect(lastFill()).toBe('#ffffff');
    renderer.applyOverlay({ ...overlay, nodes: [{ ...overlay.nodes[0], properties: { sourceFeatureId: 'source-b' } }] });
    expect(lastFill()).not.toBe('#ffffff');
    renderer.selectFeature('reused');
    expect(lastFill()).toBe('#ffffff');
    renderer.clearOverlay('buildings');
    renderer.applyOverlay(overlay);
    expect(lastFill()).not.toBe('#ffffff');
    renderer.selectFeature('reused');
    renderer.setLayers([{ id: 'buildings', visible: true, opacity: 0 }]);
    renderer.setLayers([{ id: 'buildings', visible: true, opacity: 1 }]);
    expect(lastFill()).not.toBe('#ffffff');
  } finally { renderer.destroy(); if (oldDocument === undefined) delete globals.document; else globals.document = oldDocument; }
});
