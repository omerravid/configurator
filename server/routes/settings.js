const express = require("express");
const Joi = require("joi");
const mongodb = require("../models/mongodb");
const DatabaseManager = require("../services/DatabaseManager");
const { authenticateToken, requireAdmin } = require("../middleware/auth");
const DataMigration = require("../scripts/migrate-to-mongodb");
const BackupRestore = require("../backup-restore");
const FileStorageService = require("../services/FileStorageService");

// Helper function to generate backup names in format: dd-mm-yyyy-HH:MM:ss-suffix
function generateBackupName(suffix = 'backup') {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${day}-${month}-${year}-${hours}:${minutes}:${seconds}-${suffix}`;
}

const router = express.Router();

// Validation schemas
const mongoSettingsSchema = Joi.object({
  connectionString: Joi.string().required(),
  options: Joi.object({
    useNewUrlParser: Joi.boolean(),
    useUnifiedTopology: Joi.boolean()
  }).optional()
});

const storageSettingsSchema = Joi.object({
  storageType: Joi.string().valid('embedded', 's3').required(),
  s3BucketName: Joi.when('storageType', {
    is: 's3',
    then: Joi.string().required(),
    otherwise: Joi.string().optional()
  }),
  awsRegion: Joi.when('storageType', {
    is: 's3',
    then: Joi.string().required(),
    otherwise: Joi.string().optional()
  }),
  awsAccessKeyId: Joi.when('storageType', {
    is: 's3',
    then: Joi.string().required(),
    otherwise: Joi.string().optional()
  }),
  awsSecretAccessKey: Joi.when('storageType', {
    is: 's3',
    then: Joi.string().required(),
    otherwise: Joi.string().optional()
  })
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
    const backupResult = await br.createBackup(generateBackupName('pre-migration'));

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

// List available backups
router.get("/data/backups", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const br = new BackupRestore();
    const result = await br.listBackups();
    res.json(result);
  } catch (error) {
    console.error("Failed to list backups:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list backups"
    });
  }
});

// Restore from backup
router.post("/data/restore", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { backupName } = req.body;

    if (!backupName) {
      return res.status(400).json({
        success: false,
        error: "Backup name is required"
      });
    }

    const br = new BackupRestore();
    const result = await br.restoreFromBackup(backupName);
    res.json(result);
  } catch (error) {
    console.error("Failed to restore from backup:", error);
    res.status(500).json({
      success: false,
      error: "Failed to restore from backup"
    });
  }
});

// Download backup file
router.get("/data/backup/:backupName", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { backupName } = req.params;

    if (!backupName) {
      return res.status(400).json({
        success: false,
        error: "Backup name is required"
      });
    }

    const br = new BackupRestore();
    const result = await br.getBackupFile(backupName);

    if (!result.success) {
      return res.status(404).json(result);
    }

    // Set headers for file download
    res.setHeader('Content-Disposition', `attachment; filename="${backupName}.json"`);
    res.setHeader('Content-Type', 'application/json');

    // Send the file
    res.sendFile(result.filePath);
  } catch (error) {
    console.error("Failed to download backup:", error);
    res.status(500).json({
      success: false,
      error: "Failed to download backup"
    });
  }
});

// Upload and restore from backup file
router.post("/data/upload-restore", authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Use multer middleware for file upload
    const multer = require('multer');
    const path = require('path');
    const fs = require('fs');

    // Configure multer for temporary file storage
    const upload = multer({
      dest: path.join(__dirname, '../temp-uploads'),
      fileFilter: (req, file, cb) => {
        // Only allow JSON files
        if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
          cb(null, true);
        } else {
          cb(new Error('Only JSON files are allowed'), false);
        }
      },
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
      }
    });

    // Handle the upload
    upload.single('backupFile')(req, res, async (err) => {
      try {
        if (err) {
          return res.status(400).json({
            success: false,
            error: `Upload error: ${err.message}`
          });
        }

        if (!req.file) {
          return res.status(400).json({
            success: false,
            error: "No backup file uploaded"
          });
        }

        const br = new BackupRestore();
        const result = await br.restoreFromUploadedFile(req.file.path);

        // Clean up temporary file
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.warn('Failed to clean up temporary file:', cleanupError);
        }

        res.json(result);
      } catch (uploadError) {
        // Clean up temporary file on error
        if (req.file?.path) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (cleanupError) {
            console.warn('Failed to clean up temporary file:', cleanupError);
          }
        }

        console.error("Failed to restore from uploaded file:", uploadError);
        res.status(500).json({
          success: false,
          error: "Failed to restore from uploaded file"
        });
      }
    });
  } catch (error) {
    console.error("Failed to handle upload:", error);
    res.status(500).json({
      success: false,
      error: "Failed to handle upload"
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
    const backupResult = await br.createBackup(generateBackupName('pre-embedded-migration'));

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

// Revert to SQLite database (with data migration)
router.post("/mongodb/revert-to-sqlite", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { migrateData = true } = req.body;

    console.log('Reverting to SQLite database...');

    if (migrateData) {
      // Create backup of current SQLite before overwriting
      const BackupRestore = require("../backup-restore");
      const br = new BackupRestore();
      const backupResult = await br.createBackup(generateBackupName('pre-mongo-revert'));

      if (!backupResult.success) {
        return res.status(500).json({
          success: false,
          error: `SQLite backup failed: ${backupResult.error}. Revert aborted for safety.`
        });
      }

      console.log(`✅ SQLite backup created: ${backupResult.file}`);

      // Migrate data from MongoDB to SQLite
      const embeddedMongo = require("../models/embedded-mongodb");
      const connectionString = embeddedMongo.getConnectionString() || 'mongodb://localhost:27017/config_manager';

      const MongoToSQLiteMigration = require("../scripts/migrate-from-mongodb");
      const migration = new MongoToSQLiteMigration();
      const migrationResult = await migration.migrate(connectionString);

      if (!migrationResult.success) {
        return res.status(500).json({
          success: false,
          error: `Migration from MongoDB to SQLite failed: ${migrationResult.message}. SQLite backup preserved at: ${backupResult.file}`
        });
      }

      console.log(`✅ Migrated ${migrationResult.stats.users} users and ${migrationResult.stats.configurations} configurations from MongoDB to SQLite`);
    }

    // Update .env file to use SQLite
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '../.env');

    try {
      let envContent = fs.readFileSync(envPath, 'utf8');
      envContent = envContent.replace(/USE_MONGODB=true/g, 'USE_MONGODB=false');
      envContent = envContent.replace(/# MongoDB Configuration.*/, '# MongoDB Configuration - reverted to SQLite with data migration');
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

    const message = migrateData
      ? "Successfully migrated MongoDB changes to SQLite and reverted to SQLite database."
      : "Successfully reverted to SQLite database (no data migration).";

    const nextSteps = migrateData
      ? [
          "✅ All MongoDB changes have been migrated to SQLite",
          "✅ SQLite is now set as the default database",
          "🔄 Restart the server to activate SQLite",
          "🗄️ Your MongoDB data is preserved for future use"
        ]
      : [
          "✅ SQLite is now set as the default database",
          "🔄 Restart the server to activate SQLite",
          "⚠️ MongoDB changes were NOT migrated",
          "🗄️ Your MongoDB data is preserved but not in SQLite"
        ];

    res.json({
      success: true,
      message,
      nextSteps
    });

  } catch (error) {
    console.error("Failed to revert to SQLite:", error);
    res.status(500).json({
      success: false,
      error: `Failed to revert to SQLite: ${error.message}`
    });
  }
});

// Storage settings endpoints

// Get current storage settings
router.get("/storage", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const fileStorage = new FileStorageService();
    const config = fileStorage.getStorageConfig();

    res.json({
      success: true,
      settings: {
        storageType: config.storageType,
        s3BucketName: config.s3BucketName,
        s3Region: config.s3Region,
        // Hide sensitive credentials
        awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ? '***hidden***' : null,
        awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ? '***hidden***' : null,
        embeddedStoragePath: config.embeddedStoragePath
      }
    });
  } catch (error) {
    console.error("Failed to get storage settings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get storage settings"
    });
  }
});

// Update storage settings
router.put("/storage", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { error, value } = storageSettingsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const fileStorage = new FileStorageService();
    await fileStorage.updateStorageConfig(value);

    res.json({
      success: true,
      message: "Storage settings updated successfully"
    });
  } catch (error) {
    console.error("Failed to update storage settings:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update storage settings"
    });
  }
});

// Test storage connection
router.post("/storage/test", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { error, value } = storageSettingsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    // Create a temporary storage instance with test configuration
    const testStorage = new FileStorageService();
    await testStorage.updateStorageConfig(value);

    const result = await testStorage.testConnection();

    res.json(result);
  } catch (error) {
    console.error("Failed to test storage connection:", error);
    res.status(500).json({
      success: false,
      error: "Failed to test storage connection"
    });
  }
});

// Get storage status
router.get("/storage/status", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const fileStorage = new FileStorageService();
    const config = fileStorage.getStorageConfig();
    const testResult = await fileStorage.testConnection();

    res.json({
      success: true,
      status: {
        ...config,
        connectionTest: testResult,
        isConfigured: config.storageType === 'embedded' ||
          (config.storageType === 's3' && config.s3BucketName && process.env.AWS_ACCESS_KEY_ID)
      }
    });
  } catch (error) {
    console.error("Failed to get storage status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get storage status"
    });
  }
});

module.exports = router;
