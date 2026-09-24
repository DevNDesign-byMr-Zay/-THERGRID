import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { parseHealthServiceConfig } from '../src/platform-health-service.mjs';
import { parseRuntimeConfig } from '../src/runtime-observability.mjs';

const ENV_EXAMPLE = new URL('../.env.example', import.meta.url);

function parseExample(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=');
        assert.notEqual(separator, -1, `invalid .env.example line: ${line}`);
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

test('.env.example covers the maintained health and observability configuration', async () => {
  const values = parseExample(await readFile(ENV_EXAMPLE, 'utf8'));

  assert.deepEqual(
    Object.keys(values).sort(),
    ['GITHUB_SHA', 'PORT', 'RELEASE_TAG', 'SERVICE_NAME', 'THERGRID_LOG_LEVEL', 'THERGRID_PORT'].sort(),
  );

  assert.deepEqual(parseHealthServiceConfig(values), {
    PORT: 8080,
    SERVICE_NAME: 'thergrid',
  });
  assert.deepEqual(parseRuntimeConfig(values), {
    port: 8080,
    logLevel: 'info',
  });
});
