const express = require("express");

const prisma = require("../../lib/prisma");
const { publicInstitutionId } = require("../../lib/publicScope");

const router = express.Router();

const allowedCategories = new Set(["home", "about", "notices", "staff", "gallary"]);

router.get("/upload/:category", async (req, res) => {
  try {
    const { category } = req.params;

    if (!allowedCategories.has(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }

    const institutionId = await publicInstitutionId(req);

    const items = await prisma.upload.findMany({
      where: { category, ...(institutionId !== null ? { institutionId } : {}) },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch uploads" });
  }
});

router.get("/upload", async (req, res) => {
  try {
    const institutionId = await publicInstitutionId(req);

    const items = await prisma.upload.findMany({
      where: institutionId !== null ? { institutionId } : {},
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch uploads" });
  }
});

module.exports = router;
