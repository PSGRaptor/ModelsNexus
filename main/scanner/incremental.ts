// File: main/scanner/incremental.ts
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';

export type IncrementalScanOptions = {
    // function that decides whether a path is a "model file"
    isModelFile: (p: string) => boolean;
    // your existing ingestion pipeline:
    // 1) reads/derives model metadata
    // 2) writes to your DB
    // 3) returns the primary key / hash or any info you like
    processModelFile: (filePath: string) => Promise<unknown>;
    // if true, ignore cache and force full processing
    forceFull?: boolean;
    // maximum parallelism (keep small to avoid disk thrash)
    concurrency?: number;
};

type FileKey = string;
type StatCompact = { size: number; mtimeMs: number };
type CacheShape = {
    version: number;
    files: Record<FileKey, StatCompact>;
};

const CACHE_VERSION = 1;

// ---------- cache helpers ----------
function getCacheFilePath(): string {
    const dir = app.getPath('userData');
    return path.join(dir, 'incremental-scan-cache.json');
}

async function loadCache(): Promise<CacheShape> {
    try {
        const p = getCacheFilePath();
        const raw = await fsp.readFile(p, 'utf8');
        const parsed = JSON.parse(raw) as CacheShape;
        // minimal forward-compat check
        if (!parsed || typeof parsed !== 'object' || !parsed.files) {
            return { version: CACHE_VERSION, files: {} };
        }
        return parsed;
    } catch {
        return { version: CACHE_VERSION, files: {} };
    }
}

async function saveCache(cache: CacheShape): Promise<void> {
    const p = getCacheFilePath();
    await fsp.mkdir(path.dirname(p), { recursive: true });
    await fsp.writeFile(p, JSON.stringify(cache, null, 2), 'utf8');
}

// ---------- small utils ----------
function statToCompact(st: fs.Stats): StatCompact {
    return { size: Number(st.size), mtimeMs: Number(st.mtimeMs) };
}

async function getAllFilesRecursive(root: string): Promise<string[]> {
    const out: string[] = [];
    async function walk(dir: string) {
        let entries: fs.Dirent[];
        try {
            entries = await fsp.readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }
        await Promise.all(
            entries.map(async (ent) => {
                const full = path.join(dir, ent.name);
                if (ent.isDirectory()) return walk(full);
                if (ent.isFile()) out.push(full);
            }),
        );
    }
    await walk(root);
    return out;
}

function chunk<T>(arr: T[], n: number): T[][] {
    const res: T[][] = [];
    for (let i = 0; i < arr.length; i += n) res.push(arr.slice(i, i + n));
    return res;
}

// ---------- main API ----------
export async function scanNewOrChanged(
    scanRoots: string[],
    opts: IncrementalScanOptions,
): Promise<{ processed: number; skipped: number; totalCandidates: number }> {
    const { isModelFile, processModelFile, forceFull = false, concurrency = 2 } = opts;

    // 1) gather all candidate files
    const candidatesSet = new Set<string>();
    for (const root of scanRoots) {
        const exists = fs.existsSync(root);
        if (!exists) continue;
        const files = await getAllFilesRecursive(root);
        for (const f of files) {
            if (isModelFile(f)) candidatesSet.add(path.normalize(f));
        }
    }
    const candidates = Array.from(candidatesSet);
    const totalCandidates = candidates.length;

    if (forceFull) {
        // process everything (slow path, but available on demand)
        let processed = 0;
        const batches = chunk(candidates, concurrency);
        for (const batch of batches) {
            await Promise.all(
                batch.map(async (file) => {
                    await processModelFile(file);
                    processed += 1;
                }),
            );
        }
        // refresh cache after full run
        const cache: CacheShape = { version: CACHE_VERSION, files: {} };
        for (const f of candidates) {
            try {
                const st = await fsp.stat(f);
                cache.files[f] = statToCompact(st);
            } catch {}
        }
        await saveCache(cache);
        return { processed, skipped: 0, totalCandidates };
    }

    // 2) incremental path (fast)
    const cache = await loadCache();
    let processed = 0;
    let skipped = 0;

    const batches = chunk(candidates, concurrency);
    for (const batch of batches) {
        await Promise.all(
            batch.map(async (file) => {
                try {
                    const st = await fsp.stat(file);
                    const comp = statToCompact(st);
                    const prev = cache.files[file];
                    const unchanged = prev && prev.size === comp.size && prev.mtimeMs === comp.mtimeMs;

                    if (unchanged) {
                        skipped += 1;
                        return;
                    }

                    // changed/new → process and update cache entry
                    await processModelFile(file);
                    cache.files[file] = comp;
                    processed += 1;
                } catch {
                    // ignore unreadable files; do not update cache entry
                }
            }),
        );
    }

    // 3) prune cache entries for deleted files
    const stillThere = new Set(candidates);
    for (const key of Object.keys(cache.files)) {
        if (!stillThere.has(key)) delete cache.files[key];
    }

    await saveCache(cache);
    return { processed, skipped, totalCandidates };
}
