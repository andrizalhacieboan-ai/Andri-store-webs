// CATATAN: in-memory = hanya bertahan selama server/lambda "warm".
// Untuk produksi dengan traffic nyata, ganti isi file ini dengan Redis
// (Upstash/Vercel KV) — interfacenya sudah disamakan.
const orders = new Map();
const TTL = 2 * 60 * 60 * 1000; // order pending kedaluwarsa setelah 2 jam

export function saveOrder(orderId, data) { orders.set(orderId, { ...data, createdAt: Date.now() }); }

export function getOrder(orderId) {
  const o = orders.get(orderId);
  if (!o) return null;
  if (Date.now() - o.createdAt > TTL && o.status !== "done") { orders.delete(orderId); return null; }
  return o;
}

export function updateOrder(orderId, patch) { const o = orders.get(orderId); if (o) Object.assign(o, patch); }

export function generatePassword(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; // tanpa karakter ambigu
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
