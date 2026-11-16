const prisma = require("./prisma");

function classLabel(cls) {
  if (!cls) return null;
  return cls.section ? `${cls.name} ${cls.section}` : cls.name;
}

function fullName(profile) {
  return `${profile.firstName} ${profile.lastName || ""}`.trim();
}

function parseDateOnly(value) {
  const text = String(value || "").slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }

  const date = new Date(`${text}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    return null;
  }

  return date;
}

function todayDateOnly() {
  return parseDateOnly(new Date().toISOString().slice(0, 10));
}

function toInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

async function loadTeacher(req, res, next) {
  const teacher = await prisma.teacherProfile.findUnique({
    where: { userId: req.user.id },
  });

  if (!teacher || teacher.institutionId !== req.user.institutionId) {
    return res.status(403).json({
      success: false,
      message: "Teacher profile not found",
    });
  }

  req.teacher = teacher;
  next();
}

async function loadStudent(req, res, next) {
  const student = await prisma.studentProfile.findUnique({
    where: { userId: req.user.id },
    include: { class: true },
  });

  if (!student || student.institutionId !== req.user.institutionId) {
    return res.status(403).json({
      success: false,
      message: "Student profile not found",
    });
  }

  req.student = student;
  next();
}

async function loadParent(req, res, next) {
  const parent = await prisma.parentProfile.findUnique({
    where: { userId: req.user.id },
  });

  if (!parent || parent.institutionId !== req.user.institutionId) {
    return res.status(403).json({
      success: false,
      message: "Parent profile not found",
    });
  }

  req.parent = parent;
  next();
}

async function teacherAssignment(teacherId, classId) {
  return prisma.teacherClass.findFirst({ where: { teacherId, classId } });
}

function summarizeAttendance(records) {
  const summary = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, total: 0 };

  for (const record of records) {
    summary[record.status] += 1;
    summary.total += 1;
  }

  const attended = summary.PRESENT + summary.LATE;
  summary.percentage = summary.total
    ? Math.round((attended / summary.total) * 1000) / 10
    : null;

  return summary;
}

module.exports = {
  classLabel,
  fullName,
  parseDateOnly,
  todayDateOnly,
  toInt,
  loadTeacher,
  loadStudent,
  loadParent,
  teacherAssignment,
  summarizeAttendance,
};
