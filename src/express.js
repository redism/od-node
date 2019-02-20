import bodyParser from 'body-parser'
import cookieParser from 'cookie-parser'
import Debug from 'debug'
import express from 'express'
import http from 'http'
import morgan from 'morgan'
import { handlerDefiner } from './handler'

import { initMySQLPool } from './mysql'
import { ContextWrapper } from './server-context'
import { storageDefiner } from './storage/definition'

export default function ODApp(config = {}) {
  const app = express()
  const httpServer = http.createServer(app)
  const handlerDefinitions = []
  const storageDefinitions = []
  const initializations = []
  const di = {
    options: Object.assign(
      {
        PORT: 8082,
        MYSQL: {},
        COOKIE_SECRET: 'od-cookie-secret',
        ENABLE_CORS: false,
        MORGAN: '',
        BODY_PARSER_JSON_LIMIT: '1mb',
        STORAGE: {},
      },
      config
    ),
    express: app,
    httpServer,
    storage: {}, // name - driver pair
  }

  const debug = Debug('od:ODApp')
  const defineHandler = handlerDefiner(di.options)
  const defineStorage = storageDefiner(di.options.STORAGE)

  return Object.create(null, {
    addInit: {
      writable: false,
      configurable: true,
      value(initCode) {
        initializations.push(() => Promise.resolve(initCode()))
      },
    },
    di: {
      writable: false,
      configurable: true,
      value: di,
    },
    defineHandler: {
      writable: false,
      configurable: false,
      value(name, cb) {
        const definer = defineHandler(name)
        cb(definer)
        handlerDefinitions.push(definer.build())
      },
    },
    defineStorage: {
      writable: false,
      configurable: true,
      value(name, cb) {
        const definer = defineStorage(name)
        cb && cb(definer)
        storageDefinitions.push(definer.build())
      },
    },
    run: {
      writable: false,
      configurable: false,
      async value({ noListen = false } = {}) {
        const { options } = di

        //
        // Initialize MySQL
        //
        if (options.MYSQL) {
          di.mysql = await initMySQLPool(options.MYSQL)
        }

        //
        // Setup express
        //
        app.use(cookieParser(options.COOKIE_SECRET))
        if (options.ENABLE_CORS) {
          app.use(function corsHandler(req, res, next) {
            res.header('Access-Control-Allow-Credentials', true)
            res.header('Access-Control-Allow-Origin', req.headers.origin)
            res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
            res.header(
              'Access-Control-Allow-Headers',
              'X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept, DeviceInfo, Authorization'
            )
            next()
          })
        }

        options.MORGAN && app.use(morgan(options.MORGAN))
        app.use(bodyParser.json({ limit: options.BODY_PARSER_JSON_LIMIT }))
        app.use(bodyParser.urlencoded({ extended: true }))

        //
        // Initialize Storage
        //
        await Promise.map(storageDefinitions, definition => {
          const { name, driver } = definition
          debug(`Initializing storage driver for ${name}`)
          di.storage[name] = driver
          return driver.init()
        })

        //
        // Initialize Context
        //
        const contextWrapper = ContextWrapper(options)

        if (this.initServer) {
          await this.initServer()
        }

        handlerDefinitions.forEach(definition => {
          const {
            endpoint: { url, method },
            name,
          } = definition
          debug(`Mounting ${name} for [${method}] ${url}`)
          app[method](url, contextWrapper.wrap(di, definition))
        })

        if (this.afterHandlerMounted) {
          await this.afterHandlerMounted()
        }

        //
        // Mount final error logger
        //
        // eslint-disable-next-line no-unused-vars
        app.use(function errorHandler(err, req, res, next) {
          di.onError && di.onError(err)
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
        // Initialization routines
        //
        for (let i = 0; i < initializations.length; i += 1) {
          // eslint-disable-next-line no-await-in-loop
          await initializations[i]()
        }

        //
        // Start Listening
        //
        if (noListen) {
          return Promise.resolve()
        }
        return new Promise(resolve => httpServer.listen(options.PORT || 8082, resolve))
      },
    },
    stop: {
      writable: false,
      configurable: false,
      async value() {
        await di.mysql.end()
      },
    },
  })
}
