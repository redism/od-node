/* eslint-disable no-underscore-dangle */
import btoa from 'btoa'
import Debug from 'debug'
import _ from 'lodash'
/**
 *
 * Context to use from server handlers
 *
 * */
import { ensure, getSanitizerOptions, isObjectSanitizer } from 'od-js'

function b64EncodeUnicode(str) {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function charFrom(match, p1) {
      return String.fromCharCode(parseInt(p1, 16))
    })
  )
}

function contexter(di, definition, options) {
  if (options.type !== 'express') {
    // we only support express node.js server for now.
    throw new Error(`Unknown type ${options.type}`)
  }

  const takeIf = (v, f) => (v === undefined ? f() : v)

  const contextPerDefinition = Object.create(null, {
    di: { configurable: false, writable: false, value: di },
    _deferred: { configurable: false, writable: true, value: [] },
    defer: {
      configurable: false,
      writable: false,
      value(task) {
        this._deferred.push(task)
      },
    },
    getMySQLConnection: {
      configurable: false,
      writable: false,
      value: () => di.mysql,
    },
    debug: {
      configurable: true,
      writable: false,
      value: Debug(`od:${definition.name}`),
    },
    ensure: { configurable: false, writable: false, value: ensure },
    getParam: {
      configurable: false,
      writable: false,
      value(keys) {
        if (_.isArray(keys)) {
          return keys.map(key => this.getParam(key))
        }
        return takeIf(this.express.req.params[keys], () =>
          takeIf(this.express.req.body[keys], () => this.express.req.query[keys])
        )
      },
    },
    getParamObject: {
      configurable: false,
      writable: false,
      value(keys) {
        const ret = {}
        let wrapper = v => v
        if (isObjectSanitizer(keys)) {
          // for convenience, if sanitizer.object is passed, use that.
          wrapper = keys
          // eslint-disable-next-line no-param-reassign,prefer-destructuring
          keys = getSanitizerOptions(keys).keys
        }

        keys.forEach(k => {
          const v = this.getParam(k)
          if (v !== undefined) {
            ret[k] = v
          }
        })
        return wrapper(ret)
      },
    },
    getFiles: {
      configurable: false,
      writable: false,
      value: async function getFiles(keys) {
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
          return files.map(v => (_.isArray(v) ? v[0] : v))
        }
        return this.express.req.files ? this.express.req.files[keys] : undefined
      },
    },
    sendFileFromMemory: {
      configurable: false,
      writable: false,
      value: async function sendFileFromMemory(fileName, contentType, data) {
        const { res } = this.express
        const base64Encoded = b64EncodeUnicode(data)
        const contents = Buffer.from(base64Encoded, 'base64')

        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`)
        res.setHeader('Content-Type', contentType)
        return res.status(200).send(contents)
      },
    },
    getSignedCookie: {
      configurable: false,
      writable: false,
      value(name) {
        return this.express.req.signedCookies[name]
      },
    },
    setSignedCookie: {
      configurable: false,
      writable: false,
      value(name, value) {
        this.express.res.cookie(name, value, { signed: true })
      },
    },
  })

  return function createContext(req, res) {
    return Object.create(contextPerDefinition, {
      fileModuleInitialized: { configurable: false, writable: true, value: false },
      express: {
        configurable: false,
        writable: false,
        value: { req, res },
      },
    })
  }
}

export function ContextWrapper(options = {}) {
  // eslint-disable-next-line no-param-reassign
  options = Object.assign(
    {
      type: 'express',
    },
    options
  )

  switch (options.type) {
    case 'express':
      return Object.create(null, {
        wrap: {
          writable: false,
          configurable: false,
          value(di, definition) {
            const createContextPerDefinition = contexter(di, definition, options)
            return function wrappedHandler(req, res, next) {
              const context = createContextPerDefinition(req, res)
              Promise.resolve(definition.handler(context))
                .then(
                  response => {
                    if (!res.headersSent) {
                      res.json({ data: response })
                    }
                  },
                  ex => {
                    // check handled error here
                    // console.log(`Handler error`, ex) // TODO: 왜 default error handler 를 타지 않는가?
                    next(ex)
                  }
                )
                .finally(async () => {
                  // run deferred tasks.
                  for (let i = 0; i < context._deferred.length; i += 1) {
                    try {
                      // eslint-disable-next-line no-await-in-loop
                      await Promise.resolve(context._deferred[i]())
                    } catch (ex) {
                      console.error(ex)
                    }
                  }
                })
            }
          },
        },
      })
    default:
      throw new Error(`Unknown context options.type = ${options.type}`)
  }
}
