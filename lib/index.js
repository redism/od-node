'use strict';

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

let initMySQLPool = (() => {
  var _ref = _asyncToGenerator(function* (options) {
    // TODO: merge with initLambda...
    if (options === undefined || options === null) {
      if (getMySQLConnection.options) {
        options = getMySQLConnection.options;
      } else {
        options = {
          host: process.env.mysql_host,
          user: process.env.mysql_user,
          password: process.env.mysql_password,
          port: parseInt(process.env.mysql_port, 10),
          database: process.env.mysql_database,
          debug: parseInt(process.env.mysql_debug, 10) === 1
        };
      }
    }

    globalMySQLPool = yield (0, _mysql.connectMySQLPool)(options);
    getMySQLConnection = function () {
      return globalMySQLPool;
    };
  });

  return function initMySQLPool(_x) {
    return _ref.apply(this, arguments);
  };
})();

let closeMySQLPool = (() => {
  var _ref2 = _asyncToGenerator(function* () {
    return globalMySQLPool.end();
  });

  return function closeMySQLPool() {
    return _ref2.apply(this, arguments);
  };
})();

/**
 * bcryptjs 를 이용하여 salted password 를 생성한다.
 *
 * @param pw {string}
 * @param iteration {number=10}
 * @return {Promise}
 */


let genSaltedPassword = (() => {
  var _ref3 = _asyncToGenerator(function* (pw, iteration = 10) {
    return new _bluebird2.default(function (resolve, reject) {
      bcrypt.genSalt(iteration, function (err, salt) {
        if (err) {
          reject(err);
        } else {
          bcrypt.hash(pw, salt, function (err, salted) {
            if (err) {
              reject(err);
            } else {
              resolve(salted);
            }
          });
        }
      });
    });
  });

  return function genSaltedPassword(_x2) {
    return _ref3.apply(this, arguments);
  };
})();

/**
 * Check if given {pw} matches salted password {salted}
 * @param pw {string}
 * @param salted {string}
 * @return {Promise<Boolean>}
 */


let checkSaltedPassword = (() => {
  var _ref4 = _asyncToGenerator(function* (pw, salted) {
    return new _bluebird2.default(function (resolve, reject) {
      bcrypt.compare(pw, salted, function (err, res) {
        err ? reject(err) : resolve(res);
      });
    });
  });

  return function checkSaltedPassword(_x3, _x4) {
    return _ref4.apply(this, arguments);
  };
})();

/**
 * Create Json Web Token
 *
 * @param secret {string}
 * @param data {object}
 * @return {Promise}
 */


let encodeJWTToken = (() => {
  var _ref5 = _asyncToGenerator(function* (secret, data) {
    return new _bluebird2.default(function (resolve, reject) {
      _jsonwebtoken2.default.sign(data, secret, { algorithm: 'HS256' }, function (err, res) {
        if (err) {
          console.error(64, 'Generating jwt.Token failed!!');
          console.error(err);
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
  });

  return function encodeJWTToken(_x5, _x6) {
    return _ref5.apply(this, arguments);
  };
})();

/**
 * Verify JWT token and resolve decoded data.
 *
 * @param secret {string}
 * @param token {string}
 * @return {Promise<Object>}
 */


let decodeJWTToken = (() => {
  var _ref6 = _asyncToGenerator(function* (secret, token) {
    return new _bluebird2.default(function (resolve, reject) {
      _jsonwebtoken2.default.verify(token, secret, function (err, res) {
        err ? reject(err) : resolve(res);
      });
    });
  });

  return function decodeJWTToken(_x7, _x8) {
    return _ref6.apply(this, arguments);
  };
})();

var _jsonwebtoken = require('jsonwebtoken');

var _jsonwebtoken2 = _interopRequireDefault(_jsonwebtoken);

var _param = require('./param');

var _mysql = require('./mysql');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new _bluebird2.default(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return (0, _bluebird.resolve)(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

// TODO: 이제 좀 더 제대로 모듈화. (ODServer 라는 패키지 만들기)
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const Knex = require('knex');
const knex = Knex({ client: 'mysql' }); // use only for query-builder
const fs = require('fs');
const moment = require('moment');


let getMySQLConnection;

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
function getMySQLConnectionLambda(options) {
  if (options === undefined || options === null) {
    if (getMySQLConnection.options) {
      options = getMySQLConnection.options;
    } else {
      options = {
        host: process.env.mysql_host,
        user: process.env.mysql_user,
        password: process.env.mysql_password,
        port: parseInt(process.env.mysql_port, 10),
        database: process.env.mysql_database,
        debug: parseInt(process.env.mysql_debug, 10) === 1
      };
    }
  }

  const conn = mysql.createConnection(options);

  const orgQuery = conn.query.bind(conn);
  conn.query = function (query) {
    return new _bluebird2.default((resolve, reject) => {
      orgQuery(query, (err, res) => {
        err ? reject(err) : resolve(res);
      });
    });
  };
  return conn;
}

/**
 * Inject options before calling getMySQLConnection.
 *
 * @param options {object}
 */
getMySQLConnectionLambda.setOptions = function (options) {
  getMySQLConnection.options = options;
};

getMySQLConnection = getMySQLConnectionLambda;

let globalMySQLPool;

const jwtUtil = {
  encode: encodeJWTToken,
  decode: decodeJWTToken
};

function createContext(usingMySQLPool) {
  let runDeferred = (() => {
    var _ref7 = _asyncToGenerator(function* () {
      for (const index in deferred) {
        try {
          yield (0, _bluebird.resolve)(deferred[index]());
        } catch (ex) {
          console.error(`Error during running deferred.`);
          console.error(ex);
        }
      }
    });

    return function runDeferred() {
      return _ref7.apply(this, arguments);
    };
  })();

  const deferred = [];

  function defer(fn) {
    deferred.push(fn);
  }

  if (usingMySQLPool) {
    return {
      defer,
      runDeferred,
      getMySQLConnection
    };
  }

  return {
    defer,
    runDeferred,
    getMySQLConnection: options => {
      const conn = getMySQLConnection(options);
      defer(() => {
        conn.end();
      });
      return conn;
    }
  };
}

function NIY(name) {
  throw new Error(`${name} NIY.`);
}

function runInLambdaContext(runLogic, e, ctx, cb) {
  const context = createContext();
  context.getSignedCookie = name => NIY('runInLambdaContext.getSignedCookie');
  runLogic(context).then(res => cb(null, { data: res }), err => cb(err, null)).finally(() => {
    return context.runDeferred();
  });
}

function runInExpressContext(runLogic, req, res, next) {
  const context = createContext(true);
  context.express = { req, res

    // TODO: extract these out.
  };context.getSignedCookie = name => req.signedCookies[name];
  context.setSignedCookie = (name, value) => res.cookie(name, value, { signed: true });
  context.requestBody = req.body;
  context.ensure = _param.ensure;
  context.sanitizer = (0, _param.sanitizer)({ defError: ({ value }) => `Invalid param with value : ${value}` });

  runLogic(context).then(ret => res.json({ data: ret }), next).finally(() => {
    return context.runDeferred();
  });
}

function runInTestContext(mod) {
  return _asyncToGenerator(function* () {
    const context = createContext();
    return mod.runLogic(context).finally(function () {
      return context.runDeferred();
    });
  });
}

/**
 * 파일 복사를 수행합니다.
 *
 * @param oldPath {string}
 * @param newPath {string}
 * @return {Promise}
 */
function copyFile(oldPath, newPath) {
  return new _bluebird2.default((resolve, reject) => {
    const readStream = fs.createReadStream(oldPath);
    const writeStream = fs.createWriteStream(newPath);

    readStream.on('error', reject);
    writeStream.on('error', reject);

    readStream.on('close', function () {
      fs.unlink(oldPath, resolve);
    });

    readStream.pipe(writeStream);
  });
}

/**
 * 파일을 이동합니다. 만약 실패할 경우 복사를 수행합니다.
 *
 * @param oldPath {string}
 * @param newPath {string}
 * @return {Promise}
 */
function moveFile(oldPath, newPath) {
  return new _bluebird2.default((resolve, reject) => {
    fs.rename(oldPath, newPath, function (err) {
      if (err) {
        if (err.code === 'EXDEV') {
          resolve(copyFile(oldPath, newPath));
        } else {
          reject(err);
        }
      }
      resolve();
    });
  });
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
  sanitizer: _param.sanitizer,
  ensure: _param.ensure,
  initMySQLPool: initMySQLPool,
  closeMySQLPool: closeMySQLPool
};