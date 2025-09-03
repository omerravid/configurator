const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const unzipper = require('unzipper');

class BackupRestore {
  constructor() {
    this.backupDir = path.join(__dirname, 'backups');
    this.isMongoDb = process.env.USE_MONGODB === 'true';
  }

  // Helper function to generate backup names in format: MongoServerName_Username_timestamp
  generateBackupName(username = 'system', suffix = null) {
    const serverName = this.getMongoServerName();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, -5);

    if (suffix) {
      return `${serverName}_${username}_${timestamp}_${suffix}`;
    }
    return `${serverName}_${username}_${timestamp}`;
  }

  // Get MongoDB server name for backup naming
  getMongoServerName() {
    if (this.isMongoDb) {
      try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState === 1) {
          const connectionHost = mongoose.connection.host;
          const connectionName = mongoose.connection.name;

          // For embedded MongoDB, use a descriptive name
          if (connectionHost === '127.0.0.1' || connectionHost === 'localhost') {
            return 'EmbeddedMongoDB';
          }

          // For external MongoDB, use host:db format
          return `${connectionHost}_${connectionName}`;
        }
      } catch (error) {
        console.warn('Could not determine MongoDB server name:', error.message);
      }
      return 'MongoDB';
    } else {
      return 'SQLite';
    }
  }

  async ensureBackupDir() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }

  async createBackup(name = null) {
    try {
      await this.ensureBackupDir();

      const backupName = name || this.generateBackupName('system', 'auto');
      const backupFile = path.join(this.backupDir, `${backupName}.zip`);

      console.log(`Creating backup: ${backupName} (${this.isMongoDb ? 'MongoDB' : 'SQLite'})`);

      // Get all users with their full data including password_hash
      const userRows = await this.getAllUsersForBackup();
      console.log(`Found ${userRows.length} users`);

      // Get all configurations
      const configurations = await this.getAllConfigurationsForBackup();
      console.log(`Found ${configurations.length} configurations`);

      // Get all files
      const files = await this.getAllFilesForBackup();
      console.log(`Found ${files.length} files`);

      const backupData = {
        timestamp: new Date().toISOString(),
        version: '2.0',
        databaseType: this.isMongoDb ? 'mongodb' : 'sqlite',
        data: {
          users: userRows,
          configurations,
          files
        }
      };

      // Create ZIP archive with database data and files
      await this.createZipBackup(backupFile, backupData);

      console.log(`✅ Backup created successfully: ${backupFile}`);
      return {
        success: true,
        file: backupFile,
        stats: {
          users: userRows.length,
          configurations: configurations.length,
          files: files.length
        }
      };

    } catch (error) {
      console.error('❌ Backup failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get users with password_hash for backup
  async getAllUsersForBackup() {
    if (this.isMongoDb) {
      // MongoDB - access the underlying mongoose model directly
      const mongoose = require('mongoose');
      
      // Check if we're connected to MongoDB
      if (mongoose.connection.readyState !== 1) {
        throw new Error('MongoDB is not connected');
      }
      
      const UserModel = mongoose.model('User');
      const users = await UserModel.find({}).lean();
      
      return users.map(user => ({
        id: user._id.toString(),
        username: user.username,
        password_hash: user.password_hash,
        role: user.role,
        created_at: user.createdAt,
        updated_at: user.updatedAt
      }));
    } else {
      // SQLite - direct database query
      const db = require('./models/database');
      const result = await db.query(
        "SELECT id, username, password_hash, role, created_at, updated_at FROM users ORDER BY created_at DESC"
      );
      return result.rows;
    }
  }

  // Get configurations for backup
  async getAllConfigurationsForBackup() {
    if (this.isMongoDb) {
      const mongoose = require('mongoose');

      // Check if we're connected to MongoDB
      if (mongoose.connection.readyState !== 1) {
        throw new Error('MongoDB is not connected');
      }

      const ConfigurationModel = mongoose.model('Configuration');
      return await ConfigurationModel.find({}).lean();
    } else {
      const { Configuration } = require('./models');
      return await Configuration.findAll();
    }
  }

  // Get all files for backup
  async getAllFilesForBackup() {
    try {
      const storageDir = path.join(__dirname, 'storage/files');

      // Determine which files are actually referenced in configurations
      const referencedKeys = await this.getReferencedFileKeys();
      if (!referencedKeys || referencedKeys.size === 0) {
        console.log('No referenced files found in configurations, skipping files backup');
        return [];
      }

      // Check if storage directory exists
      try {
        await fs.access(storageDir);
      } catch (error) {
        console.log('No storage directory found, skipping files backup');
        return [];
      }

      const allFiles = await fs.readdir(storageDir);
      const fileMetadata = [];

      // Process metadata files, include only those referenced
      for (const fileName of allFiles) {
        if (fileName.endsWith('.meta.json')) {
          try {
            const metaFilePath = path.join(storageDir, fileName);
            const metaData = JSON.parse(await fs.readFile(metaFilePath, 'utf8'));
            const actualFileName = fileName.replace('.meta.json', '');
            const actualFilePath = path.join(storageDir, actualFileName);
            const storageKey = metaData.storageKey || actualFileName;

            if (!referencedKeys.has(storageKey)) {
              continue; // skip unreferenced files
            }

            // Check if actual file exists
            try {
              await fs.access(actualFilePath);
              fileMetadata.push({
                storageKey,
                originalName: metaData.originalName,
                mimeType: metaData.mimeType,
                size: metaData.size,
                uploadDate: metaData.uploadDate,
                fileName: actualFileName
              });
            } catch (fileError) {
              console.warn(`File ${actualFileName} metadata exists but file missing`);
            }
          } catch (error) {
            console.warn(`Error reading metadata file ${fileName}:`, error.message);
          }
        }
      }

      return fileMetadata;
    } catch (error) {
      console.warn('Error getting files for backup:', error.message);
      return [];
    }
  }

  // Create ZIP backup with database data and files
  async createZipBackup(backupFile, backupData) {
    return new Promise((resolve, reject) => {
      const output = require('fs').createWriteStream(backupFile);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      output.on('close', () => {
        console.log(`Archive finalized: ${archive.pointer()} total bytes`);
        resolve();
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);

      // Add database backup as JSON
      archive.append(JSON.stringify(backupData, null, 2), { name: 'database.json' });

      // Add all files from storage
      const storageDir = path.join(__dirname, 'storage/files');

      // Add files if they exist
      if (backupData.data.files && backupData.data.files.length > 0) {
        for (const fileInfo of backupData.data.files) {
          const filePath = path.join(storageDir, fileInfo.fileName);
          const metaPath = path.join(storageDir, fileInfo.fileName + '.meta.json');

          try {
            // Add the actual file
            archive.file(filePath, { name: `files/${fileInfo.fileName}` });

            // Add the metadata file
            archive.file(metaPath, { name: `files/${fileInfo.fileName}.meta.json` });
          } catch (error) {
            console.warn(`Could not add file ${fileInfo.fileName} to backup:`, error.message);
          }
        }
      }

      archive.finalize();
    });
  }

  async listBackups() {
    try {
      await this.ensureBackupDir();
      const files = await fs.readdir(this.backupDir);
      const backups = files
        .filter(file => file.endsWith('.json') || file.endsWith('.zip'))
        .map(file => ({
          name: file.replace(/\.(json|zip)$/, ''),
          file: path.join(this.backupDir, file),
          path: file,
          type: file.endsWith('.zip') ? 'full' : 'database-only'
        }));

      return { success: true, backups };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async restoreFromBackup(backupPath) {
    try {
      console.log(`Restoring from backup: ${backupPath}`);

      // Determine backup file type and path
      let backupFile;
      let isZip = false;

      if (path.isAbsolute(backupPath)) {
        backupFile = backupPath;
        isZip = backupPath.endsWith('.zip');
      } else {
        // Try ZIP first, then JSON
        const zipPath = path.join(this.backupDir, `${backupPath}.zip`);
        const jsonPath = path.join(this.backupDir, `${backupPath}.json`);

        try {
          await fs.access(zipPath);
          backupFile = zipPath;
          isZip = true;
        } catch (error) {
          backupFile = jsonPath;
          isZip = false;
        }
      }

      let backupData;

      if (isZip) {
        console.log('Extracting ZIP backup...');
        backupData = await this.extractZipBackup(backupFile);
      } else {
        console.log('Reading JSON backup...');
        backupData = JSON.parse(await fs.readFile(backupFile, 'utf8'));
      }

      if (!backupData.data || !backupData.data.users || !backupData.data.configurations) {
        throw new Error('Invalid backup file format');
      }

      const fileCount = backupData.data.files ? backupData.data.files.length : 0;
      console.log(`Backup contains ${backupData.data.users.length} users, ${backupData.data.configurations.length} configurations, and ${fileCount} files`);
      console.log(`Current system: ${this.isMongoDb ? 'MongoDB' : 'SQLite'}, Backup from: ${backupData.databaseType || 'unknown'}`);

      // Create a current backup before restoring
      const preRestoreBackup = await this.createBackup(this.generateBackupName('system', 'pre-restore'));
      if (!preRestoreBackup.success) {
        throw new Error(`Failed to create pre-restore backup: ${preRestoreBackup.error}`);
      }
      console.log(`✅ Pre-restore backup created: ${preRestoreBackup.file}`);

      // Clear existing data completely
      console.log('⚠️ Clearing existing data...');

      // Clear files first (always)
      try {
        await this.clearAllFiles();
        console.log('✅ Cleared existing files');
      } catch (error) {
        console.warn('Warning: Could not clear files:', error.message);
      }

      // Delete all configurations (to avoid foreign key issues)
      try {
        await this.clearAllConfigurations();
        console.log('✅ Cleared existing configurations');
      } catch (error) {
        console.warn('Warning: Could not clear configurations:', error.message);
      }

      // Get existing admin users before clearing (we'll preserve them)
      const existingAdminUsers = await this.getExistingAdminUsers();
      console.log(`Found ${existingAdminUsers.length} existing admin users to preserve`);

      // Delete only non-admin users
      try {
        await this.clearNonAdminUsers();
        console.log('✅ Cleared existing non-admin users');
      } catch (error) {
        console.warn('Warning: Could not clear non-admin users:', error.message);
      }

      // Restore users first (to maintain referential integrity)
      console.log('📥 Restoring users...');
      let restoredUsers = 0;
      let skippedAdminUsers = 0;
      const userIdMapping = new Map(); // Track old ID to new ID mapping

      // Map existing admin users to maintain references
      for (const existingAdmin of existingAdminUsers) {
        const matchingBackupUser = backupData.data.users.find(u =>
          u.username === existingAdmin.username && u.role === 'ADMIN'
        );
        if (matchingBackupUser) {
          const existingUserId = existingAdmin.id || existingAdmin._id?.toString();
          userIdMapping.set(matchingBackupUser.id, existingUserId);
          skippedAdminUsers++;
          console.log(`✅ Preserved existing admin user: ${existingAdmin.username} - ID: ${existingUserId}`);
        }
      }

      for (const userData of backupData.data.users) {
        try {
          // Skip admin users that already exist
          if (userData.role === 'ADMIN') {
            const existingAdmin = existingAdminUsers.find(u => u.username === userData.username);
            if (existingAdmin) {
              continue; // Skip this admin user, already handled above
            }
          }

          // Restore non-admin users or new admin users
          const newUser = await this.createUserFromBackupWithId(userData);
          const newUserId = newUser.id || newUser._id?.toString() || newUser.id;
          userIdMapping.set(userData.id, newUserId);
          restoredUsers++;
          console.log(`✅ Restored user: ${userData.username} (${userData.role}) - ID: ${newUserId}`);
        } catch (error) {
          console.warn(`Warning: Could not restore user ${userData.username}:`, error.message);
        }
      }
      console.log(`✅ Restored ${restoredUsers} users, preserved ${skippedAdminUsers} admin users`);

      // Restore configurations with updated user references
      console.log('📥 Restoring configurations...');
      let restoredConfigs = 0;
      const configIdMapping = new Map(); // Track old config ID to new config ID mapping

      // Sort configurations by hierarchy (parents first)
      const sortedConfigs = [...backupData.data.configurations].sort((a, b) => {
        if (!a.parent_id && b.parent_id) return -1; // a is parent, b is child
        if (a.parent_id && !b.parent_id) return 1;  // a is child, b is parent
        return 0; // same level
      });

      for (const configData of sortedConfigs) {
        try {
          // Update user references if they changed
          let created_by = configData.created_by || configData.createdBy;
          let updated_by = configData.updated_by || configData.updatedBy;
          
          if (userIdMapping.has(created_by)) {
            created_by = userIdMapping.get(created_by);
          }
          if (updated_by && userIdMapping.has(updated_by)) {
            updated_by = userIdMapping.get(updated_by);
          }

          // Map parent_id from old to new if it exists in mapping
          let mapped_parent_id = configData.parent_id || configData.parentId;
          if (mapped_parent_id && configIdMapping.has(mapped_parent_id)) {
            mapped_parent_id = configIdMapping.get(mapped_parent_id);
          }

          const newConfig = await this.createConfigurationFromBackup(configData, created_by, updated_by, mapped_parent_id);

          // Store the mapping from old ID to new ID for future parent references
          const oldConfigId = configData.id || configData._id;
          const newConfigId = newConfig.id || newConfig._id?.toString();
          if (oldConfigId && newConfigId) {
            configIdMapping.set(oldConfigId, newConfigId);
          }

          restoredConfigs++;
        } catch (error) {
          console.warn(`Warning: Could not restore configuration ${configData.name}:`, error.message);
        }
      }
      console.log(`✅ Restored ${restoredConfigs} configurations`);

      // Map configuration IDs within data structures (products that reference components/versions)
      await this.mapConfigurationIDsInData(configIdMapping);

      // Restore files if present
      let restoredFiles = 0;
      if (backupData.data.files && backupData.data.files.length > 0 && isZip) {
        console.log('📥 Restoring files...');
        restoredFiles = await this.restoreFilesFromBackup(backupData.data.files, backupFile);
        console.log(`✅ Restored ${restoredFiles} files`);
      }

      console.log('✅ Restore completed successfully');
      return {
        success: true,
        message: `Restore completed. ${restoredUsers} users restored, ${skippedAdminUsers} admin users preserved, ${restoredConfigs} configurations, and ${restoredFiles} files restored. Pre-restore backup saved.`,
        stats: {
          users: restoredUsers,
          configurations: restoredConfigs,
          files: restoredFiles,
          preservedAdminUsers: skippedAdminUsers
        },
        preRestoreBackup: preRestoreBackup.file,
        adminUsersPreserved: skippedAdminUsers > 0
      };

    } catch (error) {
      console.error('❌ Restore failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Clear all data operations
  async clearAllUsers() {
    if (this.isMongoDb) {
      const mongoose = require('mongoose');
      const UserModel = mongoose.model('User');
      await UserModel.deleteMany({});
    } else {
      const db = require('./models/database');
      await db.query("DELETE FROM users");
    }
  }

  // Get existing admin users before clearing
  async getExistingAdminUsers() {
    if (this.isMongoDb) {
      const mongoose = require('mongoose');
      const UserModel = mongoose.model('User');
      return await UserModel.find({ role: 'ADMIN' }).lean();
    } else {
      const db = require('./models/database');
      const result = await db.query("SELECT * FROM users WHERE role = 'ADMIN'");
      return result.rows;
    }
  }

  // Clear only non-admin users
  async clearNonAdminUsers() {
    if (this.isMongoDb) {
      const mongoose = require('mongoose');
      const UserModel = mongoose.model('User');
      await UserModel.deleteMany({ role: { $ne: 'ADMIN' } });
    } else {
      const db = require('./models/database');
      await db.query("DELETE FROM users WHERE role != 'ADMIN'");
    }
  }

  async clearAllConfigurations() {
    if (this.isMongoDb) {
      const mongoose = require('mongoose');
      const ConfigurationModel = mongoose.model('Configuration');
      await ConfigurationModel.deleteMany({});
    } else {
      const { Configuration } = require('./models');
      await Configuration.deleteAll();
    }
  }

  async clearAllFiles() {
    const storageDir = path.join(__dirname, 'storage/files');
    try {
      const files = await fs.readdir(storageDir);
      for (const file of files) {
        await fs.unlink(path.join(storageDir, file));
      }
      console.log(`Cleared ${files.length} files from storage`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  // Create operations for restore
  async createUserFromBackup(userData) {
    return this.createUserFromBackupWithId(userData);
  }

  async createUserFromBackupWithId(userData) {
    if (this.isMongoDb) {
      const mongoose = require('mongoose');
      const UserModel = mongoose.model('User');

      try {
        // Try to preserve the original MongoDB ObjectId for admin users
        if (userData.role === 'ADMIN' && userData.id && userData.id.length === 24) {
          const user = new UserModel({
            _id: new mongoose.Types.ObjectId(userData.id),
            username: userData.username,
            password_hash: userData.password_hash,
            role: userData.role
          });

          return await user.save();
        }
      } catch (error) {
        console.warn(`Could not preserve ID ${userData.id} for ${userData.username}, creating with new ID`);
      }

      // Fall back to creating with new ID
      const user = new UserModel({
        username: userData.username,
        password_hash: userData.password_hash,
        role: userData.role
      });

      return await user.save();
    } else {
      const db = require('./models/database');
      const { User } = require('./models');

      await db.query(
        `INSERT INTO users (id, username, password_hash, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          userData.id,
          userData.username,
          userData.password_hash,
          userData.role,
          userData.created_at || new Date().toISOString(),
          userData.updated_at || new Date().toISOString()
        ]
      );

      return await User.findById(userData.id);
    }
  }

  async createConfigurationFromBackup(configData, created_by, updated_by, mapped_parent_id = null) {
    if (this.isMongoDb) {
      const mongoose = require('mongoose');
      const ConfigurationModel = mongoose.model('Configuration');

      const config = new ConfigurationModel({
        name: configData.name,
        type: configData.type,
        parent_id: mapped_parent_id || configData.parent_id || configData.parentId,
        data: configData.data || {},
        status: configData.status || 'DRAFT',
        created_by: created_by,
        description: configData.description || '',
        archived: configData.archived || false
      });

      return await config.save();
    } else {
      const db = require('./models/database');
      const { Configuration } = require('./models');
      
      await db.query(
        `INSERT INTO configurations (id, name, type, parent_id, data, created_by, updated_by, description, status, archived, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          configData.id || configData._id,
          configData.name,
          configData.type,
          configData.parent_id || configData.parentId,
          JSON.stringify(configData.data || {}),
          created_by,
          updated_by,
          configData.description || '',
          configData.status || 'DRAFT',
          configData.archived ? 1 : 0,
          configData.created_at || configData.createdAt || new Date().toISOString(),
          configData.updated_at || configData.updatedAt || new Date().toISOString()
        ]
      );

      return await Configuration.findById(configData.id || configData._id);
    }
  }

  async getCurrentStats() {
    try {
      let users, configurations;

      if (this.isMongoDb) {
        const mongoose = require('mongoose');

        // Check if we're connected to MongoDB
        if (mongoose.connection.readyState !== 1) {
          throw new Error('MongoDB is not connected');
        }

        const UserModel = mongoose.model('User');
        const ConfigurationModel = mongoose.model('Configuration');

        const userDocs = await UserModel.find({}).lean();
        users = userDocs.map(user => ({
          username: user.username,
          role: user.role
        }));

        configurations = await ConfigurationModel.find({}).lean();
      } else {
        const { User, Configuration } = require('./models');
        users = await User.findAll();
        configurations = await Configuration.findAll();
      }

      return {
        success: true,
        stats: {
          users: users.length,
          configurations: configurations.length,
          usernames: users.map(u => u.username),
          configNames: configurations.map(c => `${c.name} (${c.type})`).slice(0, 10) // First 10
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getBackupFile(backupName) {
    try {
      await this.ensureBackupDir();

      // Try ZIP first, then JSON
      let backupFile = path.join(this.backupDir, `${backupName}.zip`);

      try {
        await fs.access(backupFile);
      } catch (error) {
        // Try JSON format
        backupFile = path.join(this.backupDir, `${backupName}.json`);
        try {
          await fs.access(backupFile);
        } catch (error2) {
          return {
            success: false,
            error: `Backup file not found: ${backupName}`
          };
        }
      }

      return {
        success: true,
        filePath: path.resolve(backupFile)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async restoreFromUploadedFile(uploadedFilePath) {
    try {
      console.log(`Restoring from uploaded file: ${uploadedFilePath}`);

      // Detect file type (JSON or ZIP) using extension and magic header
      let isZip = uploadedFilePath.toLowerCase().endsWith('.zip');

      if (!isZip) {
        try {
          const fh = await fs.open(uploadedFilePath, 'r');
          const header = Buffer.alloc(4);
          await fh.read(header, 0, 4, 0);
          await fh.close();
          // ZIP files start with 'PK\x03\x04'
          if (header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04) {
            isZip = true;
          }
        } catch (e) {
          // Ignore header read errors; we'll try JSON parse next
        }
      }

      let backupData;
      try {
        if (isZip) {
          console.log('Detected ZIP backup upload');
          backupData = await this.extractZipBackup(uploadedFilePath);
        } else {
          console.log('Detected JSON backup upload');
          backupData = JSON.parse(await fs.readFile(uploadedFilePath, 'utf8'));
        }
      } catch (parseError) {
        throw new Error('The uploaded file is not a valid backup. Expected a JSON with "data" or a ZIP containing database.json.');
      }

      if (!backupData.data || !backupData.data.users || !backupData.data.configurations) {
        throw new Error('Invalid backup file format - missing required data sections');
      }

      const fileCount = backupData.data.files ? backupData.data.files.length : 0;
      console.log(`Uploaded backup contains ${backupData.data.users.length} users, ${backupData.data.configurations.length} configurations, and ${fileCount} files`);
      console.log(`Current system: ${this.isMongoDb ? 'MongoDB' : 'SQLite'}, Backup from: ${backupData.databaseType || 'unknown'}`);

      // Create a current backup before restoring
      const preRestoreBackup = await this.createBackup(this.generateBackupName('system', 'pre-upload-restore'));
      if (!preRestoreBackup.success) {
        throw new Error(`Failed to create pre-restore backup: ${preRestoreBackup.error}`);
      }
      console.log(`✅ Pre-restore backup created: ${preRestoreBackup.file}`);

      // Clear existing data completely
      console.log('⚠️ Clearing existing data...');

      // Clear files first (always)
      try {
        await this.clearAllFiles();
        console.log('✅ Cleared existing files');
      } catch (error) {
        console.warn('Warning: Could not clear files:', error.message);
      }

      // Delete all configurations first (to avoid foreign key issues)
      try {
        await this.clearAllConfigurations();
        console.log('✅ Cleared existing configurations');
      } catch (error) {
        console.warn('Warning: Could not clear configurations:', error.message);
      }

      // Get existing admin users before clearing (we'll preserve them)
      const existingAdminUsers = await this.getExistingAdminUsers();
      console.log(`Found ${existingAdminUsers.length} existing admin users to preserve`);

      // Delete only non-admin users
      try {
        await this.clearNonAdminUsers();
        console.log('✅ Cleared existing non-admin users');
      } catch (error) {
        console.warn('Warning: Could not clear non-admin users:', error.message);
      }

      // Restore users first (to maintain referential integrity)
      console.log('📥 Restoring users...');
      let restoredUsers = 0;
      let skippedAdminUsers = 0;
      const userIdMapping = new Map(); // Track old ID to new ID mapping

      // Map existing admin users to maintain references
      for (const existingAdmin of existingAdminUsers) {
        const matchingBackupUser = backupData.data.users.find(u =>
          u.username === existingAdmin.username && u.role === 'ADMIN'
        );
        if (matchingBackupUser) {
          const existingUserId = existingAdmin.id || existingAdmin._id?.toString();
          userIdMapping.set(matchingBackupUser.id, existingUserId);
          skippedAdminUsers++;
          console.log(`✅ Preserved existing admin user: ${existingAdmin.username} - ID: ${existingUserId}`);
        }
      }

      for (const userData of backupData.data.users) {
        try {
          // Skip admin users that already exist
          if (userData.role === 'ADMIN') {
            const existingAdmin = existingAdminUsers.find(u => u.username === userData.username);
            if (existingAdmin) {
              continue; // Skip this admin user, already handled above
            }
          }

          // Restore non-admin users or new admin users
          const newUser = await this.createUserFromBackupWithId(userData);
          const newUserId = newUser.id || newUser._id?.toString() || newUser.id;
          userIdMapping.set(userData.id, newUserId);
          restoredUsers++;
          console.log(`✅ Restored user: ${userData.username} (${userData.role}) - ID: ${newUserId}`);
        } catch (error) {
          console.warn(`Warning: Could not restore user ${userData.username}:`, error.message);
        }
      }
      console.log(`✅ Restored ${restoredUsers} users, preserved ${skippedAdminUsers} admin users`);

      // Restore configurations with updated user references
      console.log('📥 Restoring configurations...');
      let restoredConfigs = 0;
      const configIdMapping = new Map(); // Track old config ID to new config ID mapping

      // Sort configurations by hierarchy (parents first)
      const sortedConfigs = [...backupData.data.configurations].sort((a, b) => {
        if (!a.parent_id && b.parent_id) return -1; // a is parent, b is child
        if (a.parent_id && !b.parent_id) return 1;  // a is child, b is parent
        return 0; // same level
      });

      for (const configData of sortedConfigs) {
        try {
          // Update user references if they changed
          let created_by = configData.created_by || configData.createdBy;
          let updated_by = configData.updated_by || configData.updatedBy;

          if (userIdMapping.has(created_by)) {
            created_by = userIdMapping.get(created_by);
          }
          if (updated_by && userIdMapping.has(updated_by)) {
            updated_by = userIdMapping.get(updated_by);
          }

          // Map parent_id from old to new if it exists in mapping
          let mapped_parent_id = configData.parent_id || configData.parentId;
          if (mapped_parent_id && configIdMapping.has(mapped_parent_id)) {
            mapped_parent_id = configIdMapping.get(mapped_parent_id);
          }

          const newConfig = await this.createConfigurationFromBackup(configData, created_by, updated_by, mapped_parent_id);

          // Store the mapping from old ID to new ID for future parent references
          const oldConfigId = configData.id || configData._id;
          const newConfigId = newConfig.id || newConfig._id?.toString();
          if (oldConfigId && newConfigId) {
            configIdMapping.set(oldConfigId, newConfigId);
          }

          restoredConfigs++;
        } catch (error) {
          console.warn(`Warning: Could not restore configuration ${configData.name}:`, error.message);
        }
      }
      console.log(`✅ Restored ${restoredConfigs} configurations`);

      // Restore files if present in ZIP
      let restoredFiles = 0;
      if (isZip && fileCount > 0) {
        console.log('📥 Restoring files...');
        restoredFiles = await this.restoreFilesFromBackup(backupData.data.files, uploadedFilePath);
        console.log(`✅ Restored ${restoredFiles} files`);
      }

      console.log('✅ Restore from uploaded file completed successfully');
      return {
        success: true,
        message: `Restore completed from uploaded file. ${restoredUsers} users restored, ${skippedAdminUsers} admin users preserved, ${restoredConfigs} configurations${isZip ? `, and ${restoredFiles} files` : ''} restored. Pre-restore backup saved.`,
        stats: {
          users: restoredUsers,
          configurations: restoredConfigs,
          files: restoredFiles,
          preservedAdminUsers: skippedAdminUsers
        },
        preRestoreBackup: preRestoreBackup.file,
        adminUsersPreserved: skippedAdminUsers > 0
      };

    } catch (error) {
      console.error('❌ Restore from uploaded file failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Map configuration IDs within data structures (for products that reference components/versions)
  async mapConfigurationIDsInData(configIdMapping) {
    try {
      console.log('📥 Updating internal configuration ID references...');
      let updatedConfigs = 0;

      if (this.isMongoDb) {
        const mongoose = require('mongoose');
        const ConfigurationModel = mongoose.model('Configuration');

        // Find all configurations with data that might contain ID references
        const configurations = await ConfigurationModel.find({}).lean();

        for (const config of configurations) {
          if (config.data && typeof config.data === 'object') {
            let dataChanged = false;
            const updatedData = this.mapIDsInObject(config.data, configIdMapping);

            if (JSON.stringify(updatedData) !== JSON.stringify(config.data)) {
              dataChanged = true;
              await ConfigurationModel.findByIdAndUpdate(config._id, { data: updatedData });
              updatedConfigs++;
              console.log(`✅ Updated ID references in: ${config.name}`);
            }
          }
        }
      } else {
        const { Configuration } = require('./models');
        const configurations = await Configuration.findAll();

        for (const config of configurations) {
          if (config.data && typeof config.data === 'object') {
            const updatedData = this.mapIDsInObject(config.data, configIdMapping);

            if (JSON.stringify(updatedData) !== JSON.stringify(config.data)) {
              await Configuration.update(config.id, { data: updatedData });
              updatedConfigs++;
              console.log(`✅ Updated ID references in: ${config.name}`);
            }
          }
        }
      }

      console.log(`✅ Updated ID references in ${updatedConfigs} configurations`);
    } catch (error) {
      console.warn('Warning: Failed to map configuration IDs in data:', error.message);
    }
  }

  // Recursively map configuration IDs in an object
  mapIDsInObject(obj, configIdMapping) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.mapIDsInObject(item, configIdMapping));
    }

    const mapped = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'componentId' || key === 'versionId') {
        // Map configuration ID references
        if (value && configIdMapping.has(value)) {
          mapped[key] = configIdMapping.get(value);
        } else {
          mapped[key] = value;
        }
      } else if (value && typeof value === 'object') {
        // Recursively process nested objects
        mapped[key] = this.mapIDsInObject(value, configIdMapping);
      } else {
        mapped[key] = value;
      }
    }
    return mapped;
  }

  // Extract ZIP backup
  async extractZipBackup(zipFile) {
    const tempDir = path.join(__dirname, 'temp-restore');

    try {
      // Ensure temp directory exists
      await fs.mkdir(tempDir, { recursive: true });

      // Extract ZIP to temp directory
      await new Promise((resolve, reject) => {
        require('fs').createReadStream(zipFile)
          .pipe(unzipper.Extract({ path: tempDir }))
          .on('close', resolve)
          .on('error', reject);
      });

      // Read database.json
      const databaseJsonPath = path.join(tempDir, 'database.json');
      const backupData = JSON.parse(await fs.readFile(databaseJsonPath, 'utf8'));

      return backupData;
    } catch (error) {
      throw new Error(`Failed to extract ZIP backup: ${error.message}`);
    } finally {
      // Clean up temp directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('Could not clean up temp directory:', cleanupError.message);
      }
    }
  }

  // Restore files from ZIP backup
  // Compute referenced file storage keys from all configurations
  async getReferencedFileKeys() {
    const keys = new Set();
    try {
      const configs = await this.getAllConfigurationsForBackup();
      const addRefs = (obj) => {
        if (obj && typeof obj === 'object') {
          if (Array.isArray(obj)) {
            for (const item of obj) addRefs(item);
          } else {
            if (obj._type === 'file' && obj._metadata && obj._metadata.storageKey) {
              keys.add(obj._metadata.storageKey);
            }
            for (const k in obj) {
              if (Object.prototype.hasOwnProperty.call(obj, k)) addRefs(obj[k]);
            }
          }
        }
      };
      for (const cfg of configs) {
        addRefs(cfg.data);
      }
    } catch (e) {
      console.warn('Error computing referenced file keys:', e.message);
    }
    return keys;
  }

  async restoreFilesFromBackup(fileMetadata, zipFile) {
    const tempDir = path.join(__dirname, 'temp-restore');
    const storageDir = path.join(__dirname, 'storage/files');
    let restoredCount = 0;

    try {
      // Ensure temp and storage directories exist
      await fs.mkdir(tempDir, { recursive: true });
      await fs.mkdir(storageDir, { recursive: true });

      // Extract ZIP to temp directory
      await new Promise((resolve, reject) => {
        require('fs').createReadStream(zipFile)
          .pipe(unzipper.Extract({ path: tempDir }))
          .on('close', resolve)
          .on('error', reject);
      });

      // Copy files from temp/files to storage/files
      const tempFilesDir = path.join(tempDir, 'files');

      try {
        await fs.access(tempFilesDir);

        for (const fileInfo of fileMetadata) {
          try {
            const sourcePath = path.join(tempFilesDir, fileInfo.fileName);
            const metaSourcePath = path.join(tempFilesDir, fileInfo.fileName + '.meta.json');
            const destPath = path.join(storageDir, fileInfo.fileName);
            const metaDestPath = path.join(storageDir, fileInfo.fileName + '.meta.json');

            // Copy the actual file
            await fs.copyFile(sourcePath, destPath);

            // Copy the metadata file
            await fs.copyFile(metaSourcePath, metaDestPath);

            restoredCount++;
            console.log(`✅ Restored file: ${fileInfo.originalName}`);
          } catch (error) {
            console.warn(`Warning: Could not restore file ${fileInfo.fileName}:`, error.message);
          }
        }
      } catch (error) {
        console.warn('No files directory found in backup');
      }

      return restoredCount;
    } catch (error) {
      console.error('Error restoring files:', error);
      return restoredCount;
    } finally {
      // Clean up temp directory
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn('Could not clean up temp directory:', cleanupError.message);
      }
    }
  }
}

module.exports = BackupRestore;

// CLI usage
if (require.main === module) {
  const br = new BackupRestore();
  const command = process.argv[2];

  switch (command) {
    case 'backup':
      br.createBackup(process.argv[3]).then(result => {
        console.log(result);
        process.exit(result.success ? 0 : 1);
      });
      break;
    
    case 'list':
      br.listBackups().then(result => {
        console.log(result);
        process.exit(result.success ? 0 : 1);
      });
      break;
      
    case 'status':
      br.getCurrentStats().then(result => {
        console.log(result);
        process.exit(result.success ? 0 : 1);
      });
      break;
      
    default:
      console.log('Usage: node backup-restore.js <backup|list|status> [name]');
      process.exit(1);
  }
}
