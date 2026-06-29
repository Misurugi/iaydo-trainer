const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs   = require('fs');

// Writable user data dir (works on both Windows and macOS packaged apps)
const userData = app.getPath('userData');
fs.mkdirSync(userData, { recursive: true });

// Copy bundled questions.json on first run
const srcQ = path.join(__dirname, 'data', 'questions.json');
const dstQ = path.join(userData, 'questions.json');
if (!fs.existsSync(dstQ) && fs.existsSync(srcQ)) {
  fs.copyFileSync(srcQ, dstQ);
}

process.env.IAYDO_DATA_DIR   = userData;
process.env.IAYDO_STATIC_DIR = path.join(__dirname, 'static');

const { server } = require('./server');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1100,
    height: 820,
    title: 'Иайдо — Тренажёр',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  win.setMenuBarVisibility(false);
  win.loadURL('http://localhost:5000');
  win.on('closed', () => { win = null; });
}

app.whenReady().then(() => {
  if (server.listening) createWindow();
  else server.once('listening', createWindow);
});

app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!win) createWindow(); }); // macOS dock click
