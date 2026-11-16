const express = require("express");
const { PrismaClient } = require("@prisma/client");
const session = require("express-session");
const path = require("path");
require("dotenv").config();
const authenticateToken = require("./middleware/auth.js");
const requireSuperAdmin = require("./middleware/superadmin.js");

// Routers
const homeRouter = require("./router/index.js");
const programRouter = require("./router/api/program.js");
const uploadRouter = require("./router/api/upload.js");

const superAdminRouter = require("./router/api/super_admin.js");
const institutionRouter = require("./router/api/institution.js")
const usersRouter = require("./router/api/users.js");

//router for admin
const adminRouter = require("./router/api/admin");

//router for students
const studentRouter = require("./router/api/students.js");

//404 router
const errorrouter = require("./router/404.js")


const app = express();
const prisma = new PrismaClient();

// ================================
// MIDDLEWARE
// ================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve files from /public
app.use(express.static(path.join(__dirname, "public")));

// ================================
// SESSION
// ================================

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
  })
);

// ================================
// BASIC ROUTES
// ================================

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "OK",
    message: "Server is running",
  });
});

// Database test
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
      error: error.message,
    });
  }
});

// ================================
// SUPER ADMIN
// ================================

// Super Admin login API
app.use("/api/super-admin", superAdminRouter);
app.use("/api/super-admin/institutions", institutionRouter);
app.use("/api/super-admin/users", usersRouter );

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
  }
);

//admin login api
app.use("/api/admin", adminRouter);

//admin routes
app.get(
    [
        "/admin",
        "/admin/dashboard",
        "/admin/students",
        "/admin/teachers",
        "/admin/parents"
    ],
    (req, res) => {
        res.sendFile(
            path.join(__dirname, "public", "admin", "index.html")
        );
    }
);


//student api
app.use("/api/admin/students", studentRouter);
// ================================
// EXISTING APPLICATION ROUTES
// ================================

// Public website
app.use("/", homeRouter);

// Existing admin page
app.use("/admin", adminRouter);

// Programs API
app.use("/api/program", programRouter);

// Upload API
app.use("/api/admin", uploadRouter);

// ================================
// 404 HANDLER
// ================================

app.use("",errorrouter);

// ================================
// ERROR HANDLER
// ================================

app.use((err, req, res, next) => {
  console.error("Server error:", err);

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// ================================
// START SERVER
// ================================

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await prisma.$connect();

    console.log("✅ PostgreSQL connected successfully");

    app.listen(PORT, () => {
      console.log("");
      console.log("=================================");
      console.log("🚀 SERVER STARTED");
      console.log("=================================");
      console.log(`🌐 Server: http://localhost:${PORT}`);
      console.log(`❤️ Health: http://localhost:${PORT}/api/health`);
      console.log(`🗄️ Database: PostgreSQL`);
      console.log(`🔐 Super Admin: /api/superadmin/login`);
      console.log("=================================");
      console.log("");
    });
  } catch (error) {
    console.error("❌ Failed to start server");
    console.error(error);

    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();

module.exports = app;