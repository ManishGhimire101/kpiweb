const express = require("express");

// Use process.cwd() for Docker compatibility (WORKDIR /app)
const ROOT_DIR = process.cwd();
const session = require("express-session");
const path = require("path");
require("dotenv").config();

const prisma = require("./lib/prisma");
const authenticateToken = require("./middleware/auth.js");
const requireSuperAdmin = require("./middleware/superadmin.js");
const { tenantMiddleware, hostGuard, requireHost } = require("./middleware/tenant.js");
const { loginLimiter } = require("./lib/rateLimit.js");

const homeRouter = require("./router/index.js");
const programRouter = require("./router/api/program.js");
const uploadRouter = require("./router/api/upload.js");
const superAdminRouter = require("./router/api/super_admin.js");
const institutionRouter = require("./router/api/institution.js");
const usersRouter = require("./router/api/users.js");
const adminRouter = require("./router/api/admin");
const adminLmsRouter = require("./router/api/admin_lms.js");
const contentRouter = require("./router/api/content.js");
const studentAdminRouter = require("./router/api/students.js");
const authRouter = require("./router/api/auth.js");
const configRouter = require("./router/api/config.js");
const registerRouter = require("./router/api/register.js");
const teacherRouter = require("./router/api/teacher.js");
const studentRouter = require("./router/api/student.js");
const parentRouter = require("./router/api/parent.js");
const filesRouter = require("./router/api/files.js");
const errorrouter = require("./router/404.js");

const app = express();

app.set("trust proxy", 1);

app.use(tenantMiddleware);
app.use(hostGuard);

app.use((req, res, next) => {
  if (req.tenant.kind === "super") {
    res.set({
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
    });
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const landingPage = (file) => (req, res, next) =>
  req.tenant.kind === "root" ? res.sendFile(path.join(__dirname, "landing", file)) : next();

app.get("/", landingPage("index.html"));
app.get("/about", landingPage("about.html"));
app.get("/register", landingPage("register.html"));
app.get("/lms", (req, res) => res.redirect(301, "/"));
app.get("/lms/about", (req, res) => res.redirect(301, "/about"));

app.use("/landing", express.static(path.join(__dirname, "landing")));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "development-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "OK",
    message: "Server is running",
  });
});

app.use("/api/config", configRouter);
app.use("/api/register", requireHost("root"), registerRouter);

app.get("/api/test", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      success: true,
      message: "Database connected successfully!",
      database: "PostgreSQL",
      status: "OK",
    });
  } catch (error) {
    console.error("Database connection failed:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

app.use("/api/super-admin/login", requireHost("super"), loginLimiter);
app.use("/api/super-admin", requireHost("super"), superAdminRouter);
app.use("/api/super-admin/institutions", institutionRouter);
app.use("/api/super-admin/users", usersRouter);

app.get(
  "/api/super-admin/me",
  authenticateToken,
  requireSuperAdmin,
  (req, res) => {
    res.json({
      success: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        isActive: req.user.isActive,
        mustChangePassword: req.user.mustChangePassword,
        lastLoginAt: req.user.lastLoginAt,
      },
    });
  },
);

app.use("/api/auth", authRouter);
app.use("/api/teacher", teacherRouter);
app.use("/api/student", studentRouter);
app.use("/api/parent", parentRouter);
app.use("/api/files", filesRouter);

app.use("/api/admin/login", requireHost("institution"), loginLimiter);
app.use("/api/admin/content", requireHost("institution"), contentRouter);
app.use("/api/admin/students", studentAdminRouter);
app.use("/api/admin", adminLmsRouter);
app.use("/api/admin", adminRouter);

const page = (...segments) => (req, res) =>
  res.sendFile(path.join(__dirname, "public", ...segments));

const institutionOnly = requireHost("institution");

app.get("/login", institutionOnly, page("portal", "login.html"));
app.get("/admin/login", institutionOnly, (req, res) => res.redirect("/login"));
app.get(["/change-password", "/admin/change-password"], institutionOnly, page("portal", "change-password.html"));
app.get("/teacher", institutionOnly, page("portal", "teacher.html"));
app.get("/student", institutionOnly, page("portal", "student.html"));
app.get("/parent", institutionOnly, page("portal", "parent.html"));

app.get(
  [
    "/admin",
    "/admin/dashboard",
    "/admin/students",
    "/admin/teachers",
    "/admin/parents",
    "/admin/classes",
    "/admin/website",
  ],
  institutionOnly,
  page("admin", "index.html"),
);

app.get("/superadmin/change-password", requireHost("super"), page("super_admin", "change-password.html"));
app.get("/superadmin", requireHost("super"), page("superadmin.html"));
app.get("/dashboard", requireHost("super"), page("super_admin", "index.html"));

app.use("/", homeRouter);

app.use("/api/program", programRouter);
app.use("/api/admin", uploadRouter);

app.use("", errorrouter);

app.use((err, req, res, next) => {
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Invalid JSON body" });
  }

  console.error("Server error:", err);

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await prisma.$connect();

    console.log("PostgreSQL connected successfully");

    app.listen(PORT, () => {
      const root = process.env.ROOT_DOMAIN || "localhost";
      const superSub = process.env.SUPER_SUBDOMAIN || "super";

      console.log("");
      console.log("=================================");
      console.log("SERVER STARTED");
      console.log("=================================");
      console.log(`Public site : http://${root}:${PORT}`);
      console.log(`Super admin : http://${superSub}.${root}:${PORT}`);
      console.log(`Institutions: http://<subdomain>.${root}:${PORT}`);
      console.log("=================================");
      console.log("");
    });
  } catch (error) {
    console.error("Failed to start server");
    console.error(error);

    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();

module.exports = app;
