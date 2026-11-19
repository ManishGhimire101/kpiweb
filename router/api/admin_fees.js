const express = require("express");
const prisma = require("../../lib/prisma");
const authenticateToken = require("../../middleware/auth");
const requireAdmin = require("../../middleware/admin");
const PDFDocument = require("pdfkit");
const path = require("path");

const router = express.Router();
router.use(authenticateToken, requireAdmin);

function wrap(handler) {
  return (req, res) => Promise.resolve(handler(req, res)).catch((error) => {
    console.error("Admin fees error:", error);
    res.status(500).json({ success: false, message: "Unable to process fee request" });
  });
}
function bad(res, message, status = 400) {
  return res.status(status).json({ success: false, message });
}
function int(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

router.get("/catalog", wrap(async (req, res) => {
  const [programs, classes, students, plans] = await Promise.all([
    prisma.program.findMany({ where: { institutionId: req.user.institutionId }, include: { courses: true }, orderBy: { name: "asc" } }),
    prisma.class.findMany({ where: { institutionId: req.user.institutionId }, orderBy: [{ name: "asc" }, { section: "asc" }] }),
    prisma.studentProfile.findMany({ where: { institutionId: req.user.institutionId }, select: { id: true, studentCode: true, firstName: true, lastName: true, programId: true, courseId: true, classId: true }, orderBy: { studentCode: "asc" } }),
    prisma.feePlan.findMany({ where: { institutionId: req.user.institutionId }, include: { program: true, class: true, items: true }, orderBy: { createdAt: "desc" } }),
  ]);
  res.json({ success: true, data: { programs, classes, students, plans } });
}));

router.post("/plans", wrap(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const targetType = req.body.targetType === "CLASS" ? "CLASS" : "PROGRAM";
  const programId = targetType === "PROGRAM" ? int(req.body.programId) : null;
  const courseId = req.body.courseId ? int(req.body.courseId) : null;
  const classId = targetType === "CLASS" ? int(req.body.classId) : null;
  const cycle = ["TERM", "MONTHLY", "QUARTERLY", "SEMI_ANNUAL"].includes(req.body.cycle) ? req.body.cycle : null;
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!name || name.length > 120 || !cycle || !items.length || items.length > 40 || (targetType === "PROGRAM" && !programId) || (targetType === "CLASS" && !classId)) return bad(res, "Enter a plan name, target, cycle, and at least one charge");
  if (programId && !await prisma.program.findFirst({ where: { id: programId, institutionId: req.user.institutionId } })) return bad(res, "Program not found", 404);
  if (classId && !await prisma.class.findFirst({ where: { id: classId, institutionId: req.user.institutionId } })) return bad(res, "Class not found", 404);
  if (courseId && (!programId || !await prisma.course.findFirst({ where: { id: courseId, programId, program: { institutionId: req.user.institutionId } } }))) return bad(res, "Course does not belong to this program");
  const normalized = items.map((item) => ({ heading: String(item.heading || "").trim(), amount: Number(item.amount) }));
  if (normalized.some((item) => !item.heading || item.heading.length > 100 || !Number.isSafeInteger(item.amount) || item.amount <= 0 || item.amount > 100000000)) return bad(res, "Each charge needs a heading and a positive whole-number amount");
  if (normalized.reduce((sum, item) => sum + item.amount, 0) > 100000000) return bad(res, "The total fee plan amount is too large");
  const duplicate = await prisma.feePlan.findFirst({ where: { institutionId: req.user.institutionId, name, ...(classId ? { classId } : { programId, courseId }) } });
  if (duplicate) return bad(res, "A fee plan with this name already exists for this target", 409);
  const plan = await prisma.feePlan.create({ data: { institutionId: req.user.institutionId, programId, courseId, classId, name, cycle, items: { create: normalized } }, include: { items: true, program: true, class: true } });
  res.status(201).json({ success: true, data: plan });
}));

router.patch("/plans/:id", wrap(async (req, res) => {
  const planId = int(req.params.id);
  const active = req.body.active;
  if (!planId || typeof active !== "boolean") return bad(res, "A plan and active status are required");
  const changed = await prisma.feePlan.updateMany({ where: { id: planId, institutionId: req.user.institutionId }, data: { active } });
  if (!changed.count) return bad(res, "Fee plan not found", 404);
  res.json({ success: true, message: active ? "Fee plan activated" : "Fee plan deactivated" });
}));

router.post("/plans/:id/issue", wrap(async (req, res) => {
  const planId = int(req.params.id);
  const academicYear = String(req.body.academicYear || "").trim();
  const period = String(req.body.period || "").trim();
  const dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
  if (!planId || !academicYear || academicYear.length > 30 || !period || period.length > 80 || (dueDate && Number.isNaN(dueDate.getTime()))) return bad(res, "Provide the academic year, billing period, and a valid optional due date");
  const plan = await prisma.feePlan.findFirst({ where: { id: planId, institutionId: req.user.institutionId }, include: { items: true } });
  if (!plan) return bad(res, "Fee plan not found", 404);
  if (!plan.active) return bad(res, "This fee plan is inactive", 409);
  const students = await prisma.studentProfile.findMany({ where: { institutionId: req.user.institutionId, ...(plan.classId ? { classId: plan.classId } : { programId: plan.programId, ...(plan.courseId ? { courseId: plan.courseId } : {}) }) }, select: { id: true } });
  if (!students.length) return bad(res, plan.classId ? "No students are assigned to this class" : "No students are assigned to this plan's program/course", 409);
  const lines = plan.items.map(({ heading, amount }) => ({ heading, amount }));
  const totalAmount = lines.reduce((sum, item) => sum + item.amount, 0);
  const bills = await prisma.$transaction(students.map((student) => prisma.feeBill.upsert({ where: { studentId_planId_academicYear_period: { studentId: student.id, planId, academicYear, period } }, create: { institutionId: req.user.institutionId, studentId: student.id, planId, title: plan.name, academicYear, period, lines, totalAmount, dueDate }, update: {} })));
  const issued = bills.length;
  res.status(201).json({ success: true, message: `Issued ${issued} bills`, data: { count: issued } });
}));

router.get("/bills", wrap(async (req, res) => {
  const bills = await prisma.feeBill.findMany({ where: { institutionId: req.user.institutionId }, include: { student: true, payments: { where: { status: "PAID" } } }, orderBy: { createdAt: "desc" }, take: 500 });
  res.json({ success: true, data: bills.map((bill) => ({ id: bill.id, studentId: bill.studentId, student: `${bill.student.firstName} ${bill.student.lastName || ""}`.trim(), studentCode: bill.student.studentCode, title: bill.title, academicYear: bill.academicYear, period: bill.period, totalAmount: bill.totalAmount, paidAmount: bill.payments.reduce((total, payment) => total + payment.amount, 0), dueDate: bill.dueDate, createdAt: bill.createdAt })) });
}));

router.get("/bills/:id/pdf", wrap(async (req, res) => {
  const billId = int(req.params.id);
  if (!billId) return bad(res, "Invalid bill", 400);
  const bill = await prisma.feeBill.findFirst({ where: { id: billId, institutionId: req.user.institutionId }, include: { student: true, institution: true, payments: { where: { status: "PAID" }, orderBy: { paidAt: "asc" } } } });
  if (!bill) return bad(res, "Bill not found", 404);
  const paid = bill.payments.reduce((sum, payment) => sum + payment.amount, 0);
  const settings = await prisma.institutionFeeSettings.findUnique({ where: { institutionId: bill.institutionId } });
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="fee-bill-${bill.id}.pdf"`);
  doc.pipe(res);
  if (bill.institution.logo) {
    const logoPath = path.resolve(__dirname, "../../public", String(bill.institution.logo).replace(/^\/+/, ""));
    if (logoPath.startsWith(path.resolve(__dirname, "../../public") + path.sep)) { try { doc.image(logoPath, 48, 42, { fit: [72, 72] }); } catch (_) {} }
  }
  doc.font("Helvetica-Bold").fontSize(19).text(bill.institution.name, { align: "center" });
  doc.font("Helvetica").fontSize(9);
  const contact = [bill.institution.address, bill.institution.phone, bill.institution.email, bill.institution.website].filter(Boolean).join(" | ");
  if (contact) doc.text(contact, { align: "center" });
  doc.moveDown(1).font("Helvetica-Bold").fontSize(16).text("FEE BILL", { align: "center" });
  doc.moveDown().font("Helvetica").fontSize(11).text(`Bill #: ${bill.id}`).text(`Student: ${bill.student.firstName} ${bill.student.lastName || ""} (${bill.student.studentCode})`).text(`Bill: ${bill.title}`).text(`Period: ${bill.period} · Academic year: ${bill.academicYear}`).text(`Issued: ${bill.createdAt.toISOString().slice(0, 10)}`).text(`Due date: ${bill.dueDate ? bill.dueDate.toISOString().slice(0, 10) : "Not specified"}`);
  doc.moveDown().font("Helvetica-Bold").text("Itemized charges");
  for (const line of Array.isArray(bill.lines) ? bill.lines : []) doc.font("Helvetica").text(`${line.heading}: NPR ${Number(line.amount || 0).toLocaleString()}`);
  doc.moveDown().font("Helvetica-Bold").text(`Total: NPR ${bill.totalAmount.toLocaleString()}`).text(`Paid: NPR ${paid.toLocaleString()}`).text(`Balance due: NPR ${Math.max(0, bill.totalAmount - paid).toLocaleString()}`);
  doc.moveDown().font("Helvetica-Bold").text("Payment history");
  if (!bill.payments.length) doc.font("Helvetica").text("No payments recorded.");
  for (const payment of bill.payments) doc.font("Helvetica").text(`${payment.paidAt ? payment.paidAt.toISOString().slice(0, 10) : "-"} · ${payment.method} · NPR ${payment.amount.toLocaleString()}`);
  if (settings?.enabled) {
    doc.moveDown().font("Helvetica-Bold").text("Payment information");
    if (settings.merchantName) doc.font("Helvetica").text(`Payable to: ${settings.merchantName}`);
    if (settings.merchantPhone) doc.text(`Contact: ${settings.merchantPhone}`);
    if (settings.bankName) doc.text(`Bank: ${settings.bankName}`);
    if (settings.bankAccountName) doc.text(`Account holder: ${settings.bankAccountName}`);
    if (settings.bankAccountNumber) doc.text(`Account number: ${settings.bankAccountNumber}`);
    if (settings.khaltiSecretEncrypted) doc.text("Khalti online payment is available through the parent portal.");
  }
  doc.end();
}));

router.put("/students/:id/program", wrap(async (req, res) => {
  const studentId = int(req.params.id);
  const programId = req.body.programId ? int(req.body.programId) : null;
  const courseId = req.body.courseId ? int(req.body.courseId) : null;
  if (!studentId) return bad(res, "Invalid student");
  if (programId && !await prisma.program.findFirst({ where: { id: programId, institutionId: req.user.institutionId } })) return bad(res, "Program not found", 404);
  if (courseId && (!programId || !await prisma.course.findFirst({ where: { id: courseId, programId } }))) return bad(res, "Course does not belong to this program");
  const result = await prisma.studentProfile.updateMany({ where: { id: studentId, institutionId: req.user.institutionId }, data: { programId, courseId } });
  if (!result.count) return bad(res, "Student not found", 404);
  res.json({ success: true, message: "Student program assignment updated" });
}));

router.post("/bills/:id/manual-payment", wrap(async (req, res) => {
  const billId = int(req.params.id);
  const amount = Number(req.body.amount);
  if (!billId || !Number.isSafeInteger(amount) || amount <= 0) return bad(res, "Enter a valid whole-number payment amount");
  const bill = await prisma.feeBill.findFirst({ where: { id: billId, institutionId: req.user.institutionId }, include: { payments: { where: { status: "PAID" } } } });
  if (!bill) return bad(res, "Bill not found", 404);
  const balance = bill.totalAmount - bill.payments.reduce((sum, payment) => sum + payment.amount, 0);
  if (amount > balance) return bad(res, "Payment cannot exceed the outstanding balance");
  const method = String(req.body.method || "CASH").trim().toUpperCase();
  if (!["CASH", "BANK", "OTHER"].includes(method)) return bad(res, "Invalid payment method");
  await prisma.feePayment.create({ data: { billId, amount, method, status: "PAID", paidAt: new Date(), receivedByUserId: req.user.id } });
  res.status(201).json({ success: true, message: "Payment recorded" });
}));

module.exports = router;
