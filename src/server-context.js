/**
 *
 * Context to use from server handlers
 *
 **/
import { ensure } from 'overdosed-js'
import _ from 'lodash'

// function createContext (usingMySQLPool) {
//   const deferred = []
//
//   function defer (fn) {
//     deferred.push(fn)
//   }
//
//   async function runDeferred () {
//     for (const index in deferred) {
//       try {
//         await Promise.resolve(deferred[ index ]())
//       } catch (ex) {
//         console.error(`Error during running deferred.`)
//         console.error(ex)
//       }
//     }
//   }
//
//   if (usingMySQLPool) {
//     return {
//       defer,
//       runDeferred,
//       getMySQLConnection,
//     }
//   }
//
//   return {
//     defer,
//     runDeferred,
//     getMySQLConnection: (options) => {
//       const conn = getMySQLConnection(options)
//       defer(() => {conn.end()})
//       return conn
//     }
//   }
// }

function contexter (options) {
  if (options.type !== 'express') { // we only support express node.js server for now.
    throw new Error(`Unknown type ${options.type}`)
  }

  const takeIf = (v, f) => (v === undefined ? f() : v)

  return function (di, handlerOptions = {}, req, res) {
    let fileModuleInitialized = false
    return Object.create({}, {
      di: { configurable: false, writable: false, value: di },
      getMySQLConnection: {
        configurable: false,
        writable: false,
        value: () => di.mysql,
      },
      ensure: { configurable: false, writable: false, value: ensure },
      getParam: {
        configurable: false,
        writable: false,
        value: function (keys) {
          if (_.isArray(keys)) {
            return keys.map(key => this.getParam(key))
          } else {
            return takeIf(req.params[ keys ],
              () => req.body[ keys ]
            )
          }
        }
      },
      getParamObject: {
        configurable: false,
        writable: false,
        value: function (keys) {
          const ret = {}
          keys.forEach(k => {
            const v = this.getParam(k)
            if (v !== undefined) {
              ret[ k ] = v
            }
          })
          return ret
        }
      },
      getFiles: {
        configurable: false,
        writable: false,
        value: async function getFiles (keys) {
          if (!fileModuleInitialized) {
            ensure(handlerOptions.multer, 'multer not defined.')
            await new Promise((resolve, reject) => {
              handlerOptions.multer(req, res, err => {
                err ? reject(err) : resolve()
              })
            })
            fileModuleInitialized = true
          }

          if (_.isArray(keys)) {
            const files = await Promise.map(keys, key => this.getFiles(key))
            return files.map(v => _.isArray(v) ? v[ 0 ] : v)
          } else {
            return req.files[ keys ]
          }
        }
      },
      getSignedCookie: {
        configurable: false,
        writable: false,
        value: name => req.signedCookies[ name ],
      },
      setSignedCookie: {
        configurable: false,
        writable: false,
        value: (name, value) => res.cookie(name, value, { signed: true }),
      },
    })
  }
}

export default function ContextWrapper (options = {}) {
  options = Object.assign({
    type: 'express',
  }, options)

  const createContext = contexter(options)

  // TODO: refactor with strict type?
  const isHandlerDefinition = obj => {
    return _.isObject(obj) && _.isFunction(obj.handler)
  }

  switch (options.type) {
    case 'express':
      return Object.create(null, {
        wrap: {
          writable: false,
          configurable: false,
          value: function (di, _handler) {
            let handler, handlerOptions = {}
            if (isHandlerDefinition(_handler)) {
              handler = _handler.handler
              handlerOptions = _handler.options
            } else {
              handler = _handler
            }

            return function (req, res, next) {
              const context = createContext(di, handlerOptions, req, res)
              Promise.resolve(handler(context))
                .then(response => {
                  res.json({ data: response })
                }, ex => {
                  // check handled error here
                  // console.log(156, ex) // TODO: 왜 default error handler 를 타지 않는가?
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
