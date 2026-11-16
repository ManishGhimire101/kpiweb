const express = require("express");

const prisma = require("../../lib/prisma");
const authenticateToken = require("../../middleware/auth");
const requireRole = require("../../middleware/roles");
const lms = require("../../lib/lms");
const files = require("../../lib/files");

const router = express.Router();

router.use(authenticateToken, requireRole("TEACHER"), lms.loadTeacher);

function wrap(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error("Teacher API error:", error);
      files.cleanupUploaded(req);

      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "Something went wrong" });
      }
    }
  };
}

async function requireClassAccess(req, res, classId) {
  const id = lms.toInt(classId);

  if (!id) {
    res.status(400).json({ success: false, message: "A valid class is required" });
    return null;
  }

  const assignment = await lms.teacherAssignment(req.teacher.id, id);

  if (!assignment) {
    res.status(403).json({
      success: false,
      message: "You are not assigned to this class",
    });
    return null;
  }

  return id;
}

router.get(
  "/classes",
  wrap(async (req, res) => {
    const rows = await prisma.teacherClass.findMany({
      where: { teacherId: req.teacher.id },
      include: {
        class: { include: { _count: { select: { students: true } } } },
      },
      orderBy: { class: { name: "asc" } },
    });

    const map = new Map();

    for (const row of rows) {
      if (!map.has(row.classId)) {
        map.set(row.classId, {
          id: row.classId,
          label: lms.classLabel(row.class),
          studentCount: row.class._count.students,
          subjects: [],
        });
      }

      if (row.subject) {
        map.get(row.classId).subjects.push(row.subject);
      }
    }

    res.json({ success: true, data: [...map.values()] });
  }),
);

router.get(
  "/classes/:id/students",
  wrap(async (req, res) => {
    const classId = await requireClassAccess(req, res, req.params.id);
    if (!classId) return;

    const students = await prisma.studentProfile.findMany({
      where: { classId, institutionId: req.user.institutionId },
      orderBy: [{ rollNo: "asc" }, { firstName: "asc" }],
    });

    res.json({
      success: true,
      data: students.map((s) => ({
        id: s.id,
        name: lms.fullName(s),
        studentCode: s.studentCode,
        rollNo: s.rollNo,
      })),
    });
  }),
);

function homeworkSummary(hw, studentCount, submissionCount) {
  return {
    id: hw.id,
    classId: hw.classId,
    classLabel: lms.classLabel(hw.class),
    title: hw.title,
    subject: hw.subject,
    description: hw.description,
    dueDate: hw.dueDate,
    createdAt: hw.createdAt,
    files: files.publicFiles(hw.files, `/api/files/homework/${hw.id}`),
    submissionCount,
    studentCount,
  };
}

router.get(
  "/homework",
  wrap(async (req, res) => {
    const assigned = await prisma.teacherClass.findMany({
      where: { teacherId: req.teacher.id },
      select: { classId: true },
    });

    const classIds = [...new Set(assigned.map((a) => a.classId))];
    let where = {
      institutionId: req.user.institutionId,
      classId: { in: classIds },
    };

    if (req.query.classId) {
      const id = lms.toInt(req.query.classId);
      if (!id || !classIds.includes(id)) {
        return res.json({ success: true, data: [] });
      }
      where = { ...where, classId: id };
    }

    const list = await prisma.homework.findMany({
      where,
      include: { class: { include: { _count: { select: { students: true } } } }, _count: { select: { submissions: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      data: list.map((hw) =>
        homeworkSummary(hw, hw.class._count.students, hw._count.submissions),
      ),
    });
  }),
);

router.post(
  "/homework",
  files.handleUpload,
  wrap(async (req, res) => {
    const { title, description, subject, dueDate } = req.body;
    const classId = await requireClassAccess(req, res, req.body.classId);

    if (!classId) {
      return files.cleanupUploaded(req);
    }

    const fail = (message) => {
      files.cleanupUploaded(req);
      return res.status(400).json({ success: false, message });
    };

    if (!title || !String(title).trim()) {
      return fail("Title is required");
    }

    if (String(title).trim().length > 200) {
      return fail("Title must be 200 characters or fewer");
    }

    const due = new Date(dueDate);

    if (!dueDate || Number.isNaN(due.getTime())) {
      return fail("A valid due date is required");
    }

    const homework = await prisma.homework.create({
      data: {
        institutionId: req.user.institutionId,
        classId,
        teacherId: req.teacher.id,
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        subject: subject ? String(subject).trim() : null,
        dueDate: due,
        files: files.toFileEntries(req.files),
      },
    });

    res.status(201).json({
      success: true,
      message: "Homework assigned",
      data: { id: homework.id },
    });
  }),
);

async function ownHomework(req, res) {
  const id = lms.toInt(req.params.id);
  const homework = id
    ? await prisma.homework.findFirst({
        where: { id, institutionId: req.user.institutionId },
        include: { class: true },
      })
    : null;

  if (!homework) {
    res.status(404).json({ success: false, message: "Homework not found" });
    return null;
  }

  const assignment = await lms.teacherAssignment(req.teacher.id, homework.classId);

  if (!assignment) {
    res.status(403).json({
      success: false,
      message: "You are not assigned to this class",
    });
    return null;
  }

  return homework;
}

router.get(
  "/homework/:id",
  wrap(async (req, res) => {
    const homework = await ownHomework(req, res);
    if (!homework) return;

    const [students, submissions] = await Promise.all([
      prisma.studentProfile.findMany({
        where: { classId: homework.classId, institutionId: req.user.institutionId },
        orderBy: [{ rollNo: "asc" }, { firstName: "asc" }],
      }),
      prisma.homeworkSubmission.findMany({
        where: { homeworkId: homework.id },
      }),
    ]);

    const byStudent = new Map(submissions.map((s) => [s.studentId, s]));

    res.json({
      success: true,
      data: {
        ...homeworkSummary(homework, students.length, submissions.length),
        students: students.map((student) => {
          const sub = byStudent.get(student.id);

          return {
            studentId: student.id,
            name: lms.fullName(student),
            studentCode: student.studentCode,
            rollNo: student.rollNo,
            submission: sub
              ? {
                  id: sub.id,
                  note: sub.note,
                  isLate: sub.isLate,
                  submittedAt: sub.submittedAt,
                  grade: sub.grade,
                  feedback: sub.feedback,
                  reviewedAt: sub.reviewedAt,
                  files: files.publicFiles(sub.files, `/api/files/submission/${sub.id}`),
                }
              : null,
          };
        }),
      },
    });
  }),
);

router.put(
  "/homework/:id",
  wrap(async (req, res) => {
    const homework = await ownHomework(req, res);
    if (!homework) return;

    const data = {};

    if (req.body.title !== undefined) {
      if (!String(req.body.title).trim()) {
        return res.status(400).json({ success: false, message: "Title is required" });
      }
      data.title = String(req.body.title).trim();
    }

    if (req.body.description !== undefined) {
      data.description = String(req.body.description).trim() || null;
    }

    if (req.body.subject !== undefined) {
      data.subject = String(req.body.subject).trim() || null;
    }

    if (req.body.dueDate !== undefined) {
      const due = new Date(req.body.dueDate);
      if (Number.isNaN(due.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid due date" });
      }
      data.dueDate = due;
    }

    await prisma.homework.update({ where: { id: homework.id }, data });

    res.json({ success: true, message: "Homework updated" });
  }),
);

router.delete(
  "/homework/:id",
  wrap(async (req, res) => {
    const homework = await ownHomework(req, res);
    if (!homework) return;

    const submissions = await prisma.homeworkSubmission.findMany({
      where: { homeworkId: homework.id },
      select: { files: true },
    });

    await prisma.homework.delete({ where: { id: homework.id } });

    files.removeStoredFiles(req.user.institutionId, homework.files);
    for (const sub of submissions) {
      files.removeStoredFiles(req.user.institutionId, sub.files);
    }

    res.json({ success: true, message: "Homework deleted" });
  }),
);

router.patch(
  "/homework/:id/submissions/:submissionId",
  wrap(async (req, res) => {
    const homework = await ownHomework(req, res);
    if (!homework) return;

    const submissionId = lms.toInt(req.params.submissionId);
    const submission = submissionId
      ? await prisma.homeworkSubmission.findFirst({
          where: { id: submissionId, homeworkId: homework.id },
        })
      : null;

    if (!submission) {
      return res.status(404).json({ success: false, message: "Submission not found" });
    }

    const grade = req.body.grade !== undefined ? String(req.body.grade).trim() : submission.grade;
    const feedback =
      req.body.feedback !== undefined ? String(req.body.feedback).trim() : submission.feedback;

    if (grade && grade.length > 20) {
      return res.status(400).json({ success: false, message: "Grade is too long" });
    }

    await prisma.homeworkSubmission.update({
      where: { id: submission.id },
      data: { grade: grade || null, feedback: feedback || null, reviewedAt: new Date() },
    });

    res.json({ success: true, message: "Review saved" });
  }),
);

router.get(
  "/resources",
  wrap(async (req, res) => {
    const assigned = await prisma.teacherClass.findMany({
      where: { teacherId: req.teacher.id },
      select: { classId: true },
    });

    const classIds = [...new Set(assigned.map((a) => a.classId))];
    let where = { institutionId: req.user.institutionId, classId: { in: classIds } };

    if (req.query.classId) {
      const id = lms.toInt(req.query.classId);
      if (!id || !classIds.includes(id)) {
        return res.json({ success: true, data: [] });
      }
      where = { ...where, classId: id };
    }

    const list = await prisma.resource.findMany({
      where,
      include: { class: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      data: list.map((r) => ({
        id: r.id,
        classId: r.classId,
        classLabel: lms.classLabel(r.class),
        title: r.title,
        subject: r.subject,
        description: r.description,
        createdAt: r.createdAt,
        files: files.publicFiles(r.files, `/api/files/resource/${r.id}`),
      })),
    });
  }),
);

router.post(
  "/resources",
  files.handleUpload,
  wrap(async (req, res) => {
    const classId = await requireClassAccess(req, res, req.body.classId);

    if (!classId) {
      return files.cleanupUploaded(req);
    }

    const fail = (message) => {
      files.cleanupUploaded(req);
      return res.status(400).json({ success: false, message });
    };

    if (!req.body.title || !String(req.body.title).trim()) {
      return fail("Title is required");
    }

    if (!req.files || !req.files.length) {
      return fail("Attach at least one file");
    }

    const resource = await prisma.resource.create({
      data: {
        institutionId: req.user.institutionId,
        classId,
        teacherId: req.teacher.id,
        title: String(req.body.title).trim(),
        description: req.body.description ? String(req.body.description).trim() : null,
        subject: req.body.subject ? String(req.body.subject).trim() : null,
        files: files.toFileEntries(req.files),
      },
    });

    res.status(201).json({
      success: true,
      message: "Resource shared with the class",
      data: { id: resource.id },
    });
  }),
);

router.delete(
  "/resources/:id",
  wrap(async (req, res) => {
    const id = lms.toInt(req.params.id);
    const resource = id
      ? await prisma.resource.findFirst({
          where: { id, institutionId: req.user.institutionId },
        })
      : null;

    if (!resource) {
      return res.status(404).json({ success: false, message: "Resource not found" });
    }

    if (!(await lms.teacherAssignment(req.teacher.id, resource.classId))) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this class",
      });
    }

    await prisma.resource.delete({ where: { id: resource.id } });
    files.removeStoredFiles(req.user.institutionId, resource.files);

    res.json({ success: true, message: "Resource deleted" });
  }),
);

router.get(
  "/attendance",
  wrap(async (req, res) => {
    const classId = await requireClassAccess(req, res, req.query.classId);
    if (!classId) return;

    const date = lms.parseDateOnly(req.query.date || new Date().toISOString());

    if (!date) {
      return res.status(400).json({ success: false, message: "A valid date is required" });
    }

    const [students, records] = await Promise.all([
      prisma.studentProfile.findMany({
        where: { classId, institutionId: req.user.institutionId },
        orderBy: [{ rollNo: "asc" }, { firstName: "asc" }],
      }),
      prisma.attendance.findMany({ where: { classId, date } }),
    ]);

    const byStudent = new Map(records.map((r) => [r.studentId, r]));

    res.json({
      success: true,
      date: date.toISOString().slice(0, 10),
      marked: records.length > 0,
      data: students.map((s) => ({
        studentId: s.id,
        name: lms.fullName(s),
        studentCode: s.studentCode,
        rollNo: s.rollNo,
        status: byStudent.get(s.id) ? byStudent.get(s.id).status : null,
        remark: byStudent.get(s.id) ? byStudent.get(s.id).remark : null,
      })),
    });
  }),
);

router.put(
  "/attendance",
  wrap(async (req, res) => {
    const classId = await requireClassAccess(req, res, req.body.classId);
    if (!classId) return;

    const date = lms.parseDateOnly(req.body.date);

    if (!date) {
      return res.status(400).json({ success: false, message: "A valid date is required" });
    }

    if (date.getTime() > lms.todayDateOnly().getTime()) {
      return res.status(400).json({
        success: false,
        message: "Attendance cannot be marked for a future date",
      });
    }

    const records = Array.isArray(req.body.records) ? req.body.records : [];

    if (!records.length) {
      return res.status(400).json({ success: false, message: "No attendance records provided" });
    }

    const valid = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

    const students = await prisma.studentProfile.findMany({
      where: { classId, institutionId: req.user.institutionId },
      select: { id: true },
    });
    const allowed = new Set(students.map((s) => s.id));

    for (const record of records) {
      if (!allowed.has(Number(record.studentId))) {
        return res.status(400).json({
          success: false,
          message: "A student in the list does not belong to this class",
        });
      }

      if (!valid.includes(record.status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid attendance status",
        });
      }
    }

    await prisma.$transaction(
      records.map((record) =>
        prisma.attendance.upsert({
          where: {
            studentId_date: { studentId: Number(record.studentId), date },
          },
          create: {
            institutionId: req.user.institutionId,
            classId,
            studentId: Number(record.studentId),
            markedById: req.teacher.id,
            date,
            status: record.status,
            remark: record.remark ? String(record.remark).trim().slice(0, 200) : null,
          },
          update: {
            classId,
            markedById: req.teacher.id,
            status: record.status,
            remark: record.remark ? String(record.remark).trim().slice(0, 200) : null,
          },
        }),
      ),
    );

    res.json({ success: true, message: "Attendance saved" });
  }),
);

router.get(
  "/attendance/summary",
  wrap(async (req, res) => {
    const classId = await requireClassAccess(req, res, req.query.classId);
    if (!classId) return;

    const to = lms.parseDateOnly(req.query.to) || lms.todayDateOnly();
    const from =
      lms.parseDateOnly(req.query.from) ||
      new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);

    const [students, records] = await Promise.all([
      prisma.studentProfile.findMany({
        where: { classId, institutionId: req.user.institutionId },
        orderBy: [{ rollNo: "asc" }, { firstName: "asc" }],
      }),
      prisma.attendance.findMany({
        where: { classId, date: { gte: from, lte: to } },
      }),
    ]);

    res.json({
      success: true,
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      data: students.map((s) => ({
        studentId: s.id,
        name: lms.fullName(s),
        rollNo: s.rollNo,
        summary: lms.summarizeAttendance(records.filter((r) => r.studentId === s.id)),
      })),
    });
  }),
);

router.get(
  "/complaints",
  wrap(async (req, res) => {
    const list = await prisma.complaint.findMany({
      where: { teacherId: req.teacher.id },
      include: { student: { include: { class: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      data: list.map((c) => ({
        id: c.id,
        studentId: c.studentId,
        studentName: lms.fullName(c.student),
        classLabel: lms.classLabel(c.student.class),
        subject: c.subject,
        message: c.message,
        createdAt: c.createdAt,
        readAt: c.readAt,
      })),
    });
  }),
);

router.post(
  "/complaints",
  wrap(async (req, res) => {
    const studentId = lms.toInt(req.body.studentId);
    const subject = String(req.body.subject || "").trim();
    const message = String(req.body.message || "").trim();

    if (!studentId) {
      return res.status(400).json({ success: false, message: "Select a student" });
    }

    if (!subject || subject.length > 150) {
      return res.status(400).json({
        success: false,
        message: "Subject is required (150 characters max)",
      });
    }

    if (message.length < 5 || message.length > 2000) {
      return res.status(400).json({
        success: false,
        message: "Message must be between 5 and 2000 characters",
      });
    }

    const student = await prisma.studentProfile.findFirst({
      where: { id: studentId, institutionId: req.user.institutionId },
      include: { parentStudents: true },
    });

    if (!student || !student.classId) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    if (!(await lms.teacherAssignment(req.teacher.id, student.classId))) {
      return res.status(403).json({
        success: false,
        message: "You can only send complaints about students in your classes",
      });
    }

    if (!student.parentStudents.length) {
      return res.status(400).json({
        success: false,
        message: "This student has no parent account linked",
      });
    }

    const complaint = await prisma.complaint.create({
      data: {
        institutionId: req.user.institutionId,
        teacherId: req.teacher.id,
        studentId,
        subject,
        message,
      },
    });

    res.status(201).json({
      success: true,
      message: "Complaint sent to the parent",
      data: { id: complaint.id },
    });
  }),
);

module.exports = router;
