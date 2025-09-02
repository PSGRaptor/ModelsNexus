// START OF FILE: main/nsfw-index.ts
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export type NSFWIndex = {
    models: Record<string, boolean>; // key: model_hash (lowercased)
    images: Record<string, boolean>; // key: normalized file:// path (lowercased)
};

const INDEX_PATH = () => path.join(app.getPath('userData'), 'nsfw-index.json');

function readJsonSafe<T>(file: string, fallback: T): T {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
        return fallback;
    }
}

function writeJsonSafe<T>(file: string, data: T) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

export function loadIndex(): NSFWIndex {
    return readJsonSafe<NSFWIndex>(INDEX_PATH(), { models: {}, images: {} });
}

export function setModelNSFW(hash: string, value: boolean): NSFWIndex {
    const idx = loadIndex();
    const key = String(hash || '').toLowerCase();
    if (!key) return idx;
    idx.models[key] = !!value;
    writeJsonSafe(INDEX_PATH(), idx);
    return idx;
}

export function normalizeImgKey(src: string): string {
    if (!src) return '';
    let v = src.trim();
    // normalize local paths to file://
    if (/^[a-zA-Z]:[\\/]/.test(v) || v.startsWith('/')) v = `file://${v}`;
    return v.replace(/\\/g, '/').replace(/\/{2,}/g, '/').toLowerCase();
}

export function setImageNSFW(imgSrcOrPath: string, value: boolean): NSFWIndex {
    const idx = loadIndex();
    const key = normalizeImgKey(imgSrcOrPath);
    if (!key) return idx;
    idx.images[key] = !!value;
    writeJsonSafe(INDEX_PATH(), idx);
    return idx;
}

export function mergeNSFWBatch(batch: {
    models?: Array<{ hash: string; nsfw: boolean }>;
    images?: Array<{ src: string; nsfw: boolean }>;
}): NSFWIndex {
    const idx = loadIndex();
    for (const m of batch.models ?? []) {
        const key = String(m.hash || '').toLowerCase();
        if (key) idx.models[key] = !!m.nsfw;
    }
    for (const i of batch.images ?? []) {
        const key = normalizeImgKey(i.src);
        if (key) idx.images[key] = !!i.nsfw;
    }
    writeJsonSafe(INDEX_PATH(), idx);
    return idx;
}
// END OF FILE: main/nsfw-index.ts
