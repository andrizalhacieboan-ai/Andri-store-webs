// Order store — dual mode:
//  • DB_* terisi  → MySQL (cPanel) — persisten, idempotent atomic
//  • DB_* kosong  → in-memory (fallback demo / Vercel tanpa DB)
import { isDbEnabled, getPool, initDb } from './db.js';

const memoryOrders = new Map();
const MEMORY_TTL = 2 * 60 * 60 * 1000; // 2 jam (hanya mode memory)

export async function saveOrder(orderId, data) {
  if (!isDbEnabled()) {
    memoryOrders.set(orderId, { ...data, createdAt: Date.now() });
    return;
  }
  await initDb();
  await getPool().query(
    'INSERT INTO orders (order_id, ram_key, username, months, amount, status, password) VALUES (?,?,?,?,?,?,?)',
    [orderId, data.ramKey, data.username, data.months, data.amount, 'pending', data.password]
  );
}

export async function getOrder(orderId) {
  if (!isDbEnabled()) {
    const o = memoryOrders.get(orderId);
    if (!o) return null;
    if (Date.now() - o.createdAt > MEMORY_TTL && o.status !== 'done') { memoryOrders.delete(orderId); return null; }
    return o;
  }
  await initDb();
  const [rows] = await getPool().query('SELECT * FROM orders WHERE order_id = ? LIMIT 1', [orderId]);
  if (!rows.length) return null;
  const r = rows[0];
  return {
    orderId: r.order_id, ramKey: r.ram_key, username: r.username,
    months: Number(r.months), amount: Number(r.amount),
    status: r.status, password: r.password,
    credentials: r.credentials ? (typeof r.credentials === 'string' ? JSON.parse(r.credentials) : r.credentials) : null,
    createdAt: r.created_at,
  };
}

export async function updateOrder(orderId, patch) {
  if (!isDbEnabled()) {
    const o = memoryOrders.get(orderId);
    if (o) Object.assign(o, patch);
    return;
  }
  await initDb();
  const fields = [], values = [];
  if (patch.status !== undefined)      { fields.push('status = ?');      values.push(patch.status); }
  if (patch.credentials !== undefined) { fields.push('credentials = ?'); values.push(typeof patch.credentials === 'string' ? patch.credentials : JSON.stringify(patch.credentials)); }
  if (!fields.length) return;
  values.push(orderId);
  await getPool().query(`UPDATE orders SET ${fields.join(', ')} WHERE order_id = ?`, values);
}

// KLAIM ATOMIK untuk provisioning: hanya SATU request yang berhasil
// (UPDATE bersyarat) → tidak mungkin dobel-create panel walau di-poll bersamaan.
export async function claimOrder(orderId) {
  if (!isDbEnabled()) {
    const o = memoryOrders.get(orderId);
    if (!o) return false;
    if (o.status === 'pending' || o.status === 'paid') { o.status = 'provisioning'; return true; }
    return false;
  }
  await initDb();
  const [result] = await getPool().query(
    "UPDATE orders SET status = 'provisioning' WHERE order_id = ? AND status IN ('pending','paid')",
    [orderId]
  );
  return result.affectedRows > 0;
}

export function generatePassword(len = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
