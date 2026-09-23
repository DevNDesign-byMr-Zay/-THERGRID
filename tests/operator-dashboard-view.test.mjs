import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  createOperatorDashboardView,
  validateOperatorDashboardView,
} from '../src/operator-dashboard-view.mjs';

const demoPath = fileURLToPath(new URL('../scripts/demo.mjs', import.meta.url));

function demoPackage() {
  const result = spawnSync(process.execPath, [demoPath], {
    encoding: 'utf8',
    env: process.env,
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

function collectObjectKeys(value, keys = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectObjectKeys(item, keys);
    return keys;
  }
  if (!value || typeof value !== 'object') return keys;

  for (const [key, child] of Object.entries(value)) {
    keys.push(key.toLowerCase());
    collectObjectKeys(child, keys);
  }
  return keys;
}

test('dashboard view is derived only from a validated serialized operator package', () => {
  const evidencePackage = demoPackage();
  const dashboard = createOperatorDashboardView(evidencePackage);

  assert.equal(validateOperatorDashboardView(dashboard, evidencePackage), true);
  assert.equal(dashboard.version, 2);
  assert.equal(dashboard.packageFingerprint, evidencePackage.packageFingerprint);
  assert.equal(dashboard.attentionFingerprint, evidencePackage.manifest.attentionFingerprint);
  assert.equal(
    dashboard.sourceProvenanceFingerprint,
    evidencePackage.manifest.provenanceFingerprint,
  );
  assert.equal(dashboard.sourceViewFingerprint, evidencePackage.manifest.viewFingerprint);
  assert.deepEqual(dashboard.items, evidencePackage.readModel.items);
  assert.deepEqual(
    dashboard.items[0].assetNodeRefs,
    evidencePackage.readModel.items[0].assetNodeRefs,
  );
  assert.equal(dashboard.interpretation, 'operator-dashboard-read-only');
  assert.equal(dashboard.safety.advisoryOnly, true);
  assert.equal(dashboard.safety.authoritative, false);
  assert.equal(dashboard.safety.actuatesHardware, false);
  assert.equal(dashboard.safety.promotionEligible, false);
  assert.equal(dashboard.safety.dispatchesInfrastructure, false);
  assert.equal(dashboard.safety.deploysInfrastructure, false);
  assert.match(dashboard.dashboardFingerprint, /^[a-f0-9]{64}$/);

  const keys = collectObjectKeys(dashboard);
  for (const forbidden of [
    'candidate',
    'proposal',
    'controlcommand',
    'actionpayload',
    'dispatchdeltakw',
  ]) {
    assert.equal(keys.includes(forbidden), false, `dashboard leaked structural key ${forbidden}`);
  }
});

test('dashboard validation survives a complete JSON transport boundary', () => {
  const evidencePackage = demoPackage();
  const dashboard = createOperatorDashboardView(evidencePackage);
  const transportedPackage = JSON.parse(JSON.stringify(evidencePackage));
  const transportedDashboard = JSON.parse(JSON.stringify(dashboard));

  assert.equal(validateOperatorDashboardView(transportedDashboard, transportedPackage), true);
});

test('dashboard rejects package, provenance identity, and authority substitution', () => {
  const evidencePackage = demoPackage();
  const dashboard = createOperatorDashboardView(evidencePackage);
  const substitutedPackage = {
    ...evidencePackage,
    packageFingerprint: '0'.repeat(64),
  };

  assert.equal(validateOperatorDashboardView(dashboard, substitutedPackage), false);
  assert.equal(
    validateOperatorDashboardView(
      { ...dashboard, sourceProvenanceFingerprint: '0'.repeat(64) },
      evidencePackage,
    ),
    false,
  );
  assert.equal(
    validateOperatorDashboardView(
      {
        ...dashboard,
        safety: { ...dashboard.safety, authoritative: true },
      },
      evidencePackage,
    ),
    false,
  );
});

test('dashboard rejects source asset/node substitution', () => {
  const evidencePackage = demoPackage();
  const dashboard = createOperatorDashboardView(evidencePackage);
  const items = dashboard.items.map((item) => ({
    ...item,
    assetNodeRefs: item.assetNodeRefs.map((ref) => ({ ...ref })),
  }));
  items[0].assetNodeRefs[0] = { assetId: 'substituted-asset', nodeId: 'node-a' };

  assert.equal(validateOperatorDashboardView({ ...dashboard, items }, evidencePackage), false);
});

test('dashboard creation refuses loose raw attention or read-model inputs', () => {
  const evidencePackage = demoPackage();

  assert.throws(
    () => createOperatorDashboardView(evidencePackage.attention),
    /validated operator evidence package/,
  );
  assert.throws(
    () => createOperatorDashboardView(evidencePackage.readModel),
    /validated operator evidence package/,
  );
});
