const express = require("express");
const Joi = require("joi");
const mongodb = require("../models/mongodb");
const DatabaseManager = require("../services/DatabaseManager");
const { authenticateToken, requireAdmin } = require("../middleware/auth");
const DataMigration = require("../scripts/migrate-to-mongodb");
const BackupRestore = require("../backup-restore");
const FileStorageService = require("../services/FileStorageService");

// Helper function to generate backup names in format: MongoServerName_Username_timestamp
function generateBackupName(username = 'system', suffix = null) {
  const br = new BackupRestore();
  return br.generateBackupName(username, suffix);
}

const router = express.Router();

// Initialize DatabaseManager
DatabaseManager.initialize().catch(console.error);

// Validation schemas
const mongoSettingsSchema = Joi.object({
  connectionString: Joi.string().required(),
  options: Joi.object({
    useNewUrlParser: Joi.boolean(),
    useUnifiedTopology: Joi.boolean()
  }).optional()
});

const databaseConfigSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  connectionString: Joi.string().required(),
  description: Joi.string().max(500).optional().allow('')
});

const updateDatabaseConfigSchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  connectionString: Joi.string().optional(),
  description: Joi.string().max(500).optional().allow('')
});

const copyDataSchema = Joi.object({
  sourceDatabase: Joi.string().required(),
  targetDatabase: Joi.string().required(),
  includeConfigurations: Joi.boolean().default(true),
  includeConfigurationTypes: Joi.array().items(Joi.string().valid('PRODUCT', 'INSTANCE', 'USER', 'COMPONENT', 'VERSION')).default([]),
  adminOnly: Joi.boolean().default(true)
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

// Database Management Endpoints

// Get all database configurations
router.get("/databases", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const databases = DatabaseManager.getAllDatabases();
    const status = await DatabaseManager.getConnectionStatus();

    res.json({
      success: true,
      databases,
      status
    });
  } catch (error) {
    console.error("Failed to get databases:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get databases"
    });
  }
});

// Add new database configuration
router.post("/databases", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { error, value } = databaseConfigSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const database = await DatabaseManager.addDatabase(value);

    res.json({
      success: true,
      database,
      message: "Database configuration added successfully"
    });
  } catch (error) {
    console.error("Failed to add database:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to add database"
    });
  }
});

// Update database configuration
router.put("/databases/:name", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name } = req.params;
    const { error, value } = updateDatabaseConfigSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const database = await DatabaseManager.updateDatabase(name, value);

    res.json({
      success: true,
      database,
      message: "Database configuration updated successfully"
    });
  } catch (error) {
    console.error("Failed to update database:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to update database"
    });
  }
});

// Delete database configuration
router.delete("/databases/:name", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name } = req.params;
    const database = await DatabaseManager.deleteDatabase(name);

    res.json({
      success: true,
      database,
      message: "Database configuration deleted successfully"
    });
  } catch (error) {
    console.error("Failed to delete database:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to delete database"
    });
  }
});

// Set active database
router.post("/databases/:name/activate", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name } = req.params;
    const database = await DatabaseManager.setActiveDatabase(name);

    res.json({
      success: true,
      database,
      message: `Database "${name}" is now active`
    });
  } catch (error) {
    console.error("Failed to set active database:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to set active database"
    });
  }
});

// Test database connection
router.post("/databases/test", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { connectionString } = req.body;
    if (!connectionString) {
      return res.status(400).json({
        success: false,
        error: "Connection string is required"
      });
    }

    const result = await DatabaseManager.testConnection(connectionString);
    res.json(result);
  } catch (error) {
    console.error("Failed to test database connection:", error);
    res.status(500).json({
      success: false,
      error: "Failed to test database connection"
    });
  }
});

// Copy data between databases
router.post("/databases/copy-data", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { error, value } = copyDataSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const result = await DatabaseManager.copyDataBetweenDatabases(
      value.sourceDatabase,
      value.targetDatabase,
      {
        includeConfigurations: value.includeConfigurations,
        includeConfigurationTypes: value.includeConfigurationTypes,
        adminOnly: value.adminOnly
      }
    );

    res.json({
      success: true,
      result,
      message: "Data copied successfully"
    });
  } catch (error) {
    console.error("Failed to copy data:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to copy data"
    });
  }
});

// Migrate database (full migration)
router.post("/databases/migrate", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { sourceDatabase, targetDatabase } = req.body;

    if (!sourceDatabase || !targetDatabase) {
      return res.status(400).json({
        success: false,
        error: "Source and target databases are required"
      });
    }

    const result = await DatabaseManager.migrateDatabase(sourceDatabase, targetDatabase);

    res.json({
      success: true,
      result,
      message: "Database migration completed successfully"
    });
  } catch (error) {
    console.error("Failed to migrate database:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to migrate database"
    });
  }
});

// Legacy MongoDB Endpoints (kept for backward compatibility)

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
    const backupResult = await br.createBackup(generateBackupName('system', 'pre-migration'));

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
    const username = req.user?.username || 'admin';
    const br = new BackupRestore();

    // Generate backup name with new format if no custom name provided
    const backupName = name || br.generateBackupName(username);
    const result = await br.createBackup(backupName);
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
    const fileExtension = result.filePath.endsWith('.zip') ? 'zip' : 'json';
    const contentType = fileExtension === 'zip' ? 'application/zip' : 'application/json';

    res.setHeader('Content-Disposition', `attachment; filename="${backupName}.${fileExtension}"`);
    res.setHeader('Content-Type', contentType);

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

// Delete backup file (json/zip)
router.delete("/data/backup/:backupName", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { backupName } = req.params;
    if (!backupName) {
      return res.status(400).json({ success: false, error: "Backup name is required" });
    }

    const fs = require('fs').promises;
    const path = require('path');
    const backupsDir = path.join(__dirname, '../backups');
    const candidates = [
      path.join(backupsDir, `${backupName}.zip`),
      path.join(backupsDir, `${backupName}.json`)
    ];

    let deleted = 0;
    for (const filePath of candidates) {
      try {
        await fs.unlink(filePath);
        deleted++;
      } catch (e) {
        // ignore if not exists
      }
    }

    if (deleted === 0) {
      return res.status(404).json({ success: false, error: 'Backup file not found' });
    }

    res.json({ success: true, message: 'Backup deleted', deleted });
  } catch (error) {
    console.error('Failed to delete backup:', error);
    res.status(500).json({ success: false, error: 'Failed to delete backup' });
  }
});

// Upload and restore from backup file
router.post("/data/upload-restore", authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Use multer middleware for file upload
    const multer = require('multer');
    const path = require('path');
    const fs = require('fs');

    // Configure multer for temporary file storage - NO SIZE LIMITS
    const upload = multer({
      dest: path.join(__dirname, '../temp-uploads'),
      limits: {
        fileSize: Infinity, // Explicitly set to unlimited
        files: 1,
        fields: 10,
        fieldSize: 1000000 // 1MB for text fields
      },
      fileFilter: (req, file, cb) => {
        console.log(`[BACKUP UPLOAD] Receiving file: ${file.originalname}, size: ${file.size || 'unknown'}, mimetype: ${file.mimetype}`);

        // Allow JSON or ZIP by extension OR common mimetypes
        const name = (file.originalname || '').toLowerCase();
        const type = (file.mimetype || '').toLowerCase();
        const isJson = name.endsWith('.json') || type === 'application/json' || type === 'text/json';
        const isZip = name.endsWith('.zip') || type === 'application/zip' || type === 'application/x-zip-compressed' || type === 'application/octet-stream';

        if (isJson || isZip) {
          cb(null, true);
        } else {
          cb(new Error('Only JSON and ZIP files are allowed'), false);
        }
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
          error: `Failed to restore from uploaded file: ${uploadError.message}`
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
    const backupResult = await br.createBackup(generateBackupName('system', 'pre-embedded-migration'));

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
      const backupResult = await br.createBackup(generateBackupName('system', 'pre-mongo-revert'));

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
