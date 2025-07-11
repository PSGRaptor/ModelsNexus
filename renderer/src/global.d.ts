// renderer/src/global.d.ts

export {};

declare global {
    interface Window {
        electronAPI: {
            getAllModels: () => Promise<any[]>;
            scanAndImportModels: () => Promise<any[]>;
            getAllScanPaths: () => Promise<any[]>;
            addScanPath: (path: string) => Promise<any[]>;
            removeScanPath: (path: string) => Promise<any[]>;
            getApiKey: (provider: string) => Promise<string>;
            setApiKey: (provider: string, apiKey: string) => Promise<void>;
            getUserNote: (modelHash: string) => Promise<string>;
            setUserNote: (modelHash: string, note: string) => Promise<void>;
            getTags: (modelHash: string) => Promise<{ tag: string }[]>;
            addTag: (modelHash: string, tag: string) => Promise<void>;
            removeTag: (modelHash: string, tag: string) => Promise<void>;
            getModelImages: (modelHash: string) => Promise<string[]>;
            enrichModelFromAPI: (modelHash: string) => Promise<any>;
            // ...add any other APIs you expose
        };
    }
}
