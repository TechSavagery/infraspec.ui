const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  fetchData: (endpoint) => ipcRenderer.invoke('fetch-data', endpoint),
});
