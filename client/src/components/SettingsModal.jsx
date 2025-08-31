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

const SettingsModal = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('users');
  
  // Database state
  const [dbStatus, setDbStatus] = useState({ type: 'unknown', connected: false, host: '' });
  const [mongoConnectionString, setMongoConnectionString] = useState('');
  const [dbLoading, setDbLoading] = useState(false);
  
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
      const response = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else {
        throw new Error('Failed to load users');
      }
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
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newUser)
      });

      if (response.ok) {
        showToast('User created successfully', 'success');
        setNewUser({ username: '', password: '', role: 'USER' });
        setShowCreateUser(false);
        loadUsers();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Failed to create user:', error);
      showToast(`Failed to create user: ${error.message}`, 'error');
    } finally {
      setUsersLoading(false);
    }
  };

  const updateUserRole = async (userId, newRole) => {
    setUsersLoading(true);
    try {
      const response = await fetch(`/api/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ role: newRole })
      });

      if (response.ok) {
        showToast('User role updated successfully', 'success');
        setEditingUserId(null);
        loadUsers();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update user role');
      }
    } catch (error) {
      console.error('Failed to update user role:', error);
      showToast(`Failed to update user role: ${error.message}`, 'error');
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
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        showToast('User deleted successfully', 'success');
        loadUsers();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete user');
      }
    } catch (error) {
      console.error('Failed to delete user:', error);
      showToast(`Failed to delete user: ${error.message}`, 'error');
    } finally {
      setUsersLoading(false);
    }
  };

  // Database functions (existing)
  const loadDatabaseStatus = async () => {
    try {
      const response = await fetch('/api/settings/mongodb/status', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDbStatus({
            type: data.status?.status === 'connected' ? 'mongodb' : 'sqlite',
            connected: data.status?.status === 'connected',
            host: data.status?.host || ''
          });
        }
      }

      // Load MongoDB settings
      const settingsResponse = await fetch('/api/settings/mongodb', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        if (settingsData.success) {
          setMongoConnectionString(settingsData.settings.connectionString || '');
        }
      }
    } catch (error) {
      console.error('Failed to load database status:', error);
      setDbStatus({ type: 'sqlite', connected: false, host: '' });
    }
  };

  const loadStorageStatus = async () => {
    try {
      const response = await fetch('/api/settings/storage/status', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setStorageStatus({
          type: data.status.storageType,
          configured: data.status.isConfigured
        });
      } else {
        console.warn('Storage status loading unsuccessful:', data.error);
        setStorageStatus({ type: 'embedded', configured: false });
      }
    } catch (error) {
      console.error('Failed to load storage status:', error);
      setStorageStatus({ type: 'embedded', configured: false });
    }
  };

  const loadBackups = async () => {
    try {
      const response = await fetch('/api/settings/data/backups', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setBackups(data.backups || []);
      } else {
        console.warn('Backup loading unsuccessful:', data.error);
        setBackups([]);
      }
    } catch (error) {
      console.error('Failed to load backups:', error);
      setBackups([]);
    }
  };

  const loadDataStats = async () => {
    try {
      const response = await fetch('/api/settings/data/status', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        setDataStats(data.stats);
      } else {
        console.warn('Data stats loading unsuccessful:', data.error);
        setDataStats({ users: 0, configurations: 0 });
      }
    } catch (error) {
      console.error('Failed to load data stats:', error);
      setDataStats({ users: 0, configurations: 0 });
    }
  };

  const switchToEmbeddedMongo = async () => {
    if (!window.confirm('Switch to embedded MongoDB? This will migrate your data and restart the database.')) return;
    
    setDbLoading(true);
    try {
      const response = await fetch('/api/settings/mongodb/migrate-embedded', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        showToast('Switched to embedded MongoDB successfully', 'success');
        loadDatabaseStatus();
      } else {
        showToast(`Failed to switch: ${data.error}`, 'error');
      }
    } catch (error) {
      showToast('Failed to switch to embedded MongoDB', 'error');
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
      const response = await fetch('/api/settings/mongodb/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ connectionString: mongoConnectionString })
      });
      const data = await response.json();
      
      if (data.success) {
        showToast('Switched to external MongoDB successfully', 'success');
        loadDatabaseStatus();
      } else {
        showToast(`Failed to switch: ${data.error}`, 'error');
      }
    } catch (error) {
      showToast('Failed to switch to external MongoDB', 'error');
    } finally {
      setDbLoading(false);
    }
  };

  const switchToSQLite = async () => {
    if (!window.confirm('Switch to SQLite? This will migrate your MongoDB data back to SQLite.')) return;
    
    setDbLoading(true);
    try {
      const response = await fetch('/api/settings/mongodb/revert-to-sqlite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ migrateData: true })
      });
      const data = await response.json();
      
      if (data.success) {
        showToast('Switched to SQLite successfully', 'success');
        loadDatabaseStatus();
      } else {
        showToast(`Failed to switch: ${data.error}`, 'error');
      }
    } catch (error) {
      showToast('Failed to switch to SQLite', 'error');
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
      const response = await fetch('/api/settings/storage', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          storageType: 's3',
          s3BucketName: s3Config.bucketName,
          awsRegion: s3Config.region,
          awsAccessKeyId: s3Config.accessKeyId,
          awsSecretAccessKey: s3Config.secretAccessKey
        })
      });
      const data = await response.json();
      
      if (data.success) {
        showToast('S3 storage configured successfully', 'success');
        loadStorageStatus();
      } else {
        showToast(`Failed to configure S3: ${data.error}`, 'error');
      }
    } catch (error) {
      showToast('Failed to configure S3 storage', 'error');
    } finally {
      setStorageLoading(false);
    }
  };

  const switchToEmbeddedStorage = async () => {
    if (!window.confirm('Switch to embedded storage? Files will be stored locally on the server.')) return;
    
    setStorageLoading(true);
    try {
      const response = await fetch('/api/settings/storage', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ storageType: 'embedded' })
      });
      const data = await response.json();
      
      if (data.success) {
        showToast('Switched to embedded storage successfully', 'success');
        loadStorageStatus();
      } else {
        showToast(`Failed to switch: ${data.error}`, 'error');
      }
    } catch (error) {
      showToast('Failed to switch to embedded storage', 'error');
    } finally {
      setStorageLoading(false);
    }
  };

  const createBackup = async () => {
    setBackupLoading(true);
    try {
      const response = await fetch('/api/settings/data/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ name: `manual-${Date.now()}` })
      });
      const data = await response.json();

      if (data.success) {
        showToast('Backup created successfully', 'success');
        loadBackups();
        loadDataStats();
      } else {
        showToast(`Failed to create backup: ${data.error}`, 'error');
      }
    } catch (error) {
      showToast('Failed to create backup', 'error');
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
      const response = await fetch('/api/settings/data/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ backupName: selectedBackup })
      });
      const data = await response.json();

      if (data.success) {
        showToast('Data restored successfully', 'success');
        setSelectedBackup('');
        loadBackups();
        loadDataStats();
      } else {
        showToast(`Failed to restore backup: ${data.error}`, 'error');
      }
    } catch (error) {
      showToast('Failed to restore backup', 'error');
    } finally {
      setBackupLoading(false);
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'users', label: 'Users', icon: UsersIcon },
    { id: 'database', label: 'Database', icon: ServerIcon },
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
      {/* Database Section */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
            <ServerIcon className="w-5 h-5" />
            <span>Database Configuration</span>
          </h3>
          <div className="flex items-center space-x-2">
            {dbStatus.connected ? (
              <WifiIcon className="w-5 h-5 text-green-500" />
            ) : (
              <XCircleIcon className="w-5 h-5 text-gray-400" />
            )}
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {dbStatus.type === 'mongodb' ? 'MongoDB' : 'SQLite'}
              {dbStatus.host && ` • ${dbStatus.host}`}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          {/* MongoDB Connection Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
              MongoDB Connection String
            </label>
            <input
              type="text"
              value={mongoConnectionString}
              onChange={(e) => setMongoConnectionString(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
              placeholder="mongodb://localhost:27017/config_manager"
            />
          </div>

          {/* Database Switch Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={switchToEmbeddedMongo}
              disabled={dbLoading || dbStatus.type === 'mongodb'}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {dbLoading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <ServerIcon className="w-4 h-4" />}
              <span>Embedded MongoDB</span>
            </button>
            
            <button
              onClick={switchToExternalMongo}
              disabled={dbLoading || !mongoConnectionString.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {dbLoading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CloudIcon className="w-4 h-4" />}
              <span>External MongoDB</span>
            </button>
            
            <button
              onClick={switchToSQLite}
              disabled={dbLoading || dbStatus.type === 'sqlite'}
              className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {dbLoading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <ServerIcon className="w-4 h-4" />}
              <span>SQLite</span>
            </button>
          </div>
        </div>
      </div>

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

          {/* Backup Selection & Restore */}
          {backups.length > 0 && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Select Backup to Restore
                </label>
                <select
                  value={selectedBackup}
                  onChange={(e) => setSelectedBackup(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Choose a backup...</option>
                  {backups.map(backup => (
                    <option key={backup.name} value={backup.name}>
                      {backup.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <button
                onClick={restoreBackup}
                disabled={!selectedBackup || backupLoading}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {backupLoading ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <DocumentArrowDownIcon className="w-4 h-4" />}
                <span>Restore from Backup</span>
              </button>
            </div>
          )}
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
                placeholder="••••••••"
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
          {activeTab === 'filesystem' && renderFileSystemTab()}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
