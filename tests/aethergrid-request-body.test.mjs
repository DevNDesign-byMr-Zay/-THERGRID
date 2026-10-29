import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';

import { readRequestJson } from '../apps/aethergrid-console/security/request-body.mjs';

test('empty requests retain empty-object behavior', async () => {
  assert.deepEqual(await readRequestJson(Readable.from([])), {});
});

test('segmented JSON parses without altering request values', async () => {
  const input = Readable.from(['{"region":"New', ' York","active":true}']);
  assert.deepEqual(await readRequestJson(input), { region: 'New York', active: true });
  assert.deepEqual(await readRequestJson(Readable.from(['[1,2,3]'])), [1, 2, 3]);
});

test('malformed JSON preserves a safe client SyntaxError', async () => {
  await assert.rejects(readRequestJson(Readable.from(['{token:"private"]'])), {
    name: 'SyntaxError',
    status: 400,
    message: 'invalid JSON request body',
  });
});

test('multibyte UTF-8 bytes count toward upload size limits', async () => {
  const input = Buffer.from(JSON.stringify({ message: '🌎🌐' }), 'utf8');
  assert.ok(input.byteLength > input.toString().length);
  await assert.rejects(
    readRequestJson(Readable.from([input]), { maxBytes: input.byteLength - 1 }),
    { status: 413, message: 'payload too large' },
  );
  assert.deepEqual(
    await readRequestJson(Readable.from([input]), { maxBytes: input.byteLength }),
    { message: '🌎🌐' },
  );
});

test('cumulative chunk overflow terminates early', async () => {
  const chunks = [Buffer.alloc(120_000, 'a'), Buffer.alloc(120_001, 'b')];
  await assert.rejects(readRequestJson(Readable.from(chunks), { maxBytes: 240_000 }), {
    status: 413,
  });
});
