// Koneksi MySQL (cPanel) — tabel dibuat OTOMATIS saat pertama dipakai,
// jadi tidak wajib import SQL manual di phpMyAdmin.
import mysql from 'mysql2/promise';

let pool = null;
let initPromise = null;

// Mode DB aktif hanya jika env DB_* diisi (kosong = fallback in-memory)
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
    // Di Vercel (serverless): pool kecil. Di cPanel (proses panjang): pool normal.
    connectionLimit: process.env.VERCEL ? 2 : 10,
    queueLimit: 0,
    connectTimeout: 10000,
  });
  return pool;
}

export function initDb() {
  if (!initPromise) {
    initPromise = getPool().query(`
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
    `).catch(err => {
      initPromise = null; // boleh dicoba lagi di request berikutnya
      throw err;
    });
  }
  return initPromise;
}
