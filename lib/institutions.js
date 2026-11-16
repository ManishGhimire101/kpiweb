const bcrypt = require("bcrypt");

const prisma = require("./prisma");
const { checkSubdomain, slugifySubdomain, getRootDomain } = require("./tenant");
const { generateTemporaryPassword } = require("./passwords");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^[A-Z0-9][A-Z0-9-]{1,19}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

async function validateInstitutionInput(body, { excludeId, creating }) {
  const errors = {};
  const data = {};

  const name = String(body.name || "").trim();
  if (!name) errors.name = "Institution name is required";
  else if (name.length > 120) errors.name = "Name must be 120 characters or fewer";
  else data.name = name;

  const code = String(body.code || "").trim().toUpperCase();
  if (!code) errors.code = "Institution code is required";
  else if (!CODE_RE.test(code))
    errors.code = "Code must be 2-20 characters: letters, numbers and hyphens";
  else {
    const existing = await prisma.institution.findUnique({ where: { code } });
    if (existing && existing.id !== excludeId) errors.code = "Institution code already exists";
    else data.code = code;
  }

  const sub = await checkSubdomain(prisma, body.subdomain, excludeId);
  if (!sub.available) errors.subdomain = sub.message;
  else data.subdomain = sub.value;

  const email = String(body.email || "").trim();
  if (email && !EMAIL_RE.test(email)) errors.email = "Enter a valid email address";
  else data.email = email || null;

  const phone = String(body.phone || "").trim();
  if (phone && !/^[0-9+\-\s()]{6,20}$/.test(phone)) errors.phone = "Enter a valid phone number";
  else data.phone = phone || null;

  const website = String(body.website || "").trim();
  if (website && !/^https?:\/\/.+\..+/.test(website))
    errors.website = "Website must start with http:// or https://";
  else data.website = website || null;

  const customDomain = String(body.customDomain || "").trim().toLowerCase();
  if (customDomain) {
    const root = getRootDomain();
    if (!DOMAIN_RE.test(customDomain)) errors.customDomain = "Enter a valid domain name";
    else if (customDomain === root || customDomain.endsWith(`.${root}`))
      errors.customDomain = `Custom domain cannot be under ${root}`;
    else {
      const existing = await prisma.institution.findUnique({ where: { customDomain } });
      if (existing && existing.id !== excludeId) errors.customDomain = "Custom domain is already used";
      else data.customDomain = customDomain;
    }
  } else {
    data.customDomain = null;
  }

  const themeColor = String(body.themeColor || "#2563eb").trim();
  if (!HEX_RE.test(themeColor)) errors.themeColor = "Theme colour must be a hex value like #2563eb";
  else data.themeColor = themeColor;

  data.type = String(body.type || "").trim() || null;
  data.address = String(body.address || "").trim() || null;
  data.isActive = body.isActive !== false;

  if (creating && body.adminEmail) {
    const adminEmail = String(body.adminEmail).trim().toLowerCase();
    if (!EMAIL_RE.test(adminEmail)) errors.adminEmail = "Enter a valid admin email address";
    else if (await prisma.user.findUnique({ where: { email: adminEmail } }))
      errors.adminEmail = "Admin email is already in use";
  }

  return { errors, data };
}

async function createInstitutionWithAdmin(data, body, { createAdmin = true } = {}) {
  let credentials = null;

  const institution = await prisma.$transaction(async (tx) => {
    const created = await tx.institution.create({ data });

    if (createAdmin) {
      const username = `${data.code.toLowerCase()}-admin`;
      const password = generateTemporaryPassword();
      const adminEmail = body.adminEmail
        ? String(body.adminEmail).trim().toLowerCase()
        : data.email
          ? data.email.toLowerCase()
          : null;

      const emailTaken = adminEmail
        ? await tx.user.findUnique({ where: { email: adminEmail } })
        : null;

      const user = await tx.user.create({
        data: {
          institutionId: created.id,
          username,
          email: emailTaken ? null : adminEmail,
          passwordHash: await bcrypt.hash(password, 12),
          role: "ADMIN",
          mustChangePassword: true,
        },
      });

      await tx.adminProfile.create({
        data: {
          userId: user.id,
          institutionId: created.id,
          name: String(body.adminName || "").trim() || `${data.name} Admin`,
          designation: "Institution Admin",
        },
      });

      credentials = { username, temporaryPassword: password };
    }

    return created;
  });

  return { institution, credentials };
}

async function suggestSubdomain(name) {
  const base = slugifySubdomain(name) || "institute";
  let candidate = base.length >= 3 ? base : `${base}-school`;
  let n = 1;

  while (!(await checkSubdomain(prisma, candidate)).available && n < 50) {
    n += 1;
    candidate = `${base.slice(0, 26)}-${n}`;
  }

  return candidate;
}

function errorStatus(field) {
  return field === "code" || field === "subdomain" || field === "customDomain" ? 409 : 400;
}

module.exports = {
  validateInstitutionInput,
  createInstitutionWithAdmin,
  suggestSubdomain,
  errorStatus,
};
