import mysql from 'mysql'
import bcrypt from 'bcrypt'
import Knex from 'knex'
import moment from 'moment'
import jwt from 'jsonwebtoken'
import { sanitizer as Sanitizer, ensure } from 'od-js'
import ODApp from './express'
import { upsertSQL, isDeadLockError, isForeignKeyError } from './mysql'
import { handlerMaker } from './handler'

const knex = Knex({ client: 'mysql' }) // use only for query-builder

let getMySQLConnection

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
function getMySQLConnectionLambda (options) {
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
        debug: parseInt(process.env.mysql_debug, 10) === 1
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
getMySQLConnectionLambda.setOptions = function (options) {
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
    bcrypt.compare(pw, salted, (err, res) => { err ? reject(err) : resolve(res) })
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
  decode: decodeJWTToken
}

module.exports = exports = {
  genSaltedPassword: genSaltedPassword,
  checkSaltedPassword: checkSaltedPassword,
  knex: knex,
  Knex: Knex,
  jwtUtil,
  moment: moment,
  upsertSQL: upsertSQL,
  mysql: mysql,
  sanitizer: Sanitizer,
  ensure: ensure,
  ODApp: ODApp,
  isDeadLockError,
  isForeignKeyError,
  handlerMaker
}
