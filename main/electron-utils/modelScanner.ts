import fs from 'fs';
import path from 'path';
import { hashFile } from '../utils/modelUtils.js';
import { addModel } from '../../db/db-utils.js';
import { enrichModelFromAPI } from './metadataFetcher.js';
import { getApiKey } from '../../db/db-utils.js';

const MODEL_EXTENSIONS = ['.safetensors', '.pt', '.ckpt', '.lora', '.gguf'];

/**
 * Recursively scan directories for model files, import to DB,
 * emit scan progress to renderer, and enrich models as needed.
 *
 * @param scanDirs - Directories to scan
 * @param webContentsInstance - Electron WebContents instance for sending progress events
 * @param isCancelled - Function returning true if scan should abort
 * @returns Array of hashes for imported models
 */
export async function scanAndImportModels(
    scanDirs: string[],
    webContentsInstance: Electron.WebContents,
    isCancelled: () => boolean
): Promise<string[]> {
    let imported: string[] = [];

    // Step 1: Gather all files first for accurate progress counting
    let allFiles: { dir: string; file: string }[] = [];
    for (const dir of scanDirs) {
        gatherFiles(dir, allFiles);
    }
    function gatherFiles(currentDir: string, resultArr: { dir: string; file: string }[]) {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(currentDir, { withFileTypes: true });
        } catch (err) {
            console.warn(`Skipping unreadable directory: ${currentDir}`, err);
            return;
        }
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                gatherFiles(fullPath, resultArr);
            } else if (MODEL_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
                resultArr.push({ dir: currentDir, file: entry.name });
            }
        }
    }
    const totalModels = allFiles.length;
    let scannedCount = 0;

    // Step 2: Scan and import each file, emitting progress
    for (const dir of scanDirs) {
        await recurse(dir);
    }

    async function recurse(currentDir: string) {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(currentDir, { withFileTypes: true });
        } catch (err) {
            console.warn(`Skipping unreadable directory: ${currentDir}`, err);
            return;
        }
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                await recurse(fullPath);
            } else if (MODEL_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {

                if (isCancelled()) {
                    if (webContentsInstance) {
                        webContentsInstance.send('scan-progress', {
                            current: scannedCount,
                            total: totalModels,
                            file: '',
                            status: 'cancelled'
                        });
                    }
                    return imported;
                }

                let hash: string;
                try {
                    hash = await hashFile(fullPath);
                } catch (err) {
                    console.warn(`Failed to hash file: ${fullPath}`, err);
                    scannedCount++;
                    if (webContentsInstance) {
                        webContentsInstance.send('scan-progress', {
                            current: scannedCount,
                            total: totalModels,
                            file: entry.name,
                            status: 'hash-failed'
                        });
                    }
                    continue;
                }
                const date_added = new Date().toISOString();
                try {
                    await addModel({
                        file_name: entry.name,
                        model_hash: hash,
                        file_path: fullPath,
                        file_size: fs.statSync(fullPath).size,
                        date_added,
                    });
                    imported.push(hash);
                } catch (err) {
                    console.warn(`Failed to add model: ${fullPath}`, err);
                }

                // --- Progress event for each file ---
                scannedCount++;
                if (webContentsInstance) {
                    webContentsInstance.send('scan-progress', {
                        current: scannedCount,
                        total: totalModels,
                        file: entry.name,
                        hash,
                        status: 'scanned'
                    });
                }

                // --- Optional: Enrich metadata as you go ---
                try {
                    const civitaiKey = await getApiKey('civitai');
                    const hfKey = await getApiKey('huggingface');
                    if (civitaiKey || hfKey) {
                        if (webContentsInstance) {
                            webContentsInstance.send('scan-progress', {
                                current: scannedCount,
                                total: totalModels,
                                file: entry.name,
                                hash,
                                status: 'enriching'
                            });
                        }
                        await enrichModelFromAPI(hash);
                        if (webContentsInstance) {
                            webContentsInstance.send('scan-progress', {
                                current: scannedCount,
                                total: totalModels,
                                file: entry.name,
                                hash,
                                status: 'enriched'
                            });
                        }
                    }
                } catch (err) {
                    console.warn(`Failed to enrich model info: ${fullPath}`, err);
                }
            }
        }
    }
    return imported;
}
