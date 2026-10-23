import { readFile, writeFile, readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const directory = new URL('../apps/aethergrid-console/web/local-dist/', import.meta.url);
const javascript = await readFile(new URL('workspace.js', directory), 'utf8');
const css = await readFile(new URL('workspace.css', directory), 'utf8');
const cesiumRoot = fileURLToPath(new URL('../dist/cesium/', directory));
async function filesAt(root) {
  const result = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...(await filesAt(path)));
    else result.push(path);
  }
  return result;
}
const assets = {};
const modules = {};
const mime = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.js': 'text/javascript',
};
for (const path of await filesAt(cesiumRoot)) {
  const key = relative(cesiumRoot, path).replaceAll('\\', '/');
  if (
    !/^(Assets|Workers|ThirdParty)\//u.test(key) ||
    key.startsWith('Assets/Textures/NaturalEarthII/')
  )
    continue;
  const bytes = await readFile(path);
  if (key.endsWith('.js')) continue;
  else
    assets[key] =
      `data:${mime[extname(key)] || 'application/octet-stream'};base64,${bytes.toString('base64')}`;
}
// Classic self-contained workers avoid module imports from an opaque file origin.
const { build } = await import(
  new URL('../apps/aethergrid-console/web/node_modules/rolldown/dist/index.mjs', import.meta.url)
);
const workerRoot = fileURLToPath(
  new URL(
    '../apps/aethergrid-console/web/node_modules/@cesium/engine/Source/Workers/',
    import.meta.url,
  ),
);
const geometryNames = (await readdir(workerRoot)).filter(
  (name) => /^create.*Geometry\.js$/u.test(name) && name !== 'createGeometry.js',
);
const approximateHeights = await readFile(
  join(cesiumRoot, 'Assets/approximateTerrainHeights.json'),
  'utf8',
);
const workerNames = [
  'transferTypedArrayTest',
  'createVerticesFromHeightmap',
  'createGeometry',
  'combineGeometry',
  'upsampleQuantizedTerrainMesh',
  'incrementallyBuildTerrainPicker',
];
for (const name of workerNames) {
  const bundled = await build({
    input: join(workerRoot, `${name}.js`),
    platform: 'browser',
    transform: {
      define: { 'import.meta.url': 'self.location.href', 'process.env.NODE_ENV': '"production"' },
    },
    plugins: [
      {
        name: 'local-geometry-factories',
        transform(code, id) {
          // Rolldown may hand plugins Windows backslash module ids. Normalize
          // before detecting the Cesium worker we must make self-contained.
          const normalizedId = id.replaceAll('\\', '/');
          if (normalizedId.endsWith('/Core/ApproximateTerrainHeights.js')) {
            return code.replace(
              /initPromise = Resource\.fetchJson\([\s\S]*?\)\.then/u,
              `initPromise = Promise.resolve(${approximateHeights}).then`,
            );
          }
          if (!normalizedId.endsWith('/Workers/createGeometry.js')) return;
          const imports = geometryNames
            .map((file, index) => `import geometry${index} from './${file}';`)
            .join('\n');
          const factories = geometryNames
            .map((file, index) => `${JSON.stringify(file.slice(0, -3))}:geometry${index}`)
            .join(',');
          return (
            imports +
            code.replace(
              /async function getModule\([\s\S]*?\n\}\n/u,
              `async function getModule(moduleName) { const factories={${factories}}; if(!factories[moduleName])throw new Error('Unbundled geometry factory: '+moduleName); return factories[moduleName]; }\n`,
            )
          );
        },
      },
    ],
    output: { format: 'iife', name: 'CesiumLocalWorker', codeSplitting: false, minify: true },
  });
  const output = bundled.output.find((item) => item.type === 'chunk')?.code;
  if (!output) throw new Error(`Missing embedded Cesium worker bundle: ${name}`);
  // A file:// page cannot dynamically import ./createGroundPolylineGeometry.js.
  // On Windows a missed plugin id check silently produced a broken "bundled"
  // worker. Fail package creation instead of shipping an unusable city UI.
  if (
    name === 'createGeometry' &&
    (!output.includes('Unbundled geometry factory') ||
      /import\\(\\s*[`'"]?\\.\\/create/u.test(output))
  ) {
    throw new Error('Cesium createGeometry worker retains unbundled dynamic geometry imports');
  }
  modules[`Workers/${name}.js`] = output;
}
const cities = {};
const cityRoot = fileURLToPath(new URL('../../assets/cities/', directory));
for (const filename of await readdir(cityRoot)) {
  if (!filename.endsWith('.json.gz')) continue;
  const city = JSON.parse(gunzipSync(await readFile(join(cityRoot, filename))).toString('utf8'));
  if (
    !city.source?.snapshot ||
    city.source.provider !== 'bundled-openstreetmap' ||
    !city.buildings?.length
  )
    throw new Error(`Unverified city snapshot: ${filename}`);
  cities[city.city.id] = city;
}
const bootstrap = `globalThis.__AETHERGRID_ASSETS__=${JSON.stringify(assets)};globalThis.__AETHERGRID_CITIES__=${JSON.stringify(cities)};
(function(){const modules=${JSON.stringify(modules)},urls=globalThis.__AETHERGRID_ASSETS__;for(const key of Object.keys(modules))urls[key]=URL.createObjectURL(new Blob([modules[key]],{type:'text/javascript'}));})();`;
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="ÆTHERGRID spatial intelligence workspace. Direct-open 3D cities, 4D controls and public weather radar. Air traffic requires the connected runtime.">
<meta name="theme-color" content="#07090f"><title>ÆTHERGRID · Local workspace</title>
<style>${css.replaceAll('</style', '<\\/style')}
#local-boot{position:fixed;inset:0;display:grid;place-content:center;background:#07090f;color:#b9e7ee;font:16px system-ui;letter-spacing:.25em;z-index:9999;text-align:center}
#local-boot span{margin:18px auto;width:36px;height:36px;border:2px solid #253841;border-top-color:#a3efff;border-radius:50%;animation:boot-spin 1.2s linear infinite}
@keyframes boot-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){#local-boot span{animation:none}}
.local-file-status{position:fixed;bottom:4px;left:50%;transform:translateX(-50%);z-index:60;max-width:95vw;padding:4px 10px;border:1px solid #55747d;background:#0c141bea;color:#c4dbe0;font:11px system-ui;border-radius:6px;text-align:center}
.local-file-status a{color:#9feaff;margin-left:8px}
</style></head><body><div id="local-boot">ÆTHERGRID<span></span><small>Opening your workspace</small></div><div id="root"></div>
<script>${bootstrap.replaceAll('</script', '<\\/script')}</script>
<script>${javascript.replaceAll('</script', '<\\/script')}</script>
<script>new MutationObserver(function(_,observer){if(document.querySelector('.spatial-shell')){document.getElementById('local-boot').remove();observer.disconnect();}}).observe(document.getElementById('root'),{childList:true,subtree:true});setTimeout(function(){var boot=document.getElementById('local-boot');if(boot)boot.innerHTML='Workspace could not start. Please extract the ZIP and open index.html in your browser.';},15000);</script>
</body></html>`;
await writeFile(new URL('index.html', directory), html);
process.stdout.write(
  `Built direct-open ÆTHERGRID HTML: ${fileURLToPath(new URL('index.html', directory))}\n`,
);
