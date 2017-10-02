const mysql = require('mysql')
const bcrypt = require('bcryptjs')
const Knex = require('knex')
const knex = Knex({ client: 'mysql' }) // use only for query-builder

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
      orgQuery(query, {}, (err, res) => {
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

function runInLambdaContext (runLogic, e, ctx, cb) {
  const context = createContext()
  runLogic(context)
    .then(res => cb(null, res), err => cb(err, null))
    .finally(() => { return context.runDeferred() })
}

function runInExpressContext (runLogic, req, res, next) {
  const context = createContext()
  runLogic(context)
    .then(ret => res.json(ret), next)
    .finally(() => { return context.runDeferred() })
}

function runInTestContext (mod) {
  return async () => {
    const context = createContext()
    return mod.runLogic(context)
      .finally(() => { return context.runDeferred() })
  }
}

module.exports = exports = {
  getMySQLConnection: getMySQLConnection,
  genSaltedPassword,
  knex,
  Knex,
  runInLambdaContext,
  runInExpressContext,
  runInTestContext,
}
