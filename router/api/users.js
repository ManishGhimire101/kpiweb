const express = require("express");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const authenticateToken = require("../../middleware/auth.js");
const requireSuperAdmin = require("../../middleware/superAdmin.js");

const router = express.Router();
const prisma = new PrismaClient();


// ==========================================
// GET ALL USERS
// ==========================================

router.get(
  "/",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {

    try {

      const users = await prisma.user.findMany({
        orderBy: {
          createdAt: "desc",
        },

        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          lastLoginAt: true,
          createdAt: true,

          institution: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      });

      res.json({
        success: true,
        data: users,
      });

    } catch (error) {

      console.error("Get users error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to fetch users",
      });

    }
  }
);


// ==========================================
// GET SINGLE USER
// ==========================================

router.get(
  "/:id",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {

    try {

      const id = Number(req.params.id);

      if (!Number.isInteger(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
      }

      const user = await prisma.user.findUnique({
        where: {
          id,
        },

        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,

          institution: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },

          adminProfile: true,
          studentProfile: true,
          teacherProfile: true,
          parentProfile: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.json({
        success: true,
        data: user,
      });

    } catch (error) {

      console.error("Get user error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to fetch user",
      });

    }
  }
);


// ==========================================
// CREATE USER
// ==========================================

router.post(
  "/",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {

    try {

      const {
        username,
        email,
        password,
        role,
        institutionId,
        isActive,
      } = req.body;


      // Required fields

      if (!username || !password || !role) {

        return res.status(400).json({
          success: false,
          message: "Username, password and role are required",
        });

      }


      // Validate role

      const validRoles = [
        "ADMIN",
        "TEACHER",
        "STUDENT",
        "PARENT",
      ];

      if (!validRoles.includes(role)) {

        return res.status(400).json({
          success: false,
          message: "Invalid user role",
        });

      }


      const cleanUsername =
        username.trim();


      const cleanEmail =
        email?.trim() || null;


      // Check username

      const existingUsername =
        await prisma.user.findUnique({
          where: {
            username: cleanUsername,
          },
        });


      if (existingUsername) {

        return res.status(409).json({
          success: false,
          message: "Username already exists",
        });

      }


      // Check email

      if (cleanEmail) {

        const existingEmail =
          await prisma.user.findUnique({
            where: {
              email: cleanEmail,
            },
          });


        if (existingEmail) {

          return res.status(409).json({
            success: false,
            message: "Email already exists",
          });

        }

      }


      // Validate institution

      let cleanInstitutionId = null;

      if (institutionId) {

        cleanInstitutionId =
          Number(institutionId);


        if (!Number.isInteger(cleanInstitutionId)) {

          return res.status(400).json({
            success: false,
            message: "Invalid institution ID",
          });

        }


        const institution =
          await prisma.institution.findUnique({
            where: {
              id: cleanInstitutionId,
            },
          });


        if (!institution) {

          return res.status(404).json({
            success: false,
            message: "Institution not found",
          });

        }

      }


      // Hash password

      const passwordHash =
        await bcrypt.hash(password, 12);


      // Create user

      const user =
        await prisma.user.create({

          data: {

            username: cleanUsername,

            email: cleanEmail,

            passwordHash,

            role,

            institutionId:
              cleanInstitutionId,

            isActive:
              isActive !== false,

            mustChangePassword: true,

          },

          select: {

            id: true,
            username: true,
            email: true,
            role: true,
            institutionId: true,
            isActive: true,
            mustChangePassword: true,
            createdAt: true,

          },

        });


      res.status(201).json({

        success: true,

        message: "User created successfully",

        data: user,

      });

    } catch (error) {

      console.error(
        "Create user error:",
        error
      );

      res.status(500).json({

        success: false,

        message: "Failed to create user",

      });

    }
  }
);


// ==========================================
// UPDATE USER
// ==========================================

router.put(
  "/:id",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {

    try {

      const id =
        Number(req.params.id);


      if (!Number.isInteger(id)) {

        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });

      }


      const existingUser =
        await prisma.user.findUnique({
          where: {
            id,
          },
        });


      if (!existingUser) {

        return res.status(404).json({
          success: false,
          message: "User not found",
        });

      }


      const {
        username,
        email,
        role,
        institutionId,
        isActive,
      } = req.body;


      const data = {};


      // Username

      if (username !== undefined) {

        const cleanUsername =
          username.trim();


        if (!cleanUsername) {

          return res.status(400).json({
            success: false,
            message: "Username cannot be empty",
          });

        }


        if (
          cleanUsername !==
          existingUser.username
        ) {

          const duplicate =
            await prisma.user.findUnique({
              where: {
                username:
                  cleanUsername,
              },
            });


          if (duplicate) {

            return res.status(409).json({
              success: false,
              message: "Username already exists",
            });

          }

        }


        data.username =
          cleanUsername;

      }


      // Email

      if (email !== undefined) {

        const cleanEmail =
          email?.trim() || null;


        if (cleanEmail) {

          const duplicate =
            await prisma.user.findUnique({
              where: {
                email: cleanEmail,
              },
            });


          if (
            duplicate &&
            duplicate.id !== id
          ) {

            return res.status(409).json({
              success: false,
              message: "Email already exists",
            });

          }

        }


        data.email =
          cleanEmail;

      }


      // Role

      if (role !== undefined) {

        const validRoles = [
          "ADMIN",
          "TEACHER",
          "STUDENT",
          "PARENT",
        ];


        if (!validRoles.includes(role)) {

          return res.status(400).json({
            success: false,
            message: "Invalid user role",
          });

        }


        data.role = role;

      }


      // Institution

      if (institutionId !== undefined) {

        if (
          institutionId === null ||
          institutionId === ""
        ) {

          data.institutionId = null;

        } else {

          const parsedInstitutionId =
            Number(institutionId);


          if (
            !Number.isInteger(
              parsedInstitutionId
            )
          ) {

            return res.status(400).json({
              success: false,
              message: "Invalid institution ID",
            });

          }


          const institution =
            await prisma.institution.findUnique({
              where: {
                id:
                  parsedInstitutionId,
              },
            });


          if (!institution) {

            return res.status(404).json({
              success: false,
              message: "Institution not found",
            });

          }


          data.institutionId =
            parsedInstitutionId;

        }

      }


      // Active status

      if (isActive !== undefined) {

        data.isActive =
          Boolean(isActive);

      }


      const updatedUser =
        await prisma.user.update({

          where: {
            id,
          },

          data,

          select: {

            id: true,
            username: true,
            email: true,
            role: true,
            institutionId: true,
            isActive: true,
            mustChangePassword: true,
            lastLoginAt: true,
            createdAt: true,
            updatedAt: true,

          },

        });


      res.json({

        success: true,

        message: "User updated successfully",

        data: updatedUser,

      });

    } catch (error) {

      console.error(
        "Update user error:",
        error
      );

      res.status(500).json({

        success: false,

        message: "Failed to update user",

      });

    }
  }
);


// ==========================================
// ACTIVATE / DEACTIVATE USER
// ==========================================

router.patch(
  "/:id/status",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {

    try {

      const id =
        Number(req.params.id);


      if (!Number.isInteger(id)) {

        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });

      }


      const { isActive } =
        req.body;


      if (
        typeof isActive !==
        "boolean"
      ) {

        return res.status(400).json({
          success: false,
          message: "isActive must be true or false",
        });

      }


      const user =
        await prisma.user.findUnique({
          where: {
            id,
          },
        });


      if (!user) {

        return res.status(404).json({
          success: false,
          message: "User not found",
        });

      }


      // Prevent disabling yourself

      if (
        user.id === req.user.id &&
        isActive === false
      ) {

        return res.status(400).json({
          success: false,
          message: "You cannot deactivate your own account",
        });

      }


      const updatedUser =
        await prisma.user.update({

          where: {
            id,
          },

          data: {
            isActive,
          },

          select: {
            id: true,
            username: true,
            isActive: true,
          },

        });


      res.json({

        success: true,

        message:
          isActive
            ? "User activated successfully"
            : "User deactivated successfully",

        data: updatedUser,

      });

    } catch (error) {

      console.error(
        "Change user status error:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Failed to change user status",

      });

    }
  }
);


// ==========================================
// RESET PASSWORD
// ==========================================

router.post(
  "/:id/reset-password",
  authenticateToken,
  requireSuperAdmin,
  async (req, res) => {

    try {

      const id =
        Number(req.params.id);


      if (!Number.isInteger(id)) {

        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });

      }


      const {
        password,
      } = req.body;


      if (!password) {

        return res.status(400).json({
          success: false,
          message: "New password is required",
        });

      }


      if (password.length < 8) {

        return res.status(400).json({
          success: false,
          message:
            "Password must be at least 8 characters",
        });

      }


      const user =
        await prisma.user.findUnique({
          where: {
            id,
          },
        });


      if (!user) {

        return res.status(404).json({
          success: false,
          message: "User not found",
        });

      }


      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );


      await prisma.user.update({

        where: {
          id,
        },

        data: {

          passwordHash,

          mustChangePassword: true,

        },

      });


      res.json({

        success: true,

        message:
          "Password reset successfully",

      });

    } catch (error) {

      console.error(
        "Reset password error:",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Failed to reset password",

      });

    }
  }
);


module.exports = router;