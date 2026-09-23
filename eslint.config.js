export default [
  {
    files: ['src/**/*.mjs', 'tests/**/*.mjs', 'scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
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
];
