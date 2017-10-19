import _ from 'lodash'
import express from 'express'
import Debug from 'debug'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'

import { sanitizer as Sanitizer } from 'overdosed-js'
import Util from './utils'
import { initMySQLPool } from './mysql'
import ContextWrapper from './server-context'

const sanitizer = Sanitizer()

export default function ODApp (config = {}) {
  const util = Util(config)
  const app = express()
  const expressMiddlewares = []
  const di = {
    options: Object.assign({
      MYSQL: {},
      COOKIE_SECRET: 'od-cookie-secret',
      ENABLE_CORS: false,
      MORGAN: '',
      BODY_PARSER_JSON_LIMIT: '1mb',
    }, config),
    express: app,
  }
  const debug = Debug('od::server')
  const paramError = util.paramError.bind(util)

  const ensureMethod = sanitizer.chain(
    sanitizer.trim(),
    sanitizer.pass(v => v.toLowerCase()),
    sanitizer.oneOf([ 'get', 'post', 'delete' ]),
    paramError('express method'),
  )
  const ensureURL = sanitizer.nonEmptyString(paramError('express url'))
  const ensureHandler =
    sanitizer.anyOf(
      sanitizer.ensure(s => _.isFunction(s), paramError('express handler')),
      sanitizer.ensure(s => _.isObject(s), paramError('express handler')),    // TODO: check handler definition
    )

  return Object.create(null, {
    di: {
      writable: false,
      configurable: true,
      value: di,
    },
    express: {
      writable: false,
      configurable: false,
      value: function (method, url, handler) {
        ensureMethod(method)
        ensureURL(url)
        ensureHandler(handler)
        expressMiddlewares.push([ method, url, handler ])
      },
    },
    run: {
      writable: false,
      configurable: false,
      value: async function ({ noListen = false } = {}) {
        const { options } = di

        //
        // Initialize MySQL
        //
        di.mysql = await initMySQLPool(options.MYSQL)

        //
        // Setup express
        //
        app.use(cookieParser(options.COOKIE_SECRET))
        if (options.ENABLE_CORS) {
          app.use(function (req, res, next) {
            res.header('Access-Control-Allow-Credentials', true)
            res.header('Access-Control-Allow-Origin', req.headers.origin)
            res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
            res.header('Access-Control-Allow-Headers', 'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, DeviceInfo, Authorization')
            next()
          })
        }

        options.MORGAN && app.use(morgan(options.MORGAN))
        app.use(bodyParser.json({ limit: options.BODY_PARSER_JSON_LIMIT }))
        app.use(bodyParser.urlencoded({ extended: true }))

        //
        // Initialize Context
        //
        const contextWrapper = ContextWrapper(options)

        expressMiddlewares.forEach(([ method, url, handler ]) => {
          app[ method ](url, contextWrapper.wrap(di, handler))
        })

        //
        // Mount final error logger
        //
        app.use(function (err, req, res, next) {
          if (err.handled) {
            // console.log(`Handler returned error : `, err)
            res.status(err.status).json({
              error: {
                message: err.message,
                code: err.code,
              },
            })
          } else {
            console.error(err.stack)
            res.status(500).json({ error: err.message })
          }
        })

        //
        // Start Listening
        //
        if (noListen) {
          return Promise.resolve()
        }
        return new Promise(resolve => app.listen(options.port || 8082, resolve))
      },
    },
    stop: {
      writable: false,
      configurable: false,
      value: async function () {
        await di.mysql.end()
      },
    },
  })
}

