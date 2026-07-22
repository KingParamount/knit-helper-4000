import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'reference/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // An underscore prefix marks a binding that is deliberately unused: a parameter kept
    // to satisfy a shared interface (the prose Vocab members that a given register
    // ignores), a positional argument before one that is used, or a caught error we do
    // not inspect. This is the convention already used throughout the code.
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    // Architecture rule #1 (CLAUDE.md): the engine is pure — zero I/O, no DOM,
    // no React, and it must not depend on the app. Enforced here so a stray
    // import fails lint rather than being caught in review.
    files: ['packages/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'The engine must not import React.' },
            { name: 'react-dom', message: 'The engine must not import React.' },
          ],
          patterns: [
            {
              group: ['@knit-helper-4000/app', '@knit-helper-4000/app/*'],
              message: 'The engine must not depend on the app.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'Engine is pure: no DOM.' },
        { name: 'document', message: 'Engine is pure: no DOM.' },
        { name: 'fetch', message: 'Engine is pure: no network I/O.' },
        { name: 'localStorage', message: 'Engine is pure: no storage.' },
      ],
    },
  },
);
