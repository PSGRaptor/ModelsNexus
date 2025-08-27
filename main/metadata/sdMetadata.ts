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

// Heuristics to decode EXIF/COM text that may be UTF-8, Latin-1, or UTF-16 (LE/BE)
function hasUtf16BOM(buf: Buffer): 'LE' | 'BE' | null {
    if (buf.length >= 2) {
        const b0 = buf[0], b1 = buf[1];
        if (b0 === 0xFF && b1 === 0xFE) return 'LE';
        if (b0 === 0xFE && b1 === 0xFF) return 'BE';
    }
    return null;
}

function looksUtf16(buf: Buffer): 'LE' | 'BE' | null {
    // crude heuristic: lots of 0x00 every other byte → likely UTF-16
    let zerosEven = 0, zerosOdd = 0;
    const N = Math.min(buf.length, 4000);
    for (let i = 0; i < N; i++) {
        if (buf[i] === 0) {
            if (i % 2 === 0) zerosEven++; else zerosOdd++;
        }
    }
    const ratioEven = zerosEven / Math.max(1, Math.floor(N / 2));
    const ratioOdd = zerosOdd / Math.max(1, Math.floor(N / 2));
    if (ratioOdd > 0.2 && ratioEven < 0.05) return 'BE';
    if (ratioEven > 0.2 && ratioOdd < 0.05) return 'LE';
    return null;
}

function decodeTextBuffer(buf: Buffer): string {
    if (!buf || buf.length === 0) return '';
    // BOM first
    const bom = hasUtf16BOM(buf);
    if (bom === 'LE') return buf.slice(2).toString('utf16le').replace(/\u0000/g, '').trim();
    if (bom === 'BE') {
        // Node doesn't have 'utf16be' built-in; swap bytes then decode as LE
        const swapped = Buffer.allocUnsafe(buf.length - 2);
        for (let i = 2; i < buf.length; i += 2) {
            swapped[i - 2] = buf[i + 1];
            swapped[i - 1] = buf[i];
        }
        return swapped.toString('utf16le').replace(/\u0000/g, '').trim();
    }
    // Heuristic
    const hint = looksUtf16(buf);
    if (hint === 'LE') return buf.toString('utf16le').replace(/\u0000/g, '').trim();
    if (hint === 'BE') {
        const swapped = Buffer.allocUnsafe(buf.length);
        for (let i = 0; i < buf.length; i += 2) {
            swapped[i] = buf[i + 1];
            swapped[i + 1] = buf[i];
        }
        return swapped.toString('utf16le').replace(/\u0000/g, '').trim();
    }
    // Try UTF-8 then Latin-1
    try {
        const s = buf.toString('utf8');
        // If it still looks like UCS-2 with nulls, strip them
        if (/\u0000/.test(s)) return s.replace(/\u0000/g, '').trim();
        return s.trim();
    } catch {
        return buf.toString('latin1').replace(/\u0000/g, '').trim();
    }
}

// Normalize EXIF/XP* string-ish values (exifreader can return arrays/typed arrays)
function normalizeExifString(v: any): string {
    if (v == null) return '';
    if (typeof v === 'string') return v.trim();
    if (Buffer.isBuffer(v)) return decodeTextBuffer(v);
    if (Array.isArray(v)) {
        // XP* fields are often arrays of char codes (UCS-2 LE)
        const b = Buffer.from(Uint8Array.from(v as number[]));
        return decodeTextBuffer(b);
    }
    if (typeof v === 'object') {
        // exifreader tags often have { value, description }
        const cand = (v.description ?? v.value ?? '').toString();
        if (cand === '[Unicode encoded text]' && (v as any).value) {
            try {
                const arr = Array.isArray((v as any).value) ? (v as any).value : [];
                const b = Buffer.from(Uint8Array.from(arr));
                return decodeTextBuffer(b);
            } catch { /* ignore */ }
        }
        return String(cand).trim();
    }
    return String(v).trim();
}

/* -------------- A1111 parser ---------------- */

export function parseA1111Parameters(params: string): { positive?: string; negative?: string; settings?: SDSettings } {
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

function readJpegComments(buf: Buffer): string[] {
    const out: string[] = [];
    let i = 0;
    const len = buf.length;
    if (!(len > 2 && buf[i] === 0xFF && buf[i + 1] === 0xD8)) return out;
    i += 2;
    while (i + 4 <= len) {
        if (buf[i] !== 0xFF) break;
        const marker = buf[i + 1];
        i += 2;
        if (marker === 0xDA /* SOS */ || marker === 0xD9 /* EOI */) break;
        if (i + 2 > len) break;
        const segLen = buf.readUInt16BE(i);
        i += 2;
        if (segLen < 2 || i + segLen - 2 > len) break;
        const segEnd = i + segLen - 2;

        if (marker === 0xFE) {
            const data = buf.slice(i, segEnd);
            const text = decodeTextBuffer(data);
            if (text) out.push(text);
        }

        i = segEnd;
    }
    return out;
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

    // JPEG/WEBP route: EXIF / XMP plus raw COM comments
    const exif = await readExifLike(buf);
    raw.exif = exif;

    // Capture COM comments directly (A1111 often stores full params here on JPEGs)
    const comComments = readJpegComments(buf);
    raw.jpegComments = comComments;

    // Include comment blocks FIRST; spread them into the list
    const candidates = [
        ...comComments,
        normalizeExifString(exif['UserComment']),
        normalizeExifString(exif['ImageDescription']),
        normalizeExifString(exif['Description']),
        normalizeExifString(exif['Comment']),
        normalizeExifString(exif['XPComment']),
        normalizeExifString(exif['Software']),
        normalizeExifString(exif['parameters']),
    ].filter(Boolean);

    // DEBUG ONLY: show candidate stats
    try {
        const A1111_RE = /(Negative\s*prompt\s*:)|(Steps\s*:\s*\d+)|(Sampler\s*:\s*[A-Za-z0-9+ .-]+)/i;
        const matchIdx = candidates.findIndex(c => A1111_RE.test(String(c)));
        const first = candidates[0] ? String(candidates[0]).slice(0, 200) : '';
        console.log('[sd-meta] candidates=', candidates.length, 'matchIdx=', matchIdx, 'first sample=', first);
    } catch {}

    const A1111_RE = /(Negative\s*prompt\s*:)|(Steps\s*:\s*\d+)|(Sampler\s*:\s*[A-Za-z0-9+ .-]+)/i;
    for (const c of candidates) {
        // 1) JSON first
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

        // 2) A1111 / InvokeAI text (broader detector)
        if (A1111_RE.test(c)) {
            const { positive, negative, settings } = parseA1111Parameters(c);
            const sw = String(exif['Software'] || '');
            const tool: SDMeta['tool'] = sw.includes('Invoke') ? 'InvokeAI' : 'A1111';
            return {
                tool,
                positive,
                negative,
                settings,
                raw: { exif, jpegComments: comComments, matched: c.slice(0, 200) }
            };
        }
    }

    // ---- LAST-CHANCE SWEEP OVER WHOLE FILE ----
    // Some setups leave EXIF/XP* as "[Unicode encoded text]" objects.
    // As a final attempt, decode the entire buffer in multiple encodings and look for A1111 markers.
    try {
        // reuse the same detector as above
        // UTF-8 / Latin-1
        const asUtf8 = buf.toString('utf8');
        if (A1111_RE.test(asUtf8)) {
            const { positive, negative, settings } = parseA1111Parameters(asUtf8);
            const sw = normalizeExifString(exif['Software']);
            const tool: SDMeta['tool'] = sw.includes('Invoke') ? 'InvokeAI' : 'A1111';
            return { tool, positive, negative, settings, raw: { exif, sweep: 'utf8' } };
        }
        const asLatin1 = buf.toString('latin1');
        if (A1111_RE.test(asLatin1)) {
            const { positive, negative, settings } = parseA1111Parameters(asLatin1);
            const sw = normalizeExifString(exif['Software']);
            const tool: SDMeta['tool'] = sw.includes('Invoke') ? 'InvokeAI' : 'A1111';
            return { tool, positive, negative, settings, raw: { exif, sweep: 'latin1' } };
        }

        // UTF-16LE
        const asU16LE = buf.toString('utf16le').replace(/\u0000/g, '');
        if (A1111_RE.test(asU16LE)) {
            const { positive, negative, settings } = parseA1111Parameters(asU16LE);
            const sw = normalizeExifString(exif['Software']);
            const tool: SDMeta['tool'] = sw.includes('Invoke') ? 'InvokeAI' : 'A1111';
            return { tool, positive, negative, settings, raw: { exif, sweep: 'utf16le' } };
        }

        // UTF-16BE (byte-swap, then decode LE)
        const swapped = Buffer.allocUnsafe(buf.length);
        for (let i = 0; i + 1 < buf.length; i += 2) {
            swapped[i] = buf[i + 1];
            swapped[i + 1] = buf[i];
        }
        const asU16BE = swapped.toString('utf16le').replace(/\u0000/g, '');
        if (A1111_RE.test(asU16BE)) {
            const { positive, negative, settings } = parseA1111Parameters(asU16BE);
            const sw = normalizeExifString(exif['Software']);
            const tool: SDMeta['tool'] = sw.includes('Invoke') ? 'InvokeAI' : 'A1111';
            return { tool, positive, negative, settings, raw: { exif, sweep: 'utf16be' } };
        }
    } catch (e) {
        console.warn('[sd-meta] final sweep error:', e);
    }
    // ---- END LAST-CHANCE SWEEP ----

    return { tool: 'Unknown', raw: { exif } };
}
