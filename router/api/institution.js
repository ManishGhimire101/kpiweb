const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const prisma = require("../../lib/prisma");
const authenticateToken = require("../../middleware/auth.js");
const requireSuperAdmin = require("../../middleware/superadmin.js");
const { checkSubdomain, portalUrl } = require("../../lib/tenant");
const {
  validateInstitutionInput,
  createInstitutionWithAdmin,
  suggestSubdomain,
  errorStatus,
} = require("../../lib/institutions");

const router = express.Router();

router.use(authenticateToken, requireSuperAdmin);

function present(institution, req) {
  return {
    ...institution,
    portalUrl: institution.subdomain ? portalUrl(req, institution.subdomain) : null,
  };
}

function fail(res, message, status = 400, field) {
  return res.status(status).json({ success: false, message, field });
}

router.get("/", async (req, res) => {
  try {
    const institutions = await prisma.institution.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.json({
      success: true,
      data: institutions.map((i) => present(i, req)),
    });
  } catch (error) {
    console.error("Get institutions error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch institutions" });
  }
});

router.get("/suggest-subdomain", async (req, res) => {
  try {
    res.json({ success: true, value: await suggestSubdomain(req.query.name) });
  } catch (error) {
    console.error("Suggest subdomain error:", error);
    res.status(500).json({ success: false, message: "Failed to suggest a subdomain" });
  }
});

router.get("/check-subdomain", async (req, res) => {
  try {
    const excludeId = Number(req.query.excludeId) || undefined;
    const result = await checkSubdomain(prisma, req.query.value, excludeId);

    res.json({
      success: true,
      available: result.available,
      message: result.message,
      url: result.available ? portalUrl(req, result.value) : null,
    });
  } catch (error) {
    console.error("Check subdomain error:", error);
    res.status(500).json({ success: false, message: "Failed to check subdomain" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { errors, data } = await validateInstitutionInput(req.body || {}, { creating: true });

    const firstKey = Object.keys(errors)[0];
    if (firstKey) {
      return res.status(errorStatus(firstKey))
        .json({ success: false, message: errors[firstKey], field: firstKey, errors });
    }

    const { institution, credentials } = await createInstitutionWithAdmin(data, req.body, {
      createAdmin: req.body.createAdmin !== false,
    });

    res.status(201).json({
      success: true,
      message: "Institution created successfully",
      institution: present(institution, req),
      adminCredentials: credentials,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return fail(res, "Code, subdomain or admin username already exists", 409);
    }

    console.error("Create institution error:", error);
    res.status(500).json({ success: false, message: "Failed to create institution" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return fail(res, "Invalid institution ID");
    }

    const current = await prisma.institution.findUnique({ where: { id } });

    if (!current) {
      return fail(res, "Institution not found", 404);
    }

    const { errors, data } = await validateInstitutionInput(req.body || {}, { excludeId: id });

    const firstKey = Object.keys(errors)[0];
    if (firstKey) {
      return res.status(400).json({ success: false, message: errors[firstKey], field: firstKey, errors });
    }

    const updated = await prisma.institution.update({ where: { id }, data });

    res.json({
      success: true,
      message: "Institution updated successfully",
      institution: present(updated, req),
    });
  } catch (error) {
    if (error.code === "P2002") {
      return fail(res, "Code, subdomain or custom domain already exists", 409);
    }

    console.error("Update institution error:", error);
    res.status(500).json({ success: false, message: "Failed to update institution" });
  }
});

const UPLOAD_ROOT = path.join(__dirname, "..", "..", "public", "uploads");

const logoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(UPLOAD_ROOT, String(Number(req.params.id)), "logo");
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, `${crypto.randomBytes(12).toString("hex")}${path.extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (![".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(path.extname(file.originalname).toLowerCase())) {
      return cb(new Error("Only JPG, PNG, WEBP or GIF images are allowed"));
    }
    cb(null, true);
  },
}).single("logo");

router.put("/:id/logo", (req, res) => {
  logoUpload(req, res, async (uploadError) => {
    try {
      if (uploadError) {
        const message = uploadError.code === "LIMIT_FILE_SIZE" ? "Logo must be 5MB or smaller" : uploadError.message;
        return fail(res, message);
      }

      const id = Number(req.params.id);
      const institution = Number.isInteger(id)
        ? await prisma.institution.findUnique({ where: { id } })
        : null;

      if (!institution || !req.file) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return fail(res, institution ? "A logo image is required" : "Institution not found", institution ? 400 : 404);
      }

      const url = `/uploads/${id}/logo/${req.file.filename}`;

      await prisma.institution.update({ where: { id }, data: { logo: url } });

      if (institution.logo && institution.logo.startsWith(`/uploads/${id}/`)) {
        fs.unlink(path.join(UPLOAD_ROOT, institution.logo.replace("/uploads/", "")), () => {});
      }

      res.json({ success: true, message: "Logo saved", logo: url });
    } catch (error) {
      console.error("Logo upload error:", error);
      res.status(500).json({ success: false, message: "Failed to save logo" });
    }
  });
});

router.patch("/:id/status", async (req, res) => {
  try {
    const institutionId = Number(req.params.id);
    const { isActive } = req.body;

    if (Number.isNaN(institutionId)) {
      return fail(res, "Invalid institution ID");
    }

    if (typeof isActive !== "boolean") {
      return fail(res, "isActive must be true or false");
    }

    const institution = await prisma.institution.findUnique({ where: { id: institutionId } });

    if (!institution) {
      return fail(res, "Institution not found", 404);
    }

    const updated = await prisma.institution.update({
      where: { id: institutionId },
      data: { isActive },
    });

    res.json({
      success: true,
      message: isActive
        ? "Institution activated successfully"
        : "Institution deactivated successfully",
      data: { id: updated.id, name: updated.name, isActive: updated.isActive },
    });
  } catch (error) {
    console.error("Institution status update error:", error);
    res.status(500).json({ success: false, message: "Failed to update institution status" });
  }
});

module.exports = router;
