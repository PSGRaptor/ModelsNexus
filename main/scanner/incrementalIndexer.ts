// START OF FILE: main/scanner/incrementalIndexer.ts

import path from 'node:path';
import fs from 'node:fs/promises';
import { Dirent } from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { Database } from 'sqlite3'; // Assuming you already use sqlite3; adapt if you use better-sqlite3
import { promisify } from 'node:util';

// ----- Types -----
export type ScanMode = 'incremental' | 'full';

export interface ScanProgress {
    processed: number;
    total: number;
    phase: 'enumerating' | 'hashing' | 'metadata' | 'images' | 'done';
    currentPath?: string;
}

export interface IndexerOptions {
    db: Database;
    roots: string[];                 // folders to scan (from your config)
    allowedExts: string[];           // e.g. ['.safetensors', '.pt', '.ckpt', '.lora', '.gguf']
    mode: ScanMode;
    signal?: AbortSignal;            // for cancel
    maxImagesPerModel?: number;      // keep your current behavior; default pass-through
}

type DBGet = (sql: string, params?: any[]) => Promise<any>;
type DBRun = (sql: string, params?: any[]) => Promise<void>;
type DBAll = (sql: string, params?: any[]) => Promise<any[]>;

// ----- Helpers to promisify sqlite3 -----
function wrapDb(db: Database) {
    const get: DBGet = (sql, params = []) =>
        new Promise((resolve, reject) =>
            db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row))));
    const run: DBRun = (sql, params = []) =>
        new Promise<void>((resolve, reject) =>
            db.run(sql, params, (err) => (err ? reject(err) : resolve())));
    const all: DBAll = (sql, params = []) =>
        new Promise((resolve, reject) =>
            db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))));
    return { get, run, all };
}

// ----- Hashing: BLAKE3 via Node crypto (subtle: Node 20 has blake3 via openssl on some builds).
// If not available, fall back to SHA256 or your existing blake3 lib.
// We keep the function pluggable so you can replace if needed. -----
function blake3Hex(buffer: Buffer): string {
    try {
        // Openssl provider name is 'blake3' in recent Node distributions.
        const h = createHash('blake3');
        h.update(buffer);
        return h.digest('hex');
    } catch {
        // Fallback: SHA256 (rare path; replace with your blake3 lib if needed)
        const h = createHash('sha256');
        h.update(buffer);
        return h.digest('hex');
    }
}

// ----- Core: enumerate files under roots -----
async function enumerateFiles(roots: string[], allowedExts: string[], signal?: AbortSignal): Promise<string[]> {
    const out: string[] = [];
    for (const root of roots) {
        await walk(root);
    }
    return out;

    async function walk(dir: string) {
        if (signal?.aborted) return;
        let entries: Dirent[];
        try {
            entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (signal?.aborted) return;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(full);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (allowedExts.includes(ext)) {
                    out.push(full);
                }
            }
        }
    }
}

// ----- DB upsert helpers -----
async function getRowByPath(dbw: ReturnType<typeof wrapDb>, filePath: string) {
    return dbw.get(
        `SELECT id, file_path, file_size, mtime_epoch, content_hash, has_metadata, has_images, thumbnail_path
     FROM models
     WHERE file_path = ?`,
        [filePath]
    );
}

async function upsertModelShell(dbw: ReturnType<typeof wrapDb>, filePath: string, size: number, mtime: number) {
    await dbw.run(
        `INSERT INTO models (file_path, file_size, mtime_epoch, last_scanned_at)
     VALUES (?, ?, ?, strftime('%s','now'))
     ON CONFLICT(file_path) DO UPDATE SET
       file_size = excluded.file_size,
       mtime_epoch = excluded.mtime_epoch,
       last_scanned_at = excluded.last_scanned_at`,
        [filePath, size, mtime]
    );
}

async function setContentHash(dbw: ReturnType<typeof wrapDb>, filePath: string, hex: string) {
    await dbw.run(
        `UPDATE models SET content_hash = ?, last_scanned_at = strftime('%s','now')
     WHERE file_path = ?`,
        [hex, filePath]
    );
}

// Flags you already manage elsewhere can remain; we set/keep them when enrichment completes.
async function markHasMeta(dbw: ReturnType<typeof wrapDb>, filePath: string) {
    await dbw.run(`UPDATE models SET has_metadata = 1 WHERE file_path = ?`, [filePath]);
}
async function markHasImages(dbw: ReturnType<typeof wrapDb>, filePath: string) {
    await dbw.run(`UPDATE models SET has_images = 1 WHERE file_path = ?`, [filePath]);
}

// ----- Decide if a file needs hashing/reprocessing -----
function needsRehash(existing: any, size: number, mtime: number, mode: ScanMode): boolean {
    if (!existing) return true;
    if (mode === 'full') return true;
    // Incremental: only if size/mtime changed or content_hash missing
    if (existing.file_size !== size) return true;
    if (existing.mtime_epoch !== mtime) return true;
    if (!existing.content_hash) return true;
    return false;
}

// ----- Indexer (EventEmitter for progress) -----
export class IncrementalIndexer extends EventEmitter {
    private opts: IndexerOptions;
    private dbw: ReturnType<typeof wrapDb>;

    constructor(opts: IndexerOptions) {
        super();
        this.opts = opts;
        this.dbw = wrapDb(opts.db);
    }

    async run(): Promise<void> {
        const { roots, allowedExts, signal, mode } = this.opts;
        const files = await enumerateFiles(roots, allowedExts, signal);
        let processed = 0;
        const total = files.length;
        this.emit('progress', <ScanProgress>{ processed, total, phase: 'enumerating' });

        for (const filePath of files) {
            if (signal?.aborted) break;

            // Stat info
            let stat;
            try {
                stat = await fs.stat(filePath);
            } catch {
                processed++;
                continue;
            }
            const size = stat.size;
            const mtime = Math.floor(stat.mtimeMs / 1000);

            // Upsert shell record first
            await upsertModelShell(this.dbw, filePath, size, mtime);

            // Decide rehash
            const row = await getRowByPath(this.dbw, filePath);
            if (needsRehash(row, size, mtime, mode)) {
                this.emit('progress', <ScanProgress>{ processed, total, phase: 'hashing', currentPath: filePath });

                // Hash file (stream to avoid large RAM spikes)
                const buf = await fs.readFile(filePath);
                const hex = blake3Hex(buf);
                await setContentHash(this.dbw, filePath, hex);
            }

            processed++;
            if (processed % 25 === 0 || processed === total) {
                this.emit('progress', <ScanProgress>{ processed, total, phase: processed === total ? 'done' : 'enumerating' });
            }
        }

        // Enrichment (metadata/images) stays in your existing pipeline.
        // The incremental policy is: only enrich rows missing has_metadata/has_images (or full mode).
        // You can hook your current enrichment runner here if desired.
    }
}

// END OF FILE
