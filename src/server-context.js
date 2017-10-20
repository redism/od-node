/**
 *
 * Context to use from server handlers
 *
 **/
import { ensure, sanitizer, isObjectSanitizer, getSanitizerOptions } from 'overdosed-js'
import _ from 'lodash'
import Debug from 'debug'

function contexter (di, definition, options) {
  if (options.type !== 'express') { // we only support express node.js server for now.
    throw new Error(`Unknown type ${options.type}`)
  }

  const takeIf = (v, f) => (v === undefined ? f() : v)

  const contextPerDefinition = Object.create(null, {
    di: { configurable: false, writable: false, value: di },
    getMySQLConnection: {
      configurable: false,
      writable: false,
      value: () => di.mysql,
    },
    debug: {
      configurable: true, writable: false, value: Debug(`od:${definition.name}`)
    },
    ensure: { configurable: false, writable: false, value: ensure },
    getParam: {
      configurable: false,
      writable: false,
      value: function (keys) {
        if (_.isArray(keys)) {
          return keys.map(key => this.getParam(key))
        } else {
          return takeIf(this.express.req.params[ keys ],
            () => this.express.req.body[ keys ]
          )
        }
      }
    },
    getParamObject: {
      configurable: false,
      writable: false,
      value: function (keys) {
        const ret = {}
        let wrapper = v => v
        if (isObjectSanitizer(keys)) { // for convenience, if sanitizer.object is passed, use that.
          wrapper = keys
          keys = getSanitizerOptions(keys).keys
        }

        keys.forEach(k => {
          const v = this.getParam(k)
          if (v !== undefined) {
            ret[ k ] = v
          }
        })
        return wrapper(ret)
      }
    },
    getFiles: {
      configurable: false,
      writable: false,
      value: async function getFiles (keys) {
        if (!this.fileModuleInitialized) {
          ensure(definition.options.multer, 'multer not defined.')
          await new Promise((resolve, reject) => {
            definition.options.multer(this.express.req, this.express.res, err => {
              err ? reject(err) : resolve()
            })
          })
          this.fileModuleInitialized = true
        }

        if (_.isArray(keys)) {
          const files = await Promise.map(keys, key => this.getFiles(key))
          return files.map(v => _.isArray(v) ? v[ 0 ] : v)
        } else {
          return this.express.req.files[ keys ]
        }
      }
    },
    getSignedCookie: {
      configurable: false,
      writable: false,
      value: function (name) {
        return this.express.req.signedCookies[ name ]
      }
    },
    setSignedCookie: {
      configurable: false,
      writable: false,
      value: function (name, value) {
        this.express.res.cookie(name, value, { signed: true })
      }
    },
  })

  return function createContext (req, res) {
    return Object.create(contextPerDefinition, {
      fileModuleInitialized: { configurable: false, writable: true, value: false },
      express: {
        configurable: false,
        writable: false,
        value: { req, res }
      },
    })
  }
}

export function ContextWrapper (options = {}) {
  options = Object.assign({
    type: 'express',
  }, options)

  switch (options.type) {
    case 'express':
      return Object.create(null, {
        wrap: {
          writable: false,
          configurable: false,
          value: function (di, definition) {
            const createContextPerDefinition = contexter(di, definition, options)
            return function (req, res, next) {
              const context = createContextPerDefinition(req, res)
              Promise.resolve(definition.handler(context))
                .then(response => {
                  res.json({ data: response })
                }, ex => {
                  // check handled error here
                  // console.log(`Handler error`, ex) // TODO: 왜 default error handler 를 타지 않는가?
                  next(ex)
                })
                .finally(() => {
                  // run deferred here.
                })
            }
          },
        }
      })
    default:
      throw new Error(`Unknown context options.type = ${options.type}`)
  }
}
