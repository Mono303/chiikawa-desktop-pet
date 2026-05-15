const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let win;

function createWindow() {
  const { screen } = require('electron');
  const workArea = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: 200,
    height: 200,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
    win.setPosition(
      Math.round((workArea.width - 200) / 2),
      Math.round((workArea.height - 200) / 2)
    );
  });

  // Right-click context menu to quit
  const ctxMenu = Menu.buildFromTemplate([
    { label: '位置重置', click: () => win.setPosition(
      Math.round((workArea.width - 200) / 2),
      Math.round((workArea.height - 200) / 2)
    )},
    { type: 'separator' },
    { label: '退出', click: () => app.quit() }
  ]);

  ipcMain.on('show-context-menu', () => ctxMenu.popup({ window: win }));
}

// ---- System tray icon ----
let tray = null;

function createTray() {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4); // BGRA
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - (size - 1) / 2;
      const dy = y - (size - 1) / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const i = (y * size + x) * 4;
      if (dist < size / 2) {
        buf[i] = 0x00;     // B
        buf[i + 1] = 0xcc; // G
        buf[i + 2] = 0x4a; // R
        buf[i + 3] = 0xff; // A
      } else {
        buf[i + 3] = 0;    // transparent
      }
    }
  }

  tray = new Tray(nativeImage.createFromBitmap(buf, { width: size, height: size }));
  tray.setToolTip('吉伊桌宠 — 运行中');

  const trayMenu = Menu.buildFromTemplate([
    { label: '退出', click: () => app.quit() }
  ]);

  tray.setContextMenu(trayMenu);
  tray.on('click', () => tray.popUpContextMenu());
}

app.whenReady().then(() => { createWindow(); createTray(); });
app.on('window-all-closed', () => app.quit());

ipcMain.on('set-ignore-mouse', (_, ignore, options) => {
  win.setIgnoreMouseEvents(ignore, options);
});

ipcMain.on('move-window', (_, dx, dy) => {
  const [x, y] = win.getPosition();
  win.setPosition(x + dx, y + dy);
});

ipcMain.on('resize-window', (_, w, h) => {
  win.setSize(Math.round(w), Math.round(h));
});

ipcMain.handle('get-audio-files', async () => {
  const assetsDir = path.join(__dirname, 'assets');
  try {
    const files = fs.readdirSync(assetsDir);
    const mp3Files = files.filter(f => f.endsWith('.mp3'));
    return { mp3s: mp3Files };
  } catch {
    return { mp3s: [] };
  }
});
