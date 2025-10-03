const mysql = require('mysql2');
require('dotenv').config();

console.log('📝 Database Configuration:');
console.log(`   Host: ${process.env.DB_HOST}`);
console.log(`   User: ${process.env.DB_USER}`);
console.log(`   Database: ${process.env.DB_NAME}`);
console.log('');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'luct_reporting_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const promisePool = pool.promise();

module.exports = promisePool;