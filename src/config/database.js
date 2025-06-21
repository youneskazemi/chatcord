const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Initialize SQLite Database
let dbInitialized = false;
const db = new sqlite3.Database(
  path.join(__dirname, "../../chatcord.db"),
  (err) => {
    if (err) {
      console.error("Error opening database:", err.message);
    } else {
      console.log("Connected to SQLite database.");
    }
  }
);

// Database helper functions
const dbAsync = {
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      if (!dbInitialized) {
        reject(new Error("Database not initialized"));
        return;
      }
      db.run(sql, params, function (err) {
        if (err) {
          console.error("Database run error:", err);
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  },

  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      if (!dbInitialized) {
        reject(new Error("Database not initialized"));
        return;
      }
      db.get(sql, params, (err, row) => {
        if (err) {
          console.error("Database get error:", err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  },

  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      if (!dbInitialized) {
        reject(new Error("Database not initialized"));
        return;
      }
      db.all(sql, params, (err, rows) => {
        if (err) {
          console.error("Database all error:", err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  },
};

module.exports = {
  db,
  dbAsync,
  setInitialized: () => {
    dbInitialized = true;
  },
  isInitialized: () => dbInitialized,
};
