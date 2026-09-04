const { app, BrowserWindow } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const PORT = process.env.PORT || '4000';
let mainWindow;

// server.js is an ESM module (see server/package.json "type": "module"), so it's
// loaded with a dynamic import() rather than require(). It exports a `ready`
// promise that resolves once app.listen()'s callback has actually fired, so we
// never race the window load against a backend that isn't listening yet.
async function startBackend() {
  process.env.PORT = PORT;
  const serverEntry = path.join(__dirname, 'server', 'server.js');
  const mod = await import(pathToFileURL(serverEntry).href);
  await mod.ready;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 375,
    minHeight: 640,
    title: 'CineBook',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL(`http://localhost:${PORT}/`);
}

app.whenReady().then(async () => {
  try {
    await startBackend();
  } catch (err) {
    // Surface backend startup failures in a window instead of a silent blank app.
    console.error('CineBook backend failed to start:', err);
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
