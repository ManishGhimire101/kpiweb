const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const prisma = require("../../lib/prisma");
const authenticateToken = require("../../middleware/auth");
const requireAdmin = require("../../middleware/admin");
const lms = require("../../lib/lms");

const router = express.Router();

router.use(authenticateToken, requireAdmin);

const CATEGORIES = new Set(["home", "about", "notices", "staff", "gallary"]);
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const UPLOAD_ROOT = path.join(__dirname, "..", "..", "public", "uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = req.params.category || (file.fieldname === "logo" ? "logo" : "misc");
    const dir = path.join(UPLOAD_ROOT, String(req.user.institutionId), folder);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${crypto.randomBytes(12).toString("hex")}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!IMAGE_EXT.has(ext)) {
      return cb(Object.assign(new Error("Only JPG, PNG, WEBP or GIF images are allowed"), { status: 400 }));
    }
    cb(null, true);
  },
});

function single(field) {
  const handler = imageUpload.single(field);
  return (req, res, next) =>
    handler(req, res, (error) => {
      if (!error) return next();
      const message = error.code === "LIMIT_FILE_SIZE" ? "Image must be 5MB or smaller" : error.message;
      res.status(400).json({ success: false, message });
    });
}

function wrap(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error("Content API error:", error);
      removeFile(req.file && `/uploads/${req.user.institutionId}/${path.basename(path.dirname(req.file.path))}/${req.file.filename}`, req.user.institutionId);
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: "Something went wrong" });
      }
    }
  };
}

function removeFile(url, institutionId) {
  if (!url || !url.startsWith(`/uploads/${institutionId}/`)) return;
  const full = path.join(UPLOAD_ROOT, url.replace("/uploads/", ""));
  if (full.startsWith(UPLOAD_ROOT + path.sep)) {
    fs.unlink(full, () => {});
  }
}

function urlFor(req, file) {
  return `/uploads/${req.user.institutionId}/${path.basename(path.dirname(file.path))}/${file.filename}`;
}

function bad(res, message, status = 400) {
  return res.status(status).json({ success: false, message });
}

router.get(
  "/uploads",
  wrap(async (req, res) => {
    const category = String(req.query.category || "");

    if (!CATEGORIES.has(category)) {
      return bad(res, "Invalid category");
    }

    const items = await prisma.upload.findMany({
      where: { institutionId: req.user.institutionId, category },
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: items });
  }),
);

function validateText(body, res, req) {
  const title = String(body.title || "").trim();
  const details = String(body.details || "").trim();

  if (!title || title.length > 200) {
    removeFile(req.file && urlFor(req, req.file), req.user.institutionId);
    bad(res, "Title is required (200 characters max)");
    return null;
  }

  if (details.length > 5000) {
    removeFile(req.file && urlFor(req, req.file), req.user.institutionId);
    bad(res, "Details must be 5000 characters or fewer");
    return null;
  }

  return { title, details: details || null };
}

router.post(
  "/uploads/:category",
  single("image"),
  wrap(async (req, res) => {
    if (!CATEGORIES.has(req.params.category)) {
      return bad(res, "Invalid category");
    }

    if (!req.file) {
      return bad(res, "An image is required");
    }

    const text = validateText(req.body, res, req);
    if (!text) return;

    const item = await prisma.upload.create({
      data: {
        institutionId: req.user.institutionId,
        category: req.params.category,
        ...text,
        imageUrl: urlFor(req, req.file),
      },
    });

    res.status(201).json({ success: true, message: "Saved", data: item });
  }),
);

router.put(
  "/uploads/:id",
  wrap(async (req, res) => {
    const id = lms.toInt(req.params.id);
    const item = id
      ? await prisma.upload.findFirst({ where: { id, institutionId: req.user.institutionId } })
      : null;

    if (!item) return bad(res, "Item not found", 404);

    const title = String(req.body.title ?? item.title ?? "").trim();
    const details = String(req.body.details ?? item.details ?? "").trim();

    if (!title || title.length > 200) return bad(res, "Title is required (200 characters max)");
    if (details.length > 5000) return bad(res, "Details must be 5000 characters or fewer");

    await prisma.upload.update({ where: { id }, data: { title, details: details || null } });

    res.json({ success: true, message: "Updated" });
  }),
);

router.delete(
  "/uploads/:id",
  wrap(async (req, res) => {
    const id = lms.toInt(req.params.id);
    const item = id
      ? await prisma.upload.findFirst({ where: { id, institutionId: req.user.institutionId } })
      : null;

    if (!item) return bad(res, "Item not found", 404);

    await prisma.upload.delete({ where: { id } });
    removeFile(item.imageUrl, req.user.institutionId);

    res.json({ success: true, message: "Deleted" });
  }),
);

router.get(
  "/programs",
  wrap(async (req, res) => {
    const programs = await prisma.program.findMany({
      where: { institutionId: req.user.institutionId },
      include: { courses: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "asc" },
    });

    res.json({ success: true, data: programs });
  }),
);

router.post(
  "/programs",
  wrap(async (req, res) => {
    const name = String(req.body.name || "").trim();
    const details = String(req.body.details || "").trim();

    if (!name || name.length > 120) return bad(res, "Program name is required (120 characters max)");
    if (details.length > 2000) return bad(res, "Details must be 2000 characters or fewer");

    const program = await prisma.program.create({
      data: { institutionId: req.user.institutionId, name, details: details || null },
    });

    res.status(201).json({ success: true, message: "Program added", data: program });
  }),
);

async function ownProgram(req, res) {
  const id = lms.toInt(req.params.id);
  const program = id
    ? await prisma.program.findFirst({ where: { id, institutionId: req.user.institutionId } })
    : null;

  if (!program) bad(res, "Program not found", 404);
  return program;
}

router.put(
  "/programs/:id",
  wrap(async (req, res) => {
    const program = await ownProgram(req, res);
    if (!program) return;

    const name = String(req.body.name ?? program.name).trim();
    const details = String(req.body.details ?? program.details ?? "").trim();

    if (!name || name.length > 120) return bad(res, "Program name is required (120 characters max)");

    await prisma.program.update({ where: { id: program.id }, data: { name, details: details || null } });

    res.json({ success: true, message: "Program updated" });
  }),
);

router.delete(
  "/programs/:id",
  wrap(async (req, res) => {
    const program = await ownProgram(req, res);
    if (!program) return;

    await prisma.program.delete({ where: { id: program.id } });

    res.json({ success: true, message: "Program deleted" });
  }),
);

router.post(
  "/programs/:id/courses",
  wrap(async (req, res) => {
    const program = await ownProgram(req, res);
    if (!program) return;

    const title = String(req.body.title || "").trim();
    const details = String(req.body.details || "").trim();

    if (!title || title.length > 150) return bad(res, "Course title is required (150 characters max)");
    if (details.length > 2000) return bad(res, "Details must be 2000 characters or fewer");

    const course = await prisma.course.create({
      data: { programId: program.id, title, details: details || null, isFree: req.body.isFree === true || req.body.isFree === "true" },
    });

    res.status(201).json({ success: true, message: "Course added", data: course });
  }),
);

async function ownCourse(req, res) {
  const id = lms.toInt(req.params.courseId);
  const course = id
    ? await prisma.course.findFirst({ where: { id, program: { institutionId: req.user.institutionId } } })
    : null;

  if (!course) bad(res, "Course not found", 404);
  return course;
}

router.put(
  "/courses/:courseId",
  wrap(async (req, res) => {
    const course = await ownCourse(req, res);
    if (!course) return;

    const title = String(req.body.title ?? course.title).trim();

    if (!title || title.length > 150) return bad(res, "Course title is required (150 characters max)");

    await prisma.course.update({
      where: { id: course.id },
      data: {
        title,
        details: String(req.body.details ?? course.details ?? "").trim() || null,
        isFree: req.body.isFree !== undefined ? req.body.isFree === true || req.body.isFree === "true" : course.isFree,
      },
    });

    res.json({ success: true, message: "Course updated" });
  }),
);

router.delete(
  "/courses/:courseId",
  wrap(async (req, res) => {
    const course = await ownCourse(req, res);
    if (!course) return;

    await prisma.course.delete({ where: { id: course.id } });

    res.json({ success: true, message: "Course deleted" });
  }),
);

router.get(
  "/profile",
  wrap(async (req, res) => {
    const i = await prisma.institution.findUnique({ where: { id: req.user.institutionId } });

    res.json({
      success: true,
      data: {
        name: i.name,
        type: i.type,
        logo: i.logo,
        email: i.email,
        phone: i.phone,
        address: i.address,
        website: i.website,
      },
    });
  }),
);

router.put(
  "/profile",
  single("logo"),
  wrap(async (req, res) => {
    const current = await prisma.institution.findUnique({ where: { id: req.user.institutionId } });
    const fail = (message) => {
      removeFile(req.file && urlFor(req, req.file), req.user.institutionId);
      return bad(res, message);
    };

    const email = String(req.body.email ?? current.email ?? "").trim();
    const phone = String(req.body.phone ?? current.phone ?? "").trim();
    const website = String(req.body.website ?? current.website ?? "").trim();
    const address = String(req.body.address ?? current.address ?? "").trim();
    const type = String(req.body.type ?? current.type ?? "").trim();

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email address");
    if (phone && !/^[0-9+\-\s(),]{6,40}$/.test(phone)) return fail("Enter a valid phone number");
    if (website && !/^https?:\/\/.+\..+/.test(website)) return fail("Website must start with http:// or https://");
    if (address.length > 300) return fail("Address must be 300 characters or fewer");

    const data = {
      email: email || null,
      phone: phone || null,
      website: website || null,
      address: address || null,
      type: type || null,
    };

    if (req.file) {
      data.logo = urlFor(req, req.file);
    }

    await prisma.institution.update({ where: { id: current.id }, data });

    if (req.file) {
      removeFile(current.logo, req.user.institutionId);
    }

    res.json({ success: true, message: "Profile saved" });
  }),
);

module.exports = router;
