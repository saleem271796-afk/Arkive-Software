const path = require('path');
const fs = require('fs');

// Enhanced error logging
const logPath = path.join(__dirname, 'arkive-error-log.txt');
const logError = (error, context = '') => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${context}: ${error.stack || error}\n`;
  try {
    fs.appendFileSync(logPath, logEntry);
  } catch (e) {
    console.error('Failed to write to log file:', e);
  }
};

process.on('uncaughtException', (err) => {
  logError(err, 'UNCAUGHT_EXCEPTION');
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  logError(reason, 'UNHANDLED_REJECTION');
  console.error('Unhandled Rejection:', reason);
});

const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const isDev = process.env.NODE_ENV === 'development';

// Enable live reload for development
if (isDev) {
  try {
    require('electron-reload')(__dirname, {
      electron: path.join(__dirname, '..', 'node_modules', '.bin', 'electron'),
      hardResetMethod: 'exit'
    });
  } catch (e) {
    console.log('Electron reload not available');
  }
}

function createWindow() {
  // Create the browser window with enhanced settings
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 700,
    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,
    fullscreenable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      zoomFactor: 1.0,
      webgl: false,
      plugins: false,
      javascript: true,
      images: true,
      textAreasAreResizable: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: !isDev,
    show: false,
    backgroundColor: '#1f2937',
    title: 'Arkive - Tax Management System',
    center: true,
    frame: true,
    transparent: false,
    hasShadow: true,
    thickFrame: true,
    roundedCorners: true
  });

  // Window event handlers
  mainWindow.webContents.once('dom-ready', () => {
    mainWindow.webContents.setZoomFactor(1.0);
    
    // Inject custom CSS for better .exe experience
    mainWindow.webContents.insertCSS(`
      /* Fix blurriness in Electron */
      * {
        -webkit-font-smoothing: antialiased !important;
        -moz-osx-font-smoothing: grayscale !important;
        text-rendering: optimizeLegibility !important;
        font-smooth: always !important;
        -webkit-transform: translateZ(0) !important;
        transform: translateZ(0) !important;
        backface-visibility: hidden !important;
        perspective: 1000px !important;
      }
      
      /* Force hardware acceleration */
      body, #root {
        -webkit-transform: translate3d(0, 0, 0) !important;
        transform: translate3d(0, 0, 0) !important;
        will-change: transform !important;
      }
      
      /* Disable subpixel rendering issues */
      .app-content {
        -webkit-transform: scale(0.9) translateZ(0) !important;
        transform: scale(0.9) translateZ(0) !important;
        transform-origin: top left !important;
        width: 111% !important;
        height: 111% !important;
        image-rendering: -webkit-optimize-contrast !important;
        image-rendering: crisp-edges !important;
      }
      
      /* Enhanced scrollbars for Windows */
      ::-webkit-scrollbar {
        width: 12px;
        height: 12px;
      }
      
      ::-webkit-scrollbar-track {
        background: #f1f5f9;
        border-radius: 6px;
      }
      
      ::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, #cbd5e1, #94a3b8);
        border-radius: 6px;
        border: 2px solid #f1f5f9;
      }
      
      ::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(180deg, #94a3b8, #64748b);
      }
      
      /* Better text rendering */
      * {
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      
      /* Enhanced window controls */
      .titlebar {
        -webkit-app-region: drag;
      }
      
      .titlebar button {
        -webkit-app-region: no-drag;
      }
    `);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
    
    // Focus the window
    mainWindow.focus();
    
    // Set minimum size after showing
    mainWindow.setMinimumSize(1200, 700);
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    app.quit();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Prevent navigation to external sites
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    if (parsedUrl.origin !== 'http://localhost:5173' && !navigationUrl.includes('file://')) {
      event.preventDefault();
    }
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      logError(new Error(`Index file not found: ${indexPath}`), 'LOAD_FILE');
      
      // Show error dialog
      dialog.showErrorBox(
        'Application Error',
        'Failed to load the application. Please reinstall Arkive.'
      );
      
      app.quit();
    }
  }

  // Enhanced menu template
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Receipt',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-action', 'new-receipt');
          }
        },
        {
          label: 'New Client',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            mainWindow.webContents.send('menu-action', 'new-client');
          }
        },
        {
          label: 'New Expense',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            mainWindow.webContents.send('menu-action', 'new-expense');
          }
        },
        { type: 'separator' },
        {
          label: 'Export Data',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => {
            mainWindow.webContents.send('menu-action', 'export-data');
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Navigate',
      submenu: [
        {
          label: 'Dashboard',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            mainWindow.webContents.send('menu-action', 'navigate-dashboard');
          }
        },
        {
          label: 'Receipts',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            mainWindow.webContents.send('menu-action', 'navigate-receipts');
          }
        },
        {
          label: 'Clients',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            mainWindow.webContents.send('menu-action', 'navigate-clients');
          }
        },
        {
          label: 'Employees',
          accelerator: 'CmdOrCtrl+4',
          click: () => {
            mainWindow.webContents.send('menu-action', 'navigate-employees');
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
        ...(process.platform === 'darwin' ? [
          { type: 'separator' },
          { role: 'front' }
        ] : [])
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Arkive',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Arkive',
              message: 'Arkive Tax Management System',
              detail: 'Version 1.0.0\nA comprehensive tax office management solution with real-time Firebase synchronization.\n\nBuilt with React, TypeScript, and Electron.',
              buttons: ['OK']
            });
          }
        },
        {
          label: 'Keyboard Shortcuts',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Keyboard Shortcuts',
              message: 'Arkive Keyboard Shortcuts',
              detail: 'Ctrl+N - New Receipt\nCtrl+Shift+C - New Client\nCtrl+E - New Expense\nCtrl+Shift+E - Export Data\nCtrl+1-4 - Navigate Pages\nF11 - Toggle Fullscreen\nCtrl+R - Reload\nF12 - Developer Tools',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  // Set application menu
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  // Handle app updates and notifications
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Arkive loaded successfully');
  });

  // Handle crashes
  mainWindow.webContents.on('crashed', (event) => {
    logError(new Error('Renderer process crashed'), 'RENDERER_CRASH');
    
    const options = {
      type: 'error',
      title: 'Application Crashed',
      message: 'Arkive has crashed unexpectedly.',
      detail: 'Would you like to restart the application?',
      buttons: ['Restart', 'Close']
    };
    
    dialog.showMessageBox(mainWindow, options).then((result) => {
      if (result.response === 0) {
        mainWindow.reload();
      } else {
        app.quit();
      }
    });
  });

  return mainWindow;
}

// App event handlers
app.whenReady().then(() => {
  createWindow();
  
  // Set app user model ID for Windows
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.arkive.taxmanagement');
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});

// Handle certificate errors
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  if (isDev) {
    // In development, ignore certificate errors
    event.preventDefault();
    callback(true);
  } else {
    // In production, use default behavior
    callback(false);
  }
});

// Prevent navigation to external URLs
app.on('web-contents-created', (event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    if (parsedUrl.origin !== 'http://localhost:5173' && !navigationUrl.includes('file://')) {
      event.preventDefault();
    }
  });
});

// Handle app protocol for deep linking (future feature)
if (!isDev) {
  app.setAsDefaultProtocolClient('arkive');
}

// Optimize memory usage
app.commandLine.appendSwitch('--max-old-space-size', '4096');
app.commandLine.appendSwitch('--js-flags', '--max-old-space-size=4096');

console.log('🚀 Arkive Tax Management System starting...');