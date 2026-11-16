const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { PrismaClient } = require("@prisma/client");

const authenticateToken = require("../../middleware/auth");
const requireAdmin = require("../../middleware/admin");

const prisma = new PrismaClient();

const router = express.Router();


// =====================================================
// ADMIN LOGIN
// =====================================================

router.post("/login", async (req, res) => {

    try {

        const { username, password } = req.body;


        // ---------------------------------------------
        // Validate input
        // ---------------------------------------------

        if (!username || !password) {

            return res.status(400).json({
                success: false,
                message: "Username and password are required"
            });

        }


        // ---------------------------------------------
        // Find user
        // ---------------------------------------------

        const user = await prisma.user.findUnique({
            where: {
                username: username.trim()
            },

            include: {
                institution: true
            }
        });


        // ---------------------------------------------
        // User not found
        // ---------------------------------------------

        if (!user) {

            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });

        }


        // ---------------------------------------------
        // Must be ADMIN
        // ---------------------------------------------

        if (user.role !== "ADMIN") {

            return res.status(403).json({
                success: false,
                message: "This account is not an institution Admin"
            });

        }


        // ---------------------------------------------
        // Account status
        // ---------------------------------------------

        if (!user.isActive) {

            return res.status(403).json({
                success: false,
                message: "Your account has been disabled"
            });

        }


        // ---------------------------------------------
        // Institution check
        // ---------------------------------------------

        if (!user.institutionId || !user.institution) {

            return res.status(403).json({
                success: false,
                message: "Admin is not assigned to an institution"
            });

        }


        // ---------------------------------------------
        // Institution status
        // ---------------------------------------------

        if (!user.institution.isActive) {

            return res.status(403).json({
                success: false,
                message: "Your institution is currently inactive"
            });

        }


        // ---------------------------------------------
        // Check password
        // ---------------------------------------------

        const passwordMatch = await bcrypt.compare(
            password,
            user.passwordHash
        );


        if (!passwordMatch) {

            return res.status(401).json({
                success: false,
                message: "Invalid username or password"
            });

        }


        // ---------------------------------------------
        // Create JWT
        // ---------------------------------------------

        if (!process.env.JWT_SECRET) {

            console.error("JWT_SECRET is not configured");

            return res.status(500).json({
                success: false,
                message: "Server authentication configuration error"
            });

        }


        const token = jwt.sign(
            {
                userId: user.id,
                role: user.role,
                institutionId: user.institutionId
            },

            process.env.JWT_SECRET,

            {
                expiresIn: "1d"
            }
        );


        // ---------------------------------------------
        // Update last login
        // ---------------------------------------------

        await prisma.user.update({
            where: {
                id: user.id
            },

            data: {
                lastLoginAt: new Date()
            }
        });


        // ---------------------------------------------
        // Send response
        // ---------------------------------------------

        return res.json({

            success: true,

            message: "Admin login successful",

            token,

            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                institutionId: user.institutionId,
                mustChangePassword: user.mustChangePassword,

                institution: {
                    id: user.institution.id,
                    name: user.institution.name,
                    code: user.institution.code,
                    customDomain: user.institution.customDomain
                }
            }

        });

    } catch (error) {

        console.error("Admin login error:", error);

        return res.status(500).json({
            success: false,
            message: "Admin login failed"
        });

    }

});
// ===============================
// ADMIN DASHBOARD
// ===============================

router.get(
    "/dashboard",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const institutionId = req.user.institutionId;

            // Safety check
            if (!institutionId) {
                return res.status(403).json({
                    success: false,
                    message: "Admin is not assigned to an institution"
                });
            }

            // Get institution information
            const institution = await prisma.institution.findUnique({
                where: {
                    id: institutionId
                },
                select: {
                    id: true,
                    name: true,
                    code: true,
                    logo: true,
                    themeColor: true,
                    isActive: true
                }
            });

            if (!institution) {
                return res.status(404).json({
                    success: false,
                    message: "Institution not found"
                });
            }

            // Count records belonging ONLY to this institution
            const [
                students,
                teachers,
                parents,
                programs
            ] = await Promise.all([
                prisma.studentProfile.count({
                    where: {
                        institutionId: institutionId
                    }
                }),

                prisma.teacherProfile.count({
                    where: {
                        institutionId: institutionId
                    }
                }),

                prisma.parentProfile.count({
                    where: {
                        institutionId: institutionId
                    }
                }),

                prisma.program.count({
                    where: {
                        institutionId: institutionId
                    }
                })
            ]);

            return res.json({
                success: true,

                data: {
                    institution: institution,

                    counts: {
                        students,
                        teachers,
                        parents,
                        programs
                    }
                }
            });

        } catch (error) {
            console.error("Admin dashboard error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to load admin dashboard"
            });
        }
    }
);
module.exports = router;
// ===============================
// ADMIN CHANGE PASSWORD
// ===============================

router.post(
    "/change-password",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;

            // Validate input
            if (!currentPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    message: "Current password and new password are required"
                });
            }

            // Basic password length check
            if (newPassword.length < 8) {
                return res.status(400).json({
                    success: false,
                    message: "New password must be at least 8 characters long"
                });
            }

            // Get the currently authenticated Admin
            const user = await prisma.user.findUnique({
                where: {
                    id: req.user.id
                }
            });

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "User not found"
                });
            }

            // Verify current password
            const passwordMatch = await bcrypt.compare(
                currentPassword,
                user.passwordHash
            );

            if (!passwordMatch) {
                return res.status(401).json({
                    success: false,
                    message: "Current password is incorrect"
                });
            }

            // Prevent using the same password
            const samePassword = await bcrypt.compare(
                newPassword,
                user.passwordHash
            );

            if (samePassword) {
                return res.status(400).json({
                    success: false,
                    message: "New password must be different from current password"
                });
            }

            // Hash new password
            const newPasswordHash = await bcrypt.hash(
                newPassword,
                12
            );

            // Update password
            await prisma.user.update({
                where: {
                    id: user.id
                },
                data: {
                    passwordHash: newPasswordHash,
                    mustChangePassword: false
                }
            });

            return res.json({
                success: true,
                message: "Password changed successfully"
            });

        } catch (error) {
            console.error(
                "Admin change password error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Failed to change password"
            });
        }
    }
);
// ===============================
// ADMIN DASHBOARD
// ===============================

router.get(
    "/dashboard",
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            const institutionId = req.user.institutionId;

            if (!institutionId) {
                return res.status(403).json({
                    success: false,
                    message: "Admin is not assigned to an institution"
                });
            }

            const institution = await prisma.institution.findUnique({
                where: {
                    id: institutionId
                },
                select: {
                    id: true,
                    name: true,
                    code: true,
                    logo: true,
                    themeColor: true,
                    isActive: true
                }
            });

            if (!institution) {
                return res.status(404).json({
                    success: false,
                    message: "Institution not found"
                });
            }

            const [
                students,
                teachers,
                parents,
                programs
            ] = await Promise.all([
                prisma.studentProfile.count({
                    where: {
                        institutionId
                    }
                }),

                prisma.teacherProfile.count({
                    where: {
                        institutionId
                    }
                }),

                prisma.parentProfile.count({
                    where: {
                        institutionId
                    }
                }),

                prisma.program.count({
                    where: {
                        institutionId
                    }
                })
            ]);

            return res.json({
                success: true,
                data: {
                    institution,

                    counts: {
                        students,
                        teachers,
                        parents,
                        programs
                    }
                }
            });

        } catch (error) {
            console.error("Admin dashboard error:", error);

            return res.status(500).json({
                success: false,
                message: "Failed to load admin dashboard"
            });
        }
    }
);


module.exports = router;