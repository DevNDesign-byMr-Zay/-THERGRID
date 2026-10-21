import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('quantum panel exposes free local CPU QUBO comparison without touching D-Wave hold', async () => {
  const panel = await readFile(new URL('../apps/aethergrid-console/web/src/components/QuantumPanel.tsx', import.meta.url), 'utf8');
  const client = await readFile(new URL('../apps/aethergrid-console/web/src/services/quantum-client.ts', import.meta.url), 'utf8');
  assert.match(panel, /LOCAL OPTIMIZE/u);
  assert.match(panel, /runLocalQuboComparison/u);
  assert.match(panel, /EXACT CPU REFERENCE/u);
  assert.match(panel, /SIMULATED ANNEALING/u);
  assert.match(panel, /NOT QUANTUM HARDWARE/u);
  assert.match(panel, /objectiveGap/u);
  assert.match(panel, /inputReceipt/u);
  assert.match(client, /\/api\/aethergrid\/quantum\/optimization\/local/u);
  assert.match(client, /interface LocalQuboResult/u);
  assert.doesNotMatch(client, /AETHERGRID_DWAVE_API_TOKEN|AETHERGRID_IBM_QUANTUM_API_KEY/u);
  assert.match(client, /export const DWAVE_ON_HOLD = true/u);
});
