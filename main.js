const { app, BrowserWindow, globalShortcut, ipcMain, desktopCapturer, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

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

// Window tracking IPC handlers

// Return serializable source list (id + name only; NativeImage thumbnail is not IPC-safe)
ipcMain.handle('get-desktop-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 1, height: 1 }, // minimal thumbnail — we only need id/name
  });
  return sources.map(s => ({ id: s.id, name: s.name }));
});

// Show a folder-picker dialog and return the chosen path (or null if cancelled)
ipcMain.handle('choose-save-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose folder for game session recordings',
    defaultPath: path.join(app.getPath('documents'), 'ptcgl-captures'),
    properties: ['openDirectory', 'createDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

// Create a timestamped session sub-folder inside the user-chosen base directory
ipcMain.handle('create-tracking-session', (event, baseDir) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const capturesDir = path.join(baseDir, timestamp);
  fs.mkdirSync(capturesDir, { recursive: true });
  return capturesDir;
});

// Remove an empty session folder if capture was aborted before it started
ipcMain.handle('remove-tracking-session', (event, sessionDir) => {
  try {
    fs.rmdirSync(sessionDir); // only removes if empty
  } catch (_) { /* ignore — folder may not exist or may already have frames */ }
});

// Save a single PNG frame to the session folder
ipcMain.handle('save-frame', (event, { sessionDir, frameIndex, dataUrl }) => {
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
  const filename = `frame_${String(frameIndex).padStart(6, '0')}.png`;
  const filepath = path.join(sessionDir, filename);
  fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));
  return filepath;
});
