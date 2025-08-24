// START OF FILE: main/scanner/incrementalIndexer.ts

import path from 'node:path';
import fs from 'node:fs/promises';
import { Dirent } from 'node:fs';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export type ScanMode = 'incremental' | 'full';

export interface ScanProgress {
    processed: number;
    total: number;
    phase: 'enumerating' | 'hashing' | 'done';
    currentPath?: string;
}

export interface IndexerOptions {
    db: any;                         // accepts 'sqlite' Database (promise API)
    roots: string[];                 // folders to scan
    allowedExts: string[];           // e.g. ['.safetensors','.pt','.ckpt','.lora','.gguf']
    mode: ScanMode;
    signal?: AbortSignal;            // allows cancel
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

// Use BLAKE3 when available; fall back to SHA256 if the runtime doesn't expose blake3
function blake3Hex(buffer: Buffer): string {
    try {
        const h = createHash('blake3');
        h.update(buffer);
        return h.digest('hex');
    } catch {
        const h = createHash('sha256');
        h.update(buffer);
        return h.digest('hex');
    }
}

async function enumerateFiles(
    roots: string[],
    allowedExts: string[],
    signal?: AbortSignal
): Promise<string[]> {
    const out: string[] = [];
    for (const root of roots) {
        await walk(root);
        if (signal?.aborted) break;
    }
    return out;

    async function walk(dir: string) {
        if (signal?.aborted) return;
        let entries: Dirent[];
        try {
            // Note: we must import Dirent from 'node:fs' (not fs/promises)
            entries = (await fs.readdir(dir, { withFileTypes: true })) as unknown as Dirent[];
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

async function dbGetMapByPath(db: any) {
    // Build a map of known files for O(1) lookups
    // Only the fields we need to decide "skip or process"
    const rows = await db.all(
        `SELECT file_path, file_size, mtime_epoch, content_hash
     FROM models`
    );
    const map = new Map<string, { size: number; mtime: number; hash?: string }>();
    for (const r of rows || []) {
        map.set(String(r.file_path), {
            size: Number(r.file_size ?? 0),
            mtime: Number(r.mtime_epoch ?? 0),
            hash: r.content_hash ? String(r.content_hash) : undefined,
        });
    }
    return map;
}

function needsWork(
    existing: { size: number; mtime: number; hash?: string } | undefined,
    size: number,
    mtime: number,
    mode: ScanMode
): boolean {
    if (!existing) return true;        // New file
    if (mode === 'full') return true;  // Full scan forces processing
    // Incremental: skip if the file looks identical and already hashed
    if (existing.size === size && existing.mtime === mtime && existing.hash) return false;
    return true;
}

async function insertOrUpdateShell(
    db: any,
    filePath: string,
    size: number,
    mtime: number
) {
    // Upsert without requiring a UNIQUE constraint:
    const row = await db.get(`SELECT id FROM models WHERE file_path = ?`, [filePath]);
    if (row?.id) {
        await db.run(
            `UPDATE models
         SET file_size = ?, mtime_epoch = ?, last_scanned_at = strftime('%s','now')
       WHERE id = ?`,
            [size, mtime, row.id]
        );
    } else {
        await db.run(
            `INSERT INTO models (file_path, file_size, mtime_epoch, last_scanned_at)
       VALUES (?, ?, ?, strftime('%s','now'))`,
            [filePath, size, mtime]
        );
    }
}

async function setHash(db: any, filePath: string, hex: string) {
    await db.run(
        `UPDATE models
        SET content_hash = ?, last_scanned_at = strftime('%s','now')
      WHERE file_path = ?`,
        [hex, filePath]
    );
}

// -----------------------------------------------------------------------------
// Indexer
// -----------------------------------------------------------------------------
export class IncrementalIndexer extends EventEmitter {
    private opts: IndexerOptions;

    constructor(opts: IndexerOptions) {
        super();
        this.opts = opts;
    }

    async run(): Promise<void> {
        const { db, roots, allowedExts, signal, mode } = this.opts;

        // 1) Enumerate filesystem (fast)
        const allFiles = await enumerateFiles(roots, allowedExts, signal);

        // 2) Build map of what DB already knows (fast single query)
        const byPath = await dbGetMapByPath(db);

        // 3) Stat all files & build candidate list (only new/changed)
        const candidates: Array<{ filePath: string; size: number; mtime: number; existing?: { size: number; mtime: number; hash?: string } }> = [];
        for (const filePath of allFiles) {
            if (signal?.aborted) break;
            try {
                const stat = await fs.stat(filePath);
                const size = stat.size;
                const mtime = Math.floor(stat.mtimeMs / 1000);
                const existing = byPath.get(filePath);
                if (needsWork(existing, size, mtime, mode)) {
                    candidates.push({ filePath, size, mtime, existing });
                }
            } catch {
                // ignore unreadable files
            }
        }

        // 4) Emit "enumerating" progress with total = number of candidates
        let processed = 0;
        const total = candidates.length;
        this.emit('progress', <ScanProgress>{ processed, total, phase: 'enumerating' });

        // Nothing to do? We’re done.
        if (total === 0) {
            this.emit('progress', <ScanProgress>{ processed: 0, total: 0, phase: 'done' });
            return;
        }

        // 5) Process only candidates (insert/update + hash when needed)
        for (const c of candidates) {
            if (signal?.aborted) break;

            // Make sure a shell row exists with current size/mtime
            await insertOrUpdateShell(db, c.filePath, c.size, c.mtime);

            // Hash is needed if:
            //  - full mode, or
            //  - previous hash missing, or
            //  - size/mtime changed (we already filtered by this)
            const mustHash = mode === 'full' || !c.existing?.hash || c.existing.size !== c.size || c.existing.mtime !== c.mtime;

            if (mustHash) {
                this.emit('progress', <ScanProgress>{
                    processed,
                    total,
                    phase: 'hashing',
                    currentPath: c.filePath,
                });

                try {
                    // Read and hash candidate only (keeps scans fast when few files changed)
                    const buf = await fs.readFile(c.filePath);
                    const hex = blake3Hex(buf);
                    await setHash(db, c.filePath, hex);
                } catch {
                    // swallow hashing errors for a single file; continue with the rest
                }
            }

            processed++;
            // Periodically update UI (and at the end)
            if (processed % 25 === 0 || processed === total) {
                this.emit('progress', <ScanProgress>{
                    processed,
                    total,
                    phase: processed === total ? 'done' : 'enumerating',
                });
            }
        }
    }
}

// END OF FILE: main/scanner/incrementalIndexer.ts
