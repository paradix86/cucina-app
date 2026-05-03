export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
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
        'build',
        'e2e',
        'smoke',
      ],
    ],
    'subject-case': [0],
    'body-max-line-length': [2, 'always', 200],
  },
};
