import assert from 'node:assert/strict';
import test from 'node:test';
import * as acceptance from '../scripts/lib/canonical-acceptance.mjs';

const response = {
  reply: 'Switched the spatial view.',
  receipt: 'a'.repeat(64),
  runtime: {
    provider: 'openai-compatible',
    model: 'openai/gpt-oss-20b',
    fallbackUsed: false,
    providerRequestId: 'req-1',
  },
  actions: [{ type: 'set_view', view: 'grid' }],
  toolResults: [
    {
      tool: 'set_view',
      readOnly: false,
      count: 1,
      ok: true,
      modelSelected: true,
      action: { type: 'set_view', view: 'grid' },
    },
  ],
};
test('protected skill proof requires inference receipt and matching typed action', () => {
  assert.equal(typeof acceptance.summarizeGridSkill, 'function');
  const { summarizeGridSkill } = acceptance;
  const expected = { type: 'set_view', view: 'grid' };
  assert.equal(summarizeGridSkill(response, 'AUREN', expected).verified, true);
  for (const invalid of [
    { ...response, receipt: '' },
    { ...response, runtime: { ...response.runtime, providerRequestId: null } },
    { ...response, actions: [] },
    { ...response, toolResults: [{ tool: 'set_view', readOnly: false, count: 1, ok: false }] },
    { ...response, actions: [{ type: 'set_view', view: 'quantum' }] },
    { ...response, runtime: { ...response.runtime, fallbackUsed: true } },
  ])
    assert.equal(summarizeGridSkill(invalid, 'AUREN', expected).verified, false);
  assert.equal(
    summarizeGridSkill({ ...response, toolResults: [] }, 'AUREN', expected).verified,
    false,
  );
});

test('protected TEAM skill proof requires synthesis action and every distinct successful specialist', () => {
  const team = {
    ...response,
    contributions: ['VÆLON', 'AUREN', 'SOLVÆR'].map((agent) => ({ ...response, agent })),
  };
  const expected = { type: 'set_view', view: 'grid' };
  assert.equal(acceptance.summarizeGridSkill(team, 'TEAM', expected).verified, true);
  assert.equal(
    acceptance.summarizeGridSkill({ ...team, actions: [] }, 'TEAM', expected).verified,
    false,
  );
  assert.equal(
    acceptance.summarizeGridSkill(
      { ...team, contributions: team.contributions.slice(0, 2) },
      'TEAM',
      expected,
    ).verified,
    false,
  );
  assert.equal(
    acceptance.summarizeGridSkill(
      {
        ...team,
        contributions: team.contributions.map((item, i) =>
          i ? item : { ...item, runtime: { ...item.runtime, fallbackUsed: true } },
        ),
      },
      'TEAM',
      expected,
    ).verified,
    false,
  );
});
