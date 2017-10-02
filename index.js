const mysql = require('mysql')

function getMySQLConnection () {
  return mysql.createConnection({
    host: 'gameberrycashbackdb.cgta6qz5w1ey.us-east-1.rds.amazonaws.com',
    user: 'root',
    password: 'Rpdlaqpfl',
    port: 3306,
    database: 'gcb',
    debug: false
  })
}

module.exports = exports = {
  getMySQLConnection: getMySQLConnection,
}
