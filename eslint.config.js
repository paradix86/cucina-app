import pluginVue from 'eslint-plugin-vue';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

const NO_HARDCODED_STORAGE_KEY = {
  selector: [
    "CallExpression",
    "[callee.type='MemberExpression']",
    "[callee.object.name=/^(localStorage|sessionStorage)$/]",
    "[callee.property.name=/^(getItem|setItem|removeItem)$/]",
    "[arguments.0.type='Literal']",
    "[arguments.0.value=/^cucina_/]",
  ].join(''),
  message:
    "Hardcoded 'cucina_*' storage key detected. Import the constant from src/lib/storageKeys.ts instead.",
};

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      globals: { ...globals.browser },
    },
    rules: {
      'no-restricted-syntax': ['error', NO_HARDCODED_STORAGE_KEY],
    },
  },
  {
    files: ['src/**/*.vue'],
    ...pluginVue.configs['flat/base'][1],
    languageOptions: {
      ...pluginVue.configs['flat/base'][1]?.languageOptions,
      globals: { ...globals.browser },
      parserOptions: {
        parser: tsParser,
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      'no-restricted-syntax': ['error', NO_HARDCODED_STORAGE_KEY],
    },
  },
  {
    files: ['src/lib/storageKeys.ts', 'tests/**/*.{js,ts}'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
];
