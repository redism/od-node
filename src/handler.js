export function handlerDefiner (options) {
  return function defineHandler (name) {
    const d = {
      name,
      handler: null,
      options: {},
      endpoint: {},
    }

    return Object.create(null, {
      name: {
        configurable: false,
        writable: false,
        value: function (v) {
          d.name = v
          return this
        }
      },
      handler: {
        configurable: false,
        writable: false,
        value: function (v) {
          d.handler = v
          return this
        }
      },
      multer: {
        configurable: false,
        writable: false,
        value: function (v) {
          d.options.multer = v
          return this
        }
      },
      endpoint: {
        configurable: false,
        writable: false,
        value: function (method, url) {
          d.endpoint = { method, url }
          return this
        }
      },
      build: {
        configurable: false,
        writable: false,
        value: () => d,
      },
    })
  }
}
