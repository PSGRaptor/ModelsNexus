const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Image/Model Metadata
    getImageMetadata: async (path: string) => await ipcRenderer.invoke('get-image-metadata', path),
    selectModelMainImage: async (modelHash: string) => ipcRenderer.invoke('selectModelMainImage', modelHash),
    // App Info
    getAppVersion: async () => ipcRenderer.invoke('get-app-version'),

    // Model Data/DB

    getAllModels: async () => ipcRenderer.invoke('getAllModels'),
    getAllModelsWithCover: async () => ipcRenderer.invoke('getAllModelsWithCover'),
    scanAndImportModels: async () => ipcRenderer.invoke('scanAndImportModels'),
    getAllScanPaths: async () => ipcRenderer.invoke('getAllScanPaths'),
    addScanPath: async (path: string) => ipcRenderer.invoke('addScanPath', path),
    removeScanPath: async (path: string) => ipcRenderer.invoke('removeScanPath', path),
    selectFolder: async () => ipcRenderer.invoke('selectFolder'),
    updateModel: async (modelData: any) => await ipcRenderer.invoke('updateModel', modelData),

    // API Keys
    getApiKey: async (provider: string) => ipcRenderer.invoke('getApiKey', provider),
    setApiKey: async (provider: string, apiKey: string) => ipcRenderer.invoke('setApiKey', provider, apiKey),

    // Model Images and Details
    saveModelImage: async (modelHash: string, imageUrl: string) => ipcRenderer.invoke('saveModelImage', modelHash, imageUrl),
    getModelImages: async (modelHash: string) => ipcRenderer.invoke('getModelImages', modelHash),
    getModelByHash: async (modelHash: string) => ipcRenderer.invoke('getModelByHash', modelHash),
    enrichModelFromAPI: async (modelHash: string) => ipcRenderer.invoke('enrichModelFromAPI', modelHash),
    reenrichAllModels: async () => ipcRenderer.invoke('reenrichAllModels'),
    updateHashMap: async () => ipcRenderer.invoke('updateHashMap'),

    // User Notes/Tags
    getUserNote: async (modelHash: string) => ipcRenderer.invoke('getUserNote', modelHash),
    setUserNote: async (modelHash: string, note: string) => ipcRenderer.invoke('setUserNote', modelHash, note),
    getTags: async (modelHash: string) => ipcRenderer.invoke('getTags', modelHash),
    addTag: async (modelHash: string, tag: string) => ipcRenderer.invoke('addTag', modelHash, tag),
    removeTag: async (modelHash: string, tag: string) => ipcRenderer.invoke('removeTag', modelHash, tag),

    // Favorites/Scanning/Progress
    toggleFavoriteModel: async (modelHash: string) => ipcRenderer.invoke('toggleFavoriteModel', modelHash),
    cancelScan: async () => ipcRenderer.invoke('cancelScan'),
    onScanProgress: (callback: (event: any, ...args: any[]) => void) => ipcRenderer.on('scan-progress', callback),
    removeScanProgress: (callback: (event: any, ...args: any[]) => void) => ipcRenderer.removeListener('scan-progress', callback),
    openFileDialog: (options: Electron.OpenDialogOptions) => ipcRenderer.invoke('dialog:openFileDialog', options),

    deleteModelImage: (hash: string, name: string) => ipcRenderer.invoke('deleteModelImage', hash, name),
    openPromptViewer: (imgPath: string) => ipcRenderer.invoke('open-prompt-viewer', imgPath),
});
