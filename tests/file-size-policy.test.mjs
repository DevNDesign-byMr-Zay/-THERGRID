import assert from 'node:assert/strict';
import test from 'node:test';

test('file-size policy ignores blank and comment-only lines while retaining comment markers inside strings', async () => {
  const { countCodeLines } = await import('../scripts/lib/file-size-policy.mjs');
  assert.equal(
    countCodeLines(
      '// note\n\n/* block\ncomment */\nconst text = "// still code";\nconst n = 1; // trailing comment\n',
    ),
    2,
  );
  assert.equal(countCodeLines('const text = `first\n\n// string content\nlast`;\n'), 3);
  assert.equal(
    countCodeLines('export const view = <div>\n  <span>Hello</span>\n</div>;\n', 'view.tsx'),
    3,
  );
});

test('file-size budgets reject growth and require retired exceptions to be removed', async () => {
  const { fileSizeViolation } = await import('../scripts/lib/file-size-policy.mjs');
  assert.equal(fileSizeViolation('new.ts', 501, {}), 'new.ts: 501 code lines exceed 500');
  assert.equal(fileSizeViolation('legacy.ts', 700, { 'legacy.ts': 700 }), null);
  assert.equal(
    fileSizeViolation('legacy.ts', 701, { 'legacy.ts': 700 }),
    'legacy.ts: 701 code lines exceed 700',
  );
  assert.equal(
    fileSizeViolation('legacy.ts', 500, { 'legacy.ts': 700 }),
    'legacy.ts: remove retired size exception',
  );
});
