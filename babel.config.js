module.exports = function(api) {
  api.cache(true)

  const ignore = ['node_modules', 'babel.config.js', /package*.json/, 'npm-debug.log']

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
    ['@babel/plugin-proposal-class-properties', { loose: false }], // https://babeljs.io/docs/en/babel-plugin-proposal-class-properties
    ['@babel/plugin-proposal-decorators', { legacy: true }], // https://babeljs.io/docs/en/babel-plugin-proposal-class-properties
    '@babel/plugin-proposal-do-expressions', // https://babeljs.io/docs/en/babel-plugin-proposal-do-expressions
    '@babel/plugin-proposal-function-bind', // https://babeljs.io/docs/en/babel-plugin-proposal-function-bind
    '@babel/plugin-proposal-function-sent', // https://babeljs.io/docs/en/babel-plugin-proposal-function-sent
    '@babel/plugin-proposal-logical-assignment-operators', // https://babeljs.io/docs/en/babel-plugin-proposal-logical-assignment-operators
    '@babel/plugin-proposal-nullish-coalescing-operator', // https://babeljs.io/docs/en/babel-plugin-proposal-nullish-coalescing-operator
    '@babel/plugin-proposal-numeric-separator', // https://babeljs.io/docs/en/babel-plugin-proposal-numeric-separator
    '@babel/plugin-proposal-optional-chaining', // https://babeljs.io/docs/en/babel-plugin-proposal-optional-chaining
    ['@babel/plugin-proposal-pipeline-operator', { proposal: 'minimal' }], // https://babeljs.io/docs/en/babel-plugin-proposal-pipeline-operator
    '@babel/plugin-proposal-throw-expressions', // https://babeljs.io/docs/en/babel-plugin-proposal-throw-expressions
    '@babel/plugin-syntax-dynamic-import', // https://babeljs.io/docs/en/babel-plugin-syntax-dynamic-import
    '@babel/plugin-syntax-import-meta', // https://github.com/tc39/proposal-import-meta
    '@babel/plugin-proposal-json-strings', // https://github.com/babel/website/blob/master/docs/plugin-proposal-json-strings.md
  ]

  return { presets, plugins, ignore }
}
