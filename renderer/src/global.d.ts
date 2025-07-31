// File: renderer/src/global.d.ts

import type { IImageMeta } from './types';
import type { OpenDialogOptions } from 'electron';

export interface PromptAPI {
    onShowPrompt?: (cb: (img: string) => void) => void
    getPromptMetadata?: (localPath: string) => Promise<string>
}

declare global {
    interface Window {
        electronAPI: {
            // Model metadata
            getImageMetadata(path: string): Promise<IImageMeta>;
            getAppVersion(): Promise<string>;

            // Model scanning
            getAllModels(): Promise<any[]>;
            getAllModelsWithCover(): Promise<any[]>;
            scanAndImportModels(): Promise<any[]>;
            getAllScanPaths(): Promise<any[]>;
            addScanPath(path: string): Promise<any[]>;
            removeScanPath(path: string): Promise<void>;
            selectFolder(): Promise<string>;

            // API keys
            getApiKey(provider: string): Promise<string>;
            setApiKey(provider: string, apiKey: string): Promise<void>;

            // Image handling
            saveModelImage(modelHash: string, source: string): Promise<string>;
            getModelImages(modelHash: string): Promise<string[]>;
            deleteModelImage(modelHash: string, fileName: string): Promise<void>;

            // Model details
            getModelByHash(modelHash: string): Promise<any>;
            enrichModelFromAPI(modelHash: string): Promise<void>;
            reenrichAllModels(): Promise<any>;
            updateHashMap(): Promise<any>;

            // Notes & tags
            getUserNote(modelHash: string): Promise<string>;
            setUserNote(modelHash: string, note: string): Promise<void>;
            getTags(modelHash: string): Promise<{ tag: string }[]>;
            addTag(modelHash: string, tag: string): Promise<void>;
            removeTag(modelHash: string, tag: string): Promise<void>;

            // Favorites & scanning
            toggleFavoriteModel(modelHash: string): Promise<void>;
            cancelScan(): Promise<void>;
            onScanProgress(callback: (event: any, data: any) => void): void;
            removeScanProgress(callback: (event: any, data: any) => void): void;

            // Model update
            updateModel(modelData: any): Promise<{ success: boolean; error?: string }>;

            // Native file dialog
            openFileDialog(options: OpenDialogOptions): Promise<string[]>;
            selectModelMainImage(modelHash: string): Promise<SelectModelMainImageResult>;

            readPrompt(imagePath: string): Promise<PromptResult>;
            openPromptViewer(imagePath: string): Promise<boolean>;
        };
        promptAPI?: PromptAPI
    }
}

export {};
