// File: main/metadata/sdMetadata.ts
// Robust, non-mutating Stable Diffusion metadata reader used by the main process.
// - PNG: reads tEXt / zTXt / iTXt chunks
// - JPEG/WEBP: reads EXIF/XMP/Comment blocks
// - Detects A1111, ComfyUI (workflow JSON), InvokeAI, NovelAI (stealth / legacy)
// - Returns a normalized object; you can format it to any UI-friendly string.

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import ExifReader from 'exifreader';

export type SDSettings = Record<string, string | number | boolean>;

export interface SDMeta {
    tool?: 'A1111' | 'ComfyUI' | 'InvokeAI' | 'NovelAI' | 'Unknown';
    positive?: string | string[];
    negative?: string | string[];
    settings?: SDSettings;
    raw?: any; // raw extracted blocks/chunks for debug
}

/* ---------------- PNG helpers ---------------- */

function isPNG(buf: Buffer): boolean {
    if (buf.length < 8) return false;
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) return false;
    return true;
}

type PngChunk = { type: string; data: Buffer };

function readPngChunks(buf: Buffer): PngChunk[] {
    const chunks: PngChunk[] = [];
    let off = 8; // skip signature
    while (off + 8 <= buf.length) {
        const len = buf.readUInt32BE(off); off += 4;
        const type = buf.slice(off, off + 4).toString('ascii'); off += 4;
        const data = buf.slice(off, off + len); off += len;
        off += 4; // CRC
        chunks.push({ type, data });
        if (type === 'IEND') break;
    }
    return chunks;
}

function decode_tEXt(data: Buffer): { key: string; value: string } | null {
    const nullIdx = data.indexOf(0);
    if (nullIdx < 0) return null;
    const key = data.slice(0, nullIdx).toString('utf8');
    const value = data.slice(nullIdx + 1).toString('utf8');
    return { key, value };
}

function decode_zTXt(data: Buffer): { key: string; value: string } | null {
    const nullIdx = data.indexOf(0);
    if (nullIdx < 0 || nullIdx + 2 >= data.length) return null;
    const key = data.slice(0, nullIdx).toString('utf8');
    const compData = data.slice(nullIdx + 2); // skip compression flag/method
    try {
        const inflated = zlib.inflateSync(compData);
        return { key, value: inflated.toString('utf8') };
    } catch {
        return { key, value: '' };
    }
}

function decode_iTXt(data: Buffer): { key: string; value: string } | null {
    let off = 0;
    const readNullTerm = () => {
        const idx = data.indexOf(0, off);
        const s = data.slice(off, idx < 0 ? data.length : idx).toString('utf8');
        off = idx < 0 ? data.length : idx + 1;
        return s;
    };
    const key = readNullTerm();
    if (!key) return null;
    const compressionFlag = data[off++] || 0;
    off++; // compressionMethod
    readNullTerm(); // language
    readNullTerm(); // translated
    const text = data.slice(off);
    try {
        const value = compressionFlag ? zlib.inflateSync(text).toString('utf8') : text.toString('utf8');
        return { key, value };
    } catch {
        return { key, value: text.toString('utf8') };
    }
}

function extractPngTextBlocks(buf: Buffer): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const ch of readPngChunks(buf)) {
        if (ch.type === 'tEXt') {
            const kv = decode_tEXt(ch.data);
            if (kv) (out[kv.key] ??= []).push(kv.value);
        } else if (ch.type === 'zTXt') {
            const kv = decode_zTXt(ch.data);
            if (kv) (out[kv.key] ??= []).push(kv.value);
        } else if (ch.type === 'iTXt') {
            const kv = decode_iTXt(ch.data);
            if (kv) (out[kv.key] ??= []).push(kv.value);
        }
    }
    return out;
}

/* -------------- A1111 parser ---------------- */

function parseA1111Parameters(params: string): { positive?: string; negative?: string; settings?: SDSettings } {
    const joined = params.replace(/\r/g, '');
    const negIdx = joined.indexOf('Negative prompt:');

    let positive = joined;
    let negative = '';
    let tail = '';

    if (negIdx >= 0) {
        positive = joined.slice(0, negIdx).trim();
        const afterNeg = joined.slice(negIdx + 'Negative prompt:'.length);
        // Try to split negative from settings
        const idxSteps = afterNeg.search(/\b(Steps|Sampler|CFG|Seed|Size|Model|Model hash)\b/i);
        if (idxSteps >= 0) {
            negative = afterNeg.slice(0, idxSteps).trim();
            tail = afterNeg.slice(idxSteps).trim();
        } else {
            negative = afterNeg.trim();
        }
    }

    const settings: SDSettings = {};
    const tailLine = tail.split('\n').pop() || tail;

    // naive split by commas while respecting parentheses depth
    let token = '';
    let depth = 0;
    const tokens: string[] = [];
    for (const ch of tailLine) {
        if (ch === '(') depth++;
        if (ch === ')') depth = Math.max(0, depth - 1);
        if (ch === ',' && depth === 0) {
            if (token.trim()) tokens.push(token.trim());
            token = '';
        } else token += ch;
    }
    if (token.trim()) tokens.push(token.trim());

    for (const t of tokens) {
        const kv = t.split(':');
        if (kv.length >= 2) {
            const k = kv[0].trim();
            const v = kv.slice(1).join(':').trim();
            settings[k] = v;
        }
    }

    return { positive: positive.trim(), negative: negative.trim(), settings };
}

/* -------------- JPEG/WEBP EXIF/XMP -------------- */

async function readExifLike(buf: Buffer): Promise<Record<string, any>> {
    try {
        const tags = ExifReader.load(buf);
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(tags)) {
            // ExifReader values often have .description
            // @ts-ignore
            out[k] = (v && typeof v === 'object' && 'description' in v) ? (v as any).description : v;
        }
        return out;
    } catch {
        return {};
    }
}

function tryParseJSON(s: string): any | null {
    try { return JSON.parse(s); } catch { return null; }
}

/* -------------- Main entry -------------- */

export async function readSdMetadata(filePath: string): Promise<SDMeta | null> {
    const buf = await fs.promises.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const raw: any = { ext };

    if (isPNG(buf)) {
        const txt = extractPngTextBlocks(buf);
        raw.pngText = txt;

        // ComfyUI often stores workflow JSON in iTXt
        const comfy = txt['workflow']?.[0] || txt['ComfyUI']?.[0] || txt['sd-metadata']?.[0];
        if (comfy) {
            const parsed = tryParseJSON(comfy);
            return { tool: 'ComfyUI', positive: undefined, negative: undefined, settings: {}, raw: { workflow: parsed ?? comfy, txt } };
        }

        // A1111 (Parameters)
        const params = txt['parameters']?.[0] || txt['Parameters']?.[0] || txt['prompt']?.[0];
        if (params) {
            const { positive, negative, settings } = parseA1111Parameters(params);
            const novelAI = (txt['Comment']?.[0] || '').includes('NovelAI');
            return { tool: novelAI ? 'NovelAI' : 'A1111', positive, negative, settings, raw: { parameters: params, txt } };
        }

        // Generic JSON in custom keys
        for (const [k, arr] of Object.entries(txt)) {
            for (const v of arr) {
                const j = tryParseJSON(v);
                if (j && (j.prompt || j.parameters || j.workflow)) {
                    return {
                        tool: 'Unknown',
                        positive: j.prompt || undefined,
                        negative: j.negative || j.negative_prompt || undefined,
                        settings: j.settings || {},
                        raw: { key: k, json: j, txt }
                    };
                }
            }
        }

        return { tool: 'Unknown', raw: { txt } };
    }

    // JPEG/WEBP: EXIF / XMP / Comments
    const exif = await readExifLike(buf);
    raw.exif = exif;

    const candidates = [
        String(exif['UserComment'] || ''),
        String(exif['ImageDescription'] || ''),
        String(exif['Description'] || ''),
        String(exif['Comment'] || ''),
        String(exif['XPComment'] || ''),
        String(exif['Software'] || ''),
        String(exif['parameters'] || ''),
    ].filter(Boolean);

    // First, explicit JSON
    for (const c of candidates) {
        const j = tryParseJSON(c);
        if (j) {
            return {
                tool: j.workflow ? 'ComfyUI' : (String(exif['Software'] || '').includes('NovelAI') ? 'NovelAI' : 'Unknown'),
                positive: j.prompt || j.positive || undefined,
                negative: j.negative || j.negative_prompt || undefined,
                settings: j.settings || {},
                raw: { exif, json: j }
            };
        }
    }

    // Then, A1111-style parameters
    for (const c of candidates) {
        if (/Negative prompt:/i.test(c) || /Steps:/i.test(c)) {
            const { positive, negative, settings } = parseA1111Parameters(c);
            return {
                tool: String(exif['Software'] || '').includes('Invoke') ? 'InvokeAI' : 'A1111',
                positive, negative, settings,
                raw: { exif, parameters: c }
            };
        }
    }

    return { tool: 'Unknown', raw: { exif } };
}
