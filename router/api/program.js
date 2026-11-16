const express = require("express");

const prisma = require("../../lib/prisma");
const { publicInstitutionId } = require("../../lib/publicScope");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const institutionId = await publicInstitutionId(req);

    const programs = await prisma.program.findMany({
      where: institutionId !== null ? { institutionId } : {},
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

module.exports = router;
