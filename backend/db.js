// db.js
const mysql = require("mysql2");

// Create connection pool
const pool = mysql.createPool({
  host: "localhost",       // Your database host
  user: "root",            // Your database user
  password: "pita@59",// Your database password
  database: "luct_reports",// Your database name
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool.promise(); // Use promise-based queries
