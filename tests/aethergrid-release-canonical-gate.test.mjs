import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const sha = 'a'.repeat(40);
const workflow = readFileSync('.github/workflows/release.yml', 'utf8');
const section = workflow
  .split('      - name: Require successful exact-SHA canonical live acceptance\n')[1]
  ?.split('\n      - name: ')[0];
assert.ok(section, 'canonical gate must exist');
const marker = '          script: |\n';
assert.ok(section.includes(marker), 'canonical gate must use github-script');
const gate = section
  .split(marker)[1]
  .split('\n')
  .filter((line) => line.startsWith('            '))
  .map((line) => line.slice(12))
  .join('\n');

function canonical(overrides = {}) {
  return {
    name: 'aethergrid/canonical-live',
    path: '.github/workflows/aethergrid-canonical-live.yml',
    head_branch: 'main',
    head_sha: sha,
    event: 'workflow_run',
    id: 12,
    run_number: 12,
    status: 'completed',
    conclusion: 'success',
    ...overrides,
  };
}

async function evaluate(pages, submittedSha = sha) {
  let calls = 0;
  const failures = [];
  const messages = [];
  await runInNewContext('(async () => {\n' + gate + '\n})()', {
    github: {
      rest: {
        actions: {
          listWorkflowRunsForRepo: async ({ head_sha }) => {
            assert.equal(head_sha, submittedSha);
            const workflow_runs = pages[Math.min(calls, pages.length - 1)];
            calls += 1;
            return { data: { workflow_runs } };
          },
        },
      },
    },
    context: { repo: { owner: 'test', repo: '-THERGRID' }, sha: submittedSha },
    core: {
      setFailed: (message) => failures.push(message),
      info: (message) => messages.push(message),
    },
    setTimeout: (callback) => callback(),
  });
  return { calls, failures, messages };
}

test('release accepts successful automatic canonical-live for its exact main SHA', async () => {
  const result = await evaluate([[canonical()]]);
  assert.deepEqual(result.failures, []);
  assert.equal(result.calls, 1);
});

test('release still accepts a successful manual exact-SHA canonical-live run', async () => {
  const result = await evaluate([[canonical({ event: 'workflow_dispatch' })]]);
  assert.deepEqual(result.failures, []);
});

test('release waits for the current canonical run to finish before accepting', async () => {
  const result = await evaluate([
    [canonical({ status: 'in_progress', conclusion: null })],
    [canonical()],
  ]);
  assert.deepEqual(result.failures, []);
  assert.equal(result.calls, 2);
});

test('release fails closed when latest exact-SHA canonical run failed', async () => {
  const result = await evaluate([
    [canonical({ id: 13, conclusion: 'failure' }), canonical({ id: 12 })],
  ]);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0], /canonical.*fail|failed.*canonical/i);
});

test('release rejects receipts from different SHAs or branches', async () => {
  const result = await evaluate([
    [canonical({ head_sha: 'b'.repeat(40) }), canonical({ head_branch: 'dev' })],
  ]);
  assert.equal(result.failures.length, 1);
});

test('release refuses to publish from superseded main', () => {
  assert.match(workflow, /name: Refuse superseded release main/u);
  assert.match(workflow, /git ls-remote origin refs\/heads\/main/u);
  assert.ok(
    workflow.lastIndexOf('Refuse superseded release main') <
      workflow.indexOf('Publish GitHub release'),
    'the exact-main check must precede release publication',
  );
});
