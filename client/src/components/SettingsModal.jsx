import React, { useState, useEffect } from "react";
import {
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  ServerIcon,
  WifiIcon
} from "@heroicons/react/24/outline";
import { useToast } from "../context/ToastContext";
import { configAPI } from "../services/api";

const SettingsModal = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [connectionString, setConnectionString] = useState('');
  const [mongoStatus, setMongoStatus] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadMongoSettings();
      loadMongoStatus();
    }
  }, [isOpen]);

  const loadMongoSettings = async () => {
    try {
      const response = await fetch('/api/settings/mongodb', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setConnectionString(data.settings.connectionString);
          setMongoStatus(data.status);
        }
      }
    } catch (error) {
      console.error('Failed to load MongoDB settings:', error);
    }
  };

  const loadMongoStatus = async () => {
    try {
      const response = await fetch('/api/settings/mongodb/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMongoStatus(data.status);
        }
      }
    } catch (error) {
      console.error('Failed to load MongoDB status:', error);
    }
  };

  const testConnection = async () => {
    if (!connectionString.trim()) {
      showToast('Please enter a connection string', 'error');
      return;
    }

    setLoading(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/settings/mongodb/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          connectionString: connectionString.trim(),
          options: {
            useNewUrlParser: true,
            useUnifiedTopology: true
          }
        })
      });

      const data = await response.json();
      setTestResult(data);
      
      if (data.success) {
        showToast('Connection test successful!', 'success');
      } else {
        showToast(`Connection test failed: ${data.message}`, 'error');
      }
    } catch (error) {
      setTestResult({ success: false, message: error.message });
      showToast('Connection test failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!connectionString.trim()) {
      showToast('Please enter a connection string', 'error');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/settings/mongodb', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          connectionString: connectionString.trim(),
          options: {
            useNewUrlParser: true,
            useUnifiedTopology: true
          }
        })
      });

      const data = await response.json();
      
      if (data.success) {
        showToast('MongoDB settings saved successfully', 'success');
      } else {
        showToast(`Failed to save settings: ${data.error}`, 'error');
      }
    } catch (error) {
      showToast('Failed to save settings', 'error');
    } finally {
      setLoading(false);
    }
  };

  const connectToMongo = async () => {
    if (!connectionString.trim()) {
      showToast('Please enter a connection string', 'error');
      return;
    }

    setIsConnecting(true);

    try {
      const response = await fetch('/api/settings/mongodb/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          connectionString: connectionString.trim(),
          options: {
            useNewUrlParser: true,
            useUnifiedTopology: true
          }
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setMongoStatus(data.status);
        showToast('Connected to MongoDB successfully', 'success');
      } else {
        showToast(`Failed to connect: ${data.error}`, 'error');
      }
    } catch (error) {
      showToast('Failed to connect to MongoDB', 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectFromMongo = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/settings/mongodb/disconnect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      
      if (data.success) {
        setMongoStatus(data.status);
        showToast('Disconnected from MongoDB', 'success');
      } else {
        showToast(`Failed to disconnect: ${data.error}`, 'error');
      }
    } catch (error) {
      showToast('Failed to disconnect from MongoDB', 'error');
    } finally {
      setLoading(false);
    }
  };

  const migrateData = async () => {
    if (!connectionString.trim()) {
      showToast('Please enter a connection string first', 'error');
      return;
    }

    if (!window.confirm('This will migrate all data from SQLite to MongoDB. This operation cannot be undone. Continue?')) {
      return;
    }

    setIsMigrating(true);
    setMigrationStatus(null);

    try {
      const response = await fetch('/api/settings/mongodb/migrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          connectionString: connectionString.trim()
        })
      });

      const data = await response.json();
      setMigrationStatus(data);
      
      if (data.success) {
        showToast(`Migration completed! ${data.stats?.users || 0} users and ${data.stats?.configurations || 0} configurations migrated`, 'success');
      } else {
        showToast(`Migration failed: ${data.error}`, 'error');
      }
    } catch (error) {
      setMigrationStatus({ success: false, error: error.message });
      showToast('Migration failed', 'error');
    } finally {
      setIsMigrating(false);
    }
  };

  const migrateToEmbedded = async () => {
    if (!window.confirm('This will migrate all data from SQLite to embedded MongoDB and switch the system to use MongoDB. This operation creates a backup. Continue?')) {
      return;
    }

    setIsMigrating(true);
    setMigrationStatus(null);

    try {
      const response = await fetch('/api/settings/mongodb/migrate-embedded', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      setMigrationStatus(data);

      if (data.success) {
        showToast(`Migration to embedded MongoDB completed! ${data.stats?.users || 0} users and ${data.stats?.configurations || 0} configurations migrated. Please restart the server.`, 'success');
      } else {
        showToast(`Migration failed: ${data.error}`, 'error');
      }
    } catch (error) {
      setMigrationStatus({ success: false, error: error.message });
      showToast('Migration failed', 'error');
    } finally {
      setIsMigrating(false);
    }
  };

  if (!isOpen) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected': return 'text-green-600';
      case 'connecting': return 'text-yellow-600';
      case 'disconnecting': return 'text-orange-600';
      case 'disconnected': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected': return <WifiIcon className="w-5 h-5 text-green-600" />;
      case 'connecting': return <ArrowPathIcon className="w-5 h-5 text-yellow-600 animate-spin" />;
      case 'disconnecting': return <ArrowPathIcon className="w-5 h-5 text-orange-600 animate-spin" />;
      default: return <ServerIcon className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Database Settings</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          
          {/* MongoDB Status */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              {getStatusIcon(mongoStatus?.status)}
              <div>
                <h3 className="font-medium text-gray-900">MongoDB Status</h3>
                <p className={`text-sm ${getStatusColor(mongoStatus?.status)}`}>
                  {mongoStatus?.status ? mongoStatus.status.charAt(0).toUpperCase() + mongoStatus.status.slice(1) : 'Unknown'}
                  {mongoStatus?.host && ` - ${mongoStatus.host}/${mongoStatus.name}`}
                </p>
              </div>
            </div>
          </div>

          {/* Connection String Input */}
          <div>
            <label htmlFor="connectionString" className="block text-sm font-medium text-gray-700 mb-2">
              MongoDB Connection String
            </label>
            <input
              type="text"
              id="connectionString"
              value={connectionString}
              onChange={(e) => setConnectionString(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="mongodb://localhost:27017/config_manager"
            />
            <p className="mt-2 text-sm text-gray-600">
              Example: mongodb://username:password@localhost:27017/config_manager
            </p>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={`rounded-lg p-4 ${testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-start space-x-3">
                {testResult.success ? (
                  <CheckCircleIcon className="w-5 h-5 text-green-600 mt-0.5" />
                ) : (
                  <ExclamationCircleIcon className="w-5 h-5 text-red-600 mt-0.5" />
                )}
                <div>
                  <h4 className={`font-medium ${testResult.success ? 'text-green-900' : 'text-red-900'}`}>
                    Connection Test {testResult.success ? 'Successful' : 'Failed'}
                  </h4>
                  <p className={`text-sm mt-1 ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                    {testResult.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Migration Status */}
          {migrationStatus && (
            <div className={`rounded-lg p-4 ${migrationStatus.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-start space-x-3">
                {migrationStatus.success ? (
                  <CheckCircleIcon className="w-5 h-5 text-green-600 mt-0.5" />
                ) : (
                  <ExclamationCircleIcon className="w-5 h-5 text-red-600 mt-0.5" />
                )}
                <div>
                  <h4 className={`font-medium ${migrationStatus.success ? 'text-green-900' : 'text-red-900'}`}>
                    Migration {migrationStatus.success ? 'Successful' : 'Failed'}
                  </h4>
                  <p className={`text-sm mt-1 ${migrationStatus.success ? 'text-green-700' : 'text-red-700'}`}>
                    {migrationStatus.message}
                    {migrationStatus.stats && (
                      ` - ${migrationStatus.stats.users} users and ${migrationStatus.stats.configurations} configurations migrated`
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={testConnection}
              disabled={loading || !connectionString.trim()}
              className="btn-secondary flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircleIcon className="w-4 h-4" />
              )}
              <span>Test Connection</span>
            </button>

            <button
              onClick={saveSettings}
              disabled={loading || !connectionString.trim()}
              className="btn-primary flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>Save Settings</span>
            </button>

            {mongoStatus?.status === 'connected' ? (
              <button
                onClick={disconnectFromMongo}
                disabled={loading}
                className="btn-secondary flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <span>Disconnect</span>
              </button>
            ) : (
              <button
                onClick={connectToMongo}
                disabled={isConnecting || !connectionString.trim()}
                className="btn-primary flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isConnecting ? (
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <WifiIcon className="w-4 h-4" />
                )}
                <span>Connect</span>
              </button>
            )}

            <button
              onClick={migrateData}
              disabled={isMigrating || !connectionString.trim()}
              className="bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isMigrating ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowPathIcon className="w-4 h-4" />
              )}
              <span>Migrate to External MongoDB</span>
            </button>

            <button
              onClick={migrateToEmbedded}
              disabled={isMigrating}
              className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {isMigrating ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <ServerIcon className="w-4 h-4" />
              )}
              <span>Migrate to Embedded MongoDB</span>
            </button>
          </div>

          {/* Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Migration Options</h4>
            <div className="space-y-3 text-sm text-blue-700">
              <div>
                <strong>Embedded MongoDB (Recommended):</strong>
                <ul className="ml-4 mt-1 space-y-1">
                  <li>• Automatic setup - no external MongoDB needed</li>
                  <li>• Embedded server starts/stops with the application</li>
                  <li>• Perfect for development and single-server deployments</li>
                  <li>• Creates automatic backup before migration</li>
                </ul>
              </div>
              <div>
                <strong>External MongoDB:</strong>
                <ul className="ml-4 mt-1 space-y-1">
                  <li>• Connect to your own MongoDB server</li>
                  <li>• Suitable for production and cluster deployments</li>
                  <li>• Test connection before migrating</li>
                  <li>• Existing MongoDB data will be cleared before migration</li>
                </ul>
              </div>
              <div className="pt-2 border-t border-blue-200">
                <strong>⚠️ Important:</strong> All migrations create backups for safety
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
