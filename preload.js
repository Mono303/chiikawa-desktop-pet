const { contextBridge, ipcRenderer } = require('electron');
const { parseGIF, decompressFrames } = require('gifuct-js');

contextBridge.exposeInMainWorld('electronAPI', {
  setIgnoreMouse: (ignore, options) => ipcRenderer.send('set-ignore-mouse', ignore, options),
  moveWindow: (dx, dy) => ipcRenderer.send('move-window', dx, dy),
  resizeWindow: (w, h) => ipcRenderer.send('resize-window', w, h),
  showContextMenu: () => ipcRenderer.send('show-context-menu'),
  getAudioFiles: () => ipcRenderer.invoke('get-audio-files')
});

contextBridge.exposeInMainWorld('gifuct', {
  parseGIF,
  decompressFrames
});
