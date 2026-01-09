const { app, BrowserWindow, Menu, Tray, shell, ipcMain, dialog, nativeImage } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const Store = require('electron-store');
const path = require('path');
const { spawn, exec } = require('child_process');
const http = require('http');

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// Initialize store for settings
const store = new Store({
  defaults: {
    autoUpdate: true,
    startMinimized: false,
    closeToTray: true,
    backendPort: 8000,
    autoStartBackend: true,
    checkUpdateInterval: 3600000 // 1 hour
  }
});

// Keep references to prevent garbage collection
let mainWindow = null;
let tray = null;
let dockerProcess = null;
let isQuitting = false;
let backendReady = false;

// App URLs
const BACKEND_URL = `http://localhost:${store.get('backendPort')}`;
const APP_URL = BACKEND_URL;

// ============================================
// Window Management
// ============================================

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Options Scanner',
    icon: getIconPath(),
    backgroundColor: '#18181b',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    if (!store.get('startMinimized')) {
      mainWindow.show();
    }
  });

  // Handle close to tray
  mainWindow.on('close', (event) => {
    if (!isQuitting && store.get('closeToTray')) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
    return true;
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create application menu
  createMenu();

  // Load the app
  loadApp();
}

function loadApp() {
  if (backendReady) {
    mainWindow.loadURL(APP_URL);
  } else {
    // Show loading page while backend starts
    mainWindow.loadFile(path.join(__dirname, 'loading.html'));
  }
}

function getIconPath() {
  const iconName = process.platform === 'win32' ? 'icon.ico' : 
                   process.platform === 'darwin' ? 'icon.icns' : 'icon.png';
  return path.join(__dirname, '..', 'assets', iconName);
}

// ============================================
// System Tray
// ============================================

function createTray() {
  const iconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Options Scanner',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Check for Updates',
      click: () => checkForUpdates(true)
    },
    { type: 'separator' },
    {
      label: 'Backend Status',
      sublabel: backendReady ? 'Running' : 'Starting...',
      enabled: false
    },
    {
      label: 'Restart Backend',
      click: () => restartBackend()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Options Scanner');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ============================================
// Application Menu
// ============================================

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Refresh',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow?.reload()
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => openSettings()
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
          click: () => {
            isQuitting = true;
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
        { role: 'selectAll' }
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
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => checkForUpdates(true)
        },
        { type: 'separator' },
        {
          label: 'View Logs',
          click: () => shell.openPath(log.transports.file.getFile().path)
        },
        {
          label: 'Open Data Folder',
          click: () => shell.openPath(app.getPath('userData'))
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => showAbout()
        }
      ]
    }
  ];

  // macOS specific menu
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Check for Updates',
          click: () => checkForUpdates(true)
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function openSettings() {
  // Create settings window
  const settingsWindow = new BrowserWindow({
    width: 500,
    height: 400,
    parent: mainWindow,
    modal: true,
    resizable: false,
    title: 'Settings',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
}

function showAbout() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About Options Scanner',
    message: 'Options Scanner',
    detail: `Version: ${app.getVersion()}\n\nA comprehensive options analysis and paper trading application.\n\n© 2024 Options Scanner`
  });
}

// ============================================
// Backend Management
// ============================================

async function startBackend() {
  log.info('Starting backend...');

  // Check if Docker is available
  const dockerAvailable = await checkDocker();
  
  if (!dockerAvailable) {
    log.error('Docker is not available');
    dialog.showErrorBox(
      'Docker Required',
      'Docker Desktop must be installed and running to use Options Scanner.\n\nPlease install Docker Desktop and restart the application.'
    );
    return false;
  }

  // Get resources path
  const resourcesPath = process.resourcesPath || path.join(__dirname, '..', '..');
  const dockerComposePath = path.join(resourcesPath, 'docker-compose.yml');

  // Start docker-compose
  return new Promise((resolve) => {
    const args = ['-f', dockerComposePath, 'up', '-d'];
    
    dockerProcess = spawn('docker-compose', args, {
      cwd: resourcesPath,
      shell: true
    });

    dockerProcess.stdout.on('data', (data) => {
      log.info(`Docker: ${data}`);
    });

    dockerProcess.stderr.on('data', (data) => {
      log.info(`Docker: ${data}`);
    });

    dockerProcess.on('close', (code) => {
      if (code === 0) {
        log.info('Docker containers started');
        waitForBackend().then(() => {
          backendReady = true;
          if (mainWindow) {
            mainWindow.loadURL(APP_URL);
          }
          resolve(true);
        });
      } else {
        log.error(`Docker failed with code ${code}`);
        resolve(false);
      }
    });
  });
}

async function stopBackend() {
  log.info('Stopping backend...');
  
  return new Promise((resolve) => {
    exec('docker-compose down', (error) => {
      if (error) {
        log.error('Error stopping Docker:', error);
      }
      resolve();
    });
  });
}

async function restartBackend() {
  backendReady = false;
  if (mainWindow) {
    mainWindow.loadFile(path.join(__dirname, 'loading.html'));
  }
  await stopBackend();
  await startBackend();
}

function checkDocker() {
  return new Promise((resolve) => {
    exec('docker info', (error) => {
      resolve(!error);
    });
  });
}

function waitForBackend(maxAttempts = 30, interval = 2000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const check = () => {
      attempts++;
      
      http.get(`${BACKEND_URL}/api/`, (res) => {
        if (res.statusCode === 200) {
          log.info('Backend is ready');
          resolve(true);
        } else {
          retry();
        }
      }).on('error', () => {
        retry();
      });
    };

    const retry = () => {
      if (attempts >= maxAttempts) {
        log.error('Backend did not start in time');
        reject(new Error('Backend timeout'));
      } else {
        setTimeout(check, interval);
      }
    };

    check();
  });
}

// ============================================
// Auto Update
// ============================================

function setupAutoUpdater() {
  // Configure auto updater
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for updates...');
    sendStatusToWindow('checking-for-update');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version);
    sendStatusToWindow('update-available', info);

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) is available.`,
      detail: 'Would you like to download and install it now?',
      buttons: ['Download', 'Later'],
      defaultId: 0
    }).then(({ response }) => {
      if (response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('No updates available');
    sendStatusToWindow('update-not-available', info);
  });

  autoUpdater.on('download-progress', (progress) => {
    log.info(`Download progress: ${progress.percent.toFixed(1)}%`);
    sendStatusToWindow('download-progress', progress);
    
    if (mainWindow) {
      mainWindow.setProgressBar(progress.percent / 100);
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info.version);
    sendStatusToWindow('update-downloaded', info);
    
    if (mainWindow) {
      mainWindow.setProgressBar(-1);
    }

    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update has been downloaded.',
      detail: 'The application will restart to install the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0
    }).then(({ response }) => {
      if (response === 0) {
        isQuitting = true;
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (error) => {
    log.error('Update error:', error);
    sendStatusToWindow('update-error', error.message);
  });

  // Check for updates on startup
  if (store.get('autoUpdate')) {
    setTimeout(() => checkForUpdates(false), 5000);

    // Periodic update checks
    setInterval(() => {
      if (store.get('autoUpdate')) {
        checkForUpdates(false);
      }
    }, store.get('checkUpdateInterval'));
  }
}

function checkForUpdates(showNoUpdate = false) {
  autoUpdater.checkForUpdates().then((result) => {
    if (showNoUpdate && !result?.updateInfo?.version) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'No Updates',
        message: 'You are running the latest version.',
        detail: `Current version: ${app.getVersion()}`
      });
    }
  }).catch((error) => {
    log.error('Update check failed:', error);
    if (showNoUpdate) {
      dialog.showErrorBox('Update Error', 'Failed to check for updates. Please try again later.');
    }
  });
}

function sendStatusToWindow(status, data = null) {
  if (mainWindow) {
    mainWindow.webContents.send('update-status', { status, data });
  }
}

// ============================================
// IPC Handlers
// ============================================

function setupIPC() {
  ipcMain.handle('get-settings', () => {
    return store.store;
  });

  ipcMain.handle('set-setting', (event, key, value) => {
    store.set(key, value);
    return true;
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  ipcMain.handle('check-updates', () => {
    checkForUpdates(true);
  });

  ipcMain.handle('restart-backend', async () => {
    await restartBackend();
  });

  ipcMain.handle('get-backend-status', () => {
    return backendReady;
  });
}

// ============================================
// App Lifecycle
// ============================================

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.on('ready', async () => {
  log.info('App starting...');
  
  createWindow();
  createTray();
  setupIPC();
  setupAutoUpdater();

  if (store.get('autoStartBackend')) {
    startBackend();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', async () => {
  isQuitting = true;
  await stopBackend();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  log.error('Unhandled rejection:', error);
});
