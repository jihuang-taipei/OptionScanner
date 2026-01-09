const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),
  
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // Updates
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, data) => callback(data));
  },
  
  // Backend
  restartBackend: () => ipcRenderer.invoke('restart-backend'),
  getBackendStatus: () => ipcRenderer.invoke('get-backend-status'),
  
  // Platform info
  platform: process.platform,
  isElectron: true
});
