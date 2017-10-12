'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.connectMySQLPool = exports.isDeadLockError = undefined;

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

let connectMySQLPool = exports.connectMySQLPool = (() => {
  var _ref = _asyncToGenerator(function* (connectionOption) {
    const pool = _mysql2.default.createPool(connectionOption);

    return {
      end: function () {
        return new _bluebird2.default(function (resolve) {
          return pool.end(resolve);
        });
      },
      query: function query(...args) {
        const df = {};
        df.promise = new _bluebird2.default((resolve, reject) => {
          df.resolve = resolve;
          df.reject = reject;
        });
        pool.query(...args, function (err, rows) {
          if (err) {
            df.reject(err);
          } else {
            df.resolve(rows);
          }
        });
        return df.promise;
      },
      beginTransaction: function beginTransaction(context) {
        let isTransactionFinished = false;
        return new _bluebird2.default((resolve, reject) => {
          let isReleased = false;

          pool.getConnection((err, connection) => {
            if (err) {
              return reject(err);
            }

            const release = () => {
              if (!isReleased) {
                connection.release();
                isReleased = true;
              }
            };

            connection.beginTransaction(err => {
              if (err) {
                release();
                return reject(err);
              }

              // 컨텍스트 종료시에 커밋이 되어있지 않다면 자동으로 롤백시키고 connection 을 반환한다.
              context.defer(_asyncToGenerator(function* () {
                return new _bluebird2.default(function (resolve) {
                  if (!isTransactionFinished) {
                    isTransactionFinished = true;
                    debug(`Transaction is not finished after context finished. rolling back : ${context.location}`);
                    connection.rollback(function () {
                      release();
                      resolve();
                    });
                  } else {
                    release();
                    resolve();
                  }
                });
              }));

              /**
               * @name {Transaction}
               * @type {{connection: *, release: function, query: function, commit: function, rollback: function}}
               */
              const transactionObject = {
                connection,
                release: () => {
                  release();
                },
                query: (...args) => {
                  return new _bluebird2.default((resolve, reject) => {
                    connection.query(...args, (err, rows) => err ? reject(err) : resolve(rows));
                  });
                },
                commit: (() => {
                  var _ref3 = _asyncToGenerator(function* () {
                    context.ensure(!isTransactionFinished, DBErrorObject('Transaction already finished, but tried to commit.'));
                    isTransactionFinished = true;
                    return new _bluebird2.default(function (resolve, reject) {
                      connection.commit(function (err) {
                        if (err) {
                          connection.rollback(function () {
                            release();
                            reject(err);
                          });
                        } else {
                          release();
                          resolve();
                        }
                      });
                    });
                  });

                  return function commit() {
                    return _ref3.apply(this, arguments);
                  };
                })(),
                rollback: (() => {
                  var _ref4 = _asyncToGenerator(function* () {
                    context.ensure(!isTransactionFinished, DBErrorObject('Transaction already finished, but tried to rollback.'));
                    isTransactionFinished = true;
                    return new _bluebird2.default(function (resolve) {
                      release();
                      connection.rollback(resolve);
                    });
                  });

                  return function rollback() {
                    return _ref4.apply(this, arguments);
                  };
                })()
              };
              resolve(transactionObject);
            });
          });
        });
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
      executeTransQueryWithRetry: (() => {
        var _ref5 = _asyncToGenerator(function* (context, fn, options) {
          options = Object.assign({
            retry: 5,
            ignoreError: false,
            errorHandler: null,
            deadlockInterval: 100
          }, options || {});

          const trans = yield this.beginTransaction(context);
          try {
            const ret = yield fn(trans, options);
            yield trans.commit();
            return ret;
          } catch (ex) {
            yield trans.rollback();
            if (ex.handled) {
              throw ex;
            }
            if (isDeadLockError(ex)) {
              if (options.retry > 0) {
                yield (0, _bluebird.delay)(options.deadlockInterval);
                options.retry--;
                return this.executeTransQueryWithRetry(context, fn, options);
              }
              context.ensure(!!options.ignoreError, DeadlockErrorObject('Deadlock found'));
            }
            if (options.errorHandler && !options.ignoreError) {
              const ret = options.errorHandler(ex);
              if (ret) return (0, _bluebird.resolve)(ret);
            }
            context.ensure(!!options.ignoreError, UnknownDBErrorObject('Unknown error in executeTransQuery /w retry.'));
          }
        });

        return function executeTransQueryWithRetry(_x2, _x3, _x4) {
          return _ref5.apply(this, arguments);
        };
      })()
    };
  });

  return function connectMySQLPool(_x) {
    return _ref.apply(this, arguments);
  };
})();

var _mysql = require('mysql');

var _mysql2 = _interopRequireDefault(_mysql);

var _debug = require('debug');

var _debug2 = _interopRequireDefault(_debug);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new _bluebird2.default(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return (0, _bluebird.resolve)(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const debug = (0, _debug2.default)('od.mysql');

const DBErrorObject = msg => {
  return { code: 6738, status: 500, msg };
};
const DeadlockErrorObject = msg => {
  return { code: 5781, status: 500, msg };
};
const UnknownDBErrorObject = msg => {
  return { code: 5811, status: 500, msg };
};

const isDeadLockError = exports.isDeadLockError = err => err && err.errno && err.errno === 1213;