import mysql from 'mysql2/promise';

let pool = null;
let initPromise = null;

export function isDbEnabled() {
  return !!(process.env.DB_NAME && process.env.DB_USER);
}

export function getPool() {
  if (pool) return pool;
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: process.env.VERCEL ? 2 : 10,
    queueLimit: 0,
    connectTimeout: 10000,
    dateStrings: true,
  });
  return pool;
}

export function initDb() {
  if (!initPromise) {
    initPromise = (async () => {
      const pool = getPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
          order_id     VARCHAR(64)  NOT NULL PRIMARY KEY,
          ram_key      VARCHAR(20)  NOT NULL,
          username     VARCHAR(64)  NOT NULL,
          months       TINYINT UNSIGNED NOT NULL DEFAULT 1,
          amount       INT UNSIGNED NOT NULL,
          status       ENUM('pending','paid','provisioning','done','cancelled') NOT NULL DEFAULT 'pending',
          password     VARCHAR(64)  NOT NULL,
          credentials  TEXT         NULL,
          created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          KEY idx_status (status),
          KEY idx_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      // BARU: tabel notifikasi untuk admin
      await pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id         INT AUTO_INCREMENT PRIMARY KEY,
          type       VARCHAR(30)  NOT NULL DEFAULT 'transaction',
          title      VARCHAR(150) NOT NULL,
          details    TEXT         NULL,
          is_read    TINYINT(1)   NOT NULL DEFAULT 0,
          created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    })().catch(err => { initPromise = null; throw err; });
  }
  return initPromise;
}
