const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const authenticateToken = require("../../middleware/auth.js");
const requireSuperAdmin = require("../../middleware/superadmin.js");

const router = express.Router();
const prisma = new PrismaClient();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password are required",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        username: username,
      },
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    if (user.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "Account is disabled",
      });
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      },
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (error) {
    console.error("Super Admin login error:", error);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});
router.get(
  "/dashboard",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const [
        totalInstitutions,
        totalUsers,
        totalStudents,
        totalTeachers,
        totalParents,
      ] = await Promise.all([
        prisma.institution.count(),

        prisma.user.count(),

        prisma.user.count({
          where: {
            role: "STUDENT",
          },
        }),

        prisma.user.count({
          where: {
            role: "TEACHER",
          },
        }),

        prisma.user.count({
          where: {
            role: "PARENT",
          },
        }),
      ]);

      res.json({
        success: true,
        data: {
          totalInstitutions,
          totalUsers,
          totalStudents,
          totalTeachers,
          totalParents,
        },
      });
    } catch (error) {
      console.error("Dashboard data error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to load dashboard data",
      });
    }
  },
);

module.exports = router;
