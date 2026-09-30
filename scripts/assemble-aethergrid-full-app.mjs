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
  'quantum-runtime.mjs',
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