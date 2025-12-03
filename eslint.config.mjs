import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  // Configuración recomendada por ESLint
  eslint.configs.recommended,

  // Configuración recomendada por TypeScript-ESLint
  ...tseslint.configs.recommended,

  // Tu configuración personalizada (inspirada en el repo de MCP)
  {
    rules: {
      // Regla: Error si hay variables no usadas, pero permite ignorar argumentos con "_"
      // Ideal para casos como (req, _res) => {} en Express
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
        },
      ],
    },
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'variable',
        format: ['camelCase', 'UPPER_CASE'],
        leadingUnderscore: 'allow',
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
        selector: 'typeLike', // incl. class, interface, type, enum
        format: ['PascalCase'],
      },
    ],
    // Requiere un espacio después de //
    'spaced-comment': ['error', 'always'],

    // Limita la complejidad ciclomática para evitar funciones muy complejas
    complexity: ['warn', 10],
  },

  // Reglas específicas para tu código fuente
  {
    files: ['src/**/*.ts'],
    ignores: ['**/*.test.ts'], // Ignoramos los tests para esta regla
    rules: {
      // Regla: Error si se encuentran `console.log` en el código fuente
      'no-console': 'error',
    },
  },

  // ¡MUY IMPORTANTE! Esta debe ser la ÚLTIMA configuración.
  // Desactiva las reglas de ESLint que entran en conflicto con Prettier.
  prettierConfig,
);
