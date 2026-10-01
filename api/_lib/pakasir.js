import axios from "axios";
import QRCode from "qrcode";

const PAKASIR_BASE = "https://app.pakasir.com/api";
const TIMEOUT = 20000;

const cfg = () => {
  const slug = process.env.PAKASIR_SLUG;
  const apiKey = process.env.PAKASIR_API_KEY;
  if (!slug || !apiKey) throw new Error("Konfigurasi PAKASIR_SLUG / PAKASIR_API_KEY belum diisi");
  return { slug, apiKey };
};

export async function createPayment(amount) {
  const { slug, apiKey } = cfg();
  if (!Number.isInteger(amount) || amount < 1000) throw new Error("Nominal pembayaran minimal Rp 1.000");
  const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  try {
    const res = await axios.post(`${PAKASIR_BASE}/transactioncreate/qris`,
      { project: slug, order_id: orderId, amount, api_key: apiKey },
      { headers: { "Content-Type": "application/json" }, timeout: TIMEOUT });
    const payment = res.data?.payment;
    if (!payment?.payment_number) throw new Error("QR Pakasir tidak ditemukan");
    const qrBase64 = await QRCode.toDataURL(payment.payment_number, { width: 300, margin: 1 });
    return { orderId, qrBase64, amount };
  } catch (err) {
    throw new Error(err.response?.data?.message || err.message || "Gagal membuat pembayaran QRIS");
  }
}

export async function cekPaid(orderId, amount) {
  const { slug, apiKey } = cfg();
  try {
    const res = await axios.get(`${PAKASIR_BASE}/transactiondetail`,
      { params: { project: slug, order_id: orderId, amount, api_key: apiKey }, timeout: TIMEOUT });
    const status = res.data?.transaction?.status || res.data?.payment?.status || res.data?.status || "";
    return ["paid", "success", "completed"].includes(String(status).toLowerCase());
  } catch {
    return false; // error jaringan transien → polling lanjut, jangan crash
  }
}

export async function cancelPayment(orderId, amount) {
  const { slug, apiKey } = cfg();
  try {
    const res = await axios.post(`${PAKASIR_BASE}/transactioncancel`,
      { project: slug, api_key: apiKey, order_id: orderId, amount },
      { headers: { "Content-Type": "application/json" }, timeout: TIMEOUT });
    return res.data;
  } catch (err) {
    throw new Error(err.response?.data?.message || "Gagal membatalkan transaksi Pakasir");
  }
}

// KEAMANAN: simulasi hanya aktif jika env PAYMENT_SIMULATION=true
export async function simulatePayment(orderId, amount) {
  if (process.env.PAYMENT_SIMULATION !== "true") {
    throw new Error("Simulasi pembayaran dinonaktifkan di server ini");
  }
  const { slug, apiKey } = cfg();
  const res = await axios.post(`${PAKASIR_BASE}/paymentsimulation`,
    { project: slug, api_key: apiKey, order_id: orderId, amount },
    { headers: { "Content-Type": "application/json" }, timeout: TIMEOUT });
  return res.data;
}
