const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const prisma = require("../../lib/prisma");
const authenticateToken = require("../../middleware/auth");
const { requireHost } = require("../../middleware/tenant");
const { loginLimiter } = require("../../lib/rateLimit");

const router = express.Router();

const PORTAL_ROLES = ["ADMIN", "TEACHER", "STUDENT", "PARENT"];

async function buildProfile(user) {
  if (user.role === "STUDENT") {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      include: { class: true },
    });

    return profile
      ? {
          name: `${profile.firstName} ${profile.lastName || ""}`.trim(),
          studentCode: profile.studentCode,
          classId: profile.classId,
          className: profile.class
            ? `${profile.class.name}${profile.class.section ? ` ${profile.class.section}` : ""}`
            : null,
        }
      : null;
  }

  if (user.role === "TEACHER") {
    const profile = await prisma.teacherProfile.findUnique({
      where: { userId: user.id },
    });

    return profile
      ? {
          name: `${profile.firstName} ${profile.lastName || ""}`.trim(),
          employeeCode: profile.employeeCode,
        }
      : null;
  }

  if (user.role === "PARENT") {
    const profile = await prisma.parentProfile.findUnique({
      where: { userId: user.id },
    });

    return profile
      ? { name: `${profile.firstName} ${profile.lastName || ""}`.trim() }
      : null;
  }

  if (user.role === "ADMIN") {
    const profile = await prisma.adminProfile.findUnique({
      where: { userId: user.id },
    });

    return { name: profile ? profile.name : user.username };
  }

  return null;
}

function publicUser(user, institution, profile) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    institutionId: user.institutionId,
    mustChangePassword: user.mustChangePassword,
    profile,
    institution: {
      id: institution.id,
      name: institution.name,
      code: institution.code,
      subdomain: institution.subdomain,
      themeColor: institution.themeColor,
    },
  };
}

router.post(
  "/login",
  requireHost("institution"),
  loginLimiter,
  async (req, res) => {
    try {
      const { username, password } = req.body || {};

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: "Username and password are required",
        });
      }

      const institution = req.tenant.institution;

      const user = await prisma.user.findUnique({
        where: { username: String(username).trim() },
      });

      const invalid = () =>
        res.status(401).json({
          success: false,
          message: "Invalid username or password",
        });

      if (
        !user ||
        user.institutionId !== institution.id ||
        !PORTAL_ROLES.includes(user.role)
      ) {
        return invalid();
      }

      const ok = await bcrypt.compare(String(password), user.passwordHash);

      if (!ok) {
        return invalid();
      }

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: "Your account has been disabled",
        });
      }

      if (!process.env.JWT_SECRET) {
        return res.status(500).json({
          success: false,
          message: "Server authentication configuration error",
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const token = jwt.sign(
        {
          userId: user.id,
          role: user.role,
          institutionId: user.institutionId,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1d" },
      );

      const profile = await buildProfile(user);

      return res.json({
        success: true,
        message: "Login successful",
        token,
        user: publicUser(user, institution, profile),
      });
    } catch (error) {
      console.error("Portal login error:", error);

      return res.status(500).json({
        success: false,
        message: "Login failed",
      });
    }
  },
);

router.get("/me", authenticateToken, requireHost("institution"), async (req, res) => {
  const profile = await buildProfile(req.user);

  res.json({
    success: true,
    user: publicUser(req.user, req.tenant.institution, profile),
  });
});

router.post(
  "/change-password",
  authenticateToken,
  requireHost("institution"),
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body || {};

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password and new password are required",
        });
      }

      if (String(newPassword).length < 8) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 8 characters long",
        });
      }

      const user = await prisma.user.findUnique({ where: { id: req.user.id } });

      if (!(await bcrypt.compare(String(currentPassword), user.passwordHash))) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      if (await bcrypt.compare(String(newPassword), user.passwordHash)) {
        return res.status(400).json({
          success: false,
          message: "New password must be different from current password",
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await bcrypt.hash(String(newPassword), 12),
          mustChangePassword: false,
        },
      });

      res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to change password",
      });
    }
  },
);

router.post(
  "/forgot-password",
  requireHost("institution"),
  async (req, res) => {
    try {
      const username = String(req.body?.username || "").trim();
      const email = String(req.body?.email || "").trim().toLowerCase();
      const newPassword = String(req.body?.newPassword || "");

      if (!username || !email || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Username, email and new password are required",
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 8 characters long",
        });
      }

      const institution = req.tenant.institution;

      const user = await prisma.user.findUnique({
        where: { username },
      });

      const validAccount =
        user &&
        user.institutionId === institution.id &&
        PORTAL_ROLES.includes(user.role) &&
        user.isActive &&
        String(user.email || "").trim().toLowerCase() === email;

      if (!validAccount) {
        return res.status(400).json({
          success: false,
          message: "The username and registered email do not match",
        });
      }

      if (await bcrypt.compare(newPassword, user.passwordHash)) {
        return res.status(400).json({
          success: false,
          message: "New password must be different from the current password",
        });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await bcrypt.hash(newPassword, 12),
          mustChangePassword: false,
        },
      });

      return res.json({
        success: true,
        message: "Password reset successfully",
      });
    } catch (error) {
      console.error("Forgot password error:", error);

      return res.status(500).json({
        success: false,
        message: "Password reset failed",
      });
    }
  },
);

module.exports = router;
