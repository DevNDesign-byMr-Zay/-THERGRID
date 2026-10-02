import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const ROOT = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, ROOT), 'utf8');
}

test('v4 adaptive performance has a persisted AUTO mode with transparent local resolution', async () => {
  const hook = await text('apps/aethergrid-console/web/src/hooks/use-spatial-performance.ts');

  assert.match(hook, /aethergrid\.operator\.spatial-performance\.v4/u);
  assert.match(hook, /'auto'/u);
  assert.match(hook, /'quality'/u);
  assert.match(hook, /'balanced'/u);
  assert.match(hook, /'efficiency'/u);
  assert.match(hook, /hardwareConcurrency/u);
  assert.match(hook, /deviceMemory/u);
  assert.match(hook, /prefers-reduced-motion: reduce/u);
  assert.match(hook, /width <= 760/u);
  assert.match(hook, /mode === 'auto' \? autoTier : mode/u);
});

test('v4 performance tiers change renderer cost without changing data or analysis contracts', async () => {
  const [contract, manager, cesium, native] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/spatial-renderer.ts'),
    text('apps/aethergrid-console/web/src/renderer/renderer-manager.ts'),
    text('apps/aethergrid-console/web/src/renderer/cesium/cesium-renderer.ts'),
    text('apps/aethergrid-console/web/src/renderer/native/native-webgl-renderer.ts'),
  ]);

  assert.match(contract, /SpatialPerformanceTier/u);
  assert.match(contract, /setPerformanceTier\(tier: SpatialPerformanceTier\)/u);
  assert.match(manager, /#performanceTier: SpatialPerformanceTier/u);
  assert.match(manager, /this\.#current\.setPerformanceTier\(tier\)/u);
  assert.match(manager, /renderer\.setPerformanceTier\(this\.#performanceTier\)/u);

  assert.match(cesium, /viewer\.resolutionScale/u);
  assert.match(cesium, /maximumScreenSpaceError/u);
  assert.match(cesium, /detailMultiplier/u);
  assert.match(cesium, /performanceTier: this\.#performanceTier/u);

  assert.match(native, /dprCap/u);
  assert.match(native, /#decorativeDensity/u);
  assert.match(native, /performanceTier: this\.#performanceTier/u);
  assert.match(native, /#decorativeDensity/u);
});

test('v4 spatial viewport exposes explicit AUTO HQ BAL ECO operator controls', async () => {
  const [viewport, styles] = await Promise.all([
    text('apps/aethergrid-console/web/src/components/SpatialViewport.tsx'),
    text('apps/aethergrid-console/web/src/app/app.css'),
  ]);

  assert.match(viewport, /useSpatialPerformance/u);
  assert.match(viewport, /manager\.setPerformanceTier\(performance\.resolved\)/u);
  assert.match(viewport, /\['auto', 'AUTO'\]/u);
  assert.match(viewport, /\['quality', 'HQ'\]/u);
  assert.match(viewport, /\['balanced', 'BAL'\]/u);
  assert.match(viewport, /\['efficiency', 'ECO'\]/u);
  assert.match(viewport, /changes render cost only, not source data or analysis values/u);
  assert.match(viewport, /data-performance-tier=\{performance\.resolved\}/u);

  assert.match(styles, /\.renderer-quality-switch/u);
  assert.match(styles, /data-performance-tier='efficiency'/u);
});
