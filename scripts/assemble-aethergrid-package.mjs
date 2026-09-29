import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createOperatorConsoleCapabilities } from '../src/operator-console-capabilities.mjs';
import { createOperatorConsoleState } from '../src/operator-console-state.mjs';

const SOURCE_ROOT = fileURLToPath(new URL('../apps/operator-console/', import.meta.url));
const OUTPUT_PATH = resolve(
  process.argv[2] ?? fileURLToPath(new URL('../dist/aethergrid-operator-console.zip', import.meta.url)),
);
const ARCHIVE_ROOT = 'aethergrid-operator-console';

const REQUIRED_FILES = Object.freeze([
  'app.json',
  'ui.json',
  'index.html',
  'styles.css',
  'app.js',
  'model-logos.js',
  'README.md',
  'assets/aethergrid-mark.svg',
  'assets/brand/aethergrid-logo-transparent.webp',
  'assets/brand/agents/vaelon.webp',
  'assets/brand/agents/auren.webp',
  'assets/brand/agents/solvaer.webp',
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
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolute)));
      continue;
    }
    if (entry.isFile()) files.push(absolute);
  }

  return files;
}

function zipEntry(name, data, localOffset) {
  const nameBytes = Buffer.from(name, 'utf8');
  const checksum = crc32(data);
  const dosTime = 0;
  const dosDate = 33;

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt16LE(dosTime, 10);
  local.writeUInt16LE(dosDate, 12);
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
  central.writeUInt16LE(dosTime, 12);
  central.writeUInt16LE(dosDate, 14);
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
    const encoded = zipEntry(entry.name, entry.data, localOffset);
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
const sourceByRelativePath = new Map();

for (const absolute of sourceFiles) {
  const relativePath = normalizePath(relative(SOURCE_ROOT, absolute));
  const metadata = await stat(absolute);
  assert(metadata.size > 0, `ÆTHERGRID package source file is empty: ${relativePath}`);
  sourceByRelativePath.set(relativePath, await readFile(absolute));
}

for (const required of REQUIRED_FILES) {
  assert(sourceByRelativePath.has(required), `missing required ÆTHERGRID package file: ${required}`);
  assert(
    sourceByRelativePath.get(required).length > 0,
    `required ÆTHERGRID package file is empty: ${required}`,
  );
}

const appManifest = JSON.parse(sourceByRelativePath.get('app.json').toString('utf8'));
const uiManifest = JSON.parse(sourceByRelativePath.get('ui.json').toString('utf8'));
const html = sourceByRelativePath.get('index.html').toString('utf8');

assert(appManifest.entrypoints?.html === 'index.html', 'app.json must point to index.html');
assert(appManifest.machineReadableUi === 'ui.json', 'app.json must point to ui.json');
assert(appManifest.packageContract?.includesHtmlUi === true, 'app.json must declare HTML UI');
assert(appManifest.packageContract?.includesJsonUi === true, 'app.json must declare JSON UI');
assert(
  Array.isArray(uiManifest.navigation) && uiManifest.navigation.length === 5,
  'ui.json must define all five ÆTHERGRID surfaces',
);
assert(/<html\b/iu.test(html) && /ÆTHERGRID/u.test(html), 'index.html must contain the full UI shell');

const generatedFiles = new Map([
  [
    'capabilities.json',
    Buffer.from(`${JSON.stringify(createOperatorConsoleCapabilities(), null, 2)}\n`, 'utf8'),
  ],
  [
    'operator-state.json',
    Buffer.from(`${JSON.stringify(createOperatorConsoleState(), null, 2)}\n`, 'utf8'),
  ],
]);

const payloadFiles = new Map([...sourceByRelativePath, ...generatedFiles]);
const inventory = [...payloadFiles.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([path, data]) => ({
    path,
    bytes: data.length,
    sha256: sha256(data),
  }));

assert(inventory.every((entry) => entry.bytes > 0), 'archive payload cannot contain empty files');

const packageContents = Buffer.from(
  `${JSON.stringify(
    {
      schemaVersion: 1,
      product: 'ÆTHERGRID',
      archiveRoot: ARCHIVE_ROOT,
      generatedRuntimeSnapshots: ['capabilities.json', 'operator-state.json'],
      excludesSelfFromInventory: true,
      files: inventory,
    },
    null,
    2,
  )}\n`,
  'utf8',
);

const checksums = Buffer.from(
  `${inventory.map((entry) => `${entry.sha256}  ${entry.path}`).join('\n')}\n`,
  'utf8',
);

payloadFiles.set('PACKAGE_CONTENTS.json', packageContents);
payloadFiles.set('SHA256SUMS.txt', checksums);

const archiveEntries = [...payloadFiles.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([path, data]) => ({
    name: `${ARCHIVE_ROOT}/${path}`,
    data,
  }));

for (const entry of archiveEntries) {
  assert(entry.data.length > 0, `archive entry is empty: ${entry.name}`);
}

const zip = buildZip(archiveEntries);
await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, zip);

const outputMetadata = await stat(OUTPUT_PATH);
assert(outputMetadata.size > 0, 'generated ÆTHERGRID ZIP is empty');

process.stdout.write(
  `ÆTHERGRID package verified: ${archiveEntries.length} non-empty files, ${outputMetadata.size} bytes, SHA-256 ${sha256(zip)} -> ${OUTPUT_PATH}\n`,
);
