// Lint config (dev only): `npx eslint .`
const browser = {
  window: 'readonly', document: 'readonly', navigator: 'readonly', performance: 'readonly',
  requestAnimationFrame: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
  setInterval: 'readonly', clearInterval: 'readonly', localStorage: 'readonly', fetch: 'readonly',
  URLSearchParams: 'readonly', URL: 'readonly', console: 'readonly', caches: 'readonly', self: 'readonly',
};
const node = { require: 'readonly', process: 'readonly', __dirname: 'readonly', module: 'writable', console: 'readonly' };
const rules = {
  'no-undef': 'error',
  'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
  'no-redeclare': 'error',
  'no-dupe-keys': 'error',
  'no-unreachable': 'error',
  'no-constant-condition': ['error', { checkLoops: false }],
  eqeqeq: ['error', 'always'],
  'no-var': 'error',
  'prefer-const': 'error',
};
module.exports = [
  { files: ['src/**/*.js', 'sw.js'], languageOptions: { ecmaVersion: 2020, sourceType: 'script', globals: browser }, rules },
  { files: ['tools/**/*.js', 'eslint.config.js'], languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: Object.assign({}, node, { GR: 'readonly', document: 'readonly', navigator: 'readonly', localStorage: 'readonly', performance: 'readonly', requestAnimationFrame: 'readonly', window: 'writable' }) }, rules },
];
