import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function text(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('v4 reality mode uses real Cesium photorealistic tiles and falls back truthfully', async () => {
  const [renderer, controller, publicConfig] = await Promise.all([
    text('apps/aethergrid-console/web/src/renderer/cesium/cesium-renderer.ts'),
    text('apps/aethergrid-console/web/src/renderer/cesium/visual-mode-controller.ts'),
    text('apps/aethergrid-console/web/src/services/public-runtime-config.ts'),
  ]);

  assert.match(renderer, /createGooglePhotorealistic3DTileset/u);
  assert.match(renderer, /this\.#realityTiles\.show = false/u);
  assert.match(renderer, /google-photorealistic-3d-tiles/u);
  assert.match(renderer, /this\.#appliedVisualMode === 'reality'/u);
  assert.match(renderer, /const realityActive/u);
  assert.match(renderer, /this\.#viewer\.scene\.globe\.show = realityActive/u);

  assert.match(controller, /setRealityTiles/u);
  assert.match(controller, /Photorealistic 3D Tiles are unavailable/u);
  assert.match(controller, /applied: 'solid'/u);
  assert.match(controller, /applied: 'reality'/u);

  assert.match(
    publicConfig,
    /realityEnabled: Boolean\(developmentCesiumToken\)/u,
  );
  assert.doesNotMatch(
    renderer,
    /Photorealistic[\s\S]{0,160}background-image|backgroundImage/u,
  );
});
