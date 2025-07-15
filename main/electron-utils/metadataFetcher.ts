// main/electron-utils/metadataFetcher.ts

import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import {
    getApiKey,
    setUserNote,
    addTag,
    saveModelImage,
    updateCivitaiModelInfo
} from '../../db/db-utils.js';

// Helper: Download one image to local disk and return local path
async function downloadAndSaveImage(model_hash: string, url: string, index: number) {
    try {
        const imagesDir = path.resolve('images', model_hash);
        await fs.ensureDir(imagesDir);
        const ext = path.extname(new URL(url).pathname) || '.jpg';
        const imgPath = path.join(imagesDir, `${index}${ext}`);

        // Download if not already present
        if (!fs.existsSync(imgPath)) {
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            await fs.writeFile(imgPath, response.data);
        }
        return imgPath;
    } catch (err) {
        console.warn(`Failed to download image for ${model_hash} (${url}):`, err);
        return url; // fallback to remote URL
    }
}

// Main enrichment function: called per model hash
export async function enrichModelFromAPI(model_hash: string): Promise<any> {
    try {
        const civitaiKey = await getApiKey('civitai');
        const civitaiData = await fetchModelVersionByHash(model_hash, civitaiKey);

        if (!civitaiData) {
            return { error: 'Model hash not found on Civitai' };
        }

        // Extract info
        const versionId = civitaiData.id?.toString() || '';
        const modelId = civitaiData.modelId?.toString() || civitaiData.model?.id?.toString() || '';
        const modelType = civitaiData.baseModelType || civitaiData.modelType || civitaiData.model?.type || '';
        const baseModel = civitaiData.baseModel || '';
        const version = civitaiData.name || '';
        const civitaiUrl = modelId && versionId
            ? `https://civitai.com/models/${modelId}?modelVersionId=${versionId}`
            : '';

        // Tags and notes
        const tags = Array.isArray(civitaiData.trainedWords) ? civitaiData.trainedWords : [];
        const userNote = civitaiData.description || (civitaiData.model?.description ?? '');
        if (userNote) await setUserNote(model_hash, userNote);
        if (tags && tags.length) {
            for (const tag of tags) await addTag(model_hash, tag);
        }

        // Download and save up to 25 images
        const images = (civitaiData.images || []).map((img: any) => ({
            url: img.url,
            prompt: img.meta?.prompt || '',
            negativePrompt: img.meta?.negativePrompt || '',
            width: img.width,
            height: img.height,
            seed: img.meta?.seed,
            nsfwLevel: img.nsfwLevel,
        }));

        const imageEntries = [];
        for (let i = 0; i < Math.min(images.length, 25); i++) {
            const localPath = await downloadAndSaveImage(model_hash, images[i].url, i);
            await saveModelImage(model_hash, localPath, i, images[i]); // DB entry
            imageEntries.push({
                ...images[i],
                localPath,
            });
        }

        // Save main info
        await updateCivitaiModelInfo(
            model_hash,
            modelId,
            versionId,
            modelType,
            baseModel,
            version,
            civitaiUrl
        );

        // Return info for UI
        return {
            civitaiData,
            images: imageEntries,
            tags,
            userNote,
            civitai_version_id: versionId,
            modelId,
            modelType,
            baseModel,
            version,
            civitaiUrl,
        };

    } catch (err) {
        console.error('Error in enrichModelFromAPI:', err);
        return { error: err instanceof Error ? err.message : String(err) };
    }
}

// Helper: fetch model version info by hash
async function fetchModelVersionByHash(hash: string, apiKey?: string): Promise<any | null> {
    const url = `https://civitai.com/api/v1/model-versions/by-hash/${hash}`;
    const headers: any = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    try {
        const response = await axios.get(url, { headers });
        return response.data;
    } catch (err: any) {
        if (err.response?.status === 404) return null;
        throw err;
    }
}
