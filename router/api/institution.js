const express = require("express");
const { PrismaClient } = require("@prisma/client");

const authenticateToken = require("../../middleware/auth.js");
const requireSuperAdmin = require("../../middleware/superAdmin.js");

const router = express.Router();
const prisma = new PrismaClient();

//get istitutaions 
// Get All Institutions
router.get(
  "/",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const institutions = await prisma.institution.findMany({
        orderBy: {
          createdAt: "desc",
        },
      });

      res.json({
        success: true,
        data: institutions,
      });

    } catch (error) {
      console.error("Get institutions error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to fetch institutions",
      });
    }
  }
);




// Create Institution
router.post(
  "/",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const {
        name,
        code,
        type,
        email,
        phone,
        address,
        website,
        subdomain,
        themeColor,
        isActive,
      } = req.body;

      // Required fields
      if (!name || !code || !subdomain) {
        return res.status(400).json({
          success: false,
          message: "College name, code and subdomain are required",
        });
      }

      // Clean values
      const cleanName = name.trim();
      const cleanCode = code.trim().toUpperCase();
      const cleanSubdomain = subdomain.trim().toLowerCase();

      // Validate subdomain
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSubdomain)) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid subdomain. Use only lowercase letters, numbers and hyphens.",
        });
      }

      // Check duplicate code
      const existingCode = await prisma.institution.findUnique({
        where: {
          code: cleanCode,
        },
      });

      if (existingCode) {
        return res.status(409).json({
          success: false,
          message: "College code already exists",
        });
      }

      // Check duplicate subdomain
      const existingSubdomain = await prisma.institution.findUnique({
        where: {
          subdomain: cleanSubdomain,
        },
      });

      if (existingSubdomain) {
        return res.status(409).json({
          success: false,
          message: "Subdomain already exists",
        });
      }

      // Create institution
      const institution = await prisma.institution.create({
        data: {
          name: cleanName,
          code: cleanCode,
          type: type?.trim() || null,
          email: email?.trim() || null,
          phone: phone?.trim() || null,
          address: address?.trim() || null,
          website: website?.trim() || null,
          subdomain: cleanSubdomain,
          themeColor: themeColor || "#2563eb",
          isActive: isActive !== false,
        },
      });

      res.status(201).json({
        success: true,
        message: "Institution created successfully",
        institution,
      });
    } catch (error) {
      console.error("Create institution error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to create institution",
      });
    }
  }
);
router.patch("/:id/status", authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const institutionId = Number(req.params.id);
        const { isActive } = req.body;

        if (Number.isNaN(institutionId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid institution ID"
            });
        }

        if (typeof isActive !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "isActive must be true or false"
            });
        }

        const institution = await prisma.institution.findUnique({
            where: {
                id: institutionId
            }
        });

        if (!institution) {
            return res.status(404).json({
                success: false,
                message: "Institution not found"
            });
        }

        const updatedInstitution = await prisma.institution.update({
            where: {
                id: institutionId
            },
            data: {
                isActive: isActive
            }
        });

        return res.json({
            success: true,
            message: isActive
                ? "Institution activated successfully"
                : "Institution deactivated successfully",
            data: {
                id: updatedInstitution.id,
                name: updatedInstitution.name,
                isActive: updatedInstitution.isActive
            }
        });

    } catch (error) {
        console.error("Institution status update error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update institution status"
        });
    }
});

module.exports = router;