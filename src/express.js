import express from 'express'
import Debug from 'debug'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'

import Util from './utils'
import { initMySQLPool } from './mysql'
import { ContextWrapper } from './server-context'
import { handlerDefiner } from './handler'

export default function ODApp (config = {}) {
  const util = Util(config)
  const app = express()
  const handlerDefinitions = []
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

  const debug = Debug('od:ODApp')
  const paramError = util.paramError.bind(util)
  const defineHandler = handlerDefiner(config)

  return Object.create(null, {
    di: {
      writable: false,
      configurable: true,
      value: di,
    },
    defineHandler: {
      writable: false,
      configurable: false,
      value: function (name, cb) {
        const definer = defineHandler(name)
        cb(definer)
        handlerDefinitions.push(definer.build())
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

        handlerDefinitions.forEach(definition => {
          const { endpoint: { url, method }, name } = definition
          debug(`Mounting ${name} for [${method}] ${url}`)
          app[ method ](url, contextWrapper.wrap(di, definition))
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
