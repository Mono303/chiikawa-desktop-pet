const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path');

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

app.whenReady().then(createWindow);
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
