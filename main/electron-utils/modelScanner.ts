import fs from 'fs';
import path from 'path';
import { hashFile } from '../../renderer/src/utils/modelUtils'; // Make sure path matches
import { addModel } from '../../db/db-utils';import { hashFile } from '../../renderer/src/utils/modelUtils'; // Make sure path matches
import { addModel } from '../../db/db-utils';

// Supported model file extensions (easily expanded)
const MODEL_EXTENSIONS = ['.safetensors', '.pt', '.ckpt', '.lora', '.gguf'];

export type ModelFile = {
    file_name: string;
    file_path: string;
    model_type?: string;
    file_size: number;
    date_added: string;
    hash: string; // Placeholder, real implementation will hash file
};

/**
 * Recursively scan a directory for model files
 * @param dir string, starting directory
 * @returns ModelFile[]
 */
export async function scanAndImportModels(scanDirs: string[]) {
    let imported: string[] = [];

    for (const dir of scanDirs) {
        await recurse(dir);
    }

    async function recurse(currentDir: string) {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                await recurse(fullPath);
            } else if (MODEL_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
                const hash = await hashFile(fullPath);
                // addModel returns undefined if exists, so only push new ones
                const date_added = new Date().toISOString();
                await addModel({
                    file_name: entry.name,
                    model_hash: hash,
                    file_path: fullPath,
                    file_size: fs.statSync(fullPath).size,
                    date_added,
                });
                imported.push(hash);
            }
        }
    }
    return imported;
}
