const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let isVisible = true;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 800,
    x: 20,
    y: 20,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile('index.html');

  // Set always on top with 'screen-saver' level to persist over fullscreen games
  // This is necessary because the basic alwaysOnTop option doesn't work with
  // exclusive fullscreen applications like Pokemon TCG Live
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  // Optional: Open DevTools for debugging
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  // Register global hotkey to toggle visibility (Ctrl+Shift+D)
  globalShortcut.register('CommandOrControl+Shift+D', () => {
    if (mainWindow) {
      isVisible = !isVisible;
      if (isVisible) {
        mainWindow.show();
        // Re-apply screen-saver level to ensure it stays on top of fullscreen games
        mainWindow.setAlwaysOnTop(true, 'screen-saver');
      } else {
        mainWindow.hide();
      }
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});

// IPC handlers for renderer process
ipcMain.on('minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on('close', () => {
  app.quit();
});
