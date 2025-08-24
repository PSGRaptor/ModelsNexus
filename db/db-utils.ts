// START OF FILE: main/db-utils.ts

import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import fsSync from 'node:fs';
import pathNode from 'node:path';

const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'models.db');

export function getDbPath(): string {
    return dbPath;
}

export let db: Database<sqlite3.Database, sqlite3.Statement>;

/* ----------------------------------------------------------------------------
 * Robust SQL migration runner
 *  - Supports "ALTER TABLE ... ADD COLUMN IF NOT EXISTS ..." on older SQLite
 *  - Skips no-op/duplicate operations safely
 * ---------------------------------------------------------------------------- */

function splitSqlStatements(rawSql: string): string[] {
    // Normalize
    let sql = rawSql.replace(/^\uFEFF/, ''); // strip BOM if present

    // Remove block comments /* ... */
    sql = sql.replace(/\/\*[\s\S]*?\*\//g, '');

    // Remove line comments at start of line: --, //, #, Unicode dashes
    sql = sql
        .split(/\r?\n/)
        .map((line) => {
            const trimmed = line.trimStart();

            // Full-line comments
            if (
                trimmed.startsWith('--') ||
                trimmed.startsWith('//') ||
                trimmed.startsWith('#') ||
                trimmed.startsWith('—') || // em dash
                trimmed.startsWith('–')    // en dash
            ) {
                return '';
            }

            // Strip inline comments (only when not inside quotes).
            // We’ll do a simple scan to ignore text inside '...' or "..."
            let out = '';
            let inSQ = false; // single quotes
            let inDQ = false; // double quotes

            for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                const next = line[i + 1];

                // toggle quotes
                if (!inDQ && ch === '\'' ) inSQ = !inSQ;
                else if (!inSQ && ch === '"' ) inDQ = !inDQ;

                if (!inSQ && !inDQ) {
                    // inline comment starters
                    if (ch === '-' && next === '-') break;        // --
                    if (ch === '/' && next === '/') break;        // //
                    if (ch === '#') break;                         // #
                    if ((ch === '—' || ch === '–')) break;         // em/en dash used as a "comment"
                }

                out += ch;
            }
            return out;
        })
        .join('\n');

    // Now split on semicolons that terminate statements
    return sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

async function columnExists(
    dbInst: Database<sqlite3.Database, sqlite3.Statement>,
    table: string,
    column: string
): Promise<boolean> {
    const rows = await dbInst.all(`PRAGMA table_info(${table})`);
    return (rows || []).some((r: any) => String(r.name).toLowerCase() === column.toLowerCase());
}

function isIgnorableError(err: any): boolean {
    const msg = String(err?.message || err).toLowerCase();
    return (
        msg.includes('duplicate column name') ||
        msg.includes('already exists') ||
        msg.includes('index') && msg.includes('exists') ||
        msg.includes('no such table') && msg.includes('if exists') // defensive
    );
}

async function execStatementSmart(
    dbInst: Database<sqlite3.Database, sqlite3.Statement>,
    rawStmt: string
) {
    const stmt = rawStmt.trim();
    if (!stmt) return;

    // Handle: ALTER TABLE <table> ADD COLUMN IF NOT EXISTS <column> <type/def...>
    const m = stmt.match(
        /^alter\s+table\s+([A-Za-z_][\w]*)\s+add\s+column\s+if\s+not\s+exists\s+([A-Za-z_][\w]*)\s+(.+)$/i
    );
    if (m) {
        const [, table, column, tail] = m;
        if (await columnExists(dbInst, table, column)) {
            // Column already present: skip
            return;
        }
        // Execute as: ALTER TABLE <table> ADD COLUMN <column> <tail>
        const fallback = `ALTER TABLE ${table} ADD COLUMN ${column} ${tail}`;
        await dbInst.exec(fallback);
        return;
    }

    // For everything else, try exec directly; ignore benign idempotent errors
    try {
        await dbInst.exec(stmt);
    } catch (err) {
        if (isIgnorableError(err)) {
            // no-op
            return;
        }
        throw err;
    }
}

async function runSqlMigration(
    dbInst: Database<sqlite3.Database, sqlite3.Statement>,
    filename: string
): Promise<void> {
    const migrationsDir = pathNode.join(app.getAppPath(), 'db', 'migrations');
    const file = pathNode.join(migrationsDir, filename);

    if (!fsSync.existsSync(file)) return;

    const raw = fsSync.readFileSync(file, 'utf8');
    const statements = splitSqlStatements(raw);

    for (const s of statements) {
        await execStatementSmart(dbInst, s);
    }
}

/** Run all file-based migrations in order. Extend this list over time. */
async function runAllMigrations(dbInst: Database<sqlite3.Database, sqlite3.Statement>): Promise<void> {
    const files = [
        '002_incremental.sql',
        '003_perf.sql',
    ];
    for (const f of files) {
        try {
            await runSqlMigration(dbInst, f);
        } catch (err) {
            console.error(`[DB] Migration ${f} failed:`, err);
            throw err;
        }
    }
}

/* ----------------------------------------------------------------------------
 * Back-compat exports (if other modules call these directly)
 * ---------------------------------------------------------------------------- */
export async function runIncrementalMigration(dbInst: Database<sqlite3.Database, sqlite3.Statement>) {
    await runSqlMigration(dbInst, '002_incremental.sql');
}
export async function runPerfMigration(dbInst: Database<sqlite3.Database, sqlite3.Statement>) {
    await runSqlMigration(dbInst, '003_perf.sql');
}

/* ----------------------------------------------------------------------------
 * initDb: open, PRAGMAs, base schema, inline additive columns, then migrations
 * ---------------------------------------------------------------------------- */
export async function initDb(): Promise<Database<sqlite3.Database, sqlite3.Statement>> {
    await fs.mkdir(path.dirname(dbPath), { recursive: true });

    db = await open({
        filename: dbPath,
        driver: sqlite3.Database,
    });

    // Performance PRAGMAs
    await db.exec(`
    PRAGMA journal_mode = WAL;          -- concurrent readers, faster app startup
    PRAGMA synchronous = NORMAL;        -- good durability/speed trade-off
    PRAGMA temp_store = MEMORY;         -- keep temp btrees in RAM
    PRAGMA cache_size = -20000;         -- ~20,000 pages in KB units (negative => KB); tune if RAM-limited
    PRAGMA mmap_size = 268435456;       -- 256MB memory-mapped IO if supported
  `);

    // Base schema
    const schemaFile = path.join(app.getAppPath(), 'db', 'schema.sql');
    try {
        const schemaSql = await fs.readFile(schemaFile, 'utf-8');
        await db.exec(schemaSql);
    } catch (err) {
        console.error('Error applying base schema from', schemaFile, err);
        throw err;
    }

    // Inline additive columns (kept for back-compat and first-run installs)
    const tableInfo = async (table: string) => db.all(`PRAGMA table_info(${table})`);

    let columns = await tableInfo('models');

    if (!columns.some((c: any) => c.name.toLowerCase() === 'model_name')) {
        await db.exec(`ALTER TABLE models ADD COLUMN model_name TEXT`);
    }

    columns = await tableInfo('models');
    if (!columns.some((c: any) => c.name.toLowerCase() === 'prompt_positive')) {
        await db.exec(`ALTER TABLE models ADD COLUMN prompt_positive TEXT`);
    }

    columns = await tableInfo('models');
    if (!columns.some((c: any) => c.name.toLowerCase() === 'prompt_negative')) {
        await db.exec(`ALTER TABLE models ADD COLUMN prompt_negative TEXT`);
    }

    columns = await tableInfo('models');
    if (!columns.some((c: any) => c.name.toLowerCase() === 'main_image_path')) {
        await db.exec(`ALTER TABLE models ADD COLUMN main_image_path TEXT`);
    }

    columns = await tableInfo('models');
    if (!columns.some((c: any) => c.name.toLowerCase() === 'notes')) {
        await db.exec(`ALTER TABLE models ADD COLUMN notes TEXT`);
    }

    columns = await tableInfo('models');
    if (!columns.some((c: any) => c.name.toLowerCase() === 'sort_order')) {
        await db.exec(`ALTER TABLE models ADD COLUMN sort_order INTEGER DEFAULT 0`);
    }

    columns = await tableInfo('images');
    if (!columns.some((c: any) => c.name.toLowerCase() === 'sort_order')) {
        await db.exec(`ALTER TABLE images ADD COLUMN sort_order INTEGER DEFAULT 0`);
    }

    // Run file-based migrations (will tolerate IF NOT EXISTS on older SQLite)
    await runAllMigrations(db);

    return db;
}

/* ----------------------------------------------------------------------------
 * Utility functions (unchanged behavior)
 * ---------------------------------------------------------------------------- */

export async function updateFavorite(model_hash: string, is_favorite: number): Promise<void> {
    await db.run(
        'UPDATE models SET is_favorite = ? WHERE model_hash = ?',
        is_favorite,
        model_hash
    );
}

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

export async function updateModelMainImage(modelHash: string, imagePath: string): Promise<void> {
    await db.run(
        'UPDATE models SET main_image_path = ? WHERE model_hash = ?',
        imagePath,
        modelHash
    );
}

export async function getAllModels(): Promise<any[]> {
    return db.all(`SELECT * FROM models ORDER BY date_added DESC`);
}

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

// END OF FILE: main/db-utils.ts
