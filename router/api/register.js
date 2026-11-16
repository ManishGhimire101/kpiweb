const express = require("express");

const prisma = require("../../lib/prisma");
const { checkSubdomain, portalUrl } = require("../../lib/tenant");
const { createRateLimiter } = require("../../lib/rateLimit");
const {
  validateInstitutionInput,
  createInstitutionWithAdmin,
  suggestSubdomain,
  errorStatus,
} = require("../../lib/institutions");

const router = express.Router();

const checkLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  keyFn: (req) => `check|${req.ip}`,
});

const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyFn: (req) => `register|${req.ip}`,
});

const PUBLIC_FIELDS = [
  "name",
  "code",
  "type",
  "email",
  "phone",
  "address",
  "website",
  "subdomain",
  "themeColor",
  "adminName",
  "adminEmail",
];

function pick(body) {
  const out = {};
  PUBLIC_FIELDS.forEach((key) => {
    if (body && typeof body[key] === "string") out[key] = body[key];
  });
  return out;
}

router.get("/suggest-subdomain", checkLimiter, async (req, res) => {
  try {
    res.json({ success: true, value: await suggestSubdomain(String(req.query.name || "").slice(0, 120)) });
  } catch (error) {
    console.error("Register suggest error:", error);
    res.status(500).json({ success: false, message: "Failed to suggest an address" });
  }
});

router.get("/check-subdomain", checkLimiter, async (req, res) => {
  try {
    const result = await checkSubdomain(prisma, req.query.value);

    res.json({
      success: true,
      available: result.available,
      message: result.message,
      url: result.available ? portalUrl(req, result.value) : null,
    });
  } catch (error) {
    console.error("Register check error:", error);
    res.status(500).json({ success: false, message: "Failed to check the address" });
  }
});

router.post("/", registerLimiter, async (req, res) => {
  try {
    const body = pick(req.body);
    const { errors, data } = await validateInstitutionInput(body, { creating: true });

    const firstKey = Object.keys(errors)[0];
    if (firstKey) {
      return res.status(errorStatus(firstKey)).json({
        success: false,
        message: errors[firstKey],
        field: firstKey,
        errors,
      });
    }

    data.isActive = true;
    data.customDomain = null;

    const { institution, credentials } = await createInstitutionWithAdmin(data, body);

    res.status(201).json({
      success: true,
      message: "Institution registered successfully",
      institution: {
        name: institution.name,
        code: institution.code,
        subdomain: institution.subdomain,
        portalUrl: portalUrl(req, institution.subdomain),
      },
      adminCredentials: credentials,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "That code or address was just taken. Try another.",
      });
    }

    console.error("Public register error:", error);
    res.status(500).json({ success: false, message: "Failed to register the institution" });
  }
});

module.exports = router;
