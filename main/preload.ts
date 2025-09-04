// File: main/preload.ts
const { contextBridge, ipcRenderer } = require('electron');

// --- NSFW key normalization helpers (preload) ---
const canonPath = (p?: string): string => {
    if (!p) return '';
    let raw = p.startsWith('file://') ? p.slice(7) : p;
    try { raw = decodeURIComponent(raw); } catch {}
    return raw.replace(/\\/g, '/').toLowerCase();
};
const normalizeIndex = (idx: { images?: Record<string, boolean>; models?: Record<string, boolean> }) => {
    const outImages: Record<string, boolean> = {};
    const outModels: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(idx.images ?? {})) outImages[canonPath(k)] = !!v;
    for (const [k, v] of Object.entries(idx.models ?? {})) {
        outModels[k] = !!v;
        outModels[k.toLowerCase?.() ?? k] = !!v;
    }
    return { images: outImages, models: outModels };
};

contextBridge.exposeInMainWorld('electronAPI', {

    getUserSettings: () => ipcRenderer.invoke('getUserSettings'),
    updateUserSettings: (patch: any) => ipcRenderer.invoke('updateUserSettings', patch),
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
    // ✅ ADD THIS:
    openPromptViewer: (imgPath :any) => ipcRenderer.invoke('open-prompt-viewer', imgPath),

    deleteModelImage: (hash: string, name: string) => ipcRenderer.invoke('deleteModelImage', hash, name),
    //openPromptViewer: (imgPath: string) => ipcRenderer.invoke('open-prompt-viewer', imgPath),
    getPromptMetadata: (imagePath: string) => ipcRenderer.invoke('getPromptMetadata', imagePath),
    scanNewOrChanged: async (roots?: string[]) => ipcRenderer.invoke('scanNewOrChanged', roots),

    // --- NSFW (normalized read/write) ---
    nsfwGetIndex: async () => {
        const raw = await ipcRenderer.invoke('nsfw:getIndex');
        return normalizeIndex(raw || { images: {}, models: {} });
    },
    nsfwMarkImage: async (imageKey: string, value: boolean) => {
        const key = canonPath(imageKey);
        return ipcRenderer.invoke('nsfw:markImage', key, !!value);
    },
    nsfwSetImage: async (imageKey: string, value: boolean) => {
        const key = canonPath(imageKey);
        return ipcRenderer.invoke('nsfw:setImage', key, !!value);
    },
    nsfwMarkModel: async (modelHash: string, value: boolean) => {
        const h = String(modelHash).trim();
        return ipcRenderer.invoke('nsfw:markModel', h, !!value);
    },
    nsfwSetModel: async (modelHash: string, value: boolean) => {
        const h = String(modelHash).trim();
        return ipcRenderer.invoke('nsfw:setModel', h, !!value);
    },

    nsfwMerge: (batch: { models?: { hash: string; nsfw: boolean }[]; images?: { src: string; nsfw: boolean }[] }) =>
        ipcRenderer.invoke('nsfw:merge', batch),

    scanFullRebuild: (scanRoots: string[]) =>
        ipcRenderer.invoke('scan:fullRebuild', scanRoots),

    onFastScanProgress: (handler: (p: any) => void) => {
        const listener = (_evt: Electron.IpcRendererEvent, payload: any) => handler(payload);
        ipcRenderer.on('fast-scan-progress', listener);
        // return a disposer
        return () => ipcRenderer.removeListener('fast-scan-progress', listener);
    },
});

contextBridge.exposeInMainWorld('promptAPI', {
    onShowPrompt: (cb: (imagePath: string) => void) => {
        ipcRenderer.on('showPrompt', (_event: any, imagePath: string) => cb(imagePath));
    },
    getPromptMetadata: (localPath: string): Promise<string> => {
        return ipcRenderer.invoke('getPromptMetadata', localPath);
    },
});

// ✅ NEW: Settings bridge for sd-prompt-reader toggle
contextBridge.exposeInMainWorld('settingsAPI', {
    getUseExternalPromptParser: () => ipcRenderer.invoke('getUseExternalPromptParser'),
    setUseExternalPromptParser: (v: boolean) => ipcRenderer.invoke('setUseExternalPromptParser', v),
});
