module.exports = {
  root: true,
  extends: [require.resolve('@ciolabs/config-eslint/node')],
  ignorePatterns: ['node_modules/', 'dist/', 'packages/*/node_modules/', 'packages/*/dist/'],
};
