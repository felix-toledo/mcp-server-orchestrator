import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  // Never lint build output or dependencies.
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.next/**', '**/.next-e2e/**', '**/next-env.d.ts'] },

  // Plain Node scripts (not part of the TS app) need Node globals declared —
  // TS files already get these from @types/node, but a .js/.mjs script does not.
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Recommended ESLint config
  eslint.configs.recommended,

  // Recommended typescript-eslint config
  ...tseslint.configs.recommended,

  // Project rules — see docs/conventions/naming.md for the prose version.
  {
    rules: {
      // Error on unused vars, but allow ignoring args with a leading "_"
      // (useful for e.g. (req, _res) => {} in Express).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        // Zod schema constants pair with an inferred type of the same name
        // minus "Schema" (e.g. `HelloWorldInputSchema` -> `HelloWorldInput`),
        // so they follow the type's PascalCase, not plain variable casing.
        // Must come before the generic 'variable' selector below.
        {
          selector: 'variable',
          filter: { regex: 'Schema$', match: true },
          format: ['PascalCase'],
        },
        // The ESM `const __filename = ...; const __dirname = ...` idiom —
        // leadingUnderscore only strips one underscore, so these need their
        // own exact-match exception.
        {
          selector: 'variable',
          filter: { regex: '^__(filename|dirname)$', match: true },
          format: null,
        },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        // React components (and Next.js's PascalCase page/layout exports)
        // — see docs/conventions/naming.md. Must come before the generic
        // 'function' selector below.
        {
          selector: 'function',
          filter: { regex: '^[A-Z]', match: true },
          format: ['PascalCase'],
        },
        {
          selector: 'function',
          format: ['camelCase'],
        },
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'typeLike', // class, interface, type, enum
          format: ['PascalCase'],
        },
      ],
      // Require a space after //
      'spaced-comment': ['error', 'always'],
      // Cap cyclomatic complexity to keep functions from growing unreadable
      complexity: ['warn', 10],
    },
  },

  // Source-only rules (tests may use console for debugging; a service's
  // index.ts may use it for startup/health logging — business logic in
  // services/tools should not).
  {
    files: ['src/**/*.ts'],
    ignores: ['**/*.test.ts', '**/index.ts'],
    rules: {
      'no-console': 'error',
    },
  },

  // MUST be last: disables ESLint rules that conflict with Prettier.
  prettierConfig,
);
