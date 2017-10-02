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

function getMySQLConnection() {
  const conn = mysql.createConnection({
    host: 'gameberrycashbackdb.cgta6qz5w1ey.us-east-1.rds.amazonaws.com',
    user: 'root',
    password: 'Rpdlaqpfl',
    port: 3306,
    database: 'gcb',
    debug: false
  });

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

module.exports = exports = {
  getMySQLConnection: getMySQLConnection,
  genSaltedPassword,
  knex,
  Knex
};