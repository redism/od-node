'use strict';

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

let delay = (() => {
  var _ref = _asyncToGenerator(function* () {
    yield (0, _bluebird.delay)(1000);
    return 100;
  });

  return function delay() {
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
  return mysql.createConnection({
    host: 'gameberrycashbackdb.cgta6qz5w1ey.us-east-1.rds.amazonaws.com',
    user: 'root',
    password: 'Rpdlaqpfl',
    port: 3306,
    database: 'gcb',
    debug: false
  });
}

function genSaltedPassword(pw, iteration = 10, cb) {
  bcrypt.genSalt(iteration, (err, salt) => {
    if (err) {
      cb(err);
    } else {
      bcrypt.hash(pw, salt, (err, salted) => {
        if (err) {
          cb(err);
        } else {
          const sqlInsertAdmin = knex('setting').insert({
            email: 'jeff.oh@overdosed.co.kr',
            pw: salted,
            forcedUpdateVersion: null
          }).toString();

          const conn = getMySQLConnection();
          const sqlResetSetting = knex('setting').delete().toString();
          conn.query(sqlResetSetting, {}, (err, res) => {
            if (err) {
              cb(err);
            } else {
              conn.query(sqlInsertAdmin, {}, (err, res) => {
                conn.end();
                if (err) {
                  cb(err);
                } else {
                  console.log(res);
                  cb(null, `Ran SQL successfully => ${res}`);
                }
              });
            }
          });
        }
      });
    }
  });
}

module.exports = exports = {
  getMySQLConnection: getMySQLConnection,
  genSaltedPassword,
  knex,
  Knex,
  delay
};