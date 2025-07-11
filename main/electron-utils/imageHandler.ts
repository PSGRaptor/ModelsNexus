import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Ensure directory exists
function ensureDir(dir: string) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Save image from URL to /images/[model_hash] and keep max 25 images.
 */
export async function saveModelImage(modelHash: string, imageUrl: string) {
    const imagesDir = path.join(__dirname, '../../images', modelHash);
    ensureDir(imagesDir);

    // Fetch image data
    const res = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imgFiles = fs.readdirSync(imagesDir).filter(f =>
        /\.(png|jpg|jpeg)$/i.test(f)
    );

    // Limit to 25 images
    if (imgFiles.length >= 25) {
        // Delete oldest
        const oldest = imgFiles
            .map(f => ({
                file: f,
                time: fs.statSync(path.join(imagesDir, f)).ctimeMs,
            }))
            .sort((a, b) => a.time - b.time)
            .slice(0, imgFiles.length - 24);
        oldest.forEach(({ file }) => fs.unlinkSync(path.join(imagesDir, file)));
    }

    // Save new image
    const imgName = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}.png`;
    const imgPath = path.join(imagesDir, imgName);
    fs.writeFileSync(imgPath, Buffer.from(res.data));
    return imgPath;
}

// Get all images for a model
export function getModelImages(modelHash: string): string[] {
    const imagesDir = path.join(__dirname, '../../images', modelHash);
    if (!fs.existsSync(imagesDir)) return [];
    return fs.readdirSync(imagesDir)
        .filter(f => /\.(png|jpg|jpeg)$/i.test(f))
        .map(f => path.join(imagesDir, f));
}
