import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_ROOT = fileURLToPath(new URL('../apps/aethergrid-console/', import.meta.url));
const OUTPUT_PATH = resolve(
  process.argv[2] ??
    fileURLToPath(new URL('../dist/aethergrid-functional-app.zip', import.meta.url)),
);
const ARCHIVE_ROOT = 'aethergrid-functional-app';

const REQUIRED_FILES = Object.freeze([
  'index.html',
  'styles.css',
  'app.js',
  'server.mjs',
  'agent-config.mjs',
  'ai-runtime.mjs',
  'profile-store.mjs',
  'geo-runtime.mjs',
  'city-environment-runtime.mjs',
  'city-live-runtime.mjs',
  'terrain-runtime.mjs',
  'quantum-runtime.mjs',
  'config/env-schema.mjs',
  'config/provider-config.mjs',
  'config/public-config.mjs',
  'security/secret-redactor.mjs',
  'security/url-policy.mjs',
  'providers/cache-store.mjs',
  'providers/circuit-breaker.mjs',
  'providers/rate-limiter.mjs',
  'providers/provider-health.mjs',
  'providers/provider-registry.mjs',
  'providers/provider-adapter.mjs',
  'providers/provider-executor.mjs',
  'providers/provider-receipt.mjs',
  'providers/request-context.mjs',
  'providers/tomorrow-weather-provider.mjs',
  'providers/nws-alerts-provider.mjs',
  'providers/noaa-nwps-provider.mjs',
  'providers/eia-provider.mjs',
  'providers/transit-registry.mjs',
  'providers/dwave-provider.mjs',
  'app.json',
  'ui.json',
  'manifest.webmanifest',
  'sw.js',
  'README.md',
  '.env.example',
  'START-AETHERGRID.ps1',
  'STOP-AETHERGRID.ps1',
  'START-AETHERGRID.cmd',
  'assets/brand/aethergrid-logo.webp',
  'assets/brand/vaelon.webp',
  'assets/brand/auren.webp',
  'assets/brand/solvaer.webp',
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizePath(path) {
  return path.split(sep).join('/');
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(absolute)));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function encodeEntry(name, data, localOffset) {
  const nameBytes = Buffer.from(name, 'utf8');
  const checksum = crc32(data);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt16LE(0, 10);
  local.writeUInt16LE(33, 12);
  local.writeUInt32LE(checksum, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  local.writeUInt16LE(0, 28);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt16LE(0, 12);
  central.writeUInt16LE(33, 14);
  central.writeUInt32LE(checksum, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt16LE(0, 30);
  central.writeUInt16LE(0, 32);
  central.writeUInt16LE(0, 34);
  central.writeUInt16LE(0, 36);
  central.writeUInt32LE(0, 38);
  central.writeUInt32LE(localOffset, 42);

  return {
    localParts: [local, nameBytes, data],
    centralParts: [central, nameBytes],
    localLength: local.length + nameBytes.length + data.length,
  };
}

function buildZip(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  for (const entry of entries) {
    const encoded = encodeEntry(entry.name, entry.data, localOffset);
    localParts.push(...encoded.localParts);
    centralParts.push(...encoded.centralParts);
    localOffset += encoded.localLength;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

const sourceFiles = await collectFiles(SOURCE_ROOT);
const payload = new Map();

for (const absolute of sourceFiles) {
  const path = normalizePath(relative(SOURCE_ROOT, absolute));
  if (path === 'assets/dashboard-reference.webp') continue;
  if (path === '.aethergrid-data' || path.startsWith('.aethergrid-data/')) continue;
  const metadata = await stat(absolute);
  assert(metadata.size > 0, `ÆTHERGRID app source file is empty: ${path}`);
  payload.set(path, await readFile(absolute));
}

for (const required of REQUIRED_FILES) {
  assert(payload.has(required), `missing required ÆTHERGRID app file: ${required}`);
  assert(payload.get(required).length > 0, `required ÆTHERGRID app file is empty: ${required}`);
}

const appManifest = JSON.parse(payload.get('app.json').toString('utf8'));
const uiManifest = JSON.parse(payload.get('ui.json').toString('utf8'));
assert(appManifest.entrypoints?.standaloneHtml === 'standalone.html', 'app.json must expose standalone.html');
assert(appManifest.entrypoints?.webApp === 'index.html', 'app.json must expose index.html');
assert(appManifest.entrypoints?.backend === 'server.mjs', 'app.json must expose server.mjs');
assert(appManifest.visualContract?.runtimeUsesBackgroundReferenceImage === false, 'runtime must not use a dashboard reference image');
assert(uiManifest.runtimeUsesBackgroundReferenceImage === false, 'UI contract must prohibit a runtime background reference');
assert(uiManifest.spatialModel?.renderEngine === 'native-webgl', 'UI must declare native WebGL spatial rendering');

const sourceHtml = payload.get('index.html').toString('utf8');
assert(!/dashboard-reference/iu.test(sourceHtml), 'runtime index.html must not reference the old dashboard screenshot');
assert(
  ![...payload.keys()].some((path) => path === '.aethergrid-data' || path.startsWith('.aethergrid-data/')),
  'runtime profile persistence data must never be included in the distributable ZIP',
);
assert(/<canvas id="spatialGrid"/u.test(sourceHtml), 'runtime index.html must expose the real spatial WebGL canvas');
assert(/data-workspace-target="holographic"/u.test(sourceHtml), 'runtime index.html must expose functional workspace controls');
assert(/data-workspace="settings"/u.test(sourceHtml), 'runtime index.html must include a real settings workspace');
assert(/data-workspace="global"/u.test(sourceHtml), 'runtime index.html must include the global 3D workspace');
assert(/id="globalGlobe"/u.test(sourceHtml), 'runtime index.html must expose the real global WebGL canvas');
assert(/id="globalPointLat"/u.test(sourceHtml), 'runtime index.html must expose arbitrary latitude controls');
assert(/id="globalPointLon"/u.test(sourceHtml), 'runtime index.html must expose arbitrary longitude controls');
assert(/data-global-layer="infrastructure"/u.test(sourceHtml), 'runtime index.html must expose the live power-grid layer toggle');
assert(/data-global-layer="terrain"/u.test(sourceHtml), 'runtime index.html must expose the live terrain layer toggle');
assert(/id="globalTimeSlider"/u.test(sourceHtml), 'runtime index.html must expose the global 4D time index');
assert(/data-action="city-live-now"/u.test(sourceHtml), 'runtime index.html must expose city live-time synchronization');
assert(/data-global-layer="weather"/u.test(sourceHtml), 'runtime index.html must expose the live weather layer');
assert(/data-global-layer="clouds"/u.test(sourceHtml), 'runtime index.html must expose the live cloud layer');
assert(/data-global-layer="illumination"/u.test(sourceHtml), 'runtime index.html must expose the city-light layer');
assert(/data-global-layer="landmarks"/u.test(sourceHtml), 'runtime index.html must expose the source-backed landmark layer');
assert(/data-global-layer="water"/u.test(sourceHtml), 'runtime index.html must expose mapped water');
assert(/data-global-layer="green"/u.test(sourceHtml), 'runtime index.html must expose mapped green space');
assert(/id="cityIdentity"/u.test(sourceHtml), 'runtime index.html must expose the city identity inspector');
assert(/data-global-layer="air"/u.test(sourceHtml), 'runtime index.html must expose the live air-quality layer');
assert(/data-global-layer="seismic"/u.test(sourceHtml), 'runtime index.html must expose the live seismic layer');
assert(/value="weather-readiness"/u.test(sourceHtml), 'runtime index.html must expose weather readiness analysis');
assert(/value="air-quality-exposure"/u.test(sourceHtml), 'runtime index.html must expose air-quality exposure analysis');
assert(/value="seismic-awareness"/u.test(sourceHtml), 'runtime index.html must expose seismic awareness analysis');
assert(/value="heat-stress"/u.test(sourceHtml), 'runtime index.html must expose heat-stress analysis');
assert(/value="visibility-operations"/u.test(sourceHtml), 'runtime index.html must expose visibility analysis');
assert(/value="flood-context"/u.test(sourceHtml), 'runtime index.html must expose flood-context analysis');
assert(/value="green-infrastructure"/u.test(sourceHtml), 'runtime index.html must expose green-infrastructure analysis');
assert(/id="globalSolarStatus"/u.test(sourceHtml), 'runtime index.html must expose solar-position status');
assert(/id="settingTheme"/u.test(sourceHtml), 'runtime index.html must expose persistent appearance modes');
assert(/id="profileForm"/u.test(sourceHtml), 'runtime index.html must expose the persistent operator profile form');
assert(/id="quantumCircuit"/u.test(sourceHtml), 'runtime index.html must expose real quantum job controls');
assert(/data-agent="TEAM"/u.test(sourceHtml), 'runtime index.html must expose team-agent mode');

const inlineCss = payload.get('styles.css').toString('utf8');
const inlineJs = payload.get('app.js').toString('utf8');
let standaloneHtml = sourceHtml
  .replace(/\s*<link rel="manifest" href="\.\/manifest\.webmanifest" \/>\n?/u, '')
  .replace('<link rel="stylesheet" href="./styles.css" />', `<style>\n${inlineCss}\n</style>`)
  .replace('<script src="./app.js" defer></script>', `<script>\n${inlineJs}\n</script>`);

for (const [path, mime] of [
  ['assets/brand/aethergrid-logo.webp', 'image/webp'],
  ['assets/brand/vaelon.webp', 'image/webp'],
  ['assets/brand/auren.webp', 'image/webp'],
  ['assets/brand/solvaer.webp', 'image/webp'],
]) {
  const encoded = payload.get(path).toString('base64');
  standaloneHtml = standaloneHtml.replaceAll(`./${path}`, `data:${mime};base64,${encoded}`);
}

assert(!/src="\.\/app\.js"/u.test(standaloneHtml), 'standalone HTML cannot depend on app.js');
assert(!/href="\.\/styles\.css"/u.test(standaloneHtml), 'standalone HTML cannot depend on styles.css');
assert(!/assets\/brand\//u.test(standaloneHtml), 'standalone HTML must embed brand assets');
assert(/attribute vec4 a_position/u.test(standaloneHtml), 'standalone HTML must embed the native 4D WebGL shader');
assert(/data-workspace="holographic"/u.test(standaloneHtml), 'standalone HTML must retain routed workspaces');
assert(/id="settingDefaultWorkspace"/u.test(standaloneHtml), 'standalone HTML must retain functional settings controls');
assert(/id="settingTheme"/u.test(standaloneHtml), 'standalone HTML must retain light/dark/system appearance controls');
assert(/data-action="city-live-now"/u.test(standaloneHtml), 'standalone HTML must retain live city-time controls');
assert(/id="globalPointLat"/u.test(standaloneHtml), 'standalone HTML must retain coordinate exploration controls');
assert(/data-global-layer="infrastructure"/u.test(standaloneHtml), 'standalone HTML must retain the power-grid layer control');
assert(/data-global-layer="terrain"/u.test(standaloneHtml), 'standalone HTML must retain the terrain layer control');
assert(/async function loadCoordinateCity/u.test(standaloneHtml), 'standalone HTML must retain coordinate explorer behavior');
assert(/loadTerrainFor/u.test(standaloneHtml), 'standalone HTML must retain live terrain request wiring');
assert(/infrastructureLines/u.test(standaloneHtml), 'standalone HTML must retain native WebGL power-grid geometry');
assert(/terrainLines/u.test(standaloneHtml), 'standalone HTML must retain native WebGL terrain geometry');
assert(/bilinearTerrainElevation/u.test(standaloneHtml), 'standalone HTML must retain bilinear terrain interpolation');
assert(/terrainSurfaceYAtSource/u.test(standaloneHtml), 'standalone HTML must retain terrain-conforming city placement');
assert(/terrainConformance/u.test(standaloneHtml), 'standalone HTML must retain terrain conformance state');
assert(/Terrain Fit/u.test(standaloneHtml), 'standalone HTML must retain terrain-fit fidelity readouts');
assert(/data-global-layer="terrain"/u.test(standaloneHtml), 'standalone HTML must retain terrain layer controls');
assert(/terrainLines/u.test(standaloneHtml), 'standalone HTML must retain native WebGL terrain geometry');
assert(/roofFaces/u.test(standaloneHtml), 'standalone HTML must retain source-shaped roof geometry');
assert(/resolvedTheme/u.test(standaloneHtml), 'standalone HTML must retain appearance mode logic');
assert(/environmentHour/u.test(standaloneHtml), 'standalone HTML must retain live city time synchronization');
assert(/setLiveActivity/u.test(standaloneHtml), 'standalone HTML must retain animated global live-activity rendering');
assert(/weatherLines/u.test(standaloneHtml), 'standalone HTML must retain native WebGL wind geometry');
assert(/cloudParticles/u.test(standaloneHtml), 'standalone HTML must retain native WebGL cloud geometry');
assert(/cityLights/u.test(standaloneHtml), 'standalone HTML must retain procedural skyline light geometry');
assert(/landmarkCandidates/u.test(standaloneHtml), 'standalone HTML must retain source-backed identity anchor extraction');
assert(/landmarkSpines/u.test(standaloneHtml), 'standalone HTML must retain landmark spine geometry');
assert(/waterLines/u.test(standaloneHtml), 'standalone HTML must retain mapped water geometry');
assert(/waterFaces/u.test(standaloneHtml), 'standalone HTML must retain mapped water surfaces');
assert(/greenLines/u.test(standaloneHtml), 'standalone HTML must retain mapped green geometry');
assert(/greenFaces/u.test(standaloneHtml), 'standalone HTML must retain mapped green surfaces');
assert(/materialGlassFaces/u.test(standaloneHtml), 'standalone HTML must retain source-tagged material geometry');
assert(/value="flood-context"/u.test(standaloneHtml), 'standalone HTML must retain flood-context operation');
assert(/value="green-infrastructure"/u.test(standaloneHtml), 'standalone HTML must retain green-infrastructure operation');
assert(/snowParticles/u.test(standaloneHtml), 'standalone HTML must retain modeled snow geometry');
assert(/fogParticles/u.test(standaloneHtml), 'standalone HTML must retain modeled fog geometry');
assert(/stormLines/u.test(standaloneHtml), 'standalone HTML must retain modeled thunderstorm geometry');
assert(/weatherPhenomenon/u.test(standaloneHtml), 'standalone HTML must retain weather semantics');
assert(/updateCityIdentity/u.test(standaloneHtml), 'standalone HTML must retain the city identity inspector');
assert(/solarPosition/u.test(standaloneHtml), 'standalone HTML must retain solar-position calculation');
assert(/updateSolarGeometry/u.test(standaloneHtml), 'standalone HTML must retain the live solar terminator');
assert(/u_flow/u.test(standaloneHtml), 'standalone HTML must retain directional atmosphere flow');
assert(/u_drop/u.test(standaloneHtml), 'standalone HTML must retain falling precipitation motion');
assert(/airParticles/u.test(standaloneHtml), 'standalone HTML must retain native WebGL air-quality particles');
assert(/seismicLines/u.test(standaloneHtml), 'standalone HTML must retain native WebGL seismic rings');
payload.set('standalone.html', Buffer.from(standaloneHtml, 'utf8'));

const inventory = [...payload.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([path, data]) => ({ path, bytes: data.length, sha256: sha256(data) }));

assert(inventory.every((entry) => entry.bytes > 0), 'archive cannot contain empty files');

payload.set(
  'PACKAGE_CONTENTS.json',
  Buffer.from(
    `${JSON.stringify(
      {
        schemaVersion: 1,
        product: 'ÆTHERGRID',
        format: 'semantic-html-native-webgl-and-node-app',
        standaloneHtml: 'standalone.html',
        backgroundReferenceImageUsedAtRuntime: false,
        runtimeCapabilities: [
          'native-webgl-4d-grid',
          'global-coordinate-explorer',
          'live-osm-buildings-roads-power-grid',
          'live-elevation-terrain',
          'replaceable-ai-agents',
          'ibm-quantum-compute-adapter',
          'persistent-operator-profile',
          'source-backed-city-roofs',
          'city-specific-skyline-framing',
          'live-open-city-environment',
          'city-local-live-time-sync',
          'light-dark-system-theme',
          'skyline-data-quality',
          'live-air-quality',
          'live-usgs-seismic',
          'animated-weather-vectors',
          'animated-precipitation',
          'animated-air-quality-particles',
          'animated-seismic-rings',
          'animated-global-live-context',
          'source-driven-city-use-cases',
          'real-time-solar-terminator',
          'live-subsolar-point',
          'night-side-city-illumination',
          'wind-driven-cloud-deck',
          'directional-precipitation-motion',
          'procedural-skyline-lighting',
          'solar-daylight-context',
          'heat-stress-operation',
          'visibility-operations',
          'source-backed-city-identity',
          'named-structure-anchors',
          'interactive-landmark-layer',
          'semantic-weather-rendering',
          'modeled-snow-animation',
          'modeled-fog-animation',
          'modeled-thunderstorm-animation',
          'source-backed-water-areas',
          'source-backed-waterways',
          'source-backed-coastline',
          'source-backed-green-areas',
          'source-tagged-building-materials',
          'flood-context-operation',
          'green-infrastructure-operation',
          'no-invented-environmental-geometry',
          'bilinear-terrain-interpolation',
          'terrain-anchored-buildings',
          'terrain-draped-roads',
          'terrain-draped-waterways',
          'terrain-aligned-green-space',
          'terrain-draped-infrastructure',
          'level-water-area-presentation',
          'non-survey-grade-terrain-fit'
        ],
        files: inventory,
      },
      null,
      2,
    )}\n`,
    'utf8',
  ),
);

payload.set(
  'SHA256SUMS.txt',
  Buffer.from(
    `${inventory.map((entry) => `${entry.sha256}  ${entry.path}`).join('\n')}\n`,
    'utf8',
  ),
);

const archiveEntries = [...payload.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([path, data]) => ({ name: `${ARCHIVE_ROOT}/${path}`, data }));

for (const entry of archiveEntries) {
  assert(entry.data.length > 0, `archive entry is empty: ${entry.name}`);
}

const zip = buildZip(archiveEntries);
await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, zip);

process.stdout.write(
  `ÆTHERGRID functional app verified: ${archiveEntries.length} non-empty files, ${zip.length} bytes, SHA-256 ${sha256(zip)} -> ${OUTPUT_PATH}\n`,
);