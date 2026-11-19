const express = require("express");
const PDFDocument = require("pdfkit");
const prisma = require("../../lib/prisma");
const authenticateToken = require("../../middleware/auth");
const requireRole = require("../../middleware/roles");
const lms = require("../../lib/lms");

const router = express.Router();
function tenantPath(req, path) {
  const match = req.originalUrl.match(/^\/tenant\/([^/?]+)/);
  return `${match ? `/tenant/${match[1]}` : ""}${path}`;
}
function wrap(handler) {
  return (req, res) => Promise.resolve(handler(req, res)).catch((error) => {
    console.error("Parent fees error:", error);
    if (!res.headersSent) res.status(500).json({ success: false, message: "Unable to process fee request" });
  });
}

// Khalti redirects here without the portal's Bearer token. Confirm the pidx
// directly with Khalti before updating the payment ledger.
router.get("/khalti/return", wrap(async (req, res) => {
  const pidx = String(req.query.pidx || "");
  const payment = pidx ? await prisma.feePayment.findUnique({ where: { khaltiPidx: pidx } }) : null;
  if (!payment || payment.status === "PAID") return res.redirect(tenantPath(req, "/parent#fees"));
  const paymentBill = payment ? await prisma.feeBill.findUnique({ where: { id: payment.billId }, select: { institutionId: true } }) : null;
  const settings = paymentBill ? await prisma.institutionFeeSettings.findUnique({ where: { institutionId: paymentBill.institutionId } }) : null;
  const secretKey = settings?.enabled ? decryptInstitutionSecret(settings.khaltiSecretEncrypted) : null;
  if (!secretKey) return res.redirect(tenantPath(req, "/parent#fees"));
  const verify = await fetch("https://a.khalti.com/api/v2/epayment/lookup/", { method: "POST", headers: { Authorization: `Key ${secretKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ pidx }) });
  const data = await verify.json();
  if (verify.ok && data.status === "Completed" && data.total_amount === payment.amount * 100 && data.purchase_order_id === `PAY-${payment.id}-BILL-${payment.billId}`) {
    const claimed = await prisma.feePayment.updateMany({ where: { id: payment.id, status: "PENDING" }, data: { status: "PAID", paidAt: new Date(), khaltiTransactionId: data.transaction_id || null } });
    if (claimed.count) return res.redirect(tenantPath(req, "/parent#fees"));
  }
  res.redirect(tenantPath(req, "/parent#fees"));
}));

router.use(authenticateToken, requireRole("PARENT"), lms.loadParent);
async function ownedBill(req, billId) {
  const links = await prisma.parentStudent.findMany({ where: { parentId: req.parent.id }, select: { studentId: true } });
  return prisma.feeBill.findFirst({ where: { id: billId, studentId: { in: links.map((link) => link.studentId) }, institutionId: req.user.institutionId }, include: { student: true, institution: true, payments: { where: { status: "PAID" }, orderBy: { paidAt: "asc" } } } });
}
function balance(bill) {
  return bill.totalAmount - bill.payments.reduce((sum, payment) => sum + payment.amount, 0);
}

function decryptInstitutionSecret(encrypted) {
  const key = process.env.FEE_SETTINGS_ENCRYPTION_KEY ? Buffer.from(process.env.FEE_SETTINGS_ENCRYPTION_KEY, "hex") : null;
  if (!encrypted || !key || key.length !== 32) return null;
  const payload = Buffer.from(encrypted, "base64");
  if (payload.length < 29) return null;
  const decipher = require("crypto").createDecipheriv("aes-256-gcm", key, payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString("utf8");
}

router.get("/bills", wrap(async (req, res) => {
  const links = await prisma.parentStudent.findMany({ where: { parentId: req.parent.id }, select: { studentId: true } });
  const bills = await prisma.feeBill.findMany({ where: { institutionId: req.user.institutionId, studentId: { in: links.map((link) => link.studentId) } }, include: { student: true, payments: { where: { status: "PAID" } } }, orderBy: { createdAt: "desc" } });
  res.json({ success: true, data: bills.map((bill) => { const paidAmount = bill.payments.reduce((sum, payment) => sum + payment.amount, 0); return { id: bill.id, studentId: bill.studentId, studentName: lms.fullName(bill.student), title: bill.title, academicYear: bill.academicYear, period: bill.period, lines: bill.lines, totalAmount: bill.totalAmount, paidAmount, balance: bill.totalAmount - paidAmount, status: paidAmount >= bill.totalAmount ? "PAID" : paidAmount > 0 ? "PARTIAL" : bill.dueDate && bill.dueDate < new Date() ? "OVERDUE" : "DUE", dueDate: bill.dueDate, createdAt: bill.createdAt }; }) });
}));

router.get("/bills/:id/receipt", wrap(async (req, res) => {
  const bill = await ownedBill(req, Number(req.params.id));
  if (!bill) return res.status(404).json({ success: false, message: "Bill not found" });
  if (!bill.payments.length) return res.status(409).json({ success: false, message: "A receipt is available after confirmed payment" });
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="fee-receipt-${bill.id}.pdf"`);
  doc.pipe(res);
  doc.fontSize(20).font("Helvetica-Bold").text(bill.institution.name, { align: "center" });
  doc.moveDown().fontSize(16).text("Fee Payment Receipt", { align: "center" });
  doc.moveDown().fontSize(11).font("Helvetica").text(`Receipt for bill #${bill.id}`);
  doc.text(`Student: ${lms.fullName(bill.student)} (${bill.student.studentCode})`);
  doc.text(`Bill: ${bill.title} — ${bill.period}, ${bill.academicYear}`);
  doc.moveDown().font("Helvetica-Bold").text("Fee charges");
  for (const line of Array.isArray(bill.lines) ? bill.lines : []) doc.font("Helvetica").text(`${line.heading}: NPR ${Number(line.amount || 0).toLocaleString()}`);
  doc.moveDown().font("Helvetica-Bold").text("Payments received");
  for (const payment of bill.payments) doc.font("Helvetica").text(`${payment.paidAt ? payment.paidAt.toISOString().slice(0, 10) : "-"} | ${payment.method} | NPR ${payment.amount.toLocaleString()}`);
  doc.moveDown().font("Helvetica-Bold").text(`Total paid: NPR ${bill.payments.reduce((sum, payment) => sum + payment.amount, 0).toLocaleString()}`);
  doc.text(`Bill total: NPR ${bill.totalAmount.toLocaleString()}`);
  doc.end();
}));

router.post("/bills/:id/khalti/initiate", wrap(async (req, res) => {
  const bill = await ownedBill(req, Number(req.params.id));
  if (!bill) return res.status(404).json({ success: false, message: "Bill not found" });
  const amount = balance(bill);
  if (amount <= 0) return res.status(409).json({ success: false, message: "This bill is already paid" });
  const settings = await prisma.institutionFeeSettings.findUnique({ where: { institutionId: bill.institutionId } });
  const secretKey = settings?.enabled ? decryptInstitutionSecret(settings.khaltiSecretEncrypted) : null;
  if (!secretKey) return res.status(503).json({ success: false, message: "Online payment is not configured yet" });
  const existingPending = await prisma.feePayment.findFirst({ where: { billId: bill.id, status: "PENDING", method: "KHALTI" }, orderBy: { createdAt: "desc" } });
  if (existingPending && new Date() - existingPending.createdAt < 10 * 60 * 1000) return res.status(409).json({ success: false, message: "A Khalti payment is already in progress. Please wait a few minutes before retrying." });
  const origin = `${req.protocol}://${req.get("host")}`;
  const returnUrl = `${origin}${tenantPath(req, "/api/fees/khalti/return")}`;
  const payment = await prisma.feePayment.create({ data: { billId: bill.id, amount, method: "KHALTI", status: "PENDING" } });
  const response = await fetch("https://a.khalti.com/api/v2/epayment/initiate/", { method: "POST", headers: { Authorization: `Key ${secretKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ return_url: returnUrl, website_url: origin, amount: amount * 100, purchase_order_id: `PAY-${payment.id}-BILL-${bill.id}`, purchase_order_name: bill.title.slice(0, 100), customer_info: { name: lms.fullName(bill.student) } }) });
  const data = await response.json();
  if (!response.ok || !data.pidx || !data.payment_url) {
    await prisma.feePayment.delete({ where: { id: payment.id } });
    return res.status(502).json({ success: false, message: "Khalti could not initiate payment" });
  }
  await prisma.feePayment.update({ where: { id: payment.id }, data: { khaltiPidx: data.pidx } });
  res.json({ success: true, data: { paymentUrl: data.payment_url } });
}));

module.exports = router;
