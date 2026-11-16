const express = require("express");
const fs = require("fs");

const prisma = require("../../lib/prisma");
const authenticateToken = require("../../middleware/auth");
const lms = require("../../lib/lms");
const { resolveStoredPath } = require("../../lib/files");

const router = express.Router();

router.use(authenticateToken);

async function canAccessClass(user, classId) {
  if (user.role === "ADMIN") {
    return true;
  }

  if (user.role === "TEACHER") {
    const teacher = await prisma.teacherProfile.findUnique({ where: { userId: user.id } });
    return !!teacher && !!(await lms.teacherAssignment(teacher.id, classId));
  }

  if (user.role === "STUDENT") {
    const student = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
    return !!student && student.classId === classId;
  }

  if (user.role === "PARENT") {
    const parent = await prisma.parentProfile.findUnique({ where: { userId: user.id } });
    if (!parent) return false;

    const link = await prisma.parentStudent.findFirst({
      where: { parentId: parent.id, student: { classId } },
    });

    return !!link;
  }

  return false;
}

async function canAccessSubmission(user, submission) {
  if (user.role === "ADMIN") {
    return true;
  }

  if (user.role === "TEACHER") {
    return canAccessClass(user, submission.homework.classId);
  }

  if (user.role === "STUDENT") {
    const student = await prisma.studentProfile.findUnique({ where: { userId: user.id } });
    return !!student && student.id === submission.studentId;
  }

  if (user.role === "PARENT") {
    const parent = await prisma.parentProfile.findUnique({ where: { userId: user.id } });
    if (!parent) return false;

    const link = await prisma.parentStudent.findFirst({
      where: { parentId: parent.id, studentId: submission.studentId },
    });

    return !!link;
  }

  return false;
}

router.get("/:kind/:id/:index", async (req, res) => {
  try {
    const id = lms.toInt(req.params.id);
    const index = Number(req.params.index);
    const { kind } = req.params;
    const institutionId = req.user.institutionId;

    if (!id || !Number.isInteger(index) || index < 0) {
      return res.status(400).json({ success: false, message: "Invalid file" });
    }

    let record = null;
    let allowed = false;

    if (kind === "homework") {
      record = await prisma.homework.findFirst({ where: { id, institutionId } });
      allowed = !!record && (await canAccessClass(req.user, record.classId));
    } else if (kind === "resource") {
      record = await prisma.resource.findFirst({ where: { id, institutionId } });
      allowed = !!record && (await canAccessClass(req.user, record.classId));
    } else if (kind === "submission") {
      record = await prisma.homeworkSubmission.findFirst({
        where: { id, homework: { institutionId } },
        include: { homework: true },
      });
      allowed = !!record && (await canAccessSubmission(req.user, record));
    } else {
      return res.status(404).json({ success: false, message: "File not found" });
    }

    if (!record || !allowed) {
      return res.status(404).json({ success: false, message: "File not found" });
    }

    const entry = record.files[index];
    const full = entry ? resolveStoredPath(institutionId, entry.stored) : null;

    if (!full || !fs.existsSync(full)) {
      return res.status(404).json({ success: false, message: "File not found" });
    }

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.download(full, entry.name);
  } catch (error) {
    console.error("File download error:", error);
    res.status(500).json({ success: false, message: "Download failed" });
  }
});

module.exports = router;
