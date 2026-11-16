const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const STORAGE_ROOT = path.join(__dirname, "..", "storage");
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".txt",
  ".csv",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".zip",
]);

function safeDisplayName(name) {
  return (
    path
      .basename(String(name || "file"))
      .replace(/[^\w.\- ()]+/g, "_")
      .slice(0, 150) || "file"
  );
}

function createUploader() {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(STORAGE_ROOT, String(req.user.institutionId));
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${crypto.randomBytes(16).toString("hex")}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();

      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return cb(
          Object.assign(new Error(`File type ${ext || "unknown"} is not allowed`), {
            status: 400,
          }),
        );
      }

      cb(null, true);
    },
  }).array("files", MAX_FILES);
}

const uploader = createUploader();

function handleUpload(req, res, next) {
  uploader(req, res, (error) => {
    if (!error) {
      return next();
    }

    let message = error.message || "Upload failed";

    if (error.code === "LIMIT_FILE_SIZE") {
      message = `Each file must be ${MAX_FILE_SIZE / 1024 / 1024}MB or smaller`;
    } else if (error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE") {
      message = `You can upload up to ${MAX_FILES} files`;
    }

    return res.status(400).json({ success: false, message });
  });
}

function toFileEntries(files) {
  return (files || []).map((file) => ({
    stored: file.filename,
    name: safeDisplayName(file.originalname),
    size: file.size,
    mime: file.mimetype,
  }));
}

function resolveStoredPath(institutionId, stored) {
  const base = path.join(STORAGE_ROOT, String(institutionId));
  const full = path.join(base, path.basename(String(stored)));

  if (!full.startsWith(base + path.sep)) {
    return null;
  }

  return full;
}

function removeStoredFiles(institutionId, entries) {
  for (const entry of entries || []) {
    const full = resolveStoredPath(institutionId, entry.stored);

    if (full) {
      fs.unlink(full, () => {});
    }
  }
}

function cleanupUploaded(req) {
  removeStoredFiles(req.user.institutionId, toFileEntries(req.files));
}

function publicFiles(entries, base) {
  return (entries || []).map((entry, index) => ({
    index,
    name: entry.name,
    size: entry.size,
    url: `${base}/${index}`,
  }));
}

module.exports = {
  handleUpload,
  toFileEntries,
  resolveStoredPath,
  removeStoredFiles,
  cleanupUploaded,
  publicFiles,
  MAX_FILE_SIZE,
  MAX_FILES,
};
