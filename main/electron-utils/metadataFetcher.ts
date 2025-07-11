// /main/electron-utils/metadataFetcher.ts

import { db } from '../../db/db-utils';
import { fetchCivitaiModel, fetchCivitaiImages } from '../../api/civitai';
import { fetchHuggingFaceModel } from '../../api/huggingface';
import { saveModelImage } from './imageHandler';

export async function enrichModelFromAPI(
    model_hash: string,
    civitaiApiKey: string,
    hfApiKey: string
) {
    // Get model from DB
    const model = await db.get('SELECT * FROM models WHERE model_hash = ?', model_hash);
    if (!model) return { error: 'Model not found' };

    // Try Civitai (if civitai_id or civitaiApiKey present)
    let civitaiData = null;
    let civitaiImages: any[] = [];
    if (civitaiApiKey) {
        try {
            civitaiData = await fetchCivitaiModel(civitaiApiKey, { hash: model_hash });
            await db.run('UPDATE models SET civitai_id = ? WHERE model_hash = ?', civitaiData.modelId, model_hash);

            // Save preview images (limit to 25, enforced by saveModelImage)
            if (civitaiData?.id) {
                civitaiImages = await fetchCivitaiImages(civitaiApiKey, civitaiData.id);
                for (const img of civitaiImages.slice(0, 25)) {
                    await saveModelImage(model_hash, img.url);
                    // You may want to save to DB "images" table as well with meta_json etc
                }
            }
        } catch (err) {
            console.warn(`Civitai fetch failed for ${model_hash}:`, err);
        }
    }

    // Try Hugging Face (if huggingface_id or hfApiKey present)
    let hfData = null;
    if (hfApiKey && model.huggingface_id) {
        try {
            hfData = await fetchHuggingFaceModel(hfApiKey, model.huggingface_id);
            // Process HF data as needed, e.g., update base_model, usage tips, etc
            // Optionally fetch images from HF if supported
        } catch (err) {
            console.warn(`Hugging Face fetch failed for ${model_hash}:`, err);
        }
    }

    // Return all new info (useful for immediate UI update)
    return { civitaiData, civitaiImages, hfData };
}
