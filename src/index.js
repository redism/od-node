const mysql = require('mysql')
const bcrypt = require('bcryptjs')
const Knex = require('knex')
const knex = Knex({ client: 'mysql' }) // use only for query-builder

/**
 * Returns MySQL connection, and inject promise-version of query function.
 *
 * @param options {Object} if omitted, try to read from environment variable.
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
    options = {
      host: process.env.mysql_host,
      user: process.env.mysql_user,
      password: process.env.mysql_password,
      port: parseInt(process.env.mysql_port, 10),
      database: process.env.mysql_database,
      debug: parseInt(process.env.mysql_debug, 10) === 1,
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

module.exports = exports = {
  getMySQLConnection: getMySQLConnection,
  genSaltedPassword,
  knex,
  Knex,
}
