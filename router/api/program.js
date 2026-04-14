const express = require("express");
const { PrismaClient } = require("@prisma/client");

const router = express.Router();
const prisma = new PrismaClient();

// GET all programs with courses
router.get("/", async (req, res) => {
  try {
    const programs = await prisma.program.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        courses: { orderBy: { createdAt: "asc" } },
      },
    });
    res.json(programs);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch programs" });
  }
});

// POST create new program
router.post("/", async (req, res) => {
  try {
    const { name, details } = req.body;
    if (!name) return res.status(400).json({ message: "Name is required" });

    const created = await prisma.program.create({
      data: { name, details: details || null },
    });
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ message: "Failed to create program" });
  }
});

// POST create course under a program
router.post("/:programId/courses", async (req, res) => {
  try {
    const programId = Number(req.params.programId);
    const { title, details, isFree } = req.body;

    if (!title) return res.status(400).json({ message: "Title is required" });

    const created = await prisma.course.create({
      data: {
        title,
        details: details || null,
        isFree: Boolean(isFree),
        programId,
      },
    });

    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ message: "Failed to create course" });
  }
});

module.exports = router;
