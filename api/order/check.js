import { cekPaid } from "../_lib/pakasir.js";
import { createPanel } from "../_lib/pterodactyl.js";
import { getOrder, updateOrder, claimOrder } from "../_lib/store.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });

  const { orderId } = req.body || {};
  try {
    const order = await getOrder(orderId);
    if (!order) return res.status(404).json({ success: false, message: "Order tidak ditemukan atau kedaluwarsa" });

    // IDEMPOTENT — aman di-poll berkali-kali
    if (order.status === "done")        return res.status(200).json({ success: true, paid: true, credentials: order.credentials });
    if (order.status === "provisioning") return res.status(200).json({ success: true, paid: true, provisioning: true });
    if (order.status === "cancelled")    return res.status(200).json({ success: true, paid: false, cancelled: true });

    const paid = await cekPaid(orderId, order.amount);
    if (!paid) return res.status(200).json({ success: true, paid: false });

    // Klaim atomik (anti race/dobel panel) — hanya pemenang yang buat panel
    const claimed = await claimOrder(orderId);
    if (!claimed) return res.status(200).json({ success: true, paid: true, provisioning: true });

    const result = await createPanel(order.username, order.ramKey, order.password);
    if (result.success) {
      await updateOrder(orderId, { status: "done", credentials: result.data });
      return res.status(200).json({ success: true, paid: true, credentials: result.data });
    }

    await updateOrder(orderId, { status: "paid" }); // gagal → auto-retry poll berikutnya
    return res.status(500).json({ success: false, paid: true, message: result.message });
  } catch (err) {
    console.error("CHECK ORDER ERROR:", err.message);
    return res.status(500).json({ success: false, message: "Gagal mengecek order" });
  }
}
