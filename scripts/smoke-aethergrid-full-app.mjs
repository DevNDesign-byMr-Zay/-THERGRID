import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const archivePath = join(repoRoot, 'dist', 'aethergrid-functional-app.zip');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function extractStoredZip(archive, destination) {
  const bytes = await readFile(archive);
  let offset = 0;
  const extracted = [];

  while (offset + 4 <= bytes.length) {
    const signature = bytes.readUInt32LE(offset);
    if (signature === 0x02014b50 || signature === 0x06054b50) break;
    assert(signature === 0x04034b50, `unexpected ZIP signature at byte ${offset}`);

    const method = bytes.readUInt16LE(offset + 8);
    const compressedSize = bytes.readUInt32LE(offset + 18);
    const uncompressedSize = bytes.readUInt32LE(offset + 22);
    const nameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    assert(method === 0, 'package smoke supports the maintained stored-entry ZIP format only');
    assert(compressedSize === uncompressedSize, 'stored ZIP entry sizes must match');

    const nameStart = offset + 30;
    const nameEnd = nameStart + nameLength;
    const dataStart = nameEnd + extraLength;
    const dataEnd = dataStart + compressedSize;
    const entryName = bytes.subarray(nameStart, nameEnd).toString('utf8');
    assert(
      entryName.startsWith('aethergrid-functional-app/'),
      `unexpected archive root: ${entryName}`,
    );
    assert(!entryName.split('/').includes('..'), `unsafe archive path: ${entryName}`);

    const outputPath = join(destination, ...entryName.split('/'));
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, bytes.subarray(dataStart, dataEnd));
    extracted.push(entryName);
    offset = dataEnd;
  }

  return extracted;
}

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : null;
  await new Promise((resolvePromise, reject) =>
    server.close((error) => (error ? reject(error) : resolvePromise())),
  );
  assert(Number.isInteger(port), 'failed to reserve a local package-smoke port');
  return port;
}

async function waitFor(url, child) {
  let lastError = null;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`packaged server exited early with code ${child.exitCode}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw lastError || new Error(`timed out waiting for ${url}`);
}

const tempRoot = await mkdtemp(join(tmpdir(), 'aethergrid-package-smoke-'));
let child;
let stdout = '';
let stderr = '';

try {
  const extracted = await extractStoredZip(archivePath, tempRoot);
  const appRoot = join(tempRoot, 'aethergrid-functional-app');

  for (const required of [
    'aethergrid-functional-app/server.mjs',
    'aethergrid-functional-app/web/dist/index.html',
    'aethergrid-functional-app/legacy/index.html',
    'aethergrid-functional-app/legacy/standalone.html',
    'aethergrid-functional-app/node_modules/zod/package.json',
    'aethergrid-functional-app/PACKAGE_CONTENTS.json',
  ]) {
    assert(extracted.includes(required), `packaged smoke artifact missing ${required}`);
  }
  assert(
    !extracted.some(
      (entry) => /\/\.env(?:\..*)?$/u.test(entry) && !entry.endsWith('/.env.example'),
    ),
    'package must not contain populated .env or .env.* files',
  );

  const port = await reservePort();
  child = spawn(process.execPath, ['server.mjs'], {
    cwd: appRoot,
    env: {
      ...process.env,
      AETHERGRID_PORT: String(port),
      AETHERGRID_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  const health = await waitFor(`${baseUrl}/api/aethergrid/health`, child);
  assert(health.status === 200, `packaged health returned HTTP ${health.status}`);

  const root = await fetch(`${baseUrl}/`);
  assert(root.status === 200, `packaged root returned HTTP ${root.status}`);
  const html = await root.text();
  assert(/id=["']root["']/u.test(html), 'packaged server did not serve the React root');
  assert(!/<canvas id="spatialGrid"/u.test(html), 'packaged server served the legacy v3 root');

  const legacyScript = await fetch(`${baseUrl}/app.js`);
  assert(legacyScript.status === 404, 'legacy root app.js must not be served by the canonical runtime');

  const apiMiss = await fetch(`${baseUrl}/api/aethergrid/not-a-real-route`);
  assert(apiMiss.status === 404, 'unknown API route must remain an API 404');

  process.stdout.write(
    `ÆTHERGRID packaged runtime smoke passed on canonical React/Cesium archive (${extracted.length} files)\n`,
  );
} catch (error) {
  if (stdout) process.stderr.write(`--- packaged server stdout ---\n${stdout}\n`);
  if (stderr) process.stderr.write(`--- packaged server stderr ---\n${stderr}\n`);
  throw error;
} finally {
  if (child && child.exitCode === null) {
    child.kill('SIGTERM');
    await new Promise((resolvePromise) => {
      child.once('exit', resolvePromise);
      setTimeout(resolvePromise, 1000);
    });
  }
  await rm(tempRoot, { recursive: true, force: true });
}
