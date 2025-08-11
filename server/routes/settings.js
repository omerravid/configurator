const express = require("express");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Get embedded MongoDB status
router.get("/mongodb/status", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const embeddedMongo = require("../models/embedded-mongodb");
    const status = await embeddedMongo.getConnectionStatus();
    
    res.json({
      success: true,
      status,
      message: "Using embedded MongoDB as default database"
    });
  } catch (error) {
    console.error("Failed to get MongoDB status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get MongoDB status"
    });
  }
});

// Get current data status
router.get("/data/status", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { User, Configuration } = require("../models");
    
    // Get counts from MongoDB
    const userCount = await User.findAll().then(users => users.length);
    const configCount = await Configuration.findAll().then(configs => configs.length);
    
    res.json({
      success: true,
      database: "embedded-mongodb",
      stats: {
        users: userCount,
        configurations: configCount,
        message: "Using embedded MongoDB as default database"
      }
    });
  } catch (error) {
    console.error("Failed to get data status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get data status"
    });
  }
});

module.exports = router;
