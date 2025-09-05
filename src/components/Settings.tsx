import React, { useState, useEffect } from 'react';
import { 
  User, Settings as SettingsIcon, Shield, Download, Upload, 
  Trash2, Users, Moon, Sun, Monitor, Save, AlertCircle, CheckCircle, Wifi, WifiOff,
  RefreshCw, Cloud, Database, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDatabase } from '../hooks/useDatabase';
import { db } from '../services/database';
import { firebaseSync } from '../services/firebaseSync';
import { format } from 'date-fns';

const Settings: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { 
    clientAccessRequests, 
    updateClientAccessRequest 
  } = useDatabase();
  const [activeTab, setActiveTab] = useState('profile');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [syncStatus, setSyncStatus] = useState<{ lastSync: Date | null; isOnline: boolean; queueLength: number }>({
    lastSync: null,
    isOnline: navigator.onLine,
    queueLength: 0
  });
  const [syncing, setSyncing] = useState(false);

  // Profile settings
  const [profileData, setProfileData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // User creation form
  const [newUserData, setNewUserData] = useState({
    username: '',
    password: '',
    role: 'admin' as 'admin' | 'employee'
  });

  // Employee creation form
  const [newEmployeeData, setNewEmployeeData] = useState({
    username: '',
    password: '',
    name: '',
    position: '',
    department: ''
  });

  useEffect(() => {
    loadUsers();
    loadSyncStatus();
    
    // Update sync status periodically
    const interval = setInterval(loadSyncStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadSyncStatus = async () => {
    try {
      const status = await firebaseSync.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  };

  const loadUsers = async () => {
    if (!isAdmin) return;
    
    try {
      const allUsers = await db.getAllUsers();
      setUsers(allUsers);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (profileData.newPassword !== profileData.confirmPassword) {
      showMessage('New passwords do not match', 'error');
      return;
    }

    if (profileData.newPassword.length < 6) {
      showMessage('Password must be at least 6 characters long', 'error');
      return;
    }

    try {
      setLoading(true);
      
      // Verify current password
      const currentUser = await db.getUserByUsername(user!.username);
      if (!currentUser || currentUser.password !== profileData.currentPassword) {
        showMessage('Current password is incorrect', 'error');
        return;
      }

      // Update password
      const updatedUser = { ...currentUser, password: profileData.newPassword };
      await db.updateUser(updatedUser);

      setProfileData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showMessage('Password updated successfully!', 'success');
    } catch (error) {
      console.error('Error updating password:', error);
      showMessage('Error updating password', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newUserData.password.length < 6) {
      showMessage('Password must be at least 6 characters long', 'error');
      return;
    }

    // Check admin limit
    const adminCount = users.filter(u => u.role === 'admin').length;
    if (newUserData.role === 'admin' && adminCount >= 2) {
      showMessage('Maximum number of admin accounts (2) reached', 'error');
      return;
    }

    try {
      setLoading(true);
      
      // Check if username already exists
      const existingUser = await db.getUserByUsername(newUserData.username);
      if (existingUser) {
        showMessage('Username already exists', 'error');
        return;
      }

      // Create user
      await db.createUser({
        username: newUserData.username,
        password: newUserData.password,
        role: newUserData.role,
        createdAt: new Date(),
      });

      setNewUserData({ username: '', password: '', role: 'admin' });
      loadUsers();
      showMessage('User created successfully!', 'success');
    } catch (error) {
      console.error('Error creating user:', error);
      showMessage('Error creating user', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newEmployeeData.password.length < 6) {
      showMessage('Password must be at least 6 characters long', 'error');
      return;
    }

    try {
      setLoading(true);
      
      // Check if username already exists
      const existingUser = await db.getUserByUsername(newEmployeeData.username);
      if (existingUser) {
        showMessage('Username already exists', 'error');
        return;
      }

      // Create employee user account
      await db.createUser({
        username: newEmployeeData.username,
        password: newEmployeeData.password,
        role: 'employee',
        createdAt: new Date(),
      });

      // Also create employee record
      await db.createEmployee({
        employeeId: `EMP${Date.now()}`,
        name: newEmployeeData.name,
        email: `${newEmployeeData.username}@company.com`,
        phone: '',
        position: newEmployeeData.position,
        department: newEmployeeData.department,
        salary: 0,
        joinDate: new Date(),
        status: 'active',
        username: newEmployeeData.username,
        password: newEmployeeData.password,
        role: 'employee',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Create notification for admin about new employee account
      await db.createNotification({
        message: `New employee account created: ${newEmployeeData.name} (${newEmployeeData.username}) - Position: ${newEmployeeData.position}`,
        type: 'success',
        read: false,
        createdAt: new Date()
      });
      setNewEmployeeData({ username: '', password: '', name: '', position: '', department: '' });
      loadUsers();
      showMessage('Employee account created successfully!', 'success');
    } catch (error) {
      console.error('Error creating employee:', error);
      showMessage('Error creating employee account', 'error');
    } finally {
      setLoading(false);
    }
  };
  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
      return;
    }

    try {
      setLoading(true);
      
      // Don't allow deleting yourself
      if (userId === user!.id) {
        showMessage('You cannot delete your own account', 'error');
        return;
      }

      // Delete user
      await db.deleteUser(userId);
      loadUsers();
      showMessage('User deleted successfully!', 'success');
    } catch (error) {
      console.error('Error deleting user:', error);
      showMessage('Error deleting user', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleWipeAllData = async () => {
    if (!confirm('⚠️ CRITICAL WARNING: This will permanently delete ALL data from both local storage and Firebase.\n\nThis includes:\n• All clients and receipts\n• All expenses and employees\n• All documents and user accounts\n• All activity logs and notifications\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?')) {
      return;
    }

    const confirmText = prompt('⚠️ FINAL CONFIRMATION\n\nType exactly "WIPE ALL DATA" to confirm this destructive action:');
    if (confirmText !== 'WIPE ALL DATA') {
      showMessage('Data wipe cancelled - confirmation text did not match exactly', 'error');
      return;
    }

    try {
      setLoading(true);
      setSyncing(true);
      
      showMessage('Wiping all data... This may take a moment.', 'error');
      
      // Clear all local data
      await db.clearAllData();
      
      // Clear all Firebase data
      await firebaseSync.wipeAllData();
      
      showMessage('✅ All data wiped successfully! The page will reload in 3 seconds.', 'success');
      
      // Reload the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 3000);
      
    } catch (error) {
      console.error('Error wiping data:', error);
      showMessage('❌ Error wiping data. Please try again or contact support.', 'error');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  const handleSyncToFirebase = async () => {
    setSyncing(true);
    try {
      await firebaseSync.performFullSync();
      showMessage('Data synced to Firebase successfully!', 'success');
      await loadSyncStatus();
    } catch (error) {
      console.error('Sync to Firebase failed:', error);
      showMessage('Failed to sync to Firebase. Please try again.', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleExportData = async () => {
    try {
      setLoading(true);
      const data = await db.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `arkive-backup-${format(new Date(), 'yyyy-MM-dd-HH-mm-ss')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showMessage('Data exported successfully!', 'success');
    } catch (error) {
      console.error('Export error:', error);
      showMessage('Error exporting data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const text = await file.text();
      await db.importData(text);
      showMessage('Data imported successfully! Please refresh the page.', 'success');
      loadUsers();
    } catch (error) {
      console.error('Import error:', error);
      showMessage('Error importing data. Please check the file format.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'sync', label: 'Sync & Backup', icon: Database },
    { id: 'access-requests', label: 'Access Requests', icon: Shield, adminOnly: true },
    { id: 'users', label: 'User Management', icon: Users, adminOnly: true },
    { id: 'employees', label: 'Employee Accounts', icon: Users, adminOnly: true },
    { id: 'advanced', label: 'Advanced', icon: SettingsIcon, adminOnly: true },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <SettingsIcon className="w-7 h-7 text-blue-600" />
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your account and application preferences
          </p>
        </div>
        
        {/* Connection Status */}
        <div className="flex items-center gap-2 text-sm">
          {syncStatus.isOnline ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-red-500" />
          )}
          <span className={syncStatus.isOnline ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
            {syncStatus.isOnline ? 'Online' : 'Offline'}
          </span>
          {syncStatus.queueLength > 0 && (
            <span className="text-orange-600 dark:text-orange-400">
              ({syncStatus.queueLength} pending)
            </span>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
        } animate-slideInRight`}>
          <div className="flex items-center">
            {message.type === 'success' ? <CheckCircle className="w-5 h-5 mr-2" /> : <AlertCircle className="w-5 h-5 mr-2" />}
            {message.text}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              if (tab.adminOnly && !isAdmin) return null;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Client Access Requests Tab */}
        {activeTab === 'access-requests' && isAdmin && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Client Credential Requests</h3>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {clientAccessRequests.filter(r => r.status === 'pending').length} pending requests
              </div>
            </div>

            {/* Pending Requests */}
            <div className="space-y-4">
              {clientAccessRequests.filter(r => r.status === 'pending').map((request) => (
                <div key={request.id} className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {request.employeeName}
                        </h4>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          requesting client credentials
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <p className="text-gray-700 dark:text-gray-300">
                          <span className="font-medium">Reason:</span> {request.reason}
                        </p>
                        <p className="text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Requested:</span> {format(request.requestedAt, 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={async () => {
                          try {
                            const updatedRequest = { ...request, status: 'approved' as const, respondedAt: new Date(), respondedBy: user!.id };
                            await updateClientAccessRequest(updatedRequest);
                            
                            // Create notification for employee
                            await db.createNotification({
                              message: `✅ Your client credential request has been approved by ${user!.username}`,
                              type: 'success',
                              read: false,
                              createdAt: new Date()
                            });
                            
                            showMessage('Request approved successfully!', 'success');
                          } catch (error) {
                            console.error('Error approving request:', error);
                            showMessage('Error approving request', 'error');
                          }
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                      >
                        Approve
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const updatedRequest = { ...request, status: 'denied' as const, respondedAt: new Date(), respondedBy: user!.id };
                            await updateClientAccessRequest(updatedRequest);
                            
                            // Create notification for employee
                            await db.createNotification({
                              message: `❌ Your client credential request has been denied by ${user!.username}`,
                              type: 'warning',
                              read: false,
                              createdAt: new Date()
                            });
                            
                            showMessage('Request denied successfully!', 'success');
                          } catch (error) {
                            console.error('Error denying request:', error);
                            showMessage('Error denying request', 'error');
                          }
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                      >
                        Deny
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              {clientAccessRequests.filter(r => r.status === 'pending').length === 0 && (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No pending credential requests</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    Employee credential requests will appear here for approval
                  </p>
                </div>
              )}
            </div>

            {/* Request History */}
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Recent Request History</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {clientAccessRequests
                  .filter(r => r.status !== 'pending')
                  .slice(0, 5)
                  .map((request) => (
                    <div key={request.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700 dark:text-gray-300">
                        {request.employeeName}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        request.status === 'approved' 
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                          : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                      }`}>
                        {request.status}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        <div className="p-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Profile Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      value={user?.username || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Role
                    </label>
                    <input
                      type="text"
                      value={user?.role || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white capitalize"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Change Password</h3>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={profileData.currentPassword}
                      onChange={(e) => setProfileData({ ...profileData, currentPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={profileData.newPassword}
                      onChange={(e) => setProfileData({ ...profileData, newPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                      minLength={6}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={profileData.confirmPassword}
                      onChange={(e) => setProfileData({ ...profileData, confirmPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                      minLength={6}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Save size={16} />
                    {loading ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Sync & Backup Tab */}
          {activeTab === 'sync' && (
            <div className="space-y-6">
              {/* Sync Status */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Sync Status
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3">
                    {syncStatus.isOnline ? (
                      <Wifi className="w-5 h-5 text-green-500" />
                    ) : (
                      <WifiOff className="w-5 h-5 text-red-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {syncStatus.isOnline ? 'Online' : 'Offline'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Connection Status
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Cloud className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {syncStatus.lastSync ? format(syncStatus.lastSync, 'MMM dd, hh:mm a') : 'Never'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Last Sync
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 text-orange-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {syncStatus.queueLength}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Pending Changes
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Firebase Sync Controls */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Firebase Sync
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={handleSyncToFirebase}
                    disabled={syncing || !syncStatus.isOnline}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {syncing ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Upload className="w-5 h-5" />
                    )}
                    {syncing ? 'Syncing...' : 'Force Sync Now'}
                  </button>
                  
                  <button
                    onClick={handleExportData}
                    disabled={loading}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <Download className="w-5 h-5" />
                    {loading ? 'Exporting...' : 'Export Backup'}
                  </button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                  Sync your data with Firebase for real-time collaboration across devices.
                </p>
              </div>

              {/* Backup & Restore */}
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Import Data
                </h3>
                <div className="relative">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportData}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={loading}
                  />
                  <button
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Upload className="w-5 h-5" />
                    {loading ? 'Importing...' : 'Import Data from Backup'}
                  </button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                  Import data from a previously exported backup file.
                </p>
              </div>
            </div>
          )}

          {/* User Management Tab */}
          {activeTab === 'users' && isAdmin && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">User Management</h3>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {users.filter(u => u.role === 'admin').length}/2 admin accounts used
                </div>
              </div>

              {/* Create User Form */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-4">Create New Admin Account</h4>
                <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input
                    type="text"
                    value={newUserData.username}
                    onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                    placeholder="Username"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                    minLength={3}
                  />
                  <input
                    type="password"
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                    placeholder="Password"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                    minLength={6}
                  />
                  <button
                    type="submit"
                    disabled={loading || users.filter(u => u.role === 'admin').length >= 2}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save size={16} />
                    {loading ? 'Creating...' : 'Create Admin'}
                  </button>
                </form>
              </div>

              {/* Users Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Username
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Last Login
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {users.map((u, index) => (
                      <tr key={u.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-medium">
                          #{index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {u.username}
                          {u.id === user?.id && (
                            <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(You)</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            u.role === 'admin' 
                              ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                              : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {format(new Date(u.createdAt), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {u.lastLogin ? format(new Date(u.lastLogin), 'MMM dd, yyyy hh:mm a') : 'Never'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {u.id !== user?.id && (
                            <button
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors"
                              title="Delete User"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Employee Accounts Tab */}
          {activeTab === 'employees' && isAdmin && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Employee Accounts</h3>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {users.filter(u => u.role === 'employee').length} employee accounts
                </div>
              </div>

              {/* Create Employee Account Form */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 dark:text-white mb-4">Create New Employee Account</h4>
                <form onSubmit={handleCreateEmployee} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <input
                    type="text"
                    value={newEmployeeData.username}
                    onChange={(e) => setNewEmployeeData({ ...newEmployeeData, username: e.target.value })}
                    placeholder="Username"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                    minLength={3}
                  />
                  <input
                    type="password"
                    value={newEmployeeData.password}
                    onChange={(e) => setNewEmployeeData({ ...newEmployeeData, password: e.target.value })}
                    placeholder="Password"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                    minLength={6}
                  />
                  <input
                    type="text"
                    value={newEmployeeData.name}
                    onChange={(e) => setNewEmployeeData({ ...newEmployeeData, name: e.target.value })}
                    placeholder="Full Name"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                  <input
                    type="text"
                    value={newEmployeeData.position}
                    onChange={(e) => setNewEmployeeData({ ...newEmployeeData, position: e.target.value })}
                    placeholder="Position"
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save size={16} />
                    {loading ? 'Creating...' : 'Create Employee'}
                  </button>
                </form>
              </div>

              {/* Employee Accounts Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Username
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Last Login
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {users.filter(u => u.role === 'employee').map((u, index) => (
                      <tr key={u.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-medium">
                          #{index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {u.username}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                            {u.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {format(new Date(u.createdAt), 'MMM dd, yyyy')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {u.lastLogin ? format(new Date(u.lastLogin), 'MMM dd, yyyy hh:mm a') : 'Never'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => handleDeleteUser(u.id, u.username)}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors"
                            title="Delete Employee Account"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {users.filter(u => u.role === 'employee').length === 0 && (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">No employee accounts created yet</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    Create employee accounts so they can login and mark attendance
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Advanced Tab */}
          {activeTab === 'advanced' && isAdmin && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Advanced Settings</h3>
              
              {/* Danger Zone */}
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 mt-1" />
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                      Danger Zone
                    </h4>
                    <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                      This action will permanently delete ALL application data from both local storage and Firebase. 
                      This includes all clients, receipts, expenses, employees, documents, and user accounts. 
                      This action CANNOT be undone.
                    </p>
                    <button
                      onClick={handleWipeAllData}
                      disabled={loading || syncing}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                      {loading || syncing ? 'Processing...' : 'Wipe All Data'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;