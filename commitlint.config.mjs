export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      1,
      'always',
      [
        'recipe',
        'import',
        'nutrition',
        'cooking',
        'timer',
        'planner',
        'composer',
        'pwa',
        'i18n',
        'storage',
        'ui',
        'deps',
        'release',
      ],
    ],
    'subject-case': [0],
    'body-max-line-length': [2, 'always', 200],
  },
};
