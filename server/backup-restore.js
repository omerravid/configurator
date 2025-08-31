const fs = require('fs').promises;
const path = require('path');
const { User, Configuration } = require('./models');

class BackupRestore {
  constructor() {
    this.backupDir = path.join(__dirname, 'backups');
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
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = name || `backup-${timestamp}`;
      const backupFile = path.join(this.backupDir, `${backupName}.json`);

      console.log(`Creating backup: ${backupName}`);

      // Get all users
      const users = await User.findAll();
      console.log(`Found ${users.length} users`);

      // Get all configurations
      const configurations = await Configuration.findAll();
      console.log(`Found ${configurations.length} configurations`);

      const backupData = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        data: {
          users,
          configurations
        }
      };

      await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2));
      
      console.log(`✅ Backup created successfully: ${backupFile}`);
      return {
        success: true,
        file: backupFile,
        stats: {
          users: users.length,
          configurations: configurations.length
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

  async listBackups() {
    try {
      await this.ensureBackupDir();
      const files = await fs.readdir(this.backupDir);
      const backups = files
        .filter(file => file.endsWith('.json'))
        .map(file => ({
          name: file.replace('.json', ''),
          file: path.join(this.backupDir, file),
          path: file
        }));

      return { success: true, backups };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async restoreFromBackup(backupPath) {
    try {
      console.log(`Restoring from backup: ${backupPath}`);

      const backupFile = path.isAbsolute(backupPath)
        ? backupPath
        : path.join(this.backupDir, `${backupPath}.json`);

      const backupData = JSON.parse(await fs.readFile(backupFile, 'utf8'));

      if (!backupData.data || !backupData.data.users || !backupData.data.configurations) {
        throw new Error('Invalid backup file format');
      }

      console.log(`Backup contains ${backupData.data.users.length} users and ${backupData.data.configurations.length} configurations`);

      // Create a current backup before restoring
      const preRestoreBackup = await this.createBackup(`pre-restore-${Date.now()}`);
      if (!preRestoreBackup.success) {
        throw new Error(`Failed to create pre-restore backup: ${preRestoreBackup.error}`);
      }
      console.log(`✅ Pre-restore backup created: ${preRestoreBackup.file}`);

      // Clear existing data
      console.log('⚠️ Clearing existing data...');

      // Delete all configurations first (to avoid foreign key issues)
      try {
        await Configuration.deleteAll();
        console.log('✅ Cleared existing configurations');
      } catch (error) {
        console.warn('Warning: Could not clear configurations:', error.message);
      }

      // Delete all users except the current admin (to avoid locking ourselves out)
      try {
        const currentUsers = await User.findAll();
        const adminUsers = currentUsers.filter(u => u.role === 'ADMIN');
        const nonAdminUsers = currentUsers.filter(u => u.role !== 'ADMIN');

        // Delete non-admin users
        for (const user of nonAdminUsers) {
          await User.delete(user.id);
        }
        console.log(`✅ Cleared ${nonAdminUsers.length} non-admin users`);
      } catch (error) {
        console.warn('Warning: Could not clear users:', error.message);
      }

      // Restore users
      console.log('📥 Restoring users...');
      let restoredUsers = 0;
      for (const userData of backupData.data.users) {
        try {
          // Check if user already exists (by username)
          const existingUser = await User.findByUsername(userData.username);
          if (!existingUser) {
            await User.create({
              username: userData.username,
              password: userData.password_hash || userData.password, // Use password_hash if available
              role: userData.role,
              passwordIsHashed: true
            });
            restoredUsers++;
          }
        } catch (error) {
          console.warn(`Warning: Could not restore user ${userData.username}:`, error.message);
        }
      }
      console.log(`✅ Restored ${restoredUsers} users`);

      // Restore configurations
      console.log('📥 Restoring configurations...');
      let restoredConfigs = 0;

      // Sort configurations by hierarchy (parents first)
      const sortedConfigs = [...backupData.data.configurations].sort((a, b) => {
        if (!a.parent_id && b.parent_id) return -1; // a is parent, b is child
        if (a.parent_id && !b.parent_id) return 1;  // a is child, b is parent
        return 0; // same level
      });

      for (const configData of sortedConfigs) {
        try {
          await Configuration.create({
            id: configData.id,
            name: configData.name,
            type: configData.type,
            parent_id: configData.parent_id,
            data: configData.data,
            status: configData.status || 'DRAFT',
            created_by: configData.created_by,
            updated_by: configData.updated_by,
            description: configData.description || '',
            created_at: configData.created_at,
            updated_at: configData.updated_at
          });
          restoredConfigs++;
        } catch (error) {
          console.warn(`Warning: Could not restore configuration ${configData.name}:`, error.message);
        }
      }
      console.log(`✅ Restored ${restoredConfigs} configurations`);

      console.log('✅ Restore completed successfully');
      return {
        success: true,
        message: `Restore completed. ${restoredUsers} users and ${restoredConfigs} configurations restored. Pre-restore backup saved.`,
        stats: {
          users: restoredUsers,
          configurations: restoredConfigs
        },
        preRestoreBackup: preRestoreBackup.file
      };

    } catch (error) {
      console.error('❌ Restore failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getCurrentStats() {
    try {
      const users = await User.findAll();
      const configurations = await Configuration.findAll();
      
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
