const mysql = require('mysql2');
require('dotenv').config();

const readEnv = (...keys) => {
  for (const key of keys) {
    const raw = process.env[key];
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim().replace(/^['\"]|['\"]$/g, '');
    }
  }
  return undefined;
};

const pool = mysql.createPool({
  host: readEnv('DB_HOST', 'HOST'),
  user: readEnv('DB_USER', 'USER'),
  password: readEnv('DB_PASSWORD', 'PASSWORD'),
  database: readEnv('DB_NAME', 'DATABASE', 'DB'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool.promise();
