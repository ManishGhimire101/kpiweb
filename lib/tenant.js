const RESERVED_SUBDOMAINS = new Set([
  "www",
  "super",
  "superadmin",
  "super-admin",
  "admin",
  "administrator",
  "api",
  "app",
  "mail",
  "smtp",
  "ftp",
  "ns1",
  "ns2",
  "static",
  "assets",
  "cdn",
  "dashboard",
  "login",
  "portal",
  "root",
  "support",
  "help",
  "docs",
  "blog",
  "status",
  "test",
  "dev",
  "staging",
  "demo",
  "localhost",
]);

const SUBDOMAIN_MIN = 3;
const SUBDOMAIN_MAX = 30;

function getRootDomain() {
  return (process.env.ROOT_DOMAIN || "localhost").trim().toLowerCase();
}

function getSuperSubdomain() {
  return (process.env.SUPER_SUBDOMAIN || "super").trim().toLowerCase();
}

function slugifySubdomain(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SUBDOMAIN_MAX)
    .replace(/-+$/g, "");
}

function validateSubdomainFormat(value) {
  const sub = String(value || "").trim().toLowerCase();

  if (!sub) {
    return { valid: false, message: "Subdomain is required" };
  }

  if (sub.length < SUBDOMAIN_MIN) {
    return {
      valid: false,
      message: `Subdomain must be at least ${SUBDOMAIN_MIN} characters`,
    };
  }

  if (sub.length > SUBDOMAIN_MAX) {
    return {
      valid: false,
      message: `Subdomain must be at most ${SUBDOMAIN_MAX} characters`,
    };
  }

  if (!/^[a-z0-9-]+$/.test(sub)) {
    return {
      valid: false,
      message: "Use only lowercase letters, numbers and hyphens",
    };
  }

  if (sub.startsWith("-") || sub.endsWith("-")) {
    return {
      valid: false,
      message: "Subdomain cannot start or end with a hyphen",
    };
  }

  if (sub.includes("--")) {
    return {
      valid: false,
      message: "Subdomain cannot contain consecutive hyphens",
    };
  }

  if (/^\d+$/.test(sub)) {
    return { valid: false, message: "Subdomain cannot be only numbers" };
  }

  if (RESERVED_SUBDOMAINS.has(sub) || sub === getSuperSubdomain()) {
    return { valid: false, message: "This subdomain is reserved" };
  }

  return { valid: true, value: sub };
}

async function checkSubdomain(prisma, value, excludeInstitutionId) {
  const format = validateSubdomainFormat(value);

  if (!format.valid) {
    return { available: false, message: format.message };
  }

  const existing = await prisma.institution.findUnique({
    where: { subdomain: format.value },
    select: { id: true },
  });

  if (existing && existing.id !== excludeInstitutionId) {
    return { available: false, message: "Subdomain is already taken" };
  }

  return {
    available: true,
    value: format.value,
    message: "Subdomain is available",
  };
}

function parseHost(hostHeader) {
  const raw = String(hostHeader || "").trim().toLowerCase();
  const match = raw.match(/^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/);

  return {
    hostname: match ? match[1] : raw,
    port: match && match[2] ? match[2] : "",
  };
}

async function resolveTenant(prisma, hostHeader) {
  const { hostname, port } = parseHost(hostHeader);
  const root = getRootDomain();
  const superSub = getSuperSubdomain();

  if (hostname === root || hostname === `www.${root}`) {
    return { kind: "root", hostname, port };
  }

  if (hostname === `${superSub}.${root}`) {
    return { kind: "super", hostname, port };
  }

  if (hostname.endsWith(`.${root}`)) {
    const label = hostname.slice(0, -(root.length + 1));

    if (label && !label.includes(".")) {
      const institution = await prisma.institution.findUnique({
        where: { subdomain: label },
      });

      return { kind: "institution", hostname, port, institution };
    }

    return { kind: "institution", hostname, port, institution: null };
  }

  const byDomain = await prisma.institution.findUnique({
    where: { customDomain: hostname },
  });

  if (byDomain) {
    return { kind: "institution", hostname, port, institution: byDomain };
  }

  return { kind: "root", hostname, port };
}

function portalUrl(req, subdomain) {
  const root = getRootDomain();
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const { port } = parseHost(req.headers.host);
  return `${proto}://${subdomain}.${root}${port ? `:${port}` : ""}`;
}

module.exports = {
  RESERVED_SUBDOMAINS,
  getRootDomain,
  getSuperSubdomain,
  slugifySubdomain,
  validateSubdomainFormat,
  checkSubdomain,
  parseHost,
  resolveTenant,
  portalUrl,
};
