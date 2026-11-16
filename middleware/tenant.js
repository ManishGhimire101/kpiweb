const prisma = require("../lib/prisma");
const { resolveTenant } = require("../lib/tenant");

async function tenantMiddleware(req, res, next) {
  try {
    req.tenant = await resolveTenant(prisma, req.headers.host);
    next();
  } catch (error) {
    next(error);
  }
}

function isApi(req) {
  return req.originalUrl.startsWith("/api/");
}

function deny(req, res, status, message) {
  if (isApi(req)) {
    return res.status(status).json({ success: false, message });
  }

  return res.status(status).send(message);
}

function requireHost(...kinds) {
  return (req, res, next) => {
    if (!kinds.includes(req.tenant.kind)) {
      return deny(req, res, 404, "Not found");
    }

    if (req.tenant.kind === "institution") {
      if (!req.tenant.institution) {
        return deny(req, res, 404, "Institution not found");
      }

      if (!req.tenant.institution.isActive) {
        return deny(req, res, 403, "This institution is currently inactive");
      }
    }

    next();
  };
}

const SUPER_PREFIXES = [
  "/super_admin",
  "/superadmin",
  "/dashboard",
  "/api/super-admin",
];

const PORTAL_PREFIXES = [
  "/admin",
  "/teacher",
  "/student",
  "/parent",
  "/portal",
  "/uploads",
  "/login",
  "/change-password",
  "/api/admin",
  "/api/teacher",
  "/api/student",
  "/api/parent",
  "/api/auth",
  "/api/files",
];

const TEMPLATE_PATHS = [
  "/",
  "/notice",
  "/program",
  "/gallary",
  "/staff",
  "/about",
  "/style.css",
  "/script.js",
  "/component",
  "/api/program",
];

const ROOT_PUBLIC_API = ["/api/admin/upload"];

function matches(pathname, prefixes) {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}.`),
  );
}

function hostGuard(req, res, next) {
  const pathname = req.path;
  const kind = req.tenant.kind;

  if (pathname === "/api/health" || pathname === "/api/config") {
    return next();
  }

  if (kind === "super") {
    if (pathname === "/") {
      return res.redirect("/superadmin");
    }

    if (
      matches(pathname, SUPER_PREFIXES) ||
      matches(pathname, ["/uploads"]) ||
      pathname.startsWith("/portal/shared")
    ) {
      return next();
    }

    return deny(req, res, 404, "Not found");
  }

  if (kind === "institution") {
    if (!req.tenant.institution) {
      return deny(req, res, 404, "Institution not found");
    }

    if (!req.tenant.institution.isActive) {
      return deny(req, res, 403, "This institution is currently inactive");
    }

    if (matches(pathname, SUPER_PREFIXES)) {
      return deny(req, res, 404, "Not found");
    }

    if (
      matches(pathname, TEMPLATE_PATHS) ||
      matches(pathname, PORTAL_PREFIXES)
    ) {
      return next();
    }

    return deny(req, res, 404, "Not found");
  }

  if (matches(pathname, SUPER_PREFIXES)) {
    return deny(req, res, 404, "Not found");
  }

  if (matches(pathname, PORTAL_PREFIXES)) {
    if (ROOT_PUBLIC_API.some((p) => pathname.startsWith(p))) {
      return next();
    }

    return deny(req, res, 404, "Not found");
  }

  next();
}

module.exports = { tenantMiddleware, requireHost, hostGuard };
