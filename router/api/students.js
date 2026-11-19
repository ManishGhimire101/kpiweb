const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const PDFDocument = require("pdfkit");
const { generateTemporaryPassword } = require("../../lib/passwords");
const bcrypt = require("bcrypt");

const authenticateToken = require("../../middleware/auth");
const requireAdmin = require("../../middleware/admin");

const prisma = require("../../lib/prisma");
const router = express.Router();

const PHOTO_ROOT = path.join(__dirname, "..", "..", "public", "uploads");
const photoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(PHOTO_ROOT, String(req.user.institutionId), "students");
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, `${crypto.randomBytes(12).toString("hex")}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (![".jpg", ".jpeg", ".png", ".webp"].includes(path.extname(file.originalname).toLowerCase())) {
      return cb(new Error("Student photo must be JPG, PNG or WEBP"));
    }
    cb(null, true);
  },
}).single("studentPhoto");

function handlePhotoUpload(req, res, next) {
  photoUpload(req, res, (error) => {
    if (!error) return next();
    return res.status(400).json({ success: false, message: error.code === "LIMIT_FILE_SIZE" ? "Student photo must be 5MB or smaller" : error.message });
  });
}

router.post("/admission", authenticateToken, requireAdmin, handlePhotoUpload, async (req, res) => {
  try {
    const institutionId = req.user.institutionId;

    if (!institutionId) {
      return res.status(403).json({
        success: false,
        message: "Admin is not assigned to an institution",
      });
    }

    const student = typeof req.body.student === "string" ? JSON.parse(req.body.student) : req.body.student;
    const parent = typeof req.body.parent === "string" ? JSON.parse(req.body.parent) : req.body.parent;

    if (!student || !student.firstName) {
      return res.status(400).json({
        success: false,
        message: "Student first name is required",
      });
    }

    if (!parent || !parent.firstName || !parent.email) {
      return res.status(400).json({
        success: false,
        message: "Parent first name and email are required",
      });
    }

    const institution = await prisma.institution.findUnique({
      where: {
        id: institutionId,
      },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
      },
    });

    if (!institution) {
      return res.status(404).json({
        success: false,
        message: "Institution not found",
      });
    }

    if (!institution.isActive) {
      return res.status(403).json({
        success: false,
        message: "Institution is inactive",
      });
    }

    const parentEmail = String(parent.email).trim().toLowerCase();

    const programId = student.programId ? Number(student.programId) : null;
    const courseId = student.courseId ? Number(student.courseId) : null;
    if ((student.programId && (!Number.isInteger(programId) || programId <= 0)) || (student.courseId && (!Number.isInteger(courseId) || courseId <= 0))) {
      return res.status(400).json({ success: false, message: "Select a valid program and course" });
    }
    if (programId && !await prisma.program.findFirst({ where: { id: programId, institutionId } })) {
      return res.status(400).json({ success: false, message: "Selected program was not found for this institution" });
    }
    if (courseId && (!programId || !await prisma.course.findFirst({ where: { id: courseId, programId } }))) {
      return res.status(400).json({ success: false, message: "Selected course does not belong to the chosen program" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid parent email address",
      });
    }

    const emailOwner = await prisma.user.findFirst({
      where: { email: { equals: parentEmail, mode: "insensitive" } },
      include: { parentProfile: true },
    });

    const existingParent =
      emailOwner &&
      emailOwner.role === "PARENT" &&
      emailOwner.institutionId === institutionId &&
      emailOwner.parentProfile
        ? emailOwner
        : null;

    if (emailOwner && !existingParent) {
      return res.status(409).json({
        success: false,
        field: "parentEmail",
        message: "This parent email is already used by another account. Use a different email.",
      });
    }

    const lastStudent = await prisma.studentProfile.findFirst({
      where: {
        institutionId,
      },
      orderBy: {
        id: "desc",
      },
      select: {
        studentCode: true,
      },
    });

    let nextNumber = 1;

    if (lastStudent && lastStudent.studentCode) {
      const parts = lastStudent.studentCode.split("-");

      const lastNumber = Number(parts[parts.length - 1]);

      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    const studentCode = `${institution.code}-${nextNumber}`;

    const studentUsername = `${studentCode}`;

    const parentUsername = `${institution.code}-parent-${nextNumber}`;

    const studentPassword = generateTemporaryPassword();

    const parentPassword = generateTemporaryPassword();

    const studentPasswordHash = await bcrypt.hash(studentPassword, 12);

    const parentPasswordHash = await bcrypt.hash(parentPassword, 12);

    const result = await prisma.$transaction(async (tx) => {

      const studentUser = await tx.user.create({
        data: {
          institutionId,
          username: studentUsername,
          passwordHash: studentPasswordHash,
          role: "STUDENT",
          isActive: true,
          mustChangePassword: true,
        },
      });

      const studentProfile = await tx.studentProfile.create({
        data: {
          userId: studentUser.id,
          institutionId,

          studentCode,

          firstName: student.firstName.trim(),

          photo: req.file ? `/uploads/${institutionId}/students/${req.file.filename}` : null,

          lastName: student.lastName ? student.lastName.trim() : null,

          dob: student.dob ? new Date(student.dob) : null,

          gender: student.gender || null,

          phone: student.phone ? student.phone.trim() : null,

          address: student.address ? student.address.trim() : null,

          admissionDate: student.admissionDate
            ? new Date(student.admissionDate)
            : new Date(),

          status: student.status || "ACTIVE",

          programId,
          courseId,
        },
      });

      if (existingParent) {
        const parentStudent = await tx.parentStudent.create({
          data: {
            parentId: existingParent.parentProfile.id,
            studentId: studentProfile.id,
            relationship: parent.relationship || null,
            isPrimary: true,
          },
        });

        return {
          studentUser,
          studentProfile,
          parentUser: existingParent,
          parentProfile: existingParent.parentProfile,
          parentStudent,
          parentExisting: true,
        };
      }

      const parentUser = await tx.user.create({
        data: {
          institutionId,

          username: parentUsername,

          email: parentEmail,

          passwordHash: parentPasswordHash,

          role: "PARENT",

          isActive: true,

          mustChangePassword: true,
        },
      });

      const parentProfile = await tx.parentProfile.create({
        data: {
          userId: parentUser.id,
          institutionId,

          firstName: parent.firstName.trim(),

          lastName: parent.lastName ? parent.lastName.trim() : null,

          phone: parent.phone ? parent.phone.trim() : null,

          address: parent.address ? parent.address.trim() : null,

          occupation: parent.occupation ? parent.occupation.trim() : null,
        },
      });

      const parentStudent = await tx.parentStudent.create({
        data: {
          parentId: parentProfile.id,

          studentId: studentProfile.id,

          relationship: parent.relationship || null,

          isPrimary: true,
        },
      });

      return {
        studentUser,
        studentProfile,
        parentUser,
        parentProfile,
        parentStudent,
      };
    });

    return res.status(201).json({
      success: true,

      message: result.parentExisting
        ? "New admission created and linked to the existing parent account"
        : "New admission created successfully",

      data: {
        student: {
          id: result.studentProfile.id,

          studentCode: result.studentProfile.studentCode,

          name: `${result.studentProfile.firstName} ${result.studentProfile.lastName || ""}`.trim(),

          username: result.studentUser.username,

          temporaryPassword: studentPassword,
        },

        parent: {
          id: result.parentProfile.id,

          name: `${result.parentProfile.firstName} ${result.parentProfile.lastName || ""}`.trim(),

          username: result.parentUser.username,

          email: result.parentUser.email,

          existing: Boolean(result.parentExisting),

          temporaryPassword: result.parentExisting ? null : parentPassword,
        },
      },
    });
  } catch (error) {
    if (error.code === "P2002") {
      const fields = (error.meta && error.meta.target) || [];
      return res.status(409).json({
        success: false,
        message: fields.includes("email")
          ? "This parent email is already used by another account. Use a different email."
          : "Another admission was saved at the same moment. Please try again.",
      });
    }

    console.error("New admission error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create new admission",
    });
  }
});


router.get("/download", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const students = await prisma.studentProfile.findMany({
      where: { institutionId: req.user.institutionId },
      include: { user: { select: { username: true, email: true, isActive: true } } },
      orderBy: { studentCode: "asc" },
    });
    const csvValue = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["Student Code", "First Name", "Last Name", "Date of Birth", "Gender", "Phone", "Address", "Admission Date", "Status", "Username", "Email", "Account Active", "Photo URL"],
      ...students.map((s) => [s.studentCode, s.firstName, s.lastName, s.dob?.toISOString().slice(0, 10), s.gender, s.phone, s.address, s.admissionDate?.toISOString().slice(0, 10), s.status, s.user.username, s.user.email, s.user.isActive ? "Yes" : "No", s.photo]),
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="students-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send("\ufeff" + rows.map((row) => row.map(csvValue).join(",")).join("\r\n"));
  } catch (error) {
    console.error("Download students error:", error);
    res.status(500).json({ success: false, message: "Failed to download student data" });
  }
});

router.get("/", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const institutionId = req.user.institutionId;

    const students = await prisma.studentProfile.findMany({
      where: {
        institutionId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            isActive: true,
            mustChangePassword: true,
            lastLoginAt: true,
          },
        },
      },
      orderBy: {
        studentCode: "asc",
      },
    });

    return res.json({
      success: true,
      data: students,
    });
  } catch (error) {
    console.error("Get students error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load students",
    });
  }
});

// This two-segment route is explicitly registered before student detail routes.
router.get("/:id/pdf", authenticateToken, requireAdmin, async (req, res) => {
  return generateStudentPdf(req, res);
});

router.get("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const institutionId = req.user.institutionId;
    const studentId = Number(req.params.id);

    if (isNaN(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    const student = await prisma.studentProfile.findFirst({
      where: {
        id: studentId,
        institutionId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            isActive: true,
            mustChangePassword: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
        parentStudents: {
          include: {
            parent: {
              include: {
                user: {
                  select: {
                    id: true,
                    username: true,
                    email: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.json({
      success: true,
      data: student,
    });
  } catch (error) {
    console.error("Get student error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load student",
    });
  }
});

async function generateStudentPdf(req, res) {
  try {
    const studentId = Number(req.params.id);
    const student = await prisma.studentProfile.findFirst({
      where: { id: studentId, institutionId: req.user.institutionId },
      include: {
        user: { select: { username: true, email: true, isActive: true, createdAt: true } },
        parentStudents: {
          where: { isPrimary: true },
          take: 1,
          include: { parent: { include: { user: { select: { email: true, username: true } } } } },
        },
        institution: { select: { name: true, address: true, phone: true, email: true } },
      },
    });

    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    const parent = student.parentStudents[0]?.parent;
    const doc = new PDFDocument({ margin: 48, size: "A4" });
    const filename = `${student.studentCode}-profile.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    const text = (label, value) => {
      doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
      doc.font("Helvetica").text(value || "-");
    };
    doc.fontSize(18).font("Helvetica-Bold").text(student.institution.name, { align: "center" });
    doc.fontSize(10).font("Helvetica").text(student.institution.address || "", { align: "center" });
    doc.moveDown().fontSize(16).font("Helvetica-Bold").text("Student Profile", { align: "center" });
    doc.moveDown();

    if (student.photo) {
      const photoRelativePath = student.photo.replace(`/uploads/${req.user.institutionId}/`, "");
      const photoPath = path.resolve(PHOTO_ROOT, String(req.user.institutionId), photoRelativePath);
      const photoExtension = path.extname(photoPath).toLowerCase();
      const institutionPhotoRoot = path.resolve(PHOTO_ROOT, String(req.user.institutionId)) + path.sep;
      if ([".jpg", ".jpeg", ".png"].includes(photoExtension) && photoPath.startsWith(institutionPhotoRoot) && fs.existsSync(photoPath)) {
        try {
          doc.image(photoPath, 430, 125, { fit: [115, 135], align: "center" });
        } catch (photoError) {
          console.warn("Student photo omitted from PDF:", photoError.message);
        }
      }
    }

    text("Student Code", student.studentCode);
    text("Name", `${student.firstName} ${student.lastName || ""}`.trim());
    text("Date of Birth", student.dob ? student.dob.toISOString().slice(0, 10) : "-");
    text("Gender", student.gender);
    text("Phone", student.phone);
    text("Address", student.address);
    text("Admission Date", student.admissionDate ? student.admissionDate.toISOString().slice(0, 10) : "-");
    text("Status", student.status);
    doc.moveDown().fontSize(13).font("Helvetica-Bold").text("Student Account");
    doc.moveDown(0.4).fontSize(10);
    text("Username", student.user.username);
    text("Email", student.user.email);
    text("Account Active", student.user.isActive ? "Yes" : "No");

    doc.moveDown().fontSize(13).font("Helvetica-Bold").text("Parent / Guardian");
    doc.moveDown(0.4).fontSize(10);
    text("Name", parent ? `${parent.firstName} ${parent.lastName || ""}`.trim() : "-");
    text("Relationship", student.parentStudents[0]?.relationship);
    text("Email", parent?.user?.email);
    text("Phone", parent?.phone);
    text("Address", parent?.address);
    text("Occupation", parent?.occupation);
    doc.end();
  } catch (error) {
    console.error("Student PDF error:", error);
    if (!res.headersSent) return res.status(500).json({ success: false, message: error.message || "Failed to create student PDF" });
    res.destroy(error);
  }
}

router.put("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const institutionId = req.user.institutionId;

    const studentId = Number(req.params.id);

    if (isNaN(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    const {
      firstName,
      lastName,
      dob,
      gender,
      phone,
      address,
      admissionDate,
      status,
      accountStatus,
    } = req.body;

    if (!firstName || !firstName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Student first name is required",
      });
    }

    const existingStudent = await prisma.studentProfile.findFirst({
      where: {
        id: studentId,
        institutionId,
      },

      include: {
        user: true,
      },
    });

    if (!existingStudent) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const updatedStudent = await prisma.$transaction(async (tx) => {

      const student = await tx.studentProfile.update({
        where: {
          id: studentId,
        },

        data: {
          firstName: firstName.trim(),

          lastName: lastName ? lastName.trim() : null,

          dob: dob ? new Date(dob) : null,

          gender: gender || null,

          phone: phone ? phone.trim() : null,

          address: address ? address.trim() : null,

          admissionDate: admissionDate ? new Date(admissionDate) : null,

          status: status || "ACTIVE",
        },
      });

      const user = await tx.user.update({
        where: {
          id: existingStudent.userId,
        },

        data: {
          isActive:
            accountStatus === undefined
              ? existingStudent.user.isActive
              : accountStatus === true,
        },
      });

      return {
        student,
        user,
      };
    });

    return res.json({
      success: true,

      message: "Student updated successfully",

      data: {
        student: updatedStudent.student,

        user: {
          id: updatedStudent.user.id,

          username: updatedStudent.user.username,

          isActive: updatedStudent.user.isActive,
        },
      },
    });
  } catch (error) {
    console.error("Update student error:", error);

    return res.status(500).json({
      success: false,

      message: "Failed to update student",
    });
  }
});

router.patch(
    "/:id/status",
    authenticateToken,
    requireAdmin,
    async (req, res) => {

        try {

            const institutionId = req.user.institutionId;
            const studentId = Number(req.params.id);

            if (isNaN(studentId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid student ID"
                });
            }

            const { accountStatus } = req.body;

            if (typeof accountStatus !== "boolean") {
                return res.status(400).json({
                    success: false,
                    message: "accountStatus must be true or false"
                });
            }

            const student =
                await prisma.studentProfile.findFirst({
                    where: {
                        id: studentId,
                        institutionId
                    }
                });

            if (!student) {
                return res.status(404).json({
                    success: false,
                    message: "Student not found"
                });
            }

            const updatedUser =
                await prisma.user.update({
                    where: {
                        id: student.userId
                    },
                    data: {
                        isActive: accountStatus
                    }
                });

            return res.json({
                success: true,
                message: accountStatus
                    ? "Student activated successfully"
                    : "Student deactivated successfully",

                data: {
                    studentId: student.id,
                    isActive: updatedUser.isActive
                }
            });

        } catch (error) {

            console.error(
                "Update student status error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Failed to update student status"
            });
        }
    }
);

module.exports = router;
