import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';

import { readRequestJson } from '../apps/aethergrid-console/security/request-body.mjs';

test('empty requests return the default object', async () => {
  const result = await readRequestJson(Readable.from([]));
  assert.deepEqual(result, {});
});

test('segmented JSON preserves the parsed value', async () => {
  const chunks = ['{"region":"New', ' York","active":true}'];
  const result = await readRequestJson(Readable.from(chunks));
  assert.deepEqual(result, { region: 'New York', active: true });
  const array = await readRequestJson(Readable.from(['[1,2,3]']));
  assert.deepEqual(array, [1, 2, 3]);
});

test('invalid JSON raises a safe client syntax error', async () => {
  const input = Readable.from(['{token:"private"]']);
  await assert.rejects(readRequestJson(input), {
    name: 'SyntaxError',
    status: 400,
    message: 'invalid JSON request body',
  });
});

test('UTF-8 multibyte payloads are counted by bytes', async () => {
  const input = Buffer.from(JSON.stringify({ message: '🌎🌐' }));
  assert.ok(input.byteLength > input.toString().length);
  const short = Readable.from([input]);
  await assert.rejects(readRequestJson(short, { maxBytes: input.byteLength - 1 }), {
    status: 413,
    message: 'payload too large',
  });
  const exact = Readable.from([input]);
  const result = await readRequestJson(exact, { maxBytes: input.byteLength });
  assert.deepEqual(result, { message: '🌎🌐' });
});

test('cumulative request limit rejects oversized chunks', async () => {
  const chunks = [Buffer.alloc(120_000), Buffer.alloc(120_001)];
  const input = Readable.from(chunks);
  await assert.rejects(readRequestJson(input, { maxBytes: 240_000 }), {
    status: 413,
  });
});
