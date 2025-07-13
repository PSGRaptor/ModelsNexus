const { contextBridge, ipcRenderer } = require('electron');

// Securely expose limited Electron APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
    getAppVersion: async () => ipcRenderer.invoke('get-app-version'),
    getAllModels: async () => ipcRenderer.invoke('getAllModels'),
    scanAndImportModels: async () => ipcRenderer.invoke('scanAndImportModels'),
    getAllScanPaths: async () => ipcRenderer.invoke('getAllScanPaths'),
    addScanPath: async (path: string) => ipcRenderer.invoke('addScanPath', path),
    removeScanPath: async (path: string) => ipcRenderer.invoke('removeScanPath', path),
    getApiKey: async (provider: string) => ipcRenderer.invoke('getApiKey', provider),
    setApiKey: async (provider: string, apiKey: string) => ipcRenderer.invoke('setApiKey', provider, apiKey),
    saveModelImage: async (modelHash: string, imageUrl: string) => ipcRenderer.invoke('saveModelImage', modelHash, imageUrl),
    getModelImages: async (modelHash: string) => ipcRenderer.invoke('getModelImages', modelHash),
    enrichModelFromAPI: async (model_hash: string) => ipcRenderer.invoke('enrichModelFromAPI', model_hash),
    getUserNote: async (model_hash: string) => ipcRenderer.invoke('getUserNote', model_hash),
    setUserNote: async (model_hash: string, note: string) => ipcRenderer.invoke('setUserNote', model_hash, note),
    getTags: async (model_hash: string) => ipcRenderer.invoke('getTags', model_hash),
    addTag: async (model_hash: string, tag: string) => ipcRenderer.invoke('addTag', model_hash, tag),
    removeTag: async (model_hash: string, tag: string) => ipcRenderer.invoke('removeTag', model_hash, tag),
    selectFolder: async () => ipcRenderer.invoke('selectFolder'),
    onScanProgress: (callback: (...args: any[]) => void) => ipcRenderer.on('scan-progress', callback),
    removeScanProgress: (callback: (...args: any[]) => void) => ipcRenderer.removeListener('scan-progress', callback),

    cancelScan: () => ipcRenderer.invoke('cancelScan'),
});
