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

// Connect to MongoDB (SAFE MODE)
router.post("/mongodb/connect", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { error, value } = mongoSettingsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    // Only test connection, don't actually switch to MongoDB
    const testResult = await mongodb.testConnection(value.connectionString, value.options);

    if (testResult.success) {
      res.json({
        success: true,
        message: "MongoDB connection test successful. Use migration to switch to MongoDB.",
        connectionTest: testResult
      });
    } else {
      res.status(400).json({
        success: false,
        error: `Connection test failed: ${testResult.message}`
      });
    }
  } catch (error) {
    console.error("Failed to test MongoDB connection:", error);
    res.status(500).json({
      success: false,
      error: `Failed to test MongoDB connection: ${error.message}`
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

// Migrate data from SQLite to MongoDB (WITH SAFETY MEASURES)
router.post("/mongodb/migrate", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { connectionString } = req.body;

    if (!connectionString) {
      return res.status(400).json({
        success: false,
        error: "Connection string is required"
      });
    }

    // Create backup before migration
    console.log('Creating SQLite backup before migration...');
    const BackupRestore = require("../backup-restore");
    const br = new BackupRestore();
    const backupResult = await br.createBackup(`pre-migration-${Date.now()}`);

    if (!backupResult.success) {
      return res.status(500).json({
        success: false,
        error: `Backup failed: ${backupResult.error}. Migration aborted for safety.`
      });
    }

    console.log(`✅ Backup created: ${backupResult.file}`);

    // Proceed with migration
    const DataMigration = require("../scripts/migrate-to-mongodb");
    const migration = new DataMigration();
    const result = await migration.migrate(connectionString);

    if (result.success) {
      res.json({
        success: true,
        message: `Migration completed successfully. Backup saved at: ${backupResult.file}`,
        stats: result.stats,
        backup: backupResult.file
      });
    } else {
      res.status(500).json({
        success: false,
        error: `Migration failed: ${result.message}. Your data is safe in SQLite and backup: ${backupResult.file}`
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

// Get current data status
router.get("/data/status", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const br = new BackupRestore();
    const result = await br.getCurrentStats();
    res.json(result);
  } catch (error) {
    console.error("Failed to get data status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get data status"
    });
  }
});

// Create backup
router.post("/data/backup", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    const br = new BackupRestore();
    const result = await br.createBackup(name);
    res.json(result);
  } catch (error) {
    console.error("Failed to create backup:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create backup"
    });
  }
});

module.exports = router;
