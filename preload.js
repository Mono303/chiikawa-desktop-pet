const { contextBridge, ipcRenderer } = require('electron');
const { parseGIF, decompressFrames } = require('gifuct-js');

contextBridge.exposeInMainWorld('electronAPI', {
  setIgnoreMouse: (ignore, options) => ipcRenderer.send('set-ignore-mouse', ignore, options),
  moveWindow: (dx, dy) => ipcRenderer.send('move-window', dx, dy),
  resizeWindow: (w, h) => ipcRenderer.send('resize-window', w, h),
  showContextMenu: () => ipcRenderer.send('show-context-menu'),
  getAudioFiles: () => ipcRenderer.invoke('get-audio-files'),
  savePersistData: (data) => ipcRenderer.invoke('save-persist-data', data),
  loadPersistData: () => ipcRenderer.invoke('load-persist-data')
});

contextBridge.exposeInMainWorld('gifuct', {
  parseGIF,
  decompressFrames
});
