const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Menu actions
  onMenuAction: (callback) => {
    ipcRenderer.on('menu-action', (event, action) => {
      callback(action);
    });
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  // App information
  getAppVersion: () => {
    return process.env.npm_package_version || '1.0.0';
  },
  
  // Platform information
  getPlatform: () => {
    return process.platform;
  },
  
  // Window controls
  minimizeWindow: () => {
    ipcRenderer.send('window-minimize');
  },
  
  maximizeWindow: () => {
    ipcRenderer.send('window-maximize');
  },
  
  closeWindow: () => {
    ipcRenderer.send('window-close');
  },
  
  // File operations
  showSaveDialog: (options) => {
    return ipcRenderer.invoke('show-save-dialog', options);
  },
  
  showOpenDialog: (options) => {
    return ipcRenderer.invoke('show-open-dialog', options);
  },
  
  // Notifications
  showNotification: (title, body) => {
    return ipcRenderer.invoke('show-notification', { title, body });
  }
});

// Enhanced error handling
window.addEventListener('error', (event) => {
  console.error('Renderer Error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled Promise Rejection:', event.reason);
});

// Log when preload script loads
console.log('✅ Arkive preload script loaded successfully');