const express = require("express");
const { PrismaClient } = require("@prisma/client");
const path = require("path");
const homeRouter = require("./router/index.js");
const programRouter = require("./router/api/program.js");
const uploadRouter = require("./router/api/upload.js");

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(express.json());
app.use(express.static("public"));

// Test database connection
app.get("/api/test", async (req, res) => {
  try {
    const result = await prisma.$queryRaw`SELECT NOW()`;
    res.json({ message: "Database connected!" });
  } catch (error) {
    res.status(500).json({ error: "Database connection failed" });
  }
});

// Use routers
app.use("/", homeRouter);
app.use("/api/program", programRouter);
app.use("/api/upload", uploadRouter);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📊 Test DB: http://localhost:${PORT}/api/test`);
});

module.exports = app;