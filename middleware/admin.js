function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Authentication required"
        });
    }

    if (req.user.role !== "ADMIN") {
        return res.status(403).json({
            success: false,
            message: "Admin access required"
        });
    }

    if (!req.user.institutionId) {
        return res.status(403).json({
            success: false,
            message: "Admin is not assigned to an institution"
        });
    }

    next();
}

module.exports = requireAdmin;