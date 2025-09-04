// START OF FILE: main/nsfw-index.ts
import { app } from 'electron';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';

export type NsfwIndexMap = Record<string, boolean>;
export type NsfwIndex = { images: NsfwIndexMap; models: NsfwIndexMap };

// Canonicalize: strip file://, decode, forward slashes, lowercase
export function canonPath(p?: string): string {
    if (!p) return '';
    let raw = p.startsWith('file://') ? p.slice(7) : p;
    try { raw = decodeURIComponent(raw); } catch {}
    return raw.replace(/\\/g, '/').toLowerCase();
}

const FILE_NAME = 'nsfw-index.json';
let cache: NsfwIndex | null = null;
let filePath: string;

function getFilePath() {
    if (filePath) return filePath;
    const dir = app.getPath('userData');
    filePath = path.join(dir, FILE_NAME);
    return filePath;
}

async function ensureLoaded(): Promise<NsfwIndex> {
    if (cache) return cache;
    const fp = getFilePath();
    try {
        if (!fs.existsSync(fp)) {
            cache = { images: {}, models: {} };
            await fsp.writeFile(fp, JSON.stringify(cache, null, 2), 'utf8');
            return cache;
        }
        const text = await fsp.readFile(fp, 'utf8');
        const json = JSON.parse(text || '{}');

        // Normalize everything on load
        const outImages: NsfwIndexMap = {};
        const outModels: NsfwIndexMap = {};
        for (const [k, v] of Object.entries(json.images ?? {})) outImages[canonPath(k)] = !!v;
        for (const [k, v] of Object.entries(json.models ?? {})) {
            const key = String(k);
            outModels[key] = !!v;
            outModels[key.toLowerCase()] = !!v;
        }
        cache = { images: outImages, models: outModels };
    } catch {
        cache = { images: {}, models: {} };
    }
    return cache!;
}

async function persist(): Promise<void> {
    if (!cache) return;
    const fp = getFilePath();
    const data: NsfwIndex = { images: cache.images, models: cache.models };
    await fsp.writeFile(fp, JSON.stringify(data, null, 2), 'utf8');
}

export async function getNsfwIndex(): Promise<NsfwIndex> {
    return ensureLoaded();
}

export async function setImageFlag(key: string, value: boolean): Promise<void> {
    const idx = await ensureLoaded();
    const c = canonPath(key);
    idx.images[c] = !!value;
    await persist();
}

export async function setModelFlag(hash: string, value: boolean): Promise<void> {
    const idx = await ensureLoaded();
    const h = (hash || '').trim();
    idx.models[h] = !!value;
    idx.models[h.toLowerCase()] = !!value;
    await persist();
}

export async function clearNsfwIndex(): Promise<void> {
    cache = { images: {}, models: {} };
    await persist();
}
// END OF FILE: main/nsfw-index.ts
