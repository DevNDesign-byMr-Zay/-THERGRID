import { readFileSync } from 'node:fs';

const sizeBudgets = JSON.parse(
  readFileSync(new URL('./config/file-size-budgets.json', import.meta.url), 'utf8'),
);

export default [
  {
    files: ['src/**/*.mjs', 'tests/**/*.mjs', 'scripts/**/*.mjs', 'apps/**/*.js', 'apps/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      'no-constant-condition': 'error',
      'no-debugger': 'error',
      'no-dupe-else-if': 'error',
      'no-duplicate-case': 'error',
      'no-empty-character-class': 'error',
      'no-ex-assign': 'error',
      'no-fallthrough': 'error',
      'no-irregular-whitespace': 'error',
      'no-self-assign': 'error',
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',
      'no-useless-catch': 'error',
      'valid-typeof': 'error',
    },
  },
  ...Object.entries(sizeBudgets)
    .filter(([path]) => /\.(?:js|mjs)$/u.test(path))
    .map(([path, max]) => ({
      files: [path],
      rules: { 'max-lines': ['error', { max, skipBlankLines: true, skipComments: true }] },
    })),
];
