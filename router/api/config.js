const express = require("express");
const { getRootDomain, getSuperSubdomain } = require("../../lib/tenant");

const router = express.Router();

router.get("/", (req, res) => {
  const tenant = req.tenant;
  const port = tenant.port ? `:${tenant.port}` : "";
  const institution = tenant.institution;

  res.json({
    success: true,
    kind: tenant.kind,
    rootDomain: getRootDomain(),
    superSubdomain: getSuperSubdomain(),
    portalSuffix: `.${getRootDomain()}${port}`,
    institution:
      tenant.kind === "institution" && institution && institution.isActive
        ? {
            name: institution.name,
            logo: institution.logo,
            themeColor: institution.themeColor,
            code: institution.code,
            type: institution.type,
            address: institution.address,
            phone: institution.phone,
            email: institution.email,
            website: institution.website,
          }
        : null,
    institutionError:
      tenant.kind === "institution" && !institution
        ? "not_found"
        : tenant.kind === "institution" && institution && !institution.isActive
          ? "inactive"
          : null,
  });
});

module.exports = router;
