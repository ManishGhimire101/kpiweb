const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const prisma = require("../../lib/prisma");
const authenticateToken = require("../../middleware/auth");
const requireAdmin = require("../../middleware/admin");

const router = express.Router();
const PHOTO_ROOT = path.join(__dirname, "..", "..", "public", "uploads");
router.use(authenticateToken, requireAdmin);

router.use((req, res, next) => {
  if (!req.tenant || req.tenant.kind !== "institution" || req.tenant.institution?.id !== req.user.institutionId) {
    return res.status(403).json({ success: false, message: "Transfer operations are only available on your institution's domain" });
  }
  next();
});

async function newParentUsername(tx, institutionCode) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const username = `${institutionCode}-parent-transfer-${crypto.randomBytes(6).toString("hex")}`;
    const existing = await tx.user.findUnique({ where: { username }, select: { id: true } });
    if (!existing) return username;
  }
  throw new Error("Could not allocate a unique destination parent username");
}

router.get("/institutions", async (req, res) => {
  const institutions = await prisma.institution.findMany({
    where: { isActive: true, id: { not: req.user.institutionId } },
    select: { id: true, name: true, code: true, subdomain: true, type: true, logo: true, address: true, phone: true, email: true, website: true },
    orderBy: { name: "asc" },
  });
  res.json({ success: true, data: institutions });
});

router.post("/", async (req, res) => {
  try {
    const studentId = Number(req.body.studentId);
    const destinationInstitutionId = Number(req.body.destinationInstitutionId);
    if (!Number.isSafeInteger(studentId) || !Number.isSafeInteger(destinationInstitutionId)) {
      return res.status(400).json({ success: false, message: "Valid student and destination are required" });
    }
    if (destinationInstitutionId === req.user.institutionId) {
      return res.status(400).json({ success: false, message: "Choose another institution" });
    }
    const student = await prisma.studentProfile.findFirst({
      where: { id: studentId, institutionId: req.user.institutionId },
      select: { id: true, status: true },
    });
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });
    const destination = await prisma.institution.findFirst({ where: { id: destinationInstitutionId, isActive: true }, select: { id: true } });
    if (!destination) return res.status(404).json({ success: false, message: "Destination institution not found or inactive" });

    const pending = await prisma.studentTransferRequest.findFirst({ where: { studentId, status: "PENDING" } });
    if (pending) return res.status(409).json({ success: false, message: "This student already has a pending transfer request" });
    const request = await prisma.$transaction(async (tx) => {
      const pending = await tx.studentTransferRequest.findFirst({ where: { studentId, status: "PENDING" } });
      if (pending) return null;
      return tx.studentTransferRequest.create({
      data: {
        studentId,
        sourceInstitutionId: req.user.institutionId,
        destinationInstitutionId,
        requestedByUserId: req.user.id,
        note: typeof req.body.note === "string" ? req.body.note.trim().slice(0, 1000) : null,
      },
      include: {
          student: { select: { firstName: true, lastName: true, studentCode: true } },
        sourceInstitution: { select: { name: true, code: true } },
        destinationInstitution: { select: { name: true, code: true } },
      },
      });
    });
    if (!request) return res.status(409).json({ success: false, message: "This student already has a pending transfer request" });
    res.status(201).json({ success: true, data: request });
  } catch (error) {
    console.error("Create transfer request error:", error);
    res.status(500).json({ success: false, message: "Failed to create transfer request" });
  }
});

router.get("/incoming", async (req, res) => {
  const requests = await prisma.studentTransferRequest.findMany({
    where: { destinationInstitutionId: req.user.institutionId },
    include: {
      student: { select: { firstName: true, lastName: true, studentCode: true, photo: true, phone: true, dob: true, gender: true, address: true, admissionDate: true, status: true, parentStudents: { include: { parent: { select: { firstName: true, lastName: true, phone: true, address: true, occupation: true, user: { select: { username: true } } } } } } } },
      sourceInstitution: { select: { name: true, code: true } },
      destinationInstitution: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, data: requests });
});

router.get("/outgoing", async (req, res) => {
  const requests = await prisma.studentTransferRequest.findMany({
    where: { sourceInstitutionId: req.user.institutionId },
    include: {
      student: { select: { firstName: true, lastName: true, studentCode: true } },
      destinationInstitution: { select: { name: true, code: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, data: requests });
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id)) return res.status(400).json({ success: false, message: "Invalid transfer request ID" });
  const result = await prisma.studentTransferRequest.updateMany({
    where: { id, sourceInstitutionId: req.user.institutionId, status: "PENDING" },
    data: { status: "CANCELLED", respondedAt: new Date(), responseNote: "Cancelled by sending institution" },
  });
  if (result.count !== 1) return res.status(404).json({ success: false, message: "Pending transfer request not found" });
  res.json({ success: true, message: "Transfer request cancelled" });
});

router.post("/:id/respond", async (req, res) => {
  const id = Number(req.params.id);
  const decision = req.body?.decision;
  if (!Number.isSafeInteger(id) || !["ACCEPTED", "REJECTED"].includes(decision)) {
    return res.status(400).json({ success: false, message: "Valid request ID and ACCEPTED/REJECTED decision are required" });
  }
  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const transfer = await tx.studentTransferRequest.findFirst({
        where: { id, destinationInstitutionId: req.user.institutionId },
        include: {
          student: {
            include: {
              user: true,
              parentStudents: { include: { parent: { include: { user: true } } } },
            },
          },
          destinationInstitution: { select: { id: true, code: true, name: true, isActive: true } },
        },
      });
      if (!transfer) return { error: [404, "Transfer request not found"] };
      if (transfer.status !== "PENDING") return { error: [409, "This request has already been answered"] };
      if (decision === "REJECTED") {
        const claimed = await tx.studentTransferRequest.updateMany({ where: { id, status: "PENDING", destinationInstitutionId: req.user.institutionId }, data: { status: "REJECTED", responseNote: String(req.body.note || "").trim().slice(0, 1000) || null, respondedAt: new Date() } });
        if (claimed.count !== 1) return { error: [409, "This request was answered by another admin"] };
        return { rejected: true };
      }
      if (!transfer.destinationInstitution.isActive) return { error: [409, "Destination institution is inactive"] };
      const student = transfer.student;
      if (student.institutionId !== transfer.sourceInstitutionId || student.user.institutionId !== transfer.sourceInstitutionId) {
        return { error: [409, "Student record no longer belongs to the sending institution"] };
      }
      const claimed = await tx.studentTransferRequest.updateMany({ where: { id, status: "PENDING", destinationInstitutionId: req.user.institutionId }, data: { status: "ACCEPTED", respondedAt: new Date() } });
      if (claimed.count !== 1) return { error: [409, "This request was answered by another admin"] };

      const lastStudent = await tx.studentProfile.findFirst({ where: { institutionId: transfer.destinationInstitutionId }, orderBy: { id: "desc" }, select: { studentCode: true } });
      const lastNumber = Number(lastStudent?.studentCode?.split("-").pop());
      const studentCode = `${transfer.destinationInstitution.code}-${Number.isFinite(lastNumber) ? lastNumber + 1 : 1}`;
      let destinationPhoto = null;
      if (student.photo) {
        const photoName = path.basename(student.photo);
        const sourcePhotoPath = path.resolve(PHOTO_ROOT, String(transfer.sourceInstitutionId), "students", photoName);
        const destinationPhotoDir = path.join(PHOTO_ROOT, String(transfer.destinationInstitutionId), "students");
        if (sourcePhotoPath.startsWith(path.resolve(PHOTO_ROOT, String(transfer.sourceInstitutionId)) + path.sep) && fs.existsSync(sourcePhotoPath)) {
          fs.mkdirSync(destinationPhotoDir, { recursive: true });
          const destinationName = `${crypto.randomBytes(12).toString("hex")}${path.extname(photoName).toLowerCase()}`;
          fs.copyFileSync(sourcePhotoPath, path.join(destinationPhotoDir, destinationName));
          destinationPhoto = `/uploads/${transfer.destinationInstitutionId}/students/${destinationName}`;
        }
      }
      const archivedHistory = await tx.$queryRaw`
        SELECT
          (SELECT COALESCE(jsonb_agg(to_jsonb(a) - 'studentId'), '[]'::jsonb) FROM "Attendance" a WHERE a."studentId" = ${student.id}) AS attendance,
          (SELECT COALESCE(jsonb_agg(to_jsonb(hs) - 'studentId'), '[]'::jsonb) FROM "HomeworkSubmission" hs WHERE hs."studentId" = ${student.id}) AS submissions,
          (SELECT COALESCE(jsonb_agg(to_jsonb(c) - 'studentId'), '[]'::jsonb) FROM "Complaint" c WHERE c."studentId" = ${student.id}) AS complaints`;
      const destinationParentLogins = [];
      for (const parentLink of student.parentStudents) {
        const sourceParent = parentLink.parent;
        const sourceParentUser = sourceParent.user;
        const username = await newParentUsername(tx, transfer.destinationInstitution.code);
        const parentUser = await tx.user.create({ data: {
          institutionId: transfer.destinationInstitutionId,
          username,
          passwordHash: sourceParentUser.passwordHash,
          role: "PARENT",
          isActive: sourceParentUser.isActive,
          mustChangePassword: sourceParentUser.mustChangePassword,
        } });
        const destinationParent = await tx.parentProfile.create({ data: {
          userId: parentUser.id,
          institutionId: transfer.destinationInstitutionId,
          firstName: sourceParent.firstName,
          lastName: sourceParent.lastName,
          phone: sourceParent.phone,
          address: sourceParent.address,
          occupation: sourceParent.occupation,
        } });
        await tx.parentStudent.create({ data: {
          parentId: destinationParent.id,
          studentId: student.id,
          relationship: parentLink.relationship,
          isPrimary: parentLink.isPrimary,
        } });
        destinationParentLogins.push({ username, isPrimary: parentLink.isPrimary });
      }

      await tx.studentProfile.update({ where: { id: student.id }, data: { institutionId: transfer.destinationInstitutionId, studentCode, classId: null, rollNo: null, photo: destinationPhoto, admissionDate: new Date(), status: "ACTIVE" } });
      await tx.user.update({ where: { id: student.userId }, data: { institutionId: transfer.destinationInstitutionId } });
      if (student.parentStudents.length) {
        await tx.parentStudent.deleteMany({ where: { studentId: student.id } });
      }
      const historyArchive = { sourceInstitutionId: transfer.sourceInstitutionId, exportedAt: new Date().toISOString(), attendance: archivedHistory[0].attendance, submissions: archivedHistory[0].submissions, complaints: archivedHistory[0].complaints, recordsStayAtSource: true };
      await tx.studentTransferRequest.update({ where: { id }, data: { historyArchive, responseNote: String(req.body.note || "").trim().slice(0, 1000) || null } });

      // Keep the historic source-school records linked to their original classes/teachers.
      // Only the existing student's credentials/profile and a sibling-safe destination parent login transfer.
      return { accepted: true, studentId: student.id, studentCode, parentLogins: destinationParentLogins };
    });
    if (outcome.error) return res.status(outcome.error[0]).json({ success: false, message: outcome.error[1] });
    res.json({ success: true, message: outcome.rejected ? "Transfer request rejected" : "Transfer accepted. Existing student login is preserved; parent gets a separate destination login.", data: outcome });
  } catch (error) {
    console.error("Respond to transfer request error:", error);
    res.status(500).json({ success: false, message: "Unable to process transfer request" });
  }
});

module.exports = router;
