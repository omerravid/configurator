const jwt = require("jsonwebtoken");
const { User } = require("../models");

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

// API Key authentication for third-party services
const authenticateApiKey = async (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({ error: "API key required" });
  }

  try {
    // Check if API key matches the configured service key
    if (apiKey !== process.env.API_KEY) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    // For API key auth, create a virtual admin user
    req.user = {
      username: "api-service",
      role: "ADMIN",
      isApiKey: true
    };

    next();
  } catch (error) {
    return res.status(403).json({ error: "API key authentication failed" });
  }
};

// Combined authentication: try JWT first, then API key
const authenticateTokenOrApiKey = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const apiKey = req.headers["x-api-key"];

  // Try JWT authentication first
  if (authHeader) {
    const token = authHeader.split(" ")[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (user) {
          req.user = user;
          return next();
        }
      } catch (error) {
        // JWT failed, continue to API key check
      }
    }
  }

  // Try API key authentication
  if (apiKey) {
    try {
      if (apiKey === process.env.API_KEY) {
        req.user = {
          username: "api-service",
          role: "ADMIN",
          isApiKey: true
        };
        return next();
      }
    } catch (error) {
      // API key failed
    }
  }

  return res.status(401).json({ 
    error: "Authentication required. Provide either Authorization Bearer token or X-API-Key header" 
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};

const requireAdminOrOwner = (configCreatedBy) => {
  return (req, res, next) => {
    if (req.user.role === "ADMIN" || req.user.username === configCreatedBy) {
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
  authenticateApiKey,
  authenticateTokenOrApiKey,
  requireAdmin,
  requireAdminOrOwner,
};
