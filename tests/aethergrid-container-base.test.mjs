import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('both maintained containers use reachable Node 22 images and unprivileged production users', () => {
  for (const name of ['Dockerfile', 'Dockerfile.aethergrid']) {
    const dockerfile = readFileSync(name, 'utf8');
    assert.match(dockerfile, /^FROM node:22-bookworm AS builder$/mu);
    assert.match(dockerfile, /^FROM node:22-bookworm-slim(?: AS runtime)?$/mu);
    assert.doesNotMatch(dockerfile, /reg\.mini\.dev/u);
    const runtime = dockerfile.split(/^FROM node:22-bookworm-slim(?: AS runtime)?$/mu)[1];
    assert.ok(runtime, `${name} keeps its production stage`);
    assert.match(runtime, /^USER node$/mu);
    assert.match(runtime, /COPY --from=builder --chown=1000:1000/u);
    assert.match(runtime, /HEALTHCHECK /u);
    assert.match(runtime, /^CMD \["node",/mu);
  }
  const aethergrid = readFileSync('Dockerfile.aethergrid', 'utf8');
  assert.match(aethergrid, /COPY --from=builder --chown=1000:1000 \/data \/data/u);

  const compose = readFileSync('docker-compose.yml', 'utf8');
  assert.ok(
    (compose.match(/read_only:\s*true/gu) || []).length >= 2,
    'both services retain read-only root filesystems',
  );
});
