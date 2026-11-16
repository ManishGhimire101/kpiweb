const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const { passwordFingerprint } = require("../lib/passwords");

const SUPER_ADMIN_AUDIENCE = "super-admin";

const PASSWORD_CHANGE_ALLOWED = new Set([
  "/api/auth/me",
  "/api/auth/change-password",
  "/api/admin/change-password",
  "/api/super-admin/me",
  "/api/super-admin/change-password",
]);

async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token missing",
      });
    }

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured");

      return res.status(500).json({
        success: false,
        message: "Server authentication configuration error",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is disabled",
      });
    }

    if (user.role === "SUPER_ADMIN") {
      if (
        decoded.aud !== SUPER_ADMIN_AUDIENCE ||
        decoded.pwv !== passwordFingerprint(user.passwordHash)
      ) {
        return res.status(401).json({
          success: false,
          message: "Session expired. Please sign in again.",
        });
      }
    } else if (decoded.aud === SUPER_ADMIN_AUDIENCE) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token",
      });
    }

    const tenant = req.tenant;

    if (tenant) {
      if (user.role === "SUPER_ADMIN") {
        if (tenant.kind !== "super") {
          return res.status(403).json({
            success: false,
            message: "Super Admin access is only available on the super admin domain",
          });
        }
      } else {
        if (
          tenant.kind !== "institution" ||
          !tenant.institution ||
          user.institutionId !== tenant.institution.id
        ) {
          return res.status(403).json({
            success: false,
            message: "This account does not belong to this institution",
          });
        }

        if (!tenant.institution.isActive) {
          return res.status(403).json({
            success: false,
            message: "This institution is currently inactive",
          });
        }
      }
    }

    req.user = user;

    if (
      user.mustChangePassword &&
      !PASSWORD_CHANGE_ALLOWED.has(req.originalUrl.split("?")[0])
    ) {
      return res.status(403).json({
        success: false,
        code: "PASSWORD_CHANGE_REQUIRED",
        message: "Please change your temporary password to continue",
      });
    }

    next();
  } catch (error) {
    console.error("Authentication error:", error.message);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Authentication token expired",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
}

module.exports = authenticateToken;
module.exports.SUPER_ADMIN_AUDIENCE = SUPER_ADMIN_AUDIENCE;