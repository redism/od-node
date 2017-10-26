import _ from 'lodash'
import mysql from 'mysql'
import Knex from 'knex'
import Debug from 'debug'

const knex = Knex({ client: 'mysql' }) // use only for query-builder
const debug = Debug('od.mysql')

const DBErrorObject = msg => { return { code: 6738, status: 500, msg } }
const DeadlockErrorObject = msg => { return { code: 5781, status: 500, msg } }
const UnknownDBErrorObject = msg => { return { code: 5811, status: 500, msg } }

export const isDeadLockError = err => err && err.errno && err.errno === 1213
export const isForeignKeyError = err => err && err.errno && err.errno === 1452

export async function connectMySQLPool (connectionOption) {
  const pool = mysql.createPool(connectionOption)

  return {
    end: () => {
      return new Promise(resolve => pool.end(resolve))
    },
    query: function query (...args) {
      const df = {}
      df.promise = new Promise((resolve, reject) => {
        df.resolve = resolve
        df.reject = reject
      })
      pool.query(...args, function (err, rows) {
        if (err) {
          df.reject(err)
        } else {
          df.resolve(rows)
        }
      })
      return df.promise
    },
    beginTransaction: function beginTransaction (context) {
      let isTransactionFinished = false
      return new Promise((resolve, reject) => {
        let isReleased = false

        pool.getConnection((err, connection) => {
          if (err) {
            return reject(err)
          }

          const release = () => {
            if (!isReleased) {
              connection.release()
              isReleased = true
            }
          }

          connection.beginTransaction(err => {
            if (err) {
              release()
              return reject(err)
            }

            // 컨텍스트 종료시에 커밋이 되어있지 않다면 자동으로 롤백시키고 connection 을 반환한다.
            context.defer(async () => {
              return new Promise(resolve => {
                if (!isTransactionFinished) {
                  isTransactionFinished = true
                  debug(`Transaction is not finished after context finished. rolling back : ${context.location}`)
                  connection.rollback(() => {
                    release()
                    resolve()
                  })
                } else {
                  release()
                  resolve()
                }
              })
            })

            /**
             * @name {Transaction}
             * @type {{connection: *, release: function, query: function, commit: function, rollback: function}}
             */
            const transactionObject = {
              connection,
              release: () => {
                release()
              },
              query: (...args) => {
                return new Promise((resolve, reject) => {
                  connection.query(...args, (err, rows) => err ? reject(err) : resolve(rows))
                })
              },
              commit: async () => {
                context.ensure(!isTransactionFinished, DBErrorObject('Transaction already finished, but tried to commit.'))
                isTransactionFinished = true
                return new Promise((resolve, reject) => {
                  connection.commit(err => {
                    if (err) {
                      connection.rollback(() => {
                        release()
                        reject(err)
                      })
                    } else {
                      release()
                      resolve()
                    }
                  })
                })
              },
              rollback: async () => {
                context.ensure(!isTransactionFinished, DBErrorObject('Transaction already finished, but tried to rollback.'))
                isTransactionFinished = true
                return new Promise(resolve => {
                  release()
                  connection.rollback(resolve)
                })
              }
            }
            resolve(transactionObject)
          })
        })
      })
    },
    /**
     * transaction 을 이용하여 deadlock 이 걸리면 retry 하는 헬퍼 함수
     * @param context {Context}
     * @param fn {function}
     * @param [options] {object}
     * @config retry {number}
     * @config ignoreError {boolean}
     * @config errorHandler {function}
     * @returns {Promise.<*|Promise>}
     */
    executeTransQueryWithRetry: async function (context, fn, options) {
      options = Object.assign({
        retry: 5,
        ignoreError: false,
        errorHandler: null,
        deadlockInterval: 100
      }, options || {})

      const trans = await this.beginTransaction(context)
      try {
        const ret = await fn(trans, options)
        await trans.commit()
        return ret
      } catch (ex) {
        await trans.rollback()
        if (ex.handled) {
          throw ex
        }
        if (isDeadLockError(ex)) {
          if (options.retry > 0) {
            await Promise.delay(options.deadlockInterval)
            options.retry--
            return this.executeTransQueryWithRetry(context, fn, options)
          }
          context.ensure(!!options.ignoreError, DeadlockErrorObject('Deadlock found'))
        }
        if (options.errorHandler && !options.ignoreError) {
          const ret = options.errorHandler(ex)
          if (ret) return Promise.resolve(ret)
        }
        context.ensure(!!options.ignoreError, UnknownDBErrorObject('Unknown error in executeTransQuery /w retry.'))
      }
    }
  }
}

const mysqlDefaultOptions = {
  host: process.env.mysql_host || '127.0.0.1',
  user: process.env.mysql_user || 'root',
  password: process.env.mysql_password || '',
  port: parseInt(process.env.mysql_port, 10) || 3306,
  database: process.env.mysql_database || 'test',
  debug: parseInt(process.env.mysql_debug, 10) === 1
}

export async function initMySQLPool (options = {}) {
  options = Object.assign(mysqlDefaultOptions, options)
  return connectMySQLPool(options)
}

/**
 * Generate multiple upsert query. (requires toString() to build query)
 *
 * @param tableName {string}
 * @param dataInsert {object|array}
 * @param [fieldsToUpdate] {array}
 * @return {Any}
 */
export function upsertSQL (tableName, dataInsert, fieldsToUpdate) {
  if (fieldsToUpdate === undefined) {
    if (_.isArray(dataInsert)) {
      fieldsToUpdate = Object.getOwnPropertyNames(dataInsert[ 0 ])
    } else {
      fieldsToUpdate = Object.getOwnPropertyNames(dataInsert)
    }
  }

  return knex.raw(knex(tableName).insert(dataInsert).toQuery() + ' ON DUPLICATE KEY UPDATE ' +
    fieldsToUpdate.map(field => `${field}=VALUES(${field})`).join(', '))
}
