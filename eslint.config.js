// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/**', 'coverage/**', 'android/**', 'ios/**', '.agents/**', '.codex/**', '.expo/**'],
  },
  {
    settings: {
      'import/resolver': {
        typescript: { project: './jsconfig.json' },
      },
    },
  },
  {
    files: ['*.config.js', 'scripts/**/*.cjs'],
    languageOptions: {
      globals: { __dirname: 'readonly', Buffer: 'readonly' },
    },
  },
]);
