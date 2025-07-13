import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure directory exists
function ensureDir(dir: string) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Save image from URL to /images/[model_hash] and keep max 25 images.
 * Now accepts optional index and metadata for robust model gallery support.
 */
export async function saveModelImage(
    modelHash: string,
    imageUrl: string,
    index?: number,
    metadata?: any
): Promise<string> {
    const imagesDir = path.join(__dirname, '../../images', modelHash);
    ensureDir(imagesDir);

    // Fetch image data
    const res = await axios.get(imageUrl, { responseType: 'arraybuffer' });

    // Read current images (for limiting to 25)
    let imgFiles = fs.readdirSync(imagesDir).filter(f =>
        /\.(png|jpg|jpeg)$/i.test(f)
    );

    // Limit to 25 images (delete oldest if needed)
    if (imgFiles.length >= 25) {
        const oldest = imgFiles
            .map(f => ({
                file: f,
                time: fs.statSync(path.join(imagesDir, f)).ctimeMs,
            }))
            .sort((a, b) => a.time - b.time)
            .slice(0, imgFiles.length - 24);
        oldest.forEach(({ file }) => fs.unlinkSync(path.join(imagesDir, file)));
    }

    // Generate file name: use index for predictability, fallback to timestamp/random for uniqueness
    const safeIndex = typeof index === 'number' && !isNaN(index) ? index : Date.now();
    const imgName = `img_${safeIndex}.png`;
    const imgPath = path.join(imagesDir, imgName);
    fs.writeFileSync(imgPath, Buffer.from(res.data));

    // If metadata provided, save as JSON with same base name
    if (metadata) {
        const metaName = `img_${safeIndex}.json`;
        const metaPath = path.join(imagesDir, metaName);
        fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
    }

    return imgPath;
}

// Get all images for a model (returns full paths)
export function getModelImages(modelHash: string): string[] {
    const imagesDir = path.join(__dirname, '../../images', modelHash);
    if (!fs.existsSync(imagesDir)) return [];
    return fs.readdirSync(imagesDir)
        .filter(f => /\.(png|jpg|jpeg)$/i.test(f))
        .map(f => path.join(imagesDir, f));
}
