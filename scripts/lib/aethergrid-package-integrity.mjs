import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import ts from 'typescript';

const ARCHIVE_PREFIX = 'aethergrid-functional-app/';

function safeRelativePath(path) {
  return (
    typeof path === 'string' &&
    path.length > 0 &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    !path.split('/').some((part) => !part || part === '.' || part === '..')
  );
}

async function verifyBackendModules(root, expected) {
  const visited = new Set();
  const pending = ['server.mjs'];
  while (pending.length) {
    const path = pending.pop();
    if (visited.has(path)) continue;
    assert.ok(safeRelativePath(path) && expected.has(path), 'missing backend module: ' + path);
    visited.add(path);
    const source = await readFile(join(root, ...path.split('/')), 'utf8');
    const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    function visit(node) {
      const specifier =
        ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
          ? node.moduleSpecifier
          : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
            ? node.arguments[0]
            : null;
      if (specifier && ts.isStringLiteralLike(specifier) && specifier.text.startsWith('.')) {
        const dependency = posix.normalize(posix.join(posix.dirname(path), specifier.text));
        assert.ok(
          safeRelativePath(dependency) && expected.has(dependency),
          'missing backend module: ' + dependency,
        );
        if (dependency.endsWith('.mjs')) pending.push(dependency);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  return visited.size;
}

/** Checks the bytes actually extracted from a user-facing ZIP, not only its advertised manifest. */
export async function verifyAethergridPackageInventory(root, entryNames) {
  const manifest = JSON.parse(await readFile(join(root, 'PACKAGE_CONTENTS.json'), 'utf8'));
  assert.equal(manifest.schemaVersion, 2, 'canonical package inventory schema must be v2');
  assert.equal(manifest.canonicalWebApp, 'web/dist/index.html');
  assert.equal(manifest.backend, 'server.mjs');
  assert.ok(
    Array.isArray(manifest.files) && manifest.files.length > 0,
    'missing package inventory',
  );

  const expected = new Map();
  for (const item of manifest.files) {
    assert.ok(safeRelativePath(item.path), 'unsafe or invalid package inventory path');
    assert.ok(!expected.has(item.path), 'duplicate inventory entry: ' + item.path);
    assert.ok(
      Number.isInteger(item.bytes) && item.bytes > 0,
      'empty or invalid file: ' + item.path,
    );
    assert.match(item.sha256, /^[a-f0-9]{64}$/u, 'invalid SHA-256: ' + item.path);
    expected.set(item.path, item);
  }

  const actual = entryNames.map((name) => {
    assert.ok(name.startsWith(ARCHIVE_PREFIX), 'invalid packaged application root');
    const path = name.slice(ARCHIVE_PREFIX.length);
    assert.ok(safeRelativePath(path), 'unsafe extracted package entry');
    return path;
  });
  const complete = [...expected.keys(), 'PACKAGE_CONTENTS.json', 'SHA256SUMS.txt'];
  assert.equal(actual.length, new Set(actual).size, 'duplicate archive entries are forbidden');
  assert.deepEqual(
    actual.slice().sort(),
    complete.sort(),
    'archive and manifest inventories differ',
  );

  let verifiedBytes = 0;
  for (const [path, item] of expected) {
    const bytes = await readFile(join(root, ...path.split('/')));
    assert.equal(bytes.length, item.bytes, 'file size mismatch: ' + path);
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      item.sha256,
      'SHA-256 mismatch: ' + path,
    );
    verifiedBytes += bytes.length;
  }
  const shaLines = [...expected.values()]
    .map(({ sha256, path }) => sha256 + '  ' + path)
    .join('\n');
  assert.equal(
    await readFile(join(root, 'SHA256SUMS.txt'), 'utf8'),
    shaLines + '\n',
    'release checksum inventory diverges from package manifest',
  );

  const javascriptAssets = [...expected.values()].filter(
    ({ path, bytes }) =>
      path.startsWith('web/dist/assets/') && path.endsWith('.js') && bytes >= 100_000,
  ).length;
  const stylesheetAssets = [...expected.values()].filter(
    ({ path, bytes }) =>
      path.startsWith('web/dist/assets/') && path.endsWith('.css') && bytes >= 1_000,
  ).length;
  const cesiumWorkers = [...expected.keys()].filter((path) =>
    path.startsWith('web/dist/cesium/Workers/'),
  ).length;
  assert.ok(javascriptAssets > 0, 'canonical frontend has no substantial compiled JavaScript');
  assert.ok(stylesheetAssets > 0, 'canonical frontend has no compiled stylesheet');
  assert.ok(cesiumWorkers > 0, 'canonical frontend has no Cesium Workers');
  const backendModules = await verifyBackendModules(root, expected);

  return Object.freeze({
    verifiedFiles: expected.size,
    backendModules,
    verifiedBytes,
    javascriptAssets,
    cesiumWorkers,
  });
}
