const mysql = require("mysql2");
require("dotenv").config();

const config = {
  connectionLimit: 4,
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root",
  database: process.env.DB_NAME || "mydb"

};
const pool = mysql.createPool(config);

const connection = () => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) return reject(err);

      console.log("MySQL connected. Thread ID:", connection.threadId);

      const query = (sql, params = []) => {
        return new Promise((resolve, reject) => {
          connection.query(sql, params, (err, result) => {
            if (err) return reject(err);
            resolve(result);
          });
        });
      };

      const release = () => {
        console.log("MySQL connection released. Thread ID:", connection.threadId);
        return connection.release();
      };

      resolve({ query, release });
    });
  });
};

module.exports = {
  pool,
  connection
};
