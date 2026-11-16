const express = require("express");

const prisma = require("../../lib/prisma");
const authenticateToken = require("../../middleware/auth");
const requireRole = require("../../middleware/roles");
const lms = require("../../lib/lms");
const files = require("../../lib/files");

const router = express.Router();

router.use(authenticateToken, requireRole("STUDENT"), lms.loadStudent);

function wrap(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error("Student API error:", error);
      files.cleanupUploaded(req);

      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "Something went wrong" });
      }
    }
  };
}

function homeworkView(hw, submission) {
  const now = Date.now();
  let status = "PENDING";

  if (submission) {
    status = submission.reviewedAt ? "REVIEWED" : "SUBMITTED";
  } else if (hw.dueDate.getTime() < now) {
    status = "OVERDUE";
  }

  return {
    id: hw.id,
    title: hw.title,
    subject: hw.subject,
    description: hw.description,
    dueDate: hw.dueDate,
    createdAt: hw.createdAt,
    teacherName: hw.teacher ? lms.fullName(hw.teacher) : null,
    status,
    files: files.publicFiles(hw.files, `/api/files/homework/${hw.id}`),
    submission: submission
      ? {
          id: submission.id,
          note: submission.note,
          isLate: submission.isLate,
          submittedAt: submission.submittedAt,
          grade: submission.grade,
          feedback: submission.feedback,
          reviewedAt: submission.reviewedAt,
          files: files.publicFiles(submission.files, `/api/files/submission/${submission.id}`),
        }
      : null,
  };
}

router.get(
  "/me",
  wrap(async (req, res) => {
    const s = req.student;

    res.json({
      success: true,
      data: {
        name: lms.fullName(s),
        studentCode: s.studentCode,
        rollNo: s.rollNo,
        classId: s.classId,
        classLabel: lms.classLabel(s.class),
      },
    });
  }),
);

router.get(
  "/homework",
  wrap(async (req, res) => {
    if (!req.student.classId) {
      return res.json({ success: true, data: [] });
    }

    const list = await prisma.homework.findMany({
      where: {
        classId: req.student.classId,
        institutionId: req.user.institutionId,
      },
      include: {
        teacher: true,
        submissions: { where: { studentId: req.student.id } },
      },
      orderBy: { dueDate: "desc" },
    });

    res.json({
      success: true,
      data: list.map((hw) => homeworkView(hw, hw.submissions[0] || null)),
    });
  }),
);

router.post(
  "/homework/:id/submit",
  files.handleUpload,
  wrap(async (req, res) => {
    const fail = (status, message) => {
      files.cleanupUploaded(req);
      return res.status(status).json({ success: false, message });
    };

    const id = lms.toInt(req.params.id);
    const homework = id
      ? await prisma.homework.findFirst({
          where: {
            id,
            classId: req.student.classId || -1,
            institutionId: req.user.institutionId,
          },
        })
      : null;

    if (!homework) {
      return fail(404, "Homework not found");
    }

    const existing = await prisma.homeworkSubmission.findUnique({
      where: {
        homeworkId_studentId: { homeworkId: homework.id, studentId: req.student.id },
      },
    });

    if (existing && existing.reviewedAt) {
      return fail(403, "This submission has already been reviewed and can no longer be changed");
    }

    const note = req.body.note ? String(req.body.note).trim().slice(0, 2000) : null;
    const uploaded = files.toFileEntries(req.files);

    if (!uploaded.length && !note && !(existing && existing.files.length)) {
      return fail(400, "Attach a file or write a note to submit");
    }

    const isLate = homework.dueDate.getTime() < Date.now();
    const replaceFiles = uploaded.length > 0;

    const submission = await prisma.homeworkSubmission.upsert({
      where: {
        homeworkId_studentId: { homeworkId: homework.id, studentId: req.student.id },
      },
      create: {
        homeworkId: homework.id,
        studentId: req.student.id,
        note,
        files: uploaded,
        isLate,
      },
      update: {
        note,
        isLate,
        submittedAt: new Date(),
        ...(replaceFiles ? { files: uploaded } : {}),
      },
    });

    if (existing && replaceFiles) {
      files.removeStoredFiles(req.user.institutionId, existing.files);
    }

    res.status(existing ? 200 : 201).json({
      success: true,
      message: isLate ? "Submitted (late)" : "Homework submitted",
      data: { id: submission.id },
    });
  }),
);

router.get(
  "/resources",
  wrap(async (req, res) => {
    if (!req.student.classId) {
      return res.json({ success: true, data: [] });
    }

    const list = await prisma.resource.findMany({
      where: {
        classId: req.student.classId,
        institutionId: req.user.institutionId,
      },
      include: { teacher: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      data: list.map((r) => ({
        id: r.id,
        title: r.title,
        subject: r.subject,
        description: r.description,
        createdAt: r.createdAt,
        teacherName: lms.fullName(r.teacher),
        files: files.publicFiles(r.files, `/api/files/resource/${r.id}`),
      })),
    });
  }),
);

router.get(
  "/attendance",
  wrap(async (req, res) => {
    const records = await prisma.attendance.findMany({
      where: { studentId: req.student.id },
      orderBy: { date: "desc" },
    });

    res.json({
      success: true,
      summary: lms.summarizeAttendance(records),
      data: records.slice(0, 120).map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        status: r.status,
        remark: r.remark,
      })),
    });
  }),
);

module.exports = router;
