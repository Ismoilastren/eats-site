import baseConfig from '@repo/eslint-config/base.js';

export default [
  ...baseConfig,
  {
    ignores: [
      '.expo/',
      'babel.config.js',
      'dist/',
      'metro.config.js',
      'node_modules/',
      'tailwind.config.js',
    ],
  },
];
