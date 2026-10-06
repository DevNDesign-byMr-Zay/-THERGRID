import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const APP_ROOT = join(REPO_ROOT, 'apps', 'aethergrid-console');
const WEB_ROOT = join(APP_ROOT, 'web');
const WEB_DIST = join(WEB_ROOT, 'dist');
const OUTPUT_PATH = resolve(
  process.argv[2] ?? join(REPO_ROOT, 'dist', 'aethergrid-functional-app.zip'),
);
const ARCHIVE_ROOT = 'aethergrid-functional-app';

const LEGACY_FILES = new Set([
  'index.html',
  'styles.css',
  'app.js',
  'manifest.webmanifest',
  'sw.js',
]);

const REQUIRED_RUNTIME_FILES = Object.freeze([
  'server.mjs',
  'web-runtime.mjs',
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
  'providers/provider-registry.mjs',
  'providers/provider-health.mjs',
  'providers/provider-executor.mjs',
  'providers/provider-receipt.mjs',
  'providers/request-context.mjs',
  'providers/tomorrow-weather-provider.mjs',
  'providers/nws-alerts-provider.mjs',
  'providers/noaa-nwps-provider.mjs',
  'providers/eia-provider.mjs',
  'providers/transit-feed-config.mjs',
  'providers/transit-registry.mjs',
  'providers/transitland-provider.mjs',
  'providers/dwave-provider.mjs',
  'app.json',
  'ui.json',
  'README.md',
  '.env.example',
  'START-AETHERGRID.ps1',
  'STOP-AETHERGRID.ps1',
  'START-AETHERGRID.cmd',
  'web/dist/index.html',
  'legacy/index.html',
  'legacy/styles.css',
  'legacy/app.js',
  'legacy/standalone.html',
  'node_modules/zod/package.json',
]);

const PRIVATE_BROWSER_ENV_NAMES = Object.freeze([
  'AETHERGRID_IBM_QUANTUM_API_KEY',
  'AETHERGRID_IBM_QUANTUM_SERVICE_CRN',
  'AETHERGRID_DWAVE_API_TOKEN',
  'AETHERGRID_TOMORROW_API_KEY',
  'AETHERGRID_EIA_API_KEY',
  'AETHERGRID_OPENAI_API_KEY',
  'AETHERGRID_GROQ_API_KEY',
  'GROQ_API_KEY',
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

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
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

function htmlAssetReferences(html) {
  return [...html.matchAll(/(?:src|href)=["']([^"'#?]+)["']/gu)]
    .map((match) => match[1])
    .filter((value) => value && !/^(?:https?:|data:|mailto:)/u.test(value));
}

function assertNoPrivateBrowserSecrets(payload) {
  for (const [path, data] of payload.entries()) {
    if (!path.startsWith('web/dist/')) continue;
    const text = data.toString('utf8');
    for (const envName of PRIVATE_BROWSER_ENV_NAMES) {
      assert(!text.includes(envName), `canonical browser bundle references private server env name ${envName}: ${path}`);
    }
  }
}

const npm = npmCommand();
run(npm, ['ci'], WEB_ROOT);
run(npm, ['run', 'build'], WEB_ROOT);

const payload = new Map();
const legacySource = new Map();

for (const absolute of await collectFiles(APP_ROOT)) {
  const relativePath = normalizePath(relative(APP_ROOT, absolute));
  if (
    relativePath === '.aethergrid-data' ||
    relativePath.startsWith('.aethergrid-data/') ||
    relativePath.startsWith('web/node_modules/') ||
    relativePath.startsWith('web/dist/') ||
    relativePath.startsWith('web/src/') ||
    relativePath.startsWith('web/tests/') ||
    relativePath.startsWith('web/test-results/')
  ) {
    continue;
  }
  if (relativePath === 'assets/dashboard-reference.webp') continue;
  const metadata = await stat(absolute);
  assert(metadata.size > 0, `ÆTHERGRID app source file is empty: ${relativePath}`);
  const bytes = await readFile(absolute);
  if (LEGACY_FILES.has(relativePath)) {
    legacySource.set(relativePath, bytes);
    payload.set(`legacy/${relativePath}`, bytes);
  } else {
    payload.set(relativePath, bytes);
  }
}

for (const absolute of await collectFiles(WEB_DIST)) {
  const relativePath = normalizePath(relative(WEB_DIST, absolute));
  const metadata = await stat(absolute);
  assert(metadata.size > 0, `React production build file is empty: ${relativePath}`);
  payload.set(`web/dist/${relativePath}`, await readFile(absolute));
}

const zodRoot = join(REPO_ROOT, 'node_modules', 'zod');
for (const absolute of await collectFiles(zodRoot)) {
  const relativePath = normalizePath(relative(zodRoot, absolute));
  payload.set(`node_modules/zod/${relativePath}`, await readFile(absolute));
}

const repoPackage = JSON.parse(await readFile(join(REPO_ROOT, 'package.json'), 'utf8'));
const runtimePackage = {
  name: 'aethergrid-functional-app',
  version: repoPackage.version,
  private: true,
  type: 'module',
  engines: repoPackage.engines,
  scripts: { start: 'node server.mjs' },
  dependencies: { zod: repoPackage.dependencies.zod },
};
payload.set('package.json', Buffer.from(`${JSON.stringify(runtimePackage, null, 2)}\n`, 'utf8'));

for (const required of REQUIRED_RUNTIME_FILES) {
  assert(payload.has(required), `missing required ÆTHERGRID runtime file: ${required}`);
  assert(payload.get(required).length > 0, `required ÆTHERGRID runtime file is empty: ${required}`);
}

assert(
  ![...payload.keys()].some((path) => path === '.env' || path.endsWith('/.env')),
  'populated .env files must never be included in the distributable ZIP',
);
assert(
  ![...payload.keys()].some((path) => path.startsWith('web/node_modules/')),
  'web development dependencies must not be included in the distributable ZIP',
);

const appManifest = JSON.parse(payload.get('app.json').toString('utf8'));
const uiManifest = JSON.parse(payload.get('ui.json').toString('utf8'));
assert(appManifest.entrypoints?.webApp === 'web/dist/index.html', 'app.json must expose the canonical React build');
assert(appManifest.entrypoints?.backend === 'server.mjs', 'app.json must expose server.mjs');
assert(appManifest.entrypoints?.legacyWebApp === 'legacy/index.html', 'app.json must explicitly classify the native console as legacy');
assert(appManifest.entrypoints?.standaloneHtml === 'legacy/standalone.html', 'standalone compatibility HTML must live under legacy/');
assert(appManifest.frontend?.framework === 'react-typescript-vite', 'app.json must declare the canonical React/Vite frontend');
assert(appManifest.frontend?.spatialRenderer === 'cesium-primary-native-fallback', 'app.json must declare Cesium as the primary renderer');
assert(uiManifest.runtimeComposition === 'react-typescript-cesium', 'ui.json must declare the canonical React/Cesium composition');
assert(uiManifest.spatialModel?.renderEngine === 'cesium-primary-native-fallback', 'ui.json must declare Cesium primary with native fallback');

const canonicalHtml = payload.get('web/dist/index.html').toString('utf8');
assert(/id=["']root["']/u.test(canonicalHtml), 'canonical React build must expose the React root');
for (const reference of htmlAssetReferences(canonicalHtml)) {
  const relativeReference = reference.replace(/^\//u, '');
  assert(
    payload.has(`web/dist/${relativeReference}`),
    `canonical index references a missing build asset: ${reference}`,
  );
}

const legacyHtml = legacySource.get('index.html')?.toString('utf8');
const legacyCss = legacySource.get('styles.css')?.toString('utf8');
const legacyJs = legacySource.get('app.js')?.toString('utf8');
assert(legacyHtml && legacyCss && legacyJs, 'legacy compatibility sources must remain available');

let legacyStandalone = legacyHtml
  .replace(/\s*<link rel="manifest" href="\.\/manifest\.webmanifest" \/>\n?/u, '')
  .replace('<link rel="stylesheet" href="./styles.css" />', `<style>\n${legacyCss}\n</style>`)
  .replace('<script src="./app.js" defer></script>', `<script>\n${legacyJs}\n</script>`);

for (const [path, mime] of [
  ['assets/brand/aethergrid-logo.webp', 'image/webp'],
  ['assets/brand/vaelon.webp', 'image/webp'],
  ['assets/brand/auren.webp', 'image/webp'],
  ['assets/brand/solvaer.webp', 'image/webp'],
]) {
  const bytes = payload.get(path);
  if (!bytes) continue;
  legacyStandalone = legacyStandalone.replaceAll(`./${path}`, `data:${mime};base64,${bytes.toString('base64')}`);
}
payload.set('legacy/standalone.html', Buffer.from(legacyStandalone, 'utf8'));

assertNoPrivateBrowserSecrets(payload);

const inventory = [...payload.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([path, data]) => ({ path, bytes: data.length, sha256: sha256(data) }));

payload.set(
  'PACKAGE_CONTENTS.json',
  Buffer.from(
    `${JSON.stringify(
      {
        schemaVersion: 2,
        product: 'ÆTHERGRID',
        repositoryVersion: repoPackage.version,
        productGeneration: 'v4',
        format: 'react-cesium-v4-node-app-with-native-webgl-compatibility',
        canonicalWebApp: 'web/dist/index.html',
        backend: 'server.mjs',
        legacyCompatibility: {
          webApp: 'legacy/index.html',
          standaloneHtml: 'legacy/standalone.html',
          canonical: false,
        },
        runtimeCapabilities: [
          'react-typescript-command-center',
          'cesium-primary-spatial-renderer',
          'native-webgl-fallback',
          'same-origin-provider-api',
          'spa-routing',
          'server-sent-events',
          'source-backed-operational-layers',
          'replaceable-ai-agents',
          'quantum-provider-adapters',
          'evidence-and-provenance',
          'legacy-native-webgl-compatibility',
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

const zip = buildZip(archiveEntries);
await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, zip);
process.stdout.write(
  `Built canonical ÆTHERGRID React/Cesium app archive: ${OUTPUT_PATH} (${zip.length} bytes, ${archiveEntries.length} files)\n`,
);
