const express = require("express");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const authenticateToken = require("../../middleware/auth");
const requireAdmin = require("../../middleware/admin");

const prisma = new PrismaClient();
const router = express.Router();

// =====================================================
// NEW ADMISSION
// POST /api/admin/students/admission
// =====================================================

router.post("/admission", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const institutionId = req.user.institutionId;

    if (!institutionId) {
      return res.status(403).json({
        success: false,
        message: "Admin is not assigned to an institution",
      });
    }

    const { student, parent } = req.body;

    // ==========================================
    // VALIDATE STUDENT
    // ==========================================

    if (!student || !student.firstName) {
      return res.status(400).json({
        success: false,
        message: "Student first name is required",
      });
    }

    // ==========================================
    // VALIDATE PARENT
    // ==========================================

    if (!parent || !parent.firstName || !parent.email) {
      return res.status(400).json({
        success: false,
        message: "Parent first name and email are required",
      });
    }

    // ==========================================
    // GET INSTITUTION
    // ==========================================

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

    // ==========================================
    // GENERATE STUDENT CODE
    // ==========================================

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

    // ==========================================
    // GENERATE USERNAMES
    // ==========================================

    const studentUsername = `${studentCode}`;

    const parentUsername = `${institution.code}-parent-${nextNumber}`;

    // ==========================================
    // GENERATE TEMPORARY PASSWORDS
    // ==========================================

    const studentPassword = generateTemporaryPassword();

    const parentPassword = generateTemporaryPassword();

    const studentPasswordHash = await bcrypt.hash(studentPassword, 12);

    const parentPasswordHash = await bcrypt.hash(parentPassword, 12);

    // ==========================================
    // CREATE EVERYTHING IN ONE TRANSACTION
    // ==========================================

    const result = await prisma.$transaction(async (tx) => {
      // ------------------------------
      // CREATE STUDENT USER
      // ------------------------------

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

      // ------------------------------
      // CREATE STUDENT PROFILE
      // ------------------------------

      const studentProfile = await tx.studentProfile.create({
        data: {
          userId: studentUser.id,
          institutionId,

          studentCode,

          firstName: student.firstName.trim(),

          lastName: student.lastName ? student.lastName.trim() : null,

          dob: student.dob ? new Date(student.dob) : null,

          gender: student.gender || null,

          phone: student.phone ? student.phone.trim() : null,

          address: student.address ? student.address.trim() : null,

          admissionDate: student.admissionDate
            ? new Date(student.admissionDate)
            : new Date(),

          status: student.status || "ACTIVE",
        },
      });

      // ------------------------------
      // CREATE PARENT USER
      // ------------------------------

      const parentUser = await tx.user.create({
        data: {
          institutionId,

          username: parentUsername,

          email: parent.email.trim(),

          passwordHash: parentPasswordHash,

          role: "PARENT",

          isActive: true,

          mustChangePassword: true,
        },
      });

      // ------------------------------
      // CREATE PARENT PROFILE
      // ------------------------------

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

      // ------------------------------
      // LINK PARENT TO STUDENT
      // ------------------------------

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

    // ==========================================
    // RESPONSE
    // ==========================================

    return res.status(201).json({
      success: true,

      message: "New admission created successfully",

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

          temporaryPassword: parentPassword,
        },
      },
    });
  } catch (error) {
    console.error("New admission error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create new admission",
    });
  }
});

// =====================================================
// TEMPORARY PASSWORD GENERATOR
// =====================================================

function generateTemporaryPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

  let password = "";

  for (let i = 0; i < 10; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);

    password += chars[randomIndex];
  }

  return password;
}

// =====================================================
// GET ALL STUDENTS
// GET /api/admin/students
// =====================================================

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

// =====================================================
// GET SINGLE STUDENT
// GET /api/admin/students/:id
// =====================================================

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
// =====================================================
// UPDATE STUDENT
// PUT /api/admin/students/:id
// =====================================================

router.put("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const institutionId = req.user.institutionId;

    const studentId = Number(req.params.id);

    // ==========================================
    // VALIDATE ID
    // ==========================================

    if (isNaN(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID",
      });
    }

    // ==========================================
    // GET DATA
    // ==========================================

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

    // ==========================================
    // VALIDATE STUDENT
    // ==========================================

    if (!firstName || !firstName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Student first name is required",
      });
    }

    // ==========================================
    // FIND STUDENT
    // ==========================================

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

    // ==========================================
    // UPDATE STUDENT + USER
    // ==========================================

    const updatedStudent = await prisma.$transaction(async (tx) => {
      // ------------------------------
      // UPDATE STUDENT PROFILE
      // ------------------------------

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

      // ------------------------------
      // UPDATE USER ACCOUNT
      // ------------------------------

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

    // ==========================================
    // RESPONSE
    // ==========================================

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
// =====================================================
// UPDATE STUDENT ACCOUNT STATUS
// PATCH /api/admin/students/:id/status
// =====================================================

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
