// db/db-utils.ts
import path from 'path';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

// Use Electron's app.getPath('userData') to store the DB in the user's profile
const getDbPath = () => {
    // Fallback to current dir if electron is not available
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

export async function initDb() {
    db = await open({
        filename: getDbPath(),
        driver: sqlite3.Database,
    });
    // Apply schema if new
    await db.exec(await require('fs').promises.readFile(path.join(__dirname, 'schema.sql'), 'utf-8'));
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

// Fetch all models from DB
export async function getAllModels() {
    return db.all(`SELECT * FROM models ORDER BY date_added DESC`);
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
