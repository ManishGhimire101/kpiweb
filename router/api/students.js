const express = require("express");
const { generateTemporaryPassword } = require("../../lib/passwords");
const bcrypt = require("bcrypt");

const authenticateToken = require("../../middleware/auth");
const requireAdmin = require("../../middleware/admin");

const prisma = require("../../lib/prisma");
const router = express.Router();

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
