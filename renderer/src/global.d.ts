// renderer/src/global.d.ts

import type { IImageMeta } from './types';

declare global {
    interface Window {
        electronAPI: {
            getImageMetadata: (path: string) => Promise<IImageMeta>;

            getAppVersion: () => Promise<string>;

            getAllModels: () => Promise<any[]>;
            getAllModelsWithCover: () => Promise<any[]>;
            scanAndImportModels: () => Promise<any[]>;
            getAllScanPaths: () => Promise<any[]>;
            addScanPath: (path: string) => Promise<any[]>;
            removeScanPath: (path: string) => Promise<void>;
            selectFolder: () => Promise<string>;

            getApiKey: (provider: string) => Promise<string>;
            setApiKey: (provider: string, apiKey: string) => Promise<void>;

            saveModelImage: (modelHash: string, imageUrl: string) => Promise<any>;
            getModelImages: (modelHash: string) => Promise<any[]>;
            getModelByHash: (modelHash: string) => Promise<any>;
            enrichModelFromAPI: (modelHash: string) => Promise<void>;
            reenrichAllModels: () => Promise<any>;
            updateHashMap: () => Promise<any>;

            getUserNote: (modelHash: string) => Promise<string>;
            setUserNote: (modelHash: string, note: string) => Promise<void>;
            getTags: (modelHash: string) => Promise<any[]>;
            addTag: (modelHash: string, tag: string) => Promise<void>;
            removeTag: (modelHash: string, tag: string) => Promise<void>;

            toggleFavoriteModel: (modelHash: string) => Promise<void>;
            cancelScan: () => Promise<void>;
            onScanProgress: (callback: (event: any, ...args: any[]) => void) => void;
            removeScanProgress: (callback: (event: any, ...args: any[]) => void) => void;
            updateModel: (modelData: any) => Promise<{ success: boolean; error?: string }>;
        };
    }
}

export {};
