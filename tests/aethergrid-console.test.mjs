import assert from 'node:assert/strict';
import test from 'node:test';

import { server, state } from '../apps/aethergrid-console/server.mjs';

async function withServer(run) {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test('ÆTHERGRID serves the approved interactive dashboard shell', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /dashboard-reference\.webp/u);
    assert.match(html, /data-action="run-optimization"/u);
    assert.match(html, /data-action="ai-chat"/u);
    assert.match(html, /data-action="export-operator"/u);
  });
});

test('ÆTHERGRID backend exposes bounded state and evidence APIs', async () => {
  await withServer(async (baseUrl) => {
    const stateResponse = await fetch(`${baseUrl}/api/aethergrid/state`);
    assert.equal(stateResponse.status, 200);
    const payload = await stateResponse.json();
    assert.equal(payload.system.mode, 'ADVISORY ONLY');
    assert.equal(payload.system.physicalActuation, false);
    assert.equal(payload.system.infrastructureDispatch, false);
    assert.deepEqual(Object.keys(payload.agents), ['VÆLON', 'AUREN', 'SOLVÆR']);

    const evidenceResponse = await fetch(`${baseUrl}/api/aethergrid/evidence`);
    assert.equal(evidenceResponse.status, 200);
    const evidence = await evidenceResponse.json();
    assert.ok(evidence.evidence.length >= 4);
    assert.ok(evidence.evidence.every((item) => item.status === 'VERIFIED'));
  });
});

test('ÆTHERGRID optimization creates a receipt without actuation authority', async () => {
  const priorRuns = state.optimization.runCount;
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/aethergrid/optimize`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ objective: 'minimize_cost_emissions' }),
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.status, 'completed');
    assert.equal(payload.advisoryOnly, true);
    assert.equal(payload.classicalBaselineRequired, true);
    assert.match(payload.receipt, /^[a-f0-9]{64}$/u);
    assert.equal(state.optimization.runCount, priorRuns + 1);
  });
});

test('ÆTHERGRID AI collaboration and export are functional', async () => {
  await withServer(async (baseUrl) => {
    const chat = await fetch(`${baseUrl}/api/aethergrid/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'How should we optimize renewable cost?' }),
    });
    assert.equal(chat.status, 200);
    const answer = await chat.json();
    assert.match(answer.reply, /VÆLON/u);
    assert.equal(answer.advisoryOnly, true);

    const exported = await fetch(`${baseUrl}/api/aethergrid/export`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'operator-report' }),
    });
    assert.equal(exported.status, 200);
    const receipt = await exported.json();
    assert.match(receipt.receipt, /^[a-f0-9]{64}$/u);
    assert.equal(receipt.advisoryOnly, true);
  });
});