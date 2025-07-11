import { contextBridge, ipcRenderer } from 'electron';

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
});
