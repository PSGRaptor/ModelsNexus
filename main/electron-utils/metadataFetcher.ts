// File: main/electron-utils/metadataFetcher.ts

import axios from 'axios';
import {
    getApiKey,
    setUserNote,
    addTag,
    saveModelImage as dbSaveModelImage,
    updateCivitaiModelInfo,
    updateModelMainImage
} from '../../db/db-utils.js';
import { saveModelImage as fsSaveModelImage } from './imageHandler.js';

// Helper: fetch model version info by hash
async function fetchModelVersionByHash(hash: string, apiKey?: string): Promise<any | null> {
    const url = `https://civitai.com/api/v1/model-versions/by-hash/${hash}`;
    const headers: Record<string, string> = {};
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    try {
        const response = await axios.get(url, { headers });
        return response.data;
    } catch (err: any) {
        if (err.response?.status === 404) return null;
        throw err;
    }
}

// Main enrichment function: fetch metadata, update DB, download images
export async function enrichModelFromAPI(model_hash: string): Promise<any> {
    try {
        // 1️⃣ Fetch metadata from Civitai
        const civitaiKey = await getApiKey('civitai');
        const civitaiData = await fetchModelVersionByHash(model_hash, civitaiKey);
        if (!civitaiData) {
            return { error: 'Model hash not found on Civitai' };
        }

        // 2️⃣ Extract core fields
        const versionId = civitaiData.id?.toString() || '';
        const modelId = civitaiData.modelId?.toString() || civitaiData.model?.id?.toString() || '';
        const modelType =
            civitaiData.baseModelType ||
            civitaiData.modelType ||
            civitaiData.model?.type ||
            '';
        const baseModel = civitaiData.baseModel || '';
        const version = civitaiData.name || '';
        const civitaiUrl =
            modelId && versionId
                ? `https://civitai.com/models/${modelId}?modelVersionId=${versionId}`
                : '';

        // 3️⃣ Tags and notes
        const tags: string[] = Array.isArray(civitaiData.trainedWords)
            ? civitaiData.trainedWords
            : [];
        const userNote: string =
            civitaiData.description || (civitaiData.model?.description ?? '');
        if (userNote) await setUserNote(model_hash, userNote);
        for (const tag of tags) {
            await addTag(model_hash, tag);
        }

        // 4️⃣ Update model metadata in DB
        await updateCivitaiModelInfo(
            model_hash,
            modelId,
            versionId,
            modelType,
            baseModel,
            version,
            civitaiUrl
        );

        // 5️⃣ Download & save images (cover + gallery)
        const images: any[] = Array.isArray(civitaiData.images)
            ? civitaiData.images
            : [];
        const imageEntries: any[] = [];
        let mainImageLocalPath: string | null = null;

        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            // 5.1️⃣ Save remote image into userData/images/<model_hash>/
            const localPath = await fsSaveModelImage(model_hash, img.url, i, img);
            // 5.2️⃣ Record local copy in DB (optional, depending on your schema)
            await dbSaveModelImage(model_hash, localPath, i, img);
            imageEntries.push({ ...img, localPath });

            // 5.3️⃣ For the first image (cover), update main_image_path in DB
            if (i === 0) {
                const fileUrl = localPath.startsWith('file://') ? localPath : `file://${localPath}`;
                await updateModelMainImage(model_hash, fileUrl);
                mainImageLocalPath = fileUrl;
            }
        }

        // 6️⃣ Derive cover and gallery URLs for reference/legacy UI needs
        const cover_image_url: string = images[0]?.url || '';
        const image_urls: string[] = images.slice(1).map((img: any) => img.url);

        // 7️⃣ Return everything for renderer
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
            main_image_path: mainImageLocalPath, // the local file:// URI
            cover_image_url,
            image_urls
        };
    } catch (err: any) {
        console.error('Error in enrichModelFromAPI:', err);
        return { error: err.message || String(err) };
    }
}
