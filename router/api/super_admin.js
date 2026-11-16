const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const prisma = require("../../lib/prisma");
const authenticateToken = require("../../middleware/auth.js");
const requireSuperAdmin = require("../../middleware/superadmin.js");
const { createRateLimiter } = require("../../lib/rateLimit");
const { passwordFingerprint } = require("../../lib/passwords");

const { SUPER_ADMIN_AUDIENCE } = authenticateToken;

const router = express.Router();

const TOKEN_TTL = "1h";
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

const superLoginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => `super-login|${req.ip}`,
});

const changePasswordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => `super-change|${req.ip}`,
});

function issueToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      pwv: passwordFingerprint(user.passwordHash),
    },
    process.env.JWT_SECRET,
    { expiresIn: TOKEN_TTL, audience: SUPER_ADMIN_AUDIENCE, algorithm: "HS256" },
  );
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
}

function passwordProblem(password, username) {
  if (password.length < 12) return "Password must be at least 12 characters long";
  if (password.length > 128) return "Password must be 128 characters or fewer";
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password))
    return "Password must contain both letters and numbers";
  if (username && password.toLowerCase().includes(username.toLowerCase()))
    return "Password must not contain the username";
  return null;
}

router.post("/login", superLoginLimiter, async (req, res) => {
  const invalid = () =>
    res.status(401).json({ success: false, message: "Invalid username or password" });

  try {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured");
      return res.status(500).json({ success: false, message: "Internal server error" });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    const passwordValid = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

    if (!user || !passwordValid || user.role !== "SUPER_ADMIN" || !user.isActive) {
      return invalid();
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    res.json({
      success: true,
      message: "Login successful",
      token: issueToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Super Admin login error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.post(
  "/change-password",
  changePasswordLimiter,
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const currentPassword =
        typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
      const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password and new password are required",
        });
      }

      const user = await prisma.user.findUnique({ where: { id: req.user.id } });

      if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
        return res.status(400).json({
          success: false,
          field: "currentPassword",
          message: "Current password is incorrect",
        });
      }

      const problem = passwordProblem(newPassword, user.username);

      if (problem) {
        return res.status(400).json({ success: false, field: "newPassword", message: problem });
      }

      if (await bcrypt.compare(newPassword, user.passwordHash)) {
        return res.status(400).json({
          success: false,
          field: "newPassword",
          message: "New password must be different from the current password",
        });
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await bcrypt.hash(newPassword, 12),
          mustChangePassword: false,
        },
      });

      res.json({
        success: true,
        message: "Password changed successfully",
        token: issueToken(updated),
        user: publicUser(updated),
      });
    } catch (error) {
      console.error("Super Admin change password error:", error);
      res.status(500).json({ success: false, message: "Failed to change password" });
    }
  },
);

router.get("/dashboard", authenticateToken, requireSuperAdmin, async (req, res) => {
  try {
    const [totalInstitutions, totalUsers, totalStudents, totalTeachers, totalParents] =
      await Promise.all([
        prisma.institution.count(),
        prisma.user.count(),
        prisma.user.count({ where: { role: "STUDENT" } }),
        prisma.user.count({ where: { role: "TEACHER" } }),
        prisma.user.count({ where: { role: "PARENT" } }),
      ]);

    res.json({
      success: true,
      data: { totalInstitutions, totalUsers, totalStudents, totalTeachers, totalParents },
    });
  } catch (error) {
    console.error("Dashboard data error:", error);
    res.status(500).json({ success: false, message: "Failed to load dashboard data" });
  }
});

module.exports = router;
