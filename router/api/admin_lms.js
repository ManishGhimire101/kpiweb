const express = require("express");
const bcrypt = require("bcrypt");

const prisma = require("../../lib/prisma");
const authenticateToken = require("../../middleware/auth");
const requireAdmin = require("../../middleware/admin");
const lms = require("../../lib/lms");
const { generateTemporaryPassword } = require("../../lib/passwords");

const router = express.Router();

router.use(["/classes", "/teachers", "/parents", "/lms", "/users"], authenticateToken, requireAdmin);

function wrap(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      if (error && error.code === "P2002") {
        return res.status(409).json({
          success: false,
          message: "A record with these details already exists",
        });
      }

      console.error("Admin LMS error:", error);

      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "Something went wrong" });
      }
    }
  };
}

function bad(res, message, status = 400) {
  return res.status(status).json({ success: false, message });
}

async function findClass(req, res) {
  const id = lms.toInt(req.params.id);
  const cls = id
    ? await prisma.class.findFirst({
        where: { id, institutionId: req.user.institutionId },
      })
    : null;

  if (!cls) {
    bad(res, "Class not found", 404);
    return null;
  }

  return cls;
}

router.get(
  "/classes",
  wrap(async (req, res) => {
    const classes = await prisma.class.findMany({
      where: { institutionId: req.user.institutionId },
      include: {
        _count: { select: { students: true } },
        teachers: { include: { teacher: true } },
      },
      orderBy: [{ name: "asc" }, { section: "asc" }],
    });

    res.json({
      success: true,
      data: classes.map((c) => ({
        id: c.id,
        name: c.name,
        section: c.section,
        label: lms.classLabel(c),
        academicYear: c.academicYear,
        studentCount: c._count.students,
        teachers: c.teachers.map((t) => ({
          assignmentId: t.id,
          teacherId: t.teacherId,
          name: lms.fullName(t.teacher),
          subject: t.subject,
        })),
      })),
    });
  }),
);

router.post(
  "/classes",
  wrap(async (req, res) => {
    const name = String(req.body.name || "").trim();
    const section = String(req.body.section || "").trim();
    const academicYear = String(req.body.academicYear || "").trim();

    if (!name || name.length > 50) {
      return bad(res, "Class name is required (50 characters max)");
    }

    if (section.length > 20) {
      return bad(res, "Section must be 20 characters or fewer");
    }

    const created = await prisma.class.create({
      data: {
        institutionId: req.user.institutionId,
        name,
        section,
        academicYear: academicYear || null,
      },
    });

    res.status(201).json({ success: true, message: "Class created", data: { id: created.id } });
  }),
);

router.put(
  "/classes/:id",
  wrap(async (req, res) => {
    const cls = await findClass(req, res);
    if (!cls) return;

    const name = String(req.body.name ?? cls.name).trim();
    const section = String(req.body.section ?? cls.section).trim();

    if (!name || name.length > 50) {
      return bad(res, "Class name is required (50 characters max)");
    }

    await prisma.class.update({
      where: { id: cls.id },
      data: {
        name,
        section,
        academicYear:
          req.body.academicYear !== undefined
            ? String(req.body.academicYear).trim() || null
            : cls.academicYear,
      },
    });

    res.json({ success: true, message: "Class updated" });
  }),
);

router.delete(
  "/classes/:id",
  wrap(async (req, res) => {
    const cls = await findClass(req, res);
    if (!cls) return;

    await prisma.class.delete({ where: { id: cls.id } });

    res.json({ success: true, message: "Class deleted" });
  }),
);

router.get(
  "/classes/:id/students",
  wrap(async (req, res) => {
    const cls = await findClass(req, res);
    if (!cls) return;

    const students = await prisma.studentProfile.findMany({
      where: { classId: cls.id },
      include: { parentStudents: { include: { parent: true } } },
      orderBy: [{ rollNo: "asc" }, { firstName: "asc" }],
    });

    res.json({
      success: true,
      data: students.map((s) => ({
        id: s.id,
        userId: s.userId,
        name: lms.fullName(s),
        studentCode: s.studentCode,
        rollNo: s.rollNo,
        parents: s.parentStudents.map((ps) => ({
          userId: ps.parent.userId,
          name: lms.fullName(ps.parent),
        })),
      })),
    });
  }),
);

router.post(
  "/classes/:id/students",
  wrap(async (req, res) => {
    const cls = await findClass(req, res);
    if (!cls) return;

    const ids = (Array.isArray(req.body.studentIds) ? req.body.studentIds : [])
      .map(Number)
      .filter(Number.isInteger);

    if (!ids.length) {
      return bad(res, "Select at least one student");
    }

    const result = await prisma.studentProfile.updateMany({
      where: { id: { in: ids }, institutionId: req.user.institutionId },
      data: { classId: cls.id },
    });

    res.json({
      success: true,
      message: `${result.count} student(s) added to ${lms.classLabel(cls)}`,
    });
  }),
);

router.patch(
  "/classes/:id/students/:studentId",
  wrap(async (req, res) => {
    const cls = await findClass(req, res);
    if (!cls) return;

    const studentId = lms.toInt(req.params.studentId);
    const rollNo = String(req.body.rollNo || "").trim();

    if (rollNo.length > 20) {
      return bad(res, "Roll number must be 20 characters or fewer");
    }

    const result = await prisma.studentProfile.updateMany({
      where: { id: studentId || -1, classId: cls.id },
      data: { rollNo: rollNo || null },
    });

    if (!result.count) {
      return bad(res, "Student not found in this class", 404);
    }

    res.json({ success: true, message: "Roll number saved" });
  }),
);

router.delete(
  "/classes/:id/students/:studentId",
  wrap(async (req, res) => {
    const cls = await findClass(req, res);
    if (!cls) return;

    const result = await prisma.studentProfile.updateMany({
      where: { id: lms.toInt(req.params.studentId) || -1, classId: cls.id },
      data: { classId: null, rollNo: null },
    });

    if (!result.count) {
      return bad(res, "Student not found in this class", 404);
    }

    res.json({ success: true, message: "Student removed from class" });
  }),
);

router.post(
  "/classes/:id/teachers",
  wrap(async (req, res) => {
    const cls = await findClass(req, res);
    if (!cls) return;

    const teacherId = lms.toInt(req.body.teacherId);
    const subject = String(req.body.subject || "").trim();

    if (subject.length > 80) {
      return bad(res, "Subject must be 80 characters or fewer");
    }

    const teacher = teacherId
      ? await prisma.teacherProfile.findFirst({
          where: { id: teacherId, institutionId: req.user.institutionId },
        })
      : null;

    if (!teacher) {
      return bad(res, "Teacher not found", 404);
    }

    await prisma.teacherClass.create({
      data: { teacherId: teacher.id, classId: cls.id, subject },
    });

    res.status(201).json({ success: true, message: "Teacher assigned to class" });
  }),
);

router.delete(
  "/classes/:id/teachers/:assignmentId",
  wrap(async (req, res) => {
    const cls = await findClass(req, res);
    if (!cls) return;

    const result = await prisma.teacherClass.deleteMany({
      where: { id: lms.toInt(req.params.assignmentId) || -1, classId: cls.id },
    });

    if (!result.count) {
      return bad(res, "Assignment not found", 404);
    }

    res.json({ success: true, message: "Teacher removed from class" });
  }),
);

router.get(
  "/lms/students",
  wrap(async (req, res) => {
    const students = await prisma.studentProfile.findMany({
      where: { institutionId: req.user.institutionId },
      include: { class: true },
      orderBy: { firstName: "asc" },
    });

    res.json({
      success: true,
      data: students.map((s) => ({
        id: s.id,
        name: lms.fullName(s),
        studentCode: s.studentCode,
        classId: s.classId,
        classLabel: lms.classLabel(s.class),
      })),
    });
  }),
);

router.get(
  "/teachers",
  wrap(async (req, res) => {
    const teachers = await prisma.teacherProfile.findMany({
      where: { institutionId: req.user.institutionId },
      include: {
        user: true,
        classes: { include: { class: true } },
      },
      orderBy: { firstName: "asc" },
    });

    res.json({
      success: true,
      data: teachers.map((t) => ({
        id: t.id,
        userId: t.userId,
        name: lms.fullName(t),
        firstName: t.firstName,
        lastName: t.lastName,
        employeeCode: t.employeeCode,
        username: t.user.username,
        email: t.user.email,
        phone: t.phone,
        designation: t.designation,
        isActive: t.user.isActive,
        lastLoginAt: t.user.lastLoginAt,
        classes: t.classes.map((c) => ({
          label: lms.classLabel(c.class),
          subject: c.subject,
        })),
      })),
    });
  }),
);

router.get(
  "/parents",
  wrap(async (req, res) => {
    const parents = await prisma.parentProfile.findMany({
      where: { institutionId: req.user.institutionId },
      include: {
        user: true,
        students: {
          include: { student: { include: { class: true } } },
          orderBy: { id: "asc" },
        },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    res.json({
      success: true,
      data: parents.map((p) => ({
        id: p.id,
        userId: p.userId,
        name: lms.fullName(p),
        username: p.user.username,
        email: p.user.email,
        phone: p.phone,
        occupation: p.occupation,
        address: p.address,
        isActive: p.user.isActive,
        mustChangePassword: p.user.mustChangePassword,
        lastLoginAt: p.user.lastLoginAt,
        children: p.students.map((link) => ({
          name: lms.fullName(link.student),
          studentCode: link.student.studentCode,
          relationship: link.relationship,
          classLabel: link.student.class ? lms.classLabel(link.student.class) : null,
        })),
      })),
    });
  }),
);

router.post(
  "/teachers",
  wrap(async (req, res) => {
    const firstName = String(req.body.firstName || "").trim();
    const lastName = String(req.body.lastName || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const phone = String(req.body.phone || "").trim();

    if (!firstName || firstName.length > 80) {
      return bad(res, "First name is required (80 characters max)");
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return bad(res, "Enter a valid email address");
    }

    if (phone && !/^[0-9+\-\s()]{6,20}$/.test(phone)) {
      return bad(res, "Enter a valid phone number");
    }

    if (email && (await prisma.user.findUnique({ where: { email } }))) {
      return bad(res, "Email is already in use", 409);
    }

    const institution = await prisma.institution.findUnique({
      where: { id: req.user.institutionId },
    });

    const existing = await prisma.teacherProfile.findMany({
      where: { institutionId: institution.id },
      select: { employeeCode: true },
    });

    let next =
      existing.reduce((max, t) => {
        const n = Number(t.employeeCode.split("-").pop());
        return Number.isInteger(n) && n > max ? n : max;
      }, 0) + 1;

    const employeeCode = `${institution.code}-T-${next}`;
    const password = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(password, 12);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          institutionId: institution.id,
          username: employeeCode,
          email: email || null,
          passwordHash,
          role: "TEACHER",
          mustChangePassword: true,
        },
      });

      return tx.teacherProfile.create({
        data: {
          userId: user.id,
          institutionId: institution.id,
          employeeCode,
          firstName,
          lastName: lastName || null,
          phone: phone || null,
          address: req.body.address ? String(req.body.address).trim() : null,
          designation: req.body.designation ? String(req.body.designation).trim() : null,
          joiningDate: req.body.joiningDate ? new Date(req.body.joiningDate) : new Date(),
          status: "ACTIVE",
        },
      });
    });

    res.status(201).json({
      success: true,
      message: "Teacher created",
      data: {
        id: created.id,
        name: lms.fullName(created),
        username: employeeCode,
        temporaryPassword: password,
      },
    });
  }),
);

router.put(
  "/teachers/:id",
  wrap(async (req, res) => {
    const id = lms.toInt(req.params.id);
    const teacher = id
      ? await prisma.teacherProfile.findFirst({
          where: { id, institutionId: req.user.institutionId },
        })
      : null;

    if (!teacher) {
      return bad(res, "Teacher not found", 404);
    }

    const firstName = String(req.body.firstName ?? teacher.firstName).trim();

    if (!firstName) {
      return bad(res, "First name is required");
    }

    await prisma.teacherProfile.update({
      where: { id: teacher.id },
      data: {
        firstName,
        lastName: String(req.body.lastName ?? teacher.lastName ?? "").trim() || null,
        phone: String(req.body.phone ?? teacher.phone ?? "").trim() || null,
        designation: String(req.body.designation ?? teacher.designation ?? "").trim() || null,
      },
    });

    res.json({ success: true, message: "Teacher updated" });
  }),
);

router.post(
  "/users/:userId/reset-password",
  wrap(async (req, res) => {
    const userId = lms.toInt(req.params.userId);
    const user = userId
      ? await prisma.user.findFirst({
          where: {
            id: userId,
            institutionId: req.user.institutionId,
            role: { in: ["TEACHER", "STUDENT", "PARENT"] },
          },
        })
      : null;

    if (!user) {
      return bad(res, "User not found", 404);
    }

    const password = generateTemporaryPassword();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(password, 12),
        mustChangePassword: true,
      },
    });

    res.json({
      success: true,
      message: "Password reset",
      data: { username: user.username, temporaryPassword: password },
    });
  }),
);

router.patch(
  "/users/:userId/status",
  wrap(async (req, res) => {
    const userId = lms.toInt(req.params.userId);

    if (typeof req.body.isActive !== "boolean") {
      return bad(res, "isActive must be true or false");
    }

    const result = await prisma.user.updateMany({
      where: {
        id: userId || -1,
        institutionId: req.user.institutionId,
        role: { in: ["TEACHER", "STUDENT", "PARENT"] },
      },
      data: { isActive: req.body.isActive },
    });

    if (!result.count) {
      return bad(res, "User not found", 404);
    }

    res.json({
      success: true,
      message: req.body.isActive ? "Account enabled" : "Account disabled",
    });
  }),
);

module.exports = router;
