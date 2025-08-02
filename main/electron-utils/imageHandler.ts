// File: main/electron-utils/imageHandler.ts

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { app } from 'electron';

const __dirname = dirname(fileURLToPath(import.meta.url));

function ensureDir(dir: string) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export async function saveModelImage(
    modelHash: string,
    source: string,
    index?: number,
    metadata?: any
): Promise<string> {
    const imagesDir = path.join(app.getPath('userData'), 'images', modelHash);
    ensureDir(imagesDir);

    // Detect file extension
    let ext = '.png';
    let buffer: Buffer | null = null;

    // 1. Download or copy file, detect actual image type and set ext
    if (fs.existsSync(source)) {
        // Local file: detect PNG/JPEG via magic number
        const header = Buffer.alloc(8);
        const fd = fs.openSync(source, 'r');
        fs.readSync(fd, header, 0, 8, 0);
        fs.closeSync(fd);
        if (header.slice(0, 2).toString('hex') === 'ffd8') {
            ext = '.jpeg';
        } else if (header.toString('hex', 0, 8) === '89504e470d0a1a0a') {
            ext = '.png';
        } else {
            console.log('[saveModelImage] Skipping non-PNG/JPEG local file:', source);
            return '';
        }
        await fs.promises.copyFile(source, path.join(imagesDir, `img_${index}${ext}`));
    } else {
        // Remote URL: download and check content-type
        const res = await axios.get(source, { responseType: 'arraybuffer' });
        buffer = Buffer.from(res.data);
        const contentType = res.headers['content-type'] || '';
        if (contentType.includes('image/png')) {
            ext = '.png';
        } else if (contentType.includes('image/jpeg')) {
            ext = '.jpeg';
        } else {
            console.log('[saveModelImage] Remote image is not PNG/JPEG (content-type):', contentType, source);
            return '';
        }
        await fs.promises.writeFile(path.join(imagesDir, `img_${index}${ext}`), buffer);
    }

    if (metadata !== undefined) {
        const metaPath = path.join(imagesDir, `img_${index}.json`);
        await fs.promises.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
    }

    // Return as file:// URI (include extension)
    const imgPath = path.join(imagesDir, `img_${index}${ext}`);
    return imgPath.startsWith('file://') ? imgPath : `file://${imgPath}`;
}

export async function deleteModelImage(modelHash: string, fileName: string): Promise<void> {
    const imagesDir = path.join(app.getPath('userData'), 'images', modelHash);
    const target = path.join(imagesDir, fileName);
    if (fs.existsSync(target)) {
        await fs.promises.unlink(target);
    }
}

export function getModelImages(modelHash: string): string[] {
    const imagesDir = path.join(app.getPath('userData'), 'images', modelHash);
    if (!fs.existsSync(imagesDir)) return [];
    return fs
        .readdirSync(imagesDir)
        .filter(f => /\.(png|jpe?g)$/i.test(f))
        .map(f => path.join(imagesDir, f));
}
