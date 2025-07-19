// db/db-utils.ts

import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs/promises';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use Electron's app.getPath('userData') to store the DB in the user's profile
const getDbPath = () => {
    try {
        // @ts-ignore
        const electron = require('electron');
        return path.join(electron.app.getPath('userData'), 'models.db');
    } catch {
        return path.resolve(__dirname, 'models.db');
    }
};

// Exported DB instance (open on demand)
export let db: Database<sqlite3.Database, sqlite3.Statement>;

export async function updateFavorite(model_hash: string, is_favorite: number) {
    await db.run('UPDATE models SET is_favorite = ? WHERE model_hash = ?', is_favorite, model_hash);
}

// File: db/db-utils.ts

export async function initDb() {
    db = await open({
        filename: getDbPath(),
        driver: sqlite3.Database,
    });
    // Apply schema if new
    await db.exec(await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf-8'));

    // ...existing migrations for civitai_version_id and model_name...

    let columns = await db.all("PRAGMA table_info(models)");

    // Add model_name column if missing (already present in your last step)
    if (!columns.some((c: any) => c.name.toLowerCase() === 'model_name')) {
        try {
            await db.exec(`ALTER TABLE models ADD COLUMN model_name TEXT`);
            console.log('Added model_name column to models table');
        } catch (e: any) {
            if (/duplicate column/i.test(e.message)) {
                console.warn('model_name column already exists in models table');
            } else {
                throw e;
            }
        }
    }

    // --- Add prompt_positive column if missing ---
    columns = await db.all("PRAGMA table_info(models)");
    if (!columns.some((c: any) => c.name.toLowerCase() === 'prompt_positive')) {
        try {
            await db.exec(`ALTER TABLE models ADD COLUMN prompt_positive TEXT`);
            console.log('Added prompt_positive column to models table');
        } catch (e: any) {
            if (/duplicate column/i.test(e.message)) {
                console.warn('prompt_positive column already exists in models table');
            } else {
                throw e;
            }
        }
    }

    // --- Add prompt_negative column if missing ---
    columns = await db.all("PRAGMA table_info(models)");
    if (!columns.some((c: any) => c.name.toLowerCase() === 'prompt_negative')) {
        try {
            await db.exec(`ALTER TABLE models ADD COLUMN prompt_negative TEXT`);
            console.log('Added prompt_negative column to models table');
        } catch (e: any) {
            if (/duplicate column/i.test(e.message)) {
                console.warn('prompt_negative column already exists in models table');
            } else {
                throw e;
            }
        }
    }

    // --- Add notes column if missing ---
    columns = await db.all("PRAGMA table_info(models)");
    if (!columns.some((c: any) => c.name.toLowerCase() === 'notes')) {
        try {
            await db.exec(`ALTER TABLE models ADD COLUMN notes TEXT`);
            console.log('Added notes column to models table');
        } catch (e: any) {
            if (/duplicate column/i.test(e.message)) {
                console.warn('notes column already exists in models table');
            } else {
                throw e;
            }
        }
    }
}



// Update Civitai model info for a given model hash
export async function updateCivitaiModelInfo(model_hash: string, civitai_id: string, civitai_version_id: string, model_type: string, base_model: string, version: string, civitai_url: string) {
    await db.run(
        `UPDATE models
         SET civitai_id = ?, civitai_version_id = ?, model_type = ?, base_model = ?, version = ?, source_url = ?
         WHERE model_hash = ?`,
        civitai_id,
        civitai_version_id,
        model_type,
        base_model,
        version,
        civitai_url,
        model_hash
    );
}

// Add a model to the DB (simplified)
export async function addModel(model: {
    file_name: string;
    model_hash: string;
    file_path: string;
    model_type?: string;
    version?: string;
    base_model?: string;
    file_size: number;
    date_added: string;
}) {
    await db.run(
        `INSERT OR IGNORE INTO models (file_name, model_hash, file_path, model_type, version, base_model, file_size, date_added)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        model.file_name, model.model_hash, model.file_path, model.model_type || null, model.version || null, model.base_model || null, model.file_size, model.date_added
    );
}

// Add/edit/update the main model record in the "models" table
// In db/db-utils.ts
export async function updateModel(model: any) {
    if (!model || !model.model_hash) {
        throw new Error("updateModel: No model object or missing model_hash");
    }
    // fallback for missing model_name
    const modelName = model.model_name ?? model.file_name ?? "";

    // Example SQL, adjust for your columns:
    await db.run(`
                UPDATE models SET
                                  model_name = ?,
                                  model_type = ?,
                                  base_model = ?,
                                  version = ?,
                                  prompt_positive = ?,
                                  prompt_negative = ?,
                                  notes = ?
                WHERE model_hash = ?`,
        modelName,
        model.model_type ?? "",
        model.base_model ?? "",
        model.version ?? "",
        model.prompt_positive ?? "",
        model.prompt_negative ?? "",
        model.notes ?? "",
        model.model_hash
    );
}



// Fetch all models from DB
export async function getAllModels() {
    return db.all(`SELECT * FROM models ORDER BY date_added DESC`);
}

export async function getAllModelsWithCover() {
    // get all models
    const models = await db.all('SELECT * FROM models ORDER BY date_added DESC');
    for (const model of models) {
        // get all images for the model
        const img = await db.get(
            'SELECT image_path FROM images WHERE model_hash = ? ORDER BY sort_order ASC LIMIT 1',
            model.model_hash
        );
        model.cover_image = img ? img.image_path : null;
        // also get *all* images (up to 10) for preview modal
        const allImgs = await db.all(
            'SELECT image_path FROM images WHERE model_hash = ? ORDER BY sort_order ASC LIMIT 10',
            model.model_hash
        );
        model.images = allImgs.map(i => i.image_path);
    }
    return models;
}

// Get all scan paths from DB
export async function getAllScanPaths() {
    return db.all('SELECT * FROM scan_paths WHERE enabled = 1');
}

// Add new scan path (ignores if duplicate)
export async function addScanPath(pathStr: string) {
    await db.run(
        'INSERT OR IGNORE INTO scan_paths (path, enabled, date_added) VALUES (?, 1, ?)',
        pathStr,
        new Date().toISOString()
    );
}

export async function getModelByHash(model_hash: string) {
    return db.get('SELECT * FROM models WHERE model_hash = ?', model_hash);
}

// Remove (disable) scan path
export async function removeScanPath(pathStr: string) {
    await db.run(
        'UPDATE scan_paths SET enabled = 0 WHERE path = ?',
        pathStr
    );
}

// Get API key for provider
export async function getApiKey(provider: string) {
    const row = await db.get('SELECT api_key FROM api_keys WHERE provider = ?', provider);
    return row ? row.api_key : '';
}

// Set/update API key for provider
export async function setApiKey(provider: string, apiKey: string) {
    await db.run(
        'INSERT OR REPLACE INTO api_keys (provider, api_key, date_added) VALUES (?, ?, ?)',
        provider, apiKey, new Date().toISOString()
    );
}

export async function getUserNote(model_hash: string) {
    const row = await db.get('SELECT note FROM user_notes WHERE model_hash = ?', model_hash);
    return row ? row.note : '';
}
export async function setUserNote(model_hash: string, note: string) {
    await db.run(`
        INSERT INTO user_notes (model_hash, note, created_at, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(model_hash) DO UPDATE SET note=excluded.note, updated_at=CURRENT_TIMESTAMP
    `, model_hash, note);
}

// Get, add, remove tags
export async function getTags(model_hash: string) {
    return db.all('SELECT tag FROM tags WHERE model_hash = ?', model_hash);
}
export async function addTag(model_hash: string, tag: string) {
    await db.run('INSERT OR IGNORE INTO tags (model_hash, tag) VALUES (?, ?)', model_hash, tag);
}
export async function removeTag(model_hash: string, tag: string) {
    await db.run('DELETE FROM tags WHERE model_hash = ? AND tag = ?', model_hash, tag);
}

// --------------- Civitai Version ID utilities ---------------

// Set civitai_version_id for a model (by hash)
export async function setCivitaiVersionId(model_hash: string, version_id: number) {
    await db.run(
        `UPDATE models SET civitai_version_id = ? WHERE model_hash = ?`,
        version_id,
        model_hash
    );
}

// Get civitai_version_id for a model (by hash)
export async function getCivitaiVersionId(model_hash: string): Promise<number | null> {
    const row = await db.get(
        `SELECT civitai_version_id FROM models WHERE model_hash = ?`,
        model_hash
    );
    return row && row.civitai_version_id ? row.civitai_version_id : null;
}

/**
 * Save a model image (URL and meta) for a model.
 * @param model_hash string
 * @param imageUrl string (URL or file path)
 * @param _index number (not stored but can be used for ordering)
 * @param meta any metadata (will be stringified as JSON)
 */
export async function saveModelImage(model_hash: string, imageUrl: string, _index: number, meta: any) {
    try {
        await db.run(
            `INSERT OR REPLACE INTO images (model_hash, image_path, source_url, created_at, meta_json)
             VALUES (?, ?, ?, ?, ?)`,
            model_hash,
            imageUrl,
            imageUrl,
            new Date().toISOString(),
            JSON.stringify(meta || {})
        );
    } catch (err) {
        console.error('Error saving model image:', err);
    }
}

/**
 * Get all images for a model.
 * @param model_hash string
 * @returns Promise<any[]>
 */
export async function getModelImages(model_hash: string): Promise<any[]> {
    return db.all('SELECT * FROM images WHERE model_hash = ? ORDER BY id ASC', model_hash);
}
