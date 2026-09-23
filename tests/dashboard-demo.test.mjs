import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dashboardDemoPath = fileURLToPath(new URL('../scripts/dashboard-demo.mjs', import.meta.url));

function runDashboardDemo() {
  const result = spawnSync(process.execPath, [dashboardDemoPath], {
    encoding: 'utf8',
    env: process.env,
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('dashboard demo crosses the serialized package boundary and emits sealed read evidence', () => {
  const dashboard = runDashboardDemo();

  assert.equal(dashboard.version, 2);
  assert.equal(dashboard.interpretation, 'operator-dashboard-read-only');
  assert.match(dashboard.packageFingerprint, /^[a-f0-9]{64}$/);
  assert.match(dashboard.attentionFingerprint, /^[a-f0-9]{64}$/);
  assert.match(dashboard.sourceViewFingerprint, /^[a-f0-9]{64}$/);
  assert.match(dashboard.sourceProvenanceFingerprint, /^[a-f0-9]{64}$/);
  assert.match(dashboard.dashboardFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(Array.isArray(dashboard.items[0].assetNodeRefs), true);
  assert.equal(dashboard.items[0].assetNodeRefs.length > 0, true);
  assert.equal(dashboard.safety.advisoryOnly, true);
  assert.equal(dashboard.safety.authoritative, false);
  assert.equal(dashboard.safety.actuatesHardware, false);
  assert.equal(dashboard.safety.promotionEligible, false);
  assert.equal(dashboard.safety.dispatchesInfrastructure, false);
  assert.equal(dashboard.safety.deploysInfrastructure, false);
});

test('dashboard demo is deterministic across complete subprocess runs', () => {
  const first = runDashboardDemo();
  const second = runDashboardDemo();

  assert.equal(first.dashboardFingerprint, second.dashboardFingerprint);
  assert.equal(first.sourceProvenanceFingerprint, second.sourceProvenanceFingerprint);
  assert.deepEqual(first, second);
});
