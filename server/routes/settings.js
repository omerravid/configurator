const express = require("express");
const Joi = require("joi");
const mongodb = require("../models/mongodb");
const { authenticateToken, requireAdmin } = require("../middleware/auth");
const DataMigration = require("../scripts/migrate-to-mongodb");
const BackupRestore = require("../backup-restore");

const router = express.Router();

// Validation schema
const mongoSettingsSchema = Joi.object({
  connectionString: Joi.string().required(),
  options: Joi.object({
    useNewUrlParser: Joi.boolean(),
    useUnifiedTopology: Joi.boolean()
  }).optional()
});

// Get current MongoDB settings
router.get("/mongodb", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const settings = await mongodb.loadSettings();
    const status = mongodb.getConnectionStatus();
    
    res.json({
      success: true,
      settings: {
        ...settings,
        // Hide sensitive connection string details for security
        connectionString: settings.connectionString.replace(/\/\/([^:]+):([^@]+)@/, '//*****:*****@')
      },
      status
    });
  } catch (error) {
    console.error("Failed to get MongoDB settings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get MongoDB settings"
    });
  }
});

// Update MongoDB settings
router.put("/mongodb", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { error, value } = mongoSettingsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    await mongodb.saveSettings(value);
    
    res.json({
      success: true,
      message: "MongoDB settings updated successfully"
    });
  } catch (error) {
    console.error("Failed to update MongoDB settings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update MongoDB settings"
    });
  }
});

// Test MongoDB connection
router.post("/mongodb/test", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { error, value } = mongoSettingsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const result = await mongodb.testConnection(value.connectionString, value.options);
    
    res.json(result);
  } catch (error) {
    console.error("Failed to test MongoDB connection:", error);
    res.status(500).json({
      success: false,
      error: "Failed to test MongoDB connection"
    });
  }
});

// Connect to MongoDB
router.post("/mongodb/connect", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { error, value } = mongoSettingsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    await mongodb.connect(value);
    const status = mongodb.getConnectionStatus();
    
    res.json({
      success: true,
      message: "Connected to MongoDB successfully",
      status
    });
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    res.status(500).json({
      success: false,
      error: `Failed to connect to MongoDB: ${error.message}`
    });
  }
});

// Disconnect from MongoDB
router.post("/mongodb/disconnect", authenticateToken, requireAdmin, async (req, res) => {
  try {
    await mongodb.disconnect();
    const status = mongodb.getConnectionStatus();
    
    res.json({
      success: true,
      message: "Disconnected from MongoDB successfully",
      status
    });
  } catch (error) {
    console.error("Failed to disconnect from MongoDB:", error);
    res.status(500).json({
      success: false,
      error: `Failed to disconnect from MongoDB: ${error.message}`
    });
  }
});

// Migrate data from SQLite to MongoDB
router.post("/mongodb/migrate", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { connectionString } = req.body;
    
    if (!connectionString) {
      return res.status(400).json({
        success: false,
        error: "Connection string is required"
      });
    }

    const migration = new DataMigration();
    const result = await migration.migrate(connectionString);
    
    if (result.success) {
      res.json({
        success: true,
        message: "Data migration completed successfully",
        stats: result.stats
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.message
      });
    }
  } catch (error) {
    console.error("Migration failed:", error);
    res.status(500).json({
      success: false,
      error: `Migration failed: ${error.message}`
    });
  }
});

// Get MongoDB connection status
router.get("/mongodb/status", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const status = mongodb.getConnectionStatus();
    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error("Failed to get MongoDB status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get MongoDB status"
    });
  }
});

module.exports = router;
