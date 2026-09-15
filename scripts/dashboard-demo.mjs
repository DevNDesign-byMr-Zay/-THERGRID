import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  createOperatorDashboardView,
  validateOperatorDashboardView,
} from '../src/operator-dashboard-view.mjs';

const evidenceDemoPath = fileURLToPath(new URL('./demo.mjs', import.meta.url));
const result = spawnSync(process.execPath, [evidenceDemoPath], {
  encoding: 'utf8',
  env: process.env,
});

if (result.status !== 0) {
  throw new Error(result.stderr || 'operator evidence package demo failed');
}

const evidencePackage = JSON.parse(result.stdout);
const dashboard = createOperatorDashboardView(evidencePackage);
if (!validateOperatorDashboardView(dashboard, evidencePackage)) {
  throw new Error('operator dashboard view failed validation');
}

process.stdout.write(`${JSON.stringify(dashboard, null, 2)}\n`);
