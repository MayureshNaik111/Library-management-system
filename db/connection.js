// C:\Users\reshm\Desktop\Demo\library-management\db\connection.js

const mysql = require('mysql2/promise'); // 👈 Correct: Imports the promise-based API

// 1. Change createConnection to createPool (Best practice for Express)
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'library_db',
    waitForConnections: true, // Wait for available connection slots
    connectionLimit: 10,      // Max number of connections in the pool
    queueLimit: 0             // No limit on connection requests queue
});

// 2. Remove the synchronous .connect() block.
// The Pool is ready to use immediately for querying (e.g., await pool.query(...)).

console.log('MySQL Connection Pool initialized.');

// 3. Export the Pool instance. Your routes will use pool.query()
module.exports = pool;