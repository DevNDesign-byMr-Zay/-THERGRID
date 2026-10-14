import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

const base = 'http://127.0.0.1:8090';
let index;
for (let attempt = 0; attempt < 60; attempt += 1) {
  try {
    const response = await fetch(base, { signal: AbortSignal.timeout(2000) });
    if (response.ok) {
      index = await response.text();
      break;
    }
  } catch {
    /* container starting or restarting */
  }
  await delay(1000);
}
assert.ok(index?.includes('id="root"'), 'canonical React root must be served');
const script = index.match(/src="([^"]*\/assets\/[^"]+\.js)"/u)?.[1];
assert.ok(script, 'compiled application script must be referenced');
const asset = await fetch(new URL(script, base));
assert.equal(asset.status, 200);
assert.match(asset.headers.get('content-type'), /javascript/u);
const configuration = await fetch(base + '/api/aethergrid/config/public');
assert.equal(configuration.status, 200);
assert.ok((await configuration.json()).spatial);
const runtime = await fetch(base + '/api/aethergrid/runtime');
assert.equal(runtime.status, 200);
assert.ok((await runtime.json()).ai);
const profileResponse = await fetch(base + '/api/aethergrid/profile');
assert.equal(profileResponse.status, 200);
const { profile } = await profileResponse.json();
if (process.argv.includes('--profile-write')) {
  const saved = await fetch(base + '/api/aethergrid/profile', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      profile: { ...profile, displayName: 'Container persistence acceptance' },
    }),
  });
  assert.equal(saved.status, 200);
}
if (process.argv.includes('--profile-verify')) {
  assert.equal(profile.displayName, 'Container persistence acceptance');
}
const health = await fetch('http://127.0.0.1:8080/health');
assert.equal(health.status, 200);
console.log(
  'PASS canonical React assets, application APIs and independent health service' +
    (process.argv.includes('--profile-verify') ? '; profile survives container restart' : ''),
);
