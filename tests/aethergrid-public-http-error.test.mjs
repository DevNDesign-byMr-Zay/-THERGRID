import assert from 'node:assert/strict';
import test from 'node:test';

import { publicHttpError } from '../apps/aethergrid-console/security/public-error.mjs';

test('unexpected errors never expose internal messages or stack details', () => {
  const error = new Error('GROQ_API_KEY=private-test-secret runtime failed');
  const result = publicHttpError(error);
  assert.deepEqual(result, {
    status: 500,
    payload: { error: 'server_error', message: 'Internal server error' },
  });
  assert.doesNotMatch(JSON.stringify(result), /private-test-secret/u);
});

test('validated client errors preserve status and bounded compatibility messages', () => {
  const result = publicHttpError({ status: 400, message: 'invalid coordinates' });
  assert.deepEqual(result, {
    status: 400,
    payload: { error: 'invalid_request', message: 'invalid coordinates' },
  });
  const tooLong = publicHttpError({ status: 422, message: 'x'.repeat(1000) });
  assert.equal(tooLong.status, 422);
  assert.equal(tooLong.payload.error, 'server_error');
  assert.equal(tooLong.payload.message.length, 256);
});

test('invalid HTTP statuses fail closed to an ordinary 500 response', () => {
  for (const status of [undefined, null, 'NaN', Number.NaN, Infinity, 200, 600, -50]) {
    const result = publicHttpError({ status, message: 'do-not-expose' });
    assert.equal(result.status, 500);
    assert.equal(result.payload.message, 'Internal server error');
  }
});

test('upstream 5xx errors retain status without exposing provider messages', () => {
  for (const status of [500, 502, 503, 504]) {
    const result = publicHttpError({
      status,
      message: 'private provider credential leaked',
    });
    assert.equal(result.status, status);
    assert.equal(result.payload.error, 'server_error');
    assert.equal(result.payload.message, 'Internal server error');
  }
});
