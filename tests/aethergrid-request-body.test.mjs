import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';

import { readRequestJson } from '../apps/aethergrid-console/security/request-body.mjs';

test('empty requests retain the existing empty object behavior', async () => {
  assert.deepEqual(await readRequestJson(Readable.from([])), {});
});

test('segmented JSON requests parse once after bounded streaming', async () => {
  const input = Readable.from(['{"region":"New', ' York","active":true}']);
  assert.deepEqual(await readRequestJson(input), { region: 'New York', active: true });
  assert.deepEqual(await readRequestJson(Readable.from(['[1,2,3]'])), [1, 2, 3]);
});

test('non-JSON bodies are rejected as client errors without echoing input', async () => {
  await assert.rejects(
    readRequestJson(Readable.from(['{token:"private"]'])),
    (error) =>
      error instanceof SyntaxError &&
      error.status === 400 &&
      error.message === 'invalid JSON request body' &&
      !error.message.includes('private'),
  );
});

test('stream size is bounded by wire bytes even for multibyte UTF-8', async () => {
  const input = Buffer.from(JSON.stringify({ message: '🌎🌐' }), 'utf8');
  assert.ok(input.byteLength > input.toString().length);
  await assert.rejects(
    readRequestJson(Readable.from([input]), { maxBytes: input.byteLength - 1 }),
    (error) => error.status === 413 && error.message === 'payload too large',
  );
  assert.deepEqual(
    await readRequestJson(Readable.from([input]), { maxBytes: input.byteLength }),
    { message: '🌎🌐' },
  );
});

test('chunked oversized uploads terminate when the cumulative limit is exceeded', async () => {
  const chunks = [Buffer.alloc(120_000, 'a'), Buffer.alloc(120_001, 'b')];
  await assert.rejects(
    readRequestJson(Readable.from(chunks), { maxBytes: 240_000 }),
    (error) => error.status === 413,
  );
});
