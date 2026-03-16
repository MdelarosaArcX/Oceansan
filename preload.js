const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('oceansan', {
  platform: process.platform,
});
