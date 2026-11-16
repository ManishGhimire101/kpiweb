const prisma = require("./prisma");

async function publicInstitutionId(req) {
  if (req.tenant && req.tenant.kind === "institution" && req.tenant.institution) {
    return req.tenant.institution.id;
  }

  const code = process.env.ROOT_INSTITUTION_CODE;

  if (code) {
    const institution = await prisma.institution.findUnique({
      where: { code: code.trim().toUpperCase() },
      select: { id: true },
    });

    return institution ? institution.id : -1;
  }

  return null;
}

module.exports = { publicInstitutionId };
