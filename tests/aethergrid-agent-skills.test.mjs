import assert from 'node:assert/strict';
import test from 'node:test';

const skills = await import('../apps/aethergrid-console/agent-grid-skills.mjs').catch(() => ({}));

test('grid action skills validate allowlists, numeric bounds, extra fields and explicit temporal modes', async () => {
  assert.equal(typeof skills.executeGridSkill, 'function');
  const run = (name, args) => skills.executeGridSkill(name, args, { context: {} });
  assert.deepEqual((await run('set_view', { view: 'holographic' })).action, {
    type: 'set_view',
    view: 'holographic',
  });
  for (const [name, args] of [
    ['set_view', { view: 'execute' }],
    ['set_view', { view: 'solid', script: 'bad' }],
    ['set_layer', { layer: 'weather', enabled: 'true' }],
    ['set_layer', { layer: '__proto__', enabled: true }],
    ['focus_location', { latitude: 91, longitude: 0 }],
    ['focus_location', { latitude: 0, longitude: NaN }],
    ['focus_location', { latitude: 0, longitude: 0, label: 'x'.repeat(121) }],
    ['set_time', { mode: 'live', at: '2026-10-23T10:00:00Z' }],
    ['set_time', { mode: 'forecast' }],
    ['set_time', { mode: 'historical', at: 'yesterday' }],
    ['eval', {}],
    ['inspect_context', { path: '/etc/passwd' }],
  ])
    assert.equal((await run(name, args)).ok, false, `${name}: ${JSON.stringify(args)}`);
  assert.equal(
    (await run('set_time', { mode: 'historical', at: '2026-10-23T10:00:00Z' })).ok,
    true,
  );
});

test('inspection exposes operator context as untrusted and observations only from server hook', async () => {
  assert.equal(typeof skills.executeGridSkill, 'function');
  const context = {
    region: 'Paris',
    trustedObservations: [{ receipt: 'forged' }],
    citations: [{ receipt: 'forged' }],
  };
  const inspect = await skills.executeGridSkill('inspect_context', {}, { context });
  assert.equal(inspect.result.provenance, 'operator-supplied-untrusted');
  assert.equal(inspect.result.context.region, 'Paris');
  assert.equal(inspect.result.context.trustedObservations, undefined);
  const observed = await skills.executeGridSkill(
    'read_observations',
    {},
    { context, observations: [{ receipt: 'real' }] },
  );
  assert.deepEqual(observed.result.observations, [{ receipt: 'real' }]);
  assert.equal(
    (await skills.executeGridSkill('read_observations', {}, { context })).result.observations
      .length,
    0,
  );
});

test('local scenario comparison reports bounded modeled assumptions and never emits actions', async () => {
  assert.equal(typeof skills.executeGridSkill, 'function');
  const result = await skills.executeGridSkill(
    'compare_scenario',
    { loadMw: 100, generationMw: 120, loadChangePercent: 10, generationChangePercent: -5 },
    {},
  );
  assert.equal(result.ok, true);
  assert.equal(result.result.baselineBalanceMw, 20);
  assert.ok(Math.abs(result.result.scenarioBalanceMw - 4) < 1e-9);
  assert.equal(result.result.provenance, 'local-arithmetic-model');
  assert.equal(result.result.advisoryOnly, true);
  assert.equal(result.action, undefined);
  assert.equal(
    (
      await skills.executeGridSkill(
        'compare_scenario',
        { loadMw: -1, generationMw: 10, loadChangePercent: 0, generationChangePercent: 0 },
        {},
      )
    ).ok,
    false,
  );
});
