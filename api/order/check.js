import { cekPaid } from "../_lib/pakasir.js";
import { createPanel } from "../_lib/pterodactyl.js";
import { getOrder, updateOrder } from "../_lib/store.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

  const { orderId } = req.body || {};
  const order = getOrder(orderId);
  if (!order) return res.status(404).json({ success: false, message: "Order tidak ditemukan atau kedaluwarsa" });

  // IDEMPOTENT: order sudah selesai → kirim ulang kredensial (aman di-poll berkali-kali)
  if (order.status === "done")        return res.status(200).json({ success: true, paid: true, credentials: order.credentials });
  if (order.status === "provisioning") return res.status(200).json({ success: true, paid: true, provisioning: true });
  if (order.status === "cancelled")    return res.status(200).json({ success: true, paid: false, cancelled: true });

  const paid = await cekPaid(orderId, order.amount);
  if (!paid) return res.status(200).json({ success: true, paid: false });

  // Kunci dulu supaya polling berikutnya tidak dobel-create panel (race condition)
  updateOrder(orderId, { status: "provisioning" });

  const result = await createPanel(order.username, order.ramKey, order.password);
  if (result.success) {
    updateOrder(orderId, { status: "done", credentials: result.data });
    return res.status(200).json({ success: true, paid: true, credentials: result.data });
  }

  // Gagal membuat panel → kembalikan ke "paid" agar polling berikutnya auto-retry
  updateOrder(orderId, { status: "paid" });
  return res.status(500).json({ success: false, paid: true, message: result.message });
}
