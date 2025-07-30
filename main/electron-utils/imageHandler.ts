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

    // Prune to max 24 images
    let imgFiles = fs
        .readdirSync(imagesDir)
        .filter(f => /\.(png|jpe?g)$/i.test(f));
    if (imgFiles.length >= 25) {
        const toDelete = imgFiles
            .map(f => ({ file: f, time: fs.statSync(path.join(imagesDir, f)).ctimeMs }))
            .sort((a, b) => a.time - b.time)
            .slice(0, imgFiles.length - 24);
        for (const { file } of toDelete) {
            fs.unlinkSync(path.join(imagesDir, file));
        }
        imgFiles = fs.readdirSync(imagesDir).filter(f => /\.(png|jpe?g)$/i.test(f));
    }

    const safeIndex = typeof index === 'number' && !isNaN(index) ? index : Date.now();
    let ext = '.png';
    if (fs.existsSync(source)) {
        ext = path.extname(source) || ext;
    } else {
        try {
            ext = path.extname(new URL(source).pathname) || ext;
        } catch {
            ext = '.png';
        }
    }
    const baseName = `img_${safeIndex}`;
    const imgName = `${baseName}${ext}`;
    const imgPath = path.join(imagesDir, imgName);

    if (fs.existsSync(source)) {
        await fs.promises.copyFile(source, imgPath);
    } else {
        const res = await axios.get(source, { responseType: 'arraybuffer' });
        await fs.promises.writeFile(imgPath, Buffer.from(res.data));
    }

    if (metadata !== undefined) {
        const metaPath = path.join(imagesDir, `${baseName}.json`);
        await fs.promises.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
    }

    // Always return as a file:// URI for Electron/Browser compatibility
    // Avoid double prefix
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
