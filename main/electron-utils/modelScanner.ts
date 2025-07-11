import fs from 'fs';
import path from 'path';
import { hashFile } from '../utils/modelUtils.js'; // Update if your path differs
import { addModel } from '../../db/db-utils.js';

// Supported model file extensions (easily expanded)
const MODEL_EXTENSIONS = ['.safetensors', '.pt', '.ckpt', '.lora', '.gguf'];

export type ModelFile = {
    file_name: string;
    file_path: string;
    model_type?: string;
    file_size: number;
    date_added: string;
    model_hash: string; // Renamed for consistency
};

/**
 * Recursively scan a list of directories for model files and import to DB.
 * @param scanDirs Array of string directories to scan
 * @returns Array of model_hashes of newly imported models
 */
export async function scanAndImportModels(scanDirs: string[]): Promise<string[]> {
    let imported: string[] = [];

    for (const dir of scanDirs) {
        await recurse(dir);
    }

    async function recurse(currentDir: string) {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(currentDir, { withFileTypes: true });
        } catch (err) {
            // Log and skip directories we cannot read
            console.warn(`Skipping unreadable directory: ${currentDir}`, err);
            return;
        }
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                await recurse(fullPath);
            } else if (MODEL_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
                let hash: string;
                try {
                    hash = await hashFile(fullPath);
                } catch (err) {
                    console.warn(`Failed to hash file: ${fullPath}`, err);
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
                    // continue to next file
                }
            }
        }
    }
    return imported;
}
