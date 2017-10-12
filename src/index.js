const mysql = require('mysql')
const bcrypt = require('bcryptjs')
const Knex = require('knex')
const knex = Knex({ client: 'mysql' }) // use only for query-builder
const fs = require('fs')
const moment = require('moment')
import jwt from 'jsonwebtoken'
import { sanitizer, ensure } from './param'

/**
 * Returns MySQL connection, and inject promise-version of query function.
 *
 * @param [options] {Object} if omitted, try to read from environment variable.
 *
 * {
 *   host: 'gameberrycashbackdb.cgta6qz5w1ey.us-east-1.rds.amazonaws.com',
 *   user: 'user',
 *   password: 'password',
 *   port: 3306,
 *   database: 'gcb',
 *   debug: false
 * }
 * @return {Connection}
 */
function getMySQLConnection (options) {
  if (options === undefined || options === null) {
    if (getMySQLConnection.options) {
      options = getMySQLConnection.options
    } else {
      options = {
        host: process.env.mysql_host,
        user: process.env.mysql_user,
        password: process.env.mysql_password,
        port: parseInt(process.env.mysql_port, 10),
        database: process.env.mysql_database,
        debug: parseInt(process.env.mysql_debug, 10) === 1,
      }
    }
  }

  const conn = mysql.createConnection(options)

  const orgQuery = conn.query.bind(conn)
  conn.query = function (query) {
    return new Promise((resolve, reject) => {
      orgQuery(query, (err, res) => {
        err ? reject(err) : resolve(res)
      })
    })
  }
  return conn
}

/**
 * Inject options before calling getMySQLConnection.
 *
 * @param options {object}
 */
getMySQLConnection.setOptions = function (options) {
  getMySQLConnection.options = options
}

/**
 * bcryptjs 를 이용하여 salted password 를 생성한다.
 *
 * @param pw {string}
 * @param iteration {number=10}
 * @return {Promise}
 */
async function genSaltedPassword (pw, iteration = 10) {
  return new Promise((resolve, reject) => {
    bcrypt.genSalt(iteration, (err, salt) => {
      if (err) {
        reject(err)
      } else {
        bcrypt.hash(pw, salt, (err, salted) => {
          if (err) {
            reject(err)
          } else {
            resolve(salted)
          }
        })
      }
    })
  })
}

/**
 * Check if given {pw} matches salted password {salted}
 * @param pw {string}
 * @param salted {string}
 * @return {Promise<Boolean>}
 */
async function checkSaltedPassword (pw, salted) {
  return new Promise((resolve, reject) => {
    bcrypt.compare(pw, salted, (err, res) => {err ? reject(err) : resolve(res)})
  })
}

/**
 * Create Json Web Token
 *
 * @param secret {string}
 * @param data {object}
 * @return {Promise}
 */
async function encodeJWTToken (secret, data) {
  return new Promise((resolve, reject) => {
    jwt.sign(data, secret, { algorithm: 'HS256' }, (err, res) => {
      if (err) {
        console.error(64, 'Generating jwt.Token failed!!')
        console.error(err)
        reject(err)
      } else {
        resolve(res)
      }
    })
  })
}

/**
 * Verify JWT token and resolve decoded data.
 *
 * @param secret {string}
 * @param token {string}
 * @return {Promise<Object>}
 */
async function decodeJWTToken (secret, token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, secret, (err, res) => {
      err ? reject(err) : resolve(res)
    })
  })
}

const jwtUtil = {
  encode: encodeJWTToken,
  decode: decodeJWTToken,
}

function createContext () {
  const deferred = []

  function defer (fn) {
    deferred.push(fn)
  }

  async function runDeferred () {
    for (const index in deferred) {
      try {
        await Promise.resolve(deferred[ index ]())
      } catch (ex) {
        console.error(`Error during running deferred.`)
        console.error(ex)
      }
    }
  }

  return {
    defer,
    runDeferred,
    getMySQLConnection: (options) => {
      const conn = getMySQLConnection(options)
      defer(() => {conn.end()})
      return conn
    }
  }
}

function NIY (name) {
  throw new Error(`${name} NIY.`)
}

function runInLambdaContext (runLogic, e, ctx, cb) {
  const context = createContext()
  context.getSignedCookie = name => NIY('runInLambdaContext.getSignedCookie')
  runLogic(context)
    .then(res => cb(null, { data: res }), err => cb(err, null))
    .finally(() => { return context.runDeferred() })
}

function runInExpressContext (runLogic, req, res, next) {
  const context = createContext()
  context.express = { req, res }

  // TODO: extract these out.
  context.getSignedCookie = name => req.signedCookies[ name ]
  context.setSignedCookie = (name, value) => res.cookie(name, value, { signed: true })
  context.requestBody = req.body
  context.ensure = ensure
  context.sanitizer = sanitizer({ defError: ({ value }) => `Invalid param with value : ${value}` })

  runLogic(context)
    .then(ret => res.json({ data: ret }), next)
    .finally(() => { return context.runDeferred() })
}

function runInTestContext (mod) {
  return async () => {
    const context = createContext()
    return mod.runLogic(context)
      .finally(() => { return context.runDeferred() })
  }
}

/**
 * 파일 복사를 수행합니다.
 *
 * @param oldPath {string}
 * @param newPath {string}
 * @return {Promise}
 */
function copyFile (oldPath, newPath) {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(oldPath);
    const writeStream = fs.createWriteStream(newPath);

    readStream.on('error', reject)
    writeStream.on('error', reject)

    readStream.on('close', function () {
      fs.unlink(oldPath, resolve)
    });

    readStream.pipe(writeStream)
  })
}

/**
 * 파일을 이동합니다. 만약 실패할 경우 복사를 수행합니다.
 *
 * @param oldPath {string}
 * @param newPath {string}
 * @return {Promise}
 */
function moveFile (oldPath, newPath) {
  return new Promise((resolve, reject) => {
    fs.rename(oldPath, newPath, function (err) {
      if (err) {
        if (err.code === 'EXDEV') {
          resolve(copyFile(oldPath, newPath))
        } else {
          reject(err)
        }
      }
      resolve()
    })
  })
}

module.exports = exports = {
  getMySQLConnection: getMySQLConnection,
  genSaltedPassword: genSaltedPassword,
  checkSaltedPassword: checkSaltedPassword,
  knex: knex,
  Knex: Knex,
  runInLambdaContext: runInLambdaContext,
  runInExpressContext: runInExpressContext,
  runInTestContext: runInTestContext,
  jwtUtil,
  copyFile: copyFile,
  moveFile: moveFile,
  moment: moment,
  mysql: mysql,
  sanitizer: sanitizer,
  ensure: ensure,
}
