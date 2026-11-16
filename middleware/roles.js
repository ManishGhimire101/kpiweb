function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this resource",
      });
    }

    if (!req.user.institutionId) {
      return res.status(403).json({
        success: false,
        message: "Account is not assigned to an institution",
      });
    }

    next();
  };
}

module.exports = requireRole;
