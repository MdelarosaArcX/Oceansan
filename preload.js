const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('oceansan', {
  platform: process.platform,
  pickFolder: () => ipcRenderer.invoke('dialog:pick-folder'),
});
