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

// Migrate to embedded MongoDB (SAFEST OPTION)
router.post("/mongodb/migrate-embedded", authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('Starting safe migration to embedded MongoDB...');

    // Create backup before migration
    const BackupRestore = require("../backup-restore");
    const br = new BackupRestore();
    const backupResult = await br.createBackup(`pre-embedded-migration-${Date.now()}`);

    if (!backupResult.success) {
      return res.status(500).json({
        success: false,
        error: `Backup failed: ${backupResult.error}. Migration aborted for safety.`
      });
    }

    console.log(`✅ Backup created: ${backupResult.file}`);

    // Start embedded MongoDB and migrate
    const embeddedMongo = require("../models/embedded-mongodb");

    // Start embedded MongoDB
    await embeddedMongo.start();
    const connectionString = embeddedMongo.getConnectionString();
    console.log(`✅ Embedded MongoDB started at: ${connectionString}`);

    // Run migration to embedded instance
    const DataMigration = require("../scripts/migrate-to-mongodb");
    const migration = new DataMigration();
    const result = await migration.migrate(connectionString);

    if (result.success) {
      // Update environment to use MongoDB (both runtime and persistent)
      process.env.USE_MONGODB = 'true';

      // Update .env file to persist the change
      const fs = require('fs');
      const path = require('path');
      const envPath = path.join(__dirname, '../.env');

      try {
        let envContent = fs.readFileSync(envPath, 'utf8');
        envContent = envContent.replace(/USE_MONGODB=false/g, 'USE_MONGODB=true');
        envContent = envContent.replace(/# MongoDB Configuration.*/, '# MongoDB Configuration - using embedded MongoDB server');
        fs.writeFileSync(envPath, envContent);
        console.log('✅ Updated .env file to use MongoDB permanently');
      } catch (error) {
        console.warn('⚠️ Could not update .env file:', error.message);
      }

      res.json({
        success: true,
        message: `Migration to embedded MongoDB completed successfully! MongoDB is now the default database. Restart the server to activate. Backup saved at: ${backupResult.file}`,
        stats: result.stats,
        backup: backupResult.file,
        connectionString: connectionString,
        nextSteps: [
          "✅ MongoDB is now set as the default database",
          "🔄 Restart the server to activate embedded MongoDB",
          "🗄️ Your SQLite backup is preserved for safety",
          "🚀 Embedded MongoDB will start automatically with the server"
        ]
      });
    } else {
      await embeddedMongo.stop();
      res.status(500).json({
        success: false,
        error: `Migration failed: ${result.message}. Your SQLite data is safe and backup: ${backupResult.file}`
      });
    }
  } catch (error) {
    console.error("Embedded MongoDB migration failed:", error);
    res.status(500).json({
      success: false,
      error: `Migration failed: ${error.message}`
    });
  }
});

// Revert to SQLite database
router.post("/mongodb/revert-to-sqlite", authenticateToken, requireAdmin, async (req, res) => {
  try {
    console.log('Reverting to SQLite database...');

    // Update .env file to use SQLite
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '../.env');

    try {
      let envContent = fs.readFileSync(envPath, 'utf8');
      envContent = envContent.replace(/USE_MONGODB=true/g, 'USE_MONGODB=false');
      envContent = envContent.replace(/# MongoDB Configuration.*/, '# MongoDB Configuration - reverted to SQLite');
      fs.writeFileSync(envPath, envContent);
      console.log('✅ Updated .env file to use SQLite');
    } catch (error) {
      console.warn('⚠️ Could not update .env file:', error.message);
      return res.status(500).json({
        success: false,
        error: `Failed to update .env file: ${error.message}`
      });
    }

    // Update runtime environment
    process.env.USE_MONGODB = 'false';

    res.json({
      success: true,
      message: "Successfully reverted to SQLite database. Restart the server to activate.",
      nextSteps: [
        "✅ SQLite is now set as the default database",
        "🔄 Restart the server to activate SQLite",
        "🗄️ Your MongoDB data is preserved",
        "📝 You can migrate back to MongoDB anytime"
      ]
    });

  } catch (error) {
    console.error("Failed to revert to SQLite:", error);
    res.status(500).json({
      success: false,
      error: `Failed to revert to SQLite: ${error.message}`
    });
  }
});

module.exports = router;
