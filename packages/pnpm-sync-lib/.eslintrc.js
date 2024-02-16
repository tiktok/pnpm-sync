require('@rushstack/eslint-patch/modern-module-resolution');
module.exports = {
  extends: ['@rushstack/eslint-config/profile/node'],
  parserOptions: { tsconfigRootDir: __dirname }
};
