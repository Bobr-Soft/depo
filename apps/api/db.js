const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DB_NAME
});

module.exports = pool.promise();
