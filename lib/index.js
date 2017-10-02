'use strict';

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

/**
 * bcryptjs 를 이용하여 salted password 를 생성한다.
 *
 * @param pw {string}
 * @param iteration {number=10}
 * @return {Promise}
 */
let genSaltedPassword = (() => {
  var _ref = _asyncToGenerator(function* (pw, iteration = 10) {
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

  return function genSaltedPassword(_x) {
    return _ref.apply(this, arguments);
  };
})();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new _bluebird2.default(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return (0, _bluebird.resolve)(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const mysql = require('mysql');
const bcrypt = require('bcryptjs');
const Knex = require('knex');
const knex = Knex({ client: 'mysql' }); // use only for query-builder

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
function getMySQLConnection(options) {
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
      orgQuery(query, {}, (err, res) => {
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
getMySQLConnection.setOptions = function (options) {
  getMySQLConnection.options = options;
};

function createContext() {
  let runDeferred = (() => {
    var _ref2 = _asyncToGenerator(function* () {
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
      return _ref2.apply(this, arguments);
    };
  })();

  const deferred = [];

  function defer(fn) {
    deferred.push(fn);
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

function runInLambdaContext(runLogic, e, ctx, cb) {
  const context = createContext();
  runLogic(context).then(res => cb(null, res), err => cb(err, null)).finally(() => {
    return context.runDeferred();
  });
}

function runInExpressContext(runLogic, req, res, next) {
  const context = createContext();
  runLogic(context).then(ret => res.json(ret), next).finally(() => {
    return context.runDeferred();
  });
}

module.exports = exports = {
  getMySQLConnection: getMySQLConnection,
  genSaltedPassword,
  knex,
  Knex,
  runInLambdaContext,
  runInExpressContext
};