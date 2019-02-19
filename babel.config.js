module.exports = function (api) {
  api.cache(true)

  const ignore = [
    'node_modules', 'babel.config.js', /package*.json/, 'npm-debug.log',
  ]

  const presets = [
    [
      '@babel/env',
      {
        targets: { node: true },
      },
    ],
  ]

  const plugins = [
    'babel-plugin-transform-promise-to-bluebird',

    // Stage 2
    [ '@babel/plugin-proposal-decorators', { legacy: true } ],
    '@babel/plugin-proposal-function-sent',
    '@babel/plugin-proposal-export-namespace-from',
    '@babel/plugin-proposal-numeric-separator',
    '@babel/plugin-proposal-throw-expressions',

    // Stage 3
    '@babel/plugin-syntax-dynamic-import',
    '@babel/plugin-syntax-import-meta',
    [ '@babel/plugin-proposal-class-properties', { loose: false } ],
    '@babel/plugin-proposal-json-strings',
  ]

  return { presets, plugins, ignore }
}
