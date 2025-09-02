import React, { useState, useEffect } from "react";
import {
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  ServerIcon,
  CloudIcon,
  ShieldCheckIcon,
  ClockIcon,
  DocumentArrowUpIcon,
  DocumentArrowDownIcon,
  CogIcon,
  WifiIcon,
  XCircleIcon,
  UserIcon,
  UsersIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon
} from "@heroicons/react/24/outline";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import api, { userAPI, authAPI } from "../services/api";

const SettingsModal = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const { user, logout, login } = useAuth();
  const [activeTab, setActiveTab] = useState('users');

  // Force logout and redirect on authentication errors
  const forceLogout = () => {
    localStorage.removeItem("token");
    logout();
    window.location.replace("/login");
  };
  
  // Database state
  const [dbStatus, setDbStatus] = useState({ type: 'unknown', connected: false, host: '' });
  const [mongoConnectionString, setMongoConnectionString] = useState('');
  const [dbLoading, setDbLoading] = useState(false);

  // Multi-database management state
  const [databases, setDatabases] = useState([]);
  const [selectedDatabase, setSelectedDatabase] = useState(null);
  const [showAddDatabase, setShowAddDatabase] = useState(false);
  const [showCopyData, setShowCopyData] = useState(false);

  // Re-authentication state for database switching
  const [showReAuthModal, setShowReAuthModal] = useState(false);
  const [reAuthPassword, setReAuthPassword] = useState('');
  const [reAuthLoading, setReAuthLoading] = useState(false);
  const [pendingDatabaseSwitch, setPendingDatabaseSwitch] = useState(null);
  const [newDatabase, setNewDatabase] = useState({ name: '', connectionString: '', description: '' });
  const [copyDataConfig, setCopyDataConfig] = useState({
    sourceDatabase: '',
    targetDatabase: '',
    includeConfigurations: true,
    includeConfigurationTypes: [],
    adminOnly: true
  });
  
  // Storage state
  const [storageStatus, setStorageStatus] = useState({ type: 'embedded', configured: false });
  const [s3Config, setS3Config] = useState({
    bucketName: '',
    region: 'us-east-1',
    accessKeyId: '',
    secretAccessKey: ''
  });
  const [storageLoading, setStorageLoading] = useState(false);
  
  // Backup state
  const [backups, setBackups] = useState([]);
  const [selectedBackup, setSelectedBackup] = useState('');
  const [backupLoading, setBackupLoading] = useState(false);
  const [dataStats, setDataStats] = useState({ users: 0, configurations: 0 });
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Users state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'USER' });
  const [editingUserId, setEditingUserId] = useState(null);
  const [editingUserRole, setEditingUserRole] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadAllStatus();
    }
  }, [isOpen]);

  const loadAllStatus = async () => {
    // Use Promise.allSettled to ensure all requests complete even if some fail
    const results = await Promise.allSettled([
      loadDatabaseStatus(),
      loadStorageStatus(),
      loadBackups(),
      loadDataStats(),
      loadUsers()
    ]);

    // Log any rejected promises for debugging
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const functionNames = ['loadDatabaseStatus', 'loadStorageStatus', 'loadBackups', 'loadDataStats', 'loadUsers'];
        console.error(`${functionNames[index]} failed:`, result.reason);
      }
    });
  };

  // Users management functions
  const loadUsers = async () => {
    setUsersLoading(true);
    try {
      const response = await userAPI.getAll();
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Failed to load users:', error);
      showToast('Failed to load users', 'error');
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const createUser = async () => {
    if (!newUser.username || !newUser.password) {
      showToast('Please enter username and password', 'error');
      return;
    }

    setUsersLoading(true);
    try {
      await authAPI.register(newUser.username, newUser.password, newUser.role);
      showToast('User created successfully', 'success');
      setNewUser({ username: '', password: '', role: 'USER' });
      setShowCreateUser(false);
      loadUsers();
    } catch (error) {
      console.error('Failed to create user:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create user';
      showToast(`Failed to create user: ${errorMessage}`, 'error');
    } finally {
      setUsersLoading(false);
    }
  };

  const updateUserRole = async (userId, newRole) => {
    setUsersLoading(true);
    try {
      await userAPI.updateRole(userId, newRole);
      showToast('User role updated successfully', 'success');
      setEditingUserId(null);
      loadUsers();
    } catch (error) {
      console.error('Failed to update user role:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to update user role';
      showToast(`Failed to update user role: ${errorMessage}`, 'error');
    } finally {
      setUsersLoading(false);
    }
  };

  const deleteUser = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
      return;
    }

    setUsersLoading(true);
    try {
      await userAPI.delete(userId);
      showToast('User deleted successfully', 'success');
      loadUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to delete user';
      showToast(`Failed to delete user: ${errorMessage}`, 'error');
    } finally {
      setUsersLoading(false);
    }
  };

  // Database functions (existing)
  const loadDatabaseStatus = async () => {
    try {
      // Load databases from new multi-database API
      const response = await api.get('/settings/databases');
      if (response.data.success) {
        setDatabases(response.data.databases || []);

        // Set database status based on active database
        const activeDb = response.data.databases.find(db => db.isActive);
        if (activeDb && response.data.status.status === 'connected') {
          setDbStatus({
            type: 'mongodb',
            connected: true,
            host: response.data.status.host || '',
            activeDatabase: activeDb.name
          });
        } else {
          setDbStatus({ type: 'sqlite', connected: false, host: '' });
        }
      }

      // Legacy: Load MongoDB settings for backward compatibility
      try {
        const settingsResponse = await api.get('/settings/mongodb');
        if (settingsResponse.data.success) {
          setMongoConnectionString(settingsResponse.data.settings.connectionString || '');
        }
      } catch (legacyError) {
        // Ignore legacy API errors
      }
    } catch (error) {
      console.error('Failed to load database status:', error);
      if (error.response?.status === 401) {
        showToast('Session expired. Please login again.', 'error');
        forceLogout();
      } else {
        setDbStatus({ type: 'sqlite', connected: false, host: '' });
        setDatabases([]);
      }
    }
  };

  const loadStorageStatus = async () => {
    try {
      const response = await api.get('/settings/storage/status');
      if (response.data.success) {
        setStorageStatus({
          type: response.data.status.storageType,
          configured: response.data.status.isConfigured
        });
      } else {
        console.warn('Storage status loading unsuccessful:', response.data.error);
        setStorageStatus({ type: 'embedded', configured: false });
      }
    } catch (error) {
      console.error('Failed to load storage status:', error);
      setStorageStatus({ type: 'embedded', configured: false });
    }
  };

  const loadBackups = async () => {
    try {
      const response = await api.get('/settings/data/backups');
      if (response.data.success) {
        setBackups(response.data.backups || []);
      } else {
        console.warn('Backup loading unsuccessful:', response.data.error);
        setBackups([]);
      }
    } catch (error) {
      console.error('Failed to load backups:', error);
      if (error.response?.status === 401) {
        showToast('Session expired. Please login again.', 'error');
        forceLogout();
      } else {
        setBackups([]);
      }
    }
  };

  const loadDataStats = async () => {
    try {
      const response = await api.get('/settings/data/status');
      if (response.data.success) {
        setDataStats(response.data.stats);
      } else {
        console.warn('Data stats loading unsuccessful:', response.data.error);
        setDataStats({ users: 0, configurations: 0 });
      }
    } catch (error) {
      console.error('Failed to load data stats:', error);
      if (error.response?.status === 401) {
        showToast('Session expired. Please login again.', 'error');
        forceLogout();
      } else {
        setDataStats({ users: 0, configurations: 0 });
      }
    }
  };

  const switchToEmbeddedMongo = async () => {
    if (!window.confirm('Switch to embedded MongoDB? This will migrate your data and restart the database.')) return;

    setDbLoading(true);
    try {
      const response = await api.post('/settings/mongodb/migrate-embedded');

      if (response.data.success) {
        showToast('Switched to embedded MongoDB successfully', 'success');
        loadDatabaseStatus();
      } else {
        showToast(`Failed to switch: ${response.data.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to switch to embedded MongoDB:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to switch to embedded MongoDB';
      showToast(`Failed to switch: ${errorMessage}`, 'error');
    } finally {
      setDbLoading(false);
    }
  };

  const switchToExternalMongo = async () => {
    if (!mongoConnectionString.trim()) {
      showToast('Please enter a MongoDB connection string', 'error');
      return;
    }

    if (!window.confirm('Switch to external MongoDB? This will migrate your data to the new database.')) return;

    setDbLoading(true);
    try {
      const response = await api.post('/settings/mongodb/migrate', {
        connectionString: mongoConnectionString
      });

      if (response.data.success) {
        showToast('Switched to external MongoDB successfully', 'success');
        loadDatabaseStatus();
      } else {
        showToast(`Failed to switch: ${response.data.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to switch to external MongoDB:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to switch to external MongoDB';
      showToast(`Failed to switch: ${errorMessage}`, 'error');
    } finally {
      setDbLoading(false);
    }
  };

  const switchToSQLite = async () => {
    if (!window.confirm('Switch to SQLite? This will migrate your MongoDB data back to SQLite.')) return;

    setDbLoading(true);
    try {
      const response = await api.post('/settings/mongodb/revert-to-sqlite', {
        migrateData: true
      });

      if (response.data.success) {
        showToast('Switched to SQLite successfully', 'success');
        loadDatabaseStatus();
      } else {
        showToast(`Failed to switch: ${response.data.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to switch to SQLite:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to switch to SQLite';
      showToast(`Failed to switch: ${errorMessage}`, 'error');
    } finally {
      setDbLoading(false);
    }
  };

  // Multiple Database Management Functions
  const addDatabase = async () => {
    if (!newDatabase.name || !newDatabase.connectionString) {
      showToast('Please enter database name and connection string', 'error');
      return;
    }

    setDbLoading(true);
    try {
      const response = await api.post('/settings/databases', newDatabase);

      if (response.data.success) {
        showToast('Database added successfully', 'success');
        setNewDatabase({ name: '', connectionString: '', description: '' });
        setShowAddDatabase(false);
        loadDatabaseStatus();
      } else {
        showToast(`Failed to add database: ${response.data.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to add database:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to add database';
      showToast(`Failed to add database: ${errorMessage}`, 'error');
    } finally {
      setDbLoading(false);
    }
  };

  const deleteDatabase = async (name) => {
    if (!window.confirm(`Are you sure you want to delete database "${name}"? This action cannot be undone.`)) {
      return;
    }

    setDbLoading(true);
    try {
      const response = await api.delete(`/settings/databases/${encodeURIComponent(name)}`);

      if (response.data.success) {
        showToast('Database deleted successfully', 'success');
        loadDatabaseStatus();
      } else {
        showToast(`Failed to delete database: ${response.data.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to delete database:', error);
      if (error.response?.status === 401) {
        showToast('Authentication failed. Please login again.', 'error');
        forceLogout();
      } else {
        const errorMessage = error.response?.data?.error || error.message || 'Failed to delete database';
        showToast(`Failed to delete database: ${errorMessage}`, 'error');
      }
    } finally {
      setDbLoading(false);
    }
  };

  const setActiveDatabase = async (name) => {
    setDbLoading(true);
    try {
      const response = await api.post(`/settings/databases/${encodeURIComponent(name)}/activate`);

      if (response.data.success) {
        showToast(`Database "${name}" is now active`, 'success');
        loadDatabaseStatus();

        // After database switch, warn user about potential session changes
        setTimeout(() => {
          showToast('Database activated successfully. You may need to refresh the page if you experience any issues.', 'info');
        }, 1000);
      } else {
        showToast(`Failed to activate database: ${response.data.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to activate database:', error);
      if (error.response?.status === 401) {
        // Instead of logging out, prompt for re-authentication
        showToast('Authentication required for database switch. Please confirm your password.', 'info');
        setPendingDatabaseSwitch(name);
        setShowReAuthModal(true);
      } else {
        const errorMessage = error.response?.data?.error || error.message || 'Failed to activate database';
        showToast(`Failed to activate database: ${errorMessage}`, 'error');
      }
    } finally {
      setDbLoading(false);
    }
  };

  const testDatabaseConnection = async (connectionString) => {
    setDbLoading(true);
    try {
      const response = await api.post('/settings/databases/test', {
        connectionString
      });

      if (response.data.success) {
        showToast('Connection test successful', 'success');
      } else {
        showToast(`Connection test failed: ${response.data.message}`, 'error');
      }
    } catch (error) {
      console.error('Failed to test connection:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to test connection';
      showToast(`Connection test failed: ${errorMessage}`, 'error');
    } finally {
      setDbLoading(false);
    }
  };

  const copyDataBetweenDatabases = async () => {
    if (!copyDataConfig.sourceDatabase || !copyDataConfig.targetDatabase) {
      showToast('Please select source and target databases', 'error');
      return;
    }

    if (copyDataConfig.sourceDatabase === copyDataConfig.targetDatabase) {
      showToast('Source and target databases cannot be the same', 'error');
      return;
    }

    if (!window.confirm(`Copy data from "${copyDataConfig.sourceDatabase}" to "${copyDataConfig.targetDatabase}"? This will override existing configurations in the target database.`)) {
      return;
    }

    setDbLoading(true);
    try {
      const response = await api.post('/settings/databases/copy-data', copyDataConfig);

      if (response.data.success) {
        showToast(`${response.data.message}. Admin users were copied to ensure authentication works.`, 'success');
        setShowCopyData(false);
        setCopyDataConfig({
          sourceDatabase: '',
          targetDatabase: '',
          includeConfigurations: true,
          includeConfigurationTypes: [],
          adminOnly: true
        });
      } else {
        showToast(`Failed to copy data: ${response.data.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to copy data:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to copy data';
      showToast(`Failed to copy data: ${errorMessage}`, 'error');
    } finally {
      setDbLoading(false);
    }
  };

  // Re-authentication for database switching
  const handleReAuthentication = async () => {
    if (!reAuthPassword.trim()) {
      showToast('Please enter your password', 'error');
      return;
    }

    setReAuthLoading(true);
    try {
      // Attempt to login with current username and provided password
      const loginResult = await login(user.username, reAuthPassword);

      if (loginResult.success) {
        // Authentication successful, now try the database switch again
        showToast('Re-authentication successful. Switching database...', 'success');
        setShowReAuthModal(false);
        setReAuthPassword('');

        // Retry the database switch
        await setActiveDatabase(pendingDatabaseSwitch);
        setPendingDatabaseSwitch(null);
      } else {
        showToast('Authentication failed. Please check your password.', 'error');
      }
    } catch (error) {
      console.error('Re-authentication failed:', error);
      showToast('Authentication failed. Please try again.', 'error');
    } finally {
      setReAuthLoading(false);
    }
  };

  const cancelReAuthentication = () => {
    setShowReAuthModal(false);
    setReAuthPassword('');
    setPendingDatabaseSwitch(null);
    showToast('Database switch cancelled', 'info');
  };

  const migrateDatabase = async (sourceDb, targetDb) => {
    if (!window.confirm(`Migrate all data from "${sourceDb}" to "${targetDb}"? This will replace ALL data in the target database.`)) {
      return;
    }

    setDbLoading(true);
    try {
      const response = await api.post('/settings/databases/migrate', {
        sourceDatabase: sourceDb,
        targetDatabase: targetDb
      });

      if (response.data.success) {
        showToast(response.data.message, 'success');
      } else {
        showToast(`Failed to migrate database: ${response.data.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to migrate database:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to migrate database';
      showToast(`Failed to migrate database: ${errorMessage}`, 'error');
    } finally {
      setDbLoading(false);
    }
  };

  const configureS3 = async () => {
    if (!s3Config.bucketName || !s3Config.accessKeyId || !s3Config.secretAccessKey) {
      showToast('Please fill in all S3 configuration fields', 'error');
      return;
    }

    setStorageLoading(true);
    try {
      const response = await api.put('/settings/storage', {
        storageType: 's3',
        s3BucketName: s3Config.bucketName,
        awsRegion: s3Config.region,
        awsAccessKeyId: s3Config.accessKeyId,
        awsSecretAccessKey: s3Config.secretAccessKey
      });

      if (response.data.success) {
        showToast('S3 storage configured successfully', 'success');
        loadStorageStatus();
      } else {
        showToast(`Failed to configure S3: ${response.data.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to configure S3 storage:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to configure S3 storage';
      showToast(`Failed to configure S3: ${errorMessage}`, 'error');
    } finally {
      setStorageLoading(false);
    }
  };

  const switchToEmbeddedStorage = async () => {
    if (!window.confirm('Switch to embedded storage? Files will be stored locally on the server.')) return;

    setStorageLoading(true);
    try {
      const response = await api.put('/settings/storage', {
        storageType: 'embedded'
      });

      if (response.data.success) {
        showToast('Switched to embedded storage successfully', 'success');
        loadStorageStatus();
      } else {
        showToast(`Failed to switch: ${response.data.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to switch to embedded storage:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to switch to embedded storage';
      showToast(`Failed to switch: ${errorMessage}`, 'error');
    } finally {
      setStorageLoading(false);
    }
  };

  const createBackup = async () => {
    setBackupLoading(true);
    try {
      // Create backup name in format: dd-mm-yyyy-HH:MM:ss-username
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const username = user?.username || 'unknown';

      const backupName = `${day}-${month}-${year}-${hours}:${minutes}:${seconds}-${username}`;

      const response = await api.post('/settings/data/backup', {
        name: backupName
      });

      if (response.data.success) {
        showToast('Backup created successfully', 'success');
        loadBackups();
        loadDataStats();
      } else {
        showToast(`Failed to create backup: ${response.data.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to create backup:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create backup';
      showToast(`Failed to create backup: ${errorMessage}`, 'error');
    } finally {
      setBackupLoading(false);
    }
  };

  const restoreBackup = async () => {
    if (!selectedBackup) {
      showToast('Please select a backup to restore', 'error');
      return;
    }

    if (!window.confirm(`Are you sure you want to restore from backup "${selectedBackup}"? This will replace all current data. A backup of current data will be created first.`)) {
      return;
    }

    setBackupLoading(true);
    try {
      const response = await api.post('/settings/data/restore', {
        backupName: selectedBackup
      });

      if (response.data.success) {
        showToast('Data restored successfully. You will be redirected to login due to session changes.', 'success');
        setSelectedBackup('');

        // Clear token and redirect to login after restore (user IDs changed)
        setTimeout(() => {
          localStorage.removeItem("token");
          window.location.replace("/login");
        }, 2000);
      } else {
        showToast(`Failed to restore backup: ${response.data.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to restore backup:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to restore backup';
      showToast(`Failed to restore backup: ${errorMessage}`, 'error');
    } finally {
      setBackupLoading(false);
    }
  };

  const downloadBackup = async (backupName) => {
    try {
      setBackupLoading(true);

      const response = await api.get(`/settings/data/backup/${backupName}`, {
        responseType: 'blob' // Important for file downloads
      });

      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${backupName}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showToast('Backup downloaded successfully', 'success');
    } catch (error) {
      console.error('Failed to download backup:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to download backup';
      showToast(`Failed to download backup: ${errorMessage}`, 'error');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (!file.name.endsWith('.json')) {
        showToast('Please select a JSON file', 'error');
        return;
      }
      if (file.size > 100 * 1024 * 1024) { // 100MB limit
        showToast('File size must be less than 100MB', 'error');
        return;
      }
      setUploadedFile(file);
    }
  };

  const uploadAndRestore = async () => {
    if (!uploadedFile) {
      showToast('Please select a backup file to upload', 'error');
      return;
    }

    if (!window.confirm(`Are you sure you want to restore from the uploaded file "${uploadedFile.name}"? This will replace all current data. A backup of current data will be created first.`)) {
      return;
    }

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('backupFile', uploadedFile);

      const response = await api.post('/settings/data/upload-restore', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        showToast('Data restored from uploaded file successfully. You will be redirected to login due to session changes.', 'success');
        setUploadedFile(null);

        // Reset file input
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) fileInput.value = '';

        // Clear token and redirect to login after restore (user IDs changed)
        setTimeout(() => {
          localStorage.removeItem("token");
          window.location.replace("/login");
        }, 2000);
      } else {
        showToast(`Failed to restore from uploaded file: ${response.data.error}`, 'error');
      }
    } catch (error) {
      console.error('Failed to restore from uploaded file:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to restore from uploaded file';
      showToast(`Failed to restore from uploaded file: ${errorMessage}`, 'error');
    } finally {
      setUploadLoading(false);
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'users', label: 'Users', icon: UsersIcon },
    { id: 'database', label: 'Database', icon: ServerIcon },
    { id: 'backup', label: 'Backup & Restore', icon: ShieldCheckIcon },
    { id: 'filesystem', label: 'File System', icon: CloudIcon }
  ];

  const renderUsersTab = () => (
    <div className="space-y-6">
      {/* Users List Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
          <UsersIcon className="w-5 h-5" />
          <span>User Management</span>
        </h3>
        <button
          onClick={() => setShowCreateUser(true)}
          className="btn-primary flex items-center space-x-2"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Create User</span>
        </button>
      </div>

      {/* Create User Form */}
      {showCreateUser && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
          <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">Create New User</h4>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Username
              </label>
              <input
                type="text"
                value={newUser.username}
                onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                placeholder="Enter username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Password
              </label>
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                placeholder="Enter password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Role
              </label>
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
              >
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
          </div>
          <div className="flex space-x-3 mt-4">
            <button
              onClick={createUser}
              disabled={usersLoading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {usersLoading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <PlusIcon className="w-4 h-4" />}
              <span>Create</span>
            </button>
            <button
              onClick={() => setShowCreateUser(false)}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Users List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
        {usersLoading ? (
          <div className="flex items-center justify-center p-8">
            <ArrowPathIcon className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center text-gray-500 p-8">
            No users found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <UserIcon className="w-5 h-5 text-gray-400 mr-3" />
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {user.username}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingUserId === user.id ? (
                        <select
                          value={editingUserRole}
                          onChange={(e) => setEditingUserRole(e.target.value)}
                          className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                        >
                          <option value="USER">User</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      ) : (
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          user.role === 'ADMIN' 
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                        }`}>
                          {user.role}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm space-x-2">
                      {editingUserId === user.id ? (
                        <>
                          <button
                            onClick={() => updateUserRole(user.id, editingUserRole)}
                            className="text-green-600 hover:text-green-900 dark:hover:text-green-400"
                          >
                            <CheckCircleIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingUserId(null)}
                            className="text-gray-600 hover:text-gray-900 dark:hover:text-gray-400"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingUserId(user.id);
                              setEditingUserRole(user.role);
                            }}
                            className="text-blue-600 hover:text-blue-900 dark:hover:text-blue-400"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteUser(user.id, user.username)}
                            className="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderDatabaseTab = () => (
    <div className="space-y-6">
      {/* Database Status Section */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
            <ServerIcon className="w-5 h-5" />
            <span>Database Status</span>
          </h3>
          <div className="flex items-center space-x-2">
            {dbStatus.connected ? (
              <WifiIcon className="w-5 h-5 text-green-500" />
            ) : (
              <XCircleIcon className="w-5 h-5 text-gray-400" />
            )}
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {dbStatus.activeDatabase ? `Active: ${dbStatus.activeDatabase}` : 'SQLite'}
              {dbStatus.host && ` • ${dbStatus.host}`}
            </span>
          </div>
        </div>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          {databases.length} database{databases.length !== 1 ? 's' : ''} configured
        </div>
      </div>

      {/* Database Management Section */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
            <ServerIcon className="w-5 h-5" />
            <span>Database Connections</span>
          </h3>
          <button
            onClick={() => setShowAddDatabase(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Add Database</span>
          </button>
        </div>

        {/* Database List */}
        <div className="space-y-3">
          {databases.length === 0 ? (
            <div className="text-center text-gray-500 p-8">
              No databases configured
            </div>
          ) : (
            databases.map(database => (
              <div key={database.name} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${database.isActive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                      <h4 className="text-md font-medium text-gray-900 dark:text-gray-100">
                        {database.name}
                        {database.isEmbedded && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Embedded</span>}
                        {database.isActive && <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Active</span>}
                      </h4>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {database.description || 'No description'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 font-mono">
                      {database.connectionString}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    {!database.isActive && (
                      <button
                        onClick={() => setActiveDatabase(database.name)}
                        disabled={dbLoading}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded font-medium transition-colors disabled:cursor-not-allowed text-xs"
                      >
                        Activate
                      </button>
                    )}

                    <button
                      onClick={() => testDatabaseConnection(database.connectionString)}
                      disabled={dbLoading}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded font-medium transition-colors disabled:cursor-not-allowed text-xs"
                    >
                      Test
                    </button>

                    {!database.isEmbedded && (
                      <button
                        onClick={() => deleteDatabase(database.name)}
                        disabled={dbLoading || database.isActive}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded font-medium transition-colors disabled:cursor-not-allowed text-xs"
                        title={database.isActive ? "Cannot delete active database" : "Delete database"}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Data Operations */}
        {databases.length > 1 && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
            <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">Data Operations</h4>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowCopyData(true)}
                disabled={dbLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <DocumentArrowUpIcon className="w-4 h-4" />
                <span>Copy Data</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Database Modal */}
      {showAddDatabase && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
          <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">Add New Database</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Database Name
              </label>
              <input
                type="text"
                value={newDatabase.name}
                onChange={(e) => setNewDatabase({...newDatabase, name: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                placeholder="e.g., Production Database"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Connection String
              </label>
              <input
                type="text"
                value={newDatabase.connectionString}
                onChange={(e) => setNewDatabase({...newDatabase, connectionString: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                placeholder="mongodb://localhost:27017/database_name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Description (Optional)
              </label>
              <textarea
                value={newDatabase.description}
                onChange={(e) => setNewDatabase({...newDatabase, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                placeholder="Description of this database"
                rows="2"
              />
            </div>
          </div>

          <div className="flex space-x-3 mt-4">
            <button
              onClick={addDatabase}
              disabled={dbLoading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {dbLoading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <PlusIcon className="w-4 h-4" />}
              <span>Add Database</span>
            </button>
            <button
              onClick={() => setShowAddDatabase(false)}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Copy Data Modal */}
      {showCopyData && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
          <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">Copy Data Between Databases</h4>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Source Database
                </label>
                <select
                  value={copyDataConfig.sourceDatabase}
                  onChange={(e) => setCopyDataConfig({...copyDataConfig, sourceDatabase: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select source...</option>
                  {databases.map(db => (
                    <option key={db.name} value={db.name}>{db.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Target Database
                </label>
                <select
                  value={copyDataConfig.targetDatabase}
                  onChange={(e) => setCopyDataConfig({...copyDataConfig, targetDatabase: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select target...</option>
                  {databases.filter(db => db.name !== copyDataConfig.sourceDatabase).map(db => (
                    <option key={db.name} value={db.name}>{db.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                Configuration Types to Copy
              </label>
              <div className="flex flex-wrap gap-2">
                {['PRODUCT', 'INSTANCE', 'USER', 'COMPONENT', 'VERSION'].map(type => (
                  <label key={type} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={copyDataConfig.includeConfigurationTypes.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCopyDataConfig({
                            ...copyDataConfig,
                            includeConfigurationTypes: [...copyDataConfig.includeConfigurationTypes, type]
                          });
                        } else {
                          setCopyDataConfig({
                            ...copyDataConfig,
                            includeConfigurationTypes: copyDataConfig.includeConfigurationTypes.filter(t => t !== type)
                          });
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{type}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">Leave empty to copy all types</p>
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={copyDataConfig.adminOnly}
                  onChange={(e) => setCopyDataConfig({...copyDataConfig, adminOnly: e.target.checked})}
                  className="rounded"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Only copy admin-created configurations</span>
              </label>
            </div>
          </div>

          <div className="flex space-x-3 mt-4">
            <button
              onClick={copyDataBetweenDatabases}
              disabled={dbLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {dbLoading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <DocumentArrowUpIcon className="w-4 h-4" />}
              <span>Copy Data</span>
            </button>
            <button
              onClick={() => setShowCopyData(false)}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderBackupTab = () => (
    <div className="space-y-6">
      {/* Backup & Restore Section */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
            <ShieldCheckIcon className="w-5 h-5" />
            <span>Backup & Restore</span>
          </h3>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {dataStats.users} users • {dataStats.configurations} configurations
          </div>
        </div>

        <div className="space-y-4">
          {/* Backup Actions */}
          <div className="flex space-x-3">
            <button
              onClick={createBackup}
              disabled={backupLoading}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {backupLoading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <DocumentArrowUpIcon className="w-4 h-4" />}
              <span>Create Backup</span>
            </button>
          </div>

          {/* Available Backups List with Download & Restore */}
          {backups.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">
                Available Backups
              </h4>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 max-h-40 overflow-y-auto">
                {backups.map(backup => (
                  <div key={backup.name} className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-600 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <div className="flex items-center space-x-3">
                      <ClockIcon className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                        {backup.name}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => downloadBackup(backup.name)}
                        disabled={backupLoading}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded font-medium transition-colors disabled:cursor-not-allowed flex items-center space-x-1 text-xs"
                        title="Download backup file"
                      >
                        <DocumentArrowDownIcon className="w-3 h-3" />
                        <span>Download</span>
                      </button>
                      <button
                        onClick={() => setSelectedBackup(backup.name)}
                        disabled={backupLoading}
                        className={`px-3 py-1 rounded font-medium transition-colors disabled:cursor-not-allowed flex items-center space-x-1 text-xs ${
                          selectedBackup === backup.name
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200'
                        }`}
                        title="Select for restore"
                      >
                        <ArrowPathIcon className="w-3 h-3" />
                        <span>Select</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {selectedBackup && (
                <button
                  onClick={restoreBackup}
                  disabled={backupLoading}
                  className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {backupLoading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <DocumentArrowDownIcon className="w-4 h-4" />}
                  <span>Restore from "{selectedBackup}"</span>
                </button>
              )}
            </div>
          )}

          {/* Upload and Restore Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Upload & Restore from File
            </h4>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Select Backup File (.json)
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-gray-700 dark:file:text-gray-200"
                />
                {uploadedFile && (
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Selected: {uploadedFile.name} ({Math.round(uploadedFile.size / 1024)} KB)
                  </div>
                )}
              </div>

              <button
                onClick={uploadAndRestore}
                disabled={!uploadedFile || uploadLoading}
                className="w-full px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {uploadLoading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <DocumentArrowUpIcon className="w-4 h-4" />}
                <span>Upload & Restore</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFileSystemTab = () => (
    <div className="space-y-6">
      {/* Storage Section */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
            <CloudIcon className="w-5 h-5" />
            <span>File Storage Configuration</span>
          </h3>
          <div className="flex items-center space-x-2">
            {storageStatus.configured ? (
              <CheckCircleIcon className="w-5 h-5 text-green-500" />
            ) : (
              <ExclamationCircleIcon className="w-5 h-5 text-yellow-500" />
            )}
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {storageStatus.type === 's3' ? 'Amazon S3' : 'Embedded Storage'}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {/* S3 Configuration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                S3 Bucket Name
              </label>
              <input
                type="text"
                value={s3Config.bucketName}
                onChange={(e) => setS3Config({...s3Config, bucketName: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                placeholder="my-bucket"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                AWS Region
              </label>
              <select
                value={s3Config.region}
                onChange={(e) => setS3Config({...s3Config, region: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
              >
                <option value="us-east-1">us-east-1</option>
                <option value="us-west-2">us-west-2</option>
                <option value="eu-west-1">eu-west-1</option>
                <option value="eu-central-1">eu-central-1</option>
                <option value="ap-southeast-1">ap-southeast-1</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                AWS Access Key ID
              </label>
              <input
                type="text"
                value={s3Config.accessKeyId}
                onChange={(e) => setS3Config({...s3Config, accessKeyId: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                placeholder="AKIA..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                AWS Secret Access Key
              </label>
              <input
                type="password"
                value={s3Config.secretAccessKey}
                onChange={(e) => setS3Config({...s3Config, secretAccessKey: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                placeholder="••���••••��"
              />
            </div>
          </div>

          {/* Storage Switch Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={configureS3}
              disabled={storageLoading}
              className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {storageLoading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CloudIcon className="w-4 h-4" />}
              <span>Configure S3</span>
            </button>
            
            <button
              onClick={switchToEmbeddedStorage}
              disabled={storageLoading}
              className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {storageLoading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <ServerIcon className="w-4 h-4" />}
              <span>Use Embedded Storage</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
            <CogIcon className="w-6 h-6" />
            <span>System Settings</span>
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'users' && renderUsersTab()}
          {activeTab === 'database' && renderDatabaseTab()}
          {activeTab === 'backup' && renderBackupTab()}
          {activeTab === 'filesystem' && renderFileSystemTab()}
        </div>
      </div>

      {/* Re-authentication Modal for Database Switching */}
      {showReAuthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
              <ShieldCheckIcon className="w-5 h-5" />
              <span>Confirm Password</span>
            </h3>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              To switch to database "{pendingDatabaseSwitch}", please confirm your password:
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={user?.username || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={reAuthPassword}
                  onChange={(e) => setReAuthPassword(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleReAuthentication()}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                  placeholder="Enter your password"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleReAuthentication}
                disabled={reAuthLoading || !reAuthPassword.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {reAuthLoading ? (
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheckIcon className="w-4 h-4" />
                )}
                <span>Authenticate & Switch</span>
              </button>

              <button
                onClick={cancelReAuthentication}
                disabled={reAuthLoading}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsModal;
