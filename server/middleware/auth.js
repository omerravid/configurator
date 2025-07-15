const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: "Invalid token - user not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

const requireAdminOrOwner = (configCreatedBy) => {
  return (req, res, next) => {
    if (req.user.role === "ADMIN" || req.user.id === configCreatedBy) {
      next();
    } else {
      return res
        .status(403)
        .json({ error: "Access denied - admin or owner required" });
    }
  };
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireAdminOrOwner,
};
