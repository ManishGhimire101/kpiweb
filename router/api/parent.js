const express = require("express");

const prisma = require("../../lib/prisma");
const authenticateToken = require("../../middleware/auth");
const requireRole = require("../../middleware/roles");
const lms = require("../../lib/lms");
const files = require("../../lib/files");

const router = express.Router();

router.use(authenticateToken, requireRole("PARENT"), lms.loadParent);

function wrap(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error("Parent API error:", error);

      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "Something went wrong" });
      }
    }
  };
}

async function childIds(parentId) {
  const links = await prisma.parentStudent.findMany({
    where: { parentId },
    select: { studentId: true },
  });

  return links.map((l) => l.studentId);
}

router.get(
  "/children",
  wrap(async (req, res) => {
    const links = await prisma.parentStudent.findMany({
      where: { parentId: req.parent.id },
      include: { student: { include: { class: true } } },
    });

    const ids = links.map((l) => l.studentId);

    const [attendance, unread] = await Promise.all([
      prisma.attendance.findMany({ where: { studentId: { in: ids } } }),
      prisma.complaint.groupBy({
        by: ["studentId"],
        where: { studentId: { in: ids }, readAt: null },
        _count: { _all: true },
      }),
    ]);

    const unreadBy = new Map(unread.map((u) => [u.studentId, u._count._all]));

    res.json({
      success: true,
      data: links.map((link) => ({
        id: link.student.id,
        name: lms.fullName(link.student),
        studentCode: link.student.studentCode,
        rollNo: link.student.rollNo,
        relationship: link.relationship,
        classLabel: lms.classLabel(link.student.class),
        attendance: lms.summarizeAttendance(
          attendance.filter((a) => a.studentId === link.student.id),
        ),
        unreadComplaints: unreadBy.get(link.student.id) || 0,
      })),
    });
  }),
);

router.get(
  "/children/:studentId/overview",
  wrap(async (req, res) => {
    const studentId = lms.toInt(req.params.studentId);
    const ids = await childIds(req.parent.id);

    if (!studentId || !ids.includes(studentId)) {
      return res.status(404).json({ success: false, message: "Child not found" });
    }

    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: { class: true },
    });

    const [records, homework, resources] = await Promise.all([
      prisma.attendance.findMany({
        where: { studentId },
        orderBy: { date: "desc" },
      }),
      student.classId
        ? prisma.homework.findMany({
            where: { classId: student.classId },
            include: { teacher: true, submissions: { where: { studentId } } },
            orderBy: { dueDate: "desc" },
            take: 50,
          })
        : [],
      student.classId
        ? prisma.resource.findMany({
            where: { classId: student.classId },
            include: { teacher: true },
            orderBy: { createdAt: "desc" },
            take: 50,
          })
        : [],
    ]);

    res.json({
      success: true,
      data: {
        id: student.id,
        name: lms.fullName(student),
        studentCode: student.studentCode,
        classLabel: lms.classLabel(student.class),
        attendanceSummary: lms.summarizeAttendance(records),
        attendance: records.slice(0, 60).map((r) => ({
          date: r.date.toISOString().slice(0, 10),
          status: r.status,
          remark: r.remark,
        })),
        homework: homework.map((hw) => {
          const sub = hw.submissions[0];
          let status = "PENDING";

          if (sub) {
            status = sub.reviewedAt ? "REVIEWED" : "SUBMITTED";
          } else if (hw.dueDate.getTime() < Date.now()) {
            status = "OVERDUE";
          }

          return {
            id: hw.id,
            title: hw.title,
            subject: hw.subject,
            dueDate: hw.dueDate,
            teacherName: lms.fullName(hw.teacher),
            status,
            grade: sub ? sub.grade : null,
            feedback: sub ? sub.feedback : null,
            isLate: sub ? sub.isLate : false,
          };
        }),
        resources: resources.map((r) => ({
          id: r.id,
          title: r.title,
          subject: r.subject,
          teacherName: lms.fullName(r.teacher),
          createdAt: r.createdAt,
          files: files.publicFiles(r.files, `/api/files/resource/${r.id}`),
        })),
      },
    });
  }),
);

router.get(
  "/complaints",
  wrap(async (req, res) => {
    const ids = await childIds(req.parent.id);

    const list = await prisma.complaint.findMany({
      where: { studentId: { in: ids } },
      include: { teacher: true, student: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      data: list.map((c) => ({
        id: c.id,
        studentId: c.studentId,
        studentName: lms.fullName(c.student),
        teacherName: lms.fullName(c.teacher),
        subject: c.subject,
        message: c.message,
        createdAt: c.createdAt,
        readAt: c.readAt,
      })),
    });
  }),
);

router.patch(
  "/complaints/:id/read",
  wrap(async (req, res) => {
    const id = lms.toInt(req.params.id);
    const ids = await childIds(req.parent.id);

    const complaint = id
      ? await prisma.complaint.findFirst({
          where: { id, studentId: { in: ids } },
        })
      : null;

    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    if (!complaint.readAt) {
      await prisma.complaint.update({
        where: { id },
        data: { readAt: new Date() },
      });
    }

    res.json({ success: true });
  }),
);

module.exports = router;
