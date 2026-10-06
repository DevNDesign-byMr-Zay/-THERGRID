import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSecretRedactor } from '../apps/aethergrid-console/security/secret-redactor.mjs';

test('live-smoke options match GitHub workflow choice options', () => {
  const workflowYaml = readFileSync('.github/workflows/aethergrid-live-provider-smoke.yml', 'utf8');
  const runnerScript = readFileSync('scripts/aethergrid-live-provider-smoke.mjs', 'utf8');

  const optionMatches = [...workflowYaml.matchAll(/^\s+-\s+([a-z0-9_-]+)$/gm)].map((m) => m[1]);
  assert.ok(optionMatches.length >= 15);

  for (const opt of optionMatches) {
    assert.ok(
      runnerScript.includes(`'${opt}'`),
      `Runner script missing support for workflow option '${opt}'`,
    );
  }
});

test('live-smoke workflow contains no quantum hardware submit path', () => {
  const workflowYaml = readFileSync('.github/workflows/aethergrid-live-provider-smoke.yml', 'utf8');
  assert.equal(workflowYaml.includes('submitSampler'), false);
  assert.equal(workflowYaml.includes('submitEstimator'), false);
  assert.equal(workflowYaml.includes('action: submit'), false);
  assert.equal(workflowYaml.includes('hardwareSubmitted: true'), false);
});

test('secret redactor sanitizes fake provider credentials and Bearer tokens', () => {
  const redactor = createSecretRedactor();
  redactor.addSecret('fake-groq-key-gsk_12345');
  redactor.addSecret('fake-transitland-key-tl_999');
  redactor.addSecret('fake-ibm-crn-123456789');

  const report = {
    provider: 'groq',
    apiKey: 'fake-groq-key-gsk_12345',
    token: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.secret',
    nested: {
      transitlandKey: 'fake-transitland-key-tl_999',
      serviceCrn: 'fake-ibm-crn-123456789',
    },
    message:
      'Error accessing https://api.example.com?api_key=fake-groq-key-gsk_12345 with Bearer abcdef123456',
  };

  const redacted = redactor.redactValue(report);

  assert.equal(redacted.apiKey, '[REDACTED_SECRET]');
  assert.equal(redacted.nested.transitlandKey, '[REDACTED_SECRET]');
  assert.equal(redacted.nested.serviceCrn, '[REDACTED_SECRET]');
  assert.equal(redacted.message.includes('fake-groq-key-gsk_12345'), false);
  assert.equal(redacted.message.includes('REDACTED'), true);
  assert.equal(redacted.token.includes('eyJhbGciOiJIUzI1NiI'), false);
});
