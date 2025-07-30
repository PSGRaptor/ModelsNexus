// File: main/db-utils.ts

import { app } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

// 1) Compute a user-writable path for your DB and ensure the folder exists
const userDataPath = app.getPath('userData');                    // e.g. C:\Users\<You>\AppData\Roaming\Models Nexus
const dbPath       = path.join(userDataPath, 'models.db');

// 2) Export getDbPath() for legacy callers
export function getDbPath(): string {
    return dbPath;
}

// 3) The Database instance
export let db: Database<sqlite3.Database, sqlite3.Statement>;

/**
 * Initializes the SQLite database:
 *  - Creates the userData directory if missing
 *  - Opens (or creates) the models.db file
 *  - Applies the base schema from schema.sql
 *  - Runs any necessary ALTER TABLE migrations
 */
export async function initDb(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
    // A) Ensure the userData folder exists
    await fs.mkdir(path.dirname(dbPath), { recursive: true });

    // B) Open (or create) the database
    db = await open({
        filename: dbPath,
        driver: sqlite3.Database,
    });

    // C) Apply base schema
    const schemaFile = path.join(app.getAppPath(), 'db', 'schema.sql');
    try {
        const schemaSql = await fs.readFile(schemaFile, 'utf-8');
        await db.exec(schemaSql);
    } catch (err) {
        console.error('Error applying base schema from', schemaFile, err);
        throw err;
    }

    // D) Run migrations: add missing columns if they don’t exist
    const tableInfo = async (table: string) => db.all(`PRAGMA table_info(${table})`);

    let columns = await tableInfo('models');

    // 1) model_name
    if (!columns.some((c: any) => c.name.toLowerCase() === 'model_name')) {
        await db.exec(`ALTER TABLE models ADD COLUMN model_name TEXT`);
    }

    // 2) prompt_positive
    columns = await tableInfo('models');
    if (!columns.some((c: any) => c.name.toLowerCase() === 'prompt_positive')) {
        await db.exec(`ALTER TABLE models ADD COLUMN prompt_positive TEXT`);
    }

    // 3) prompt_negative
    columns = await tableInfo('models');
    if (!columns.some((c: any) => c.name.toLowerCase() === 'prompt_negative')) {
        await db.exec(`ALTER TABLE models ADD COLUMN prompt_negative TEXT`);
    }

    // 4) main_image_path
    columns = await tableInfo('models');
    if (!columns.some((c: any) => c.name.toLowerCase() === 'main_image_path')) {
        await db.exec(`ALTER TABLE models ADD COLUMN main_image_path TEXT`);
    }

    // 5) notes
    columns = await tableInfo('models');
    if (!columns.some((c: any) => c.name.toLowerCase() === 'notes')) {
        await db.exec(`ALTER TABLE models ADD COLUMN notes TEXT`);
    }

    // 6) sort_order (used by getAllModelsWithCover)
    columns = await tableInfo('models');
    if (!columns.some((c: any) => c.name.toLowerCase() === 'sort_order')) {
        await db.exec(`ALTER TABLE models ADD COLUMN sort_order INTEGER DEFAULT 0`);
    }

    // 7) sort_order on images (needed by getAllModelsWithCover)
    columns = await tableInfo('images');
    if (!columns.some((c: any) => c.name.toLowerCase() === 'sort_order')) {
        // default to 0 so images without an explicit order all sort first
        await db.exec(`ALTER TABLE images ADD COLUMN sort_order INTEGER DEFAULT 0`);
    }

    return db;
}

// ————————————————————————————————————————————————————————————————————————

// Marks or unmarks a model as favorite
export async function updateFavorite(model_hash: string, is_favorite: number): Promise<void> {
    await db.run(
        'UPDATE models SET is_favorite = ? WHERE model_hash = ?',
        is_favorite,
        model_hash
    );
}

// Updates Civitai metadata for a model
export async function updateCivitaiModelInfo(
    model_hash: string,
    civitai_id: string,
    civitai_version_id: string,
    model_type: string,
    base_model: string,
    version: string,
    source_url: string
): Promise<void> {
    await db.run(
        `UPDATE models
         SET civitai_id = ?, civitai_version_id = ?, model_type = ?, base_model = ?, version = ?, source_url = ?
         WHERE model_hash = ?`,
        civitai_id,
        civitai_version_id,
        model_type,
        base_model,
        version,
        source_url,
        model_hash
    );
}

// Inserts a model record if it does not exist
export async function addModel(model: {
    file_name: string;
    model_hash: string;
    file_path: string;
    model_type?: string;
    version?: string;
    base_model?: string;
    file_size: number;
    date_added: string;
}): Promise<void> {
    await db.run(
        `INSERT OR IGNORE INTO models
       (file_name, model_hash, file_path, model_type, version, base_model, file_size, date_added)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        model.file_name,
        model.model_hash,
        model.file_path,
        model.model_type || null,
        model.version || null,
        model.base_model || null,
        model.file_size,
        model.date_added
    );
}

// Updates the main model record
export async function updateModel(model: any): Promise<void> {
    const name = model.model_name ?? model.file_name ?? '';
    await db.run(
        `UPDATE models SET
       model_name      = ?,
       model_type      = ?,
       base_model      = ?,
       version         = ?,
       prompt_positive = ?,
       prompt_negative = ?,
       notes           = ?
     WHERE model_hash = ?`,
        name,
        model.model_type ?? '',
        model.base_model ?? '',
        model.version ?? '',
        model.prompt_positive ?? '',
        model.prompt_negative ?? '',
        model.notes ?? '',
        model.model_hash
    );
}

// Sets the main (cover) image path for a model
export async function updateModelMainImage(modelHash: string, imagePath: string): Promise<void> {
    await db.run(
        'UPDATE models SET main_image_path = ? WHERE model_hash = ?',
        imagePath,
        modelHash
    );
}

// Retrieves all models ordered by date_added
export async function getAllModels(): Promise<any[]> {
    return db.all(`SELECT * FROM models ORDER BY date_added DESC`);
}

// Retrieves all models with a cover image (main_image_path or first image)
export async function getAllModelsWithCover(): Promise<any[]> {
    const models = await db.all('SELECT * FROM models ORDER BY date_added DESC');
    for (const model of models) {
        const img = await db.get(
            'SELECT image_path FROM images WHERE model_hash = ? ORDER BY sort_order ASC LIMIT 1',
            model.model_hash
        );
        model.cover_image = model.main_image_path || (img ? img.image_path : null);

        const allImgs = await db.all(
            'SELECT image_path FROM images WHERE model_hash = ? ORDER BY sort_order ASC LIMIT 10',
            model.model_hash
        );
        model.images = allImgs.map((i: any) => i.image_path);
    }
    return models;
}

// Scan-paths management
export async function getAllScanPaths(): Promise<any[]> {
    return db.all('SELECT * FROM scan_paths WHERE enabled = 1');
}

export async function addScanPath(pathStr: string): Promise<void> {
    await db.run(
        'INSERT OR IGNORE INTO scan_paths (path, enabled, date_added) VALUES (?, 1, ?)',
        pathStr,
        new Date().toISOString()
    );
}

export async function removeScanPath(pathStr: string): Promise<void> {
    await db.run(
        'UPDATE scan_paths SET enabled = 0 WHERE path = ?',
        pathStr
    );
}

export async function getModelByHash(model_hash: string): Promise<any> {
    return db.get('SELECT * FROM models WHERE model_hash = ?', model_hash);
}

// API-key storage
export async function getApiKey(provider: string): Promise<string> {
    const row: any = await db.get('SELECT api_key FROM api_keys WHERE provider = ?', provider);
    return row ? row.api_key : '';
}

export async function setApiKey(provider: string, apiKey: string): Promise<void> {
    await db.run(
        'INSERT OR REPLACE INTO api_keys (provider, api_key, date_added) VALUES (?, ?, ?)',
        provider,
        apiKey,
        new Date().toISOString()
    );
}

// User notes
export async function getUserNote(model_hash: string): Promise<string> {
    const row: any = await db.get('SELECT note FROM user_notes WHERE model_hash = ?', model_hash);
    return row ? row.note : '';
}

export async function setUserNote(model_hash: string, note: string): Promise<void> {
    await db.run(
        `INSERT INTO user_notes (model_hash, note, created_at, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(model_hash) DO UPDATE SET note=excluded.note, updated_at=CURRENT_TIMESTAMP`,
        model_hash,
        note
    );
}

// Tags
export async function getTags(model_hash: string): Promise<string[]> {
    return db.all('SELECT tag FROM tags WHERE model_hash = ?', model_hash);
}

export async function addTag(model_hash: string, tag: string): Promise<void> {
    await db.run(
        'INSERT OR IGNORE INTO tags (model_hash, tag) VALUES (?, ?)',
        model_hash,
        tag
    );
}

export async function removeTag(model_hash: string, tag: string): Promise<void> {
    await db.run(
        'DELETE FROM tags WHERE model_hash = ? AND tag = ?',
        model_hash,
        tag
    );
}

// Civitai version utilities
export async function setCivitaiVersionId(model_hash: string, version_id: number): Promise<void> {
    await db.run(
        'UPDATE models SET civitai_version_id = ? WHERE model_hash = ?',
        version_id,
        model_hash
    );
}

export async function getCivitaiVersionId(model_hash: string): Promise<number | null> {
    const row: any = await db.get(
        'SELECT civitai_version_id FROM models WHERE model_hash = ?',
        model_hash
    );
    return row && row.civitai_version_id ? row.civitai_version_id : null;
}

// Model images
export async function saveModelImage(
    model_hash: string,
    imageUrl: string,
    _index: number,
    meta: any
): Promise<void> {
    try {
        await db.run(
            `INSERT OR REPLACE INTO images
         (model_hash, image_path, source_url, created_at, meta_json)
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

export async function getModelImages(model_hash: string): Promise<any[]> {
    return db.all(
        'SELECT * FROM images WHERE model_hash = ? ORDER BY id ASC',
        model_hash
    );
}
