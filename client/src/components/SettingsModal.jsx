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
  XCircleIcon
} from "@heroicons/react/24/outline";
import { useToast } from "../context/ToastContext";

const SettingsModal = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  
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

  useEffect(() => {
    if (isOpen) {
      loadAllStatus();
    }
  }, [isOpen]);

  const loadAllStatus = async () => {
    await Promise.all([
      loadDatabaseStatus(),
      loadStorageStatus(),
      loadBackups(),
      loadDataStats()
    ]);
  };

  const loadDatabaseStatus = async () => {
    try {
      const response = await fetch('/api/settings/mongodb/status', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        setDbStatus({
          type: data.status?.status === 'connected' ? 'mongodb' : 'sqlite',
          connected: data.status?.status === 'connected',
          host: data.status?.host || ''
        });
      }
      
      // Load MongoDB settings
      const settingsResponse = await fetch('/api/settings/mongodb', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const settingsData = await settingsResponse.json();
      if (settingsData.success) {
        setMongoConnectionString(settingsData.settings.connectionString || '');
      }
    } catch (error) {
      console.error('Failed to load database status:', error);
    }
  };

  const loadStorageStatus = async () => {
    try {
      const response = await fetch('/api/settings/storage/status', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        setStorageStatus({
          type: data.status.storageType,
          configured: data.status.isConfigured
        });
      }
    } catch (error) {
      console.error('Failed to load storage status:', error);
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
      // Set empty array on error so UI doesn't break
      setBackups([]);
    }
  };

  const loadDataStats = async () => {
    try {
      const response = await fetch('/api/settings/data/status', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      if (data.success) {
        setDataStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load data stats:', error);
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col transition-colors">
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

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-8">
          
          {/* Database Section */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
                <ServerIcon className="w-5 h-5" />
                <span>Database</span>
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

          {/* Storage Section */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
                <CloudIcon className="w-5 h-5" />
                <span>File Storage</span>
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
      </div>
    </div>
  );
};

export default SettingsModal;
