// File: renderer/src/global.d.ts

import type { IImageMeta } from './types';
import type { OpenDialogOptions } from 'electron';

export interface PromptAPI {
    onShowPrompt?: (cb: (img: string) => void) => void;
    getPromptMetadata?: (localPath: string) => Promise<string>;
}

// Returned by electronAPI.selectModelMainImage
export interface SelectModelMainImageResult {
    canceled: boolean;
    filePaths?: string[];
}

declare const __BUILD_INFO__: {
    version: string;
    commit: string;
    timestamp: string; // ISO 8601
};

declare const __APP_VERSION__: string;

declare global {
    interface Window {
        electronAPI: {
            // Model metadata
            getPromptMetadata(imagePath: string): Promise<string>;
            getImageMetadata(path: string): Promise<IImageMeta>;
            getAppVersion(): Promise<string>;

            // Model scanning
            getAllModels(): Promise<any[]>;
            getAllModelsWithCover(): Promise<any[]>;
            scanAndImportModels(): Promise<any[]>;
            getAllScanPaths(): Promise<any[]>; // typically { path: string }[]
            addScanPath(path: string): Promise<any[]>;
            removeScanPath(path: string): Promise<void>;
            selectFolder(): Promise<string | null>;

            // API keys
            getApiKey(provider: string): Promise<string>;
            setApiKey(provider: string, apiKey: string): Promise<void>;

            // Image handling
            saveModelImage(modelHash: string, source: string): Promise<string>;
            getModelImages(modelHash: string): Promise<string[]>;
            deleteModelImage(modelHash: string, fileName: string): Promise<void>;

            // Model details
            getModelByHash(modelHash: string): Promise<any>;
            enrichModelFromAPI(modelHash: string): Promise<any>;
            reenrichAllModels(): Promise<{ success: boolean; error?: string }>;
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

            // Prompt viewer / metadata
            openPromptViewer(imagePath: string): Promise<void>;

            scanNewOrChanged: (scanRoots: string[]) => Promise<{
                processed: number;
                skipped: number;
                totalCandidates: number;
            }>;
            scanFullRebuild: (scanRoots: string[]) => Promise<{
                processed: number;
                skipped: number;
                totalCandidates: number;
            }>;
        };

        // IPC bridges exposed via preload
        promptAPI: PromptAPI;

        settingsAPI: {
            getUseExternalPromptParser(): Promise<boolean>;
            setUseExternalPromptParser(v: boolean): Promise<boolean>;
        };
    }
}

export {};
