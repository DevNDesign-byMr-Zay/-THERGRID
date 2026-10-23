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

test('failed TEAM proof retains bounded failure categories for each contribution without raw errors', () => {
  const failed = {
    ...response,
    runtime: {
      ...response.runtime,
      fallbackUsed: true,
      executionStatus: 'cooldown',
      error: 'provider returned HTTP 429',
      retryAfterSeconds: 17,
      rateLimit: { 'x-ratelimit-remaining-tokens': '25' },
    },
  };
  const result = acceptance.summarizeGridSkill(
    {
      ...failed,
      contributions: ['VÆLON', 'AUREN', 'SOLVÆR'].map((agent) => ({ ...failed, agent })),
    },
    'TEAM',
    { type: 'set_view', view: 'grid' },
  );
  assert.equal(result.verified, false);
  for (const item of [result, ...result.contributions]) {
    assert.equal(item.executionStatus, 'cooldown');
    assert.equal(item.failureCategory, 'provider-http');
    assert.equal(item.providerStatus, 429);
    assert.equal(item.retryAfterSeconds, 17);
    assert.equal(item.remainingTokens, 25);
    assert.equal(Object.hasOwn(item, 'error'), false);
  }
  const unsafe = acceptance.summarizeAgent(
    {
      ...failed,
      runtime: {
        ...failed.runtime,
        executionStatus: 'private-value',
        error: 'private-upstream-value',
        retryAfterSeconds: Infinity,
        rateLimit: { 'x-ratelimit-remaining-tokens': 'private-header' },
      },
    },
    'AUREN',
  );
  assert.equal(unsafe.failureCategory, 'runtime-error');
  assert.equal(unsafe.executionStatus, 'unknown');
  assert.equal(unsafe.retryAfterSeconds, null);
  assert.equal(unsafe.remainingTokens, null);
  assert.doesNotMatch(JSON.stringify(unsafe), /private-/);
});
