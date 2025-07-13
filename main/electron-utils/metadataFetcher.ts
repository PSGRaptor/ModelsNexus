import { fetchCivitaiModelVersion, civitaiVersionIdFromHash } from '../../api/civitai.js';
import { setCivitaiVersionId, getCivitaiVersionId, setUserNote, addTag } from '../../db/db-utils.js';
import { saveModelImage } from './imageHandler.js';

/**
 * Enrich model metadata from Civitai (and Hugging Face, stub).
 * Accepts a model hash (not version ID)—handles lookup, DB sync, etc.
 * Populates images, prompts, tags, notes, and saves them as needed.
 * @param model_hash Your model's SHA256 or unique hash string
 * @param civitaiKey Civitai API key
 * @param huggingfaceKey Hugging Face API key (optional, not implemented)
 * @returns Object with all gathered/parsed info, for further use or UI
 */
export async function enrichModelFromAPI(
    model_hash: string,
    civitaiKey?: string,
    huggingfaceKey?: string
) {
    // --- Step 1: Lookup/resolve the Civitai version ID for this hash ---
    let versionId: number | null = await getCivitaiVersionId(model_hash);
    if (!versionId) {
        versionId = await civitaiVersionIdFromHash(model_hash);
        if (versionId) await setCivitaiVersionId(model_hash, versionId);
    }

    if (!versionId) {
        console.warn('No Civitai version found for model hash:', model_hash);
        return { error: 'No matching Civitai model found' };
    }

    // --- Step 2: Fetch version details using the numeric ID ---
    const civitaiData = await fetchCivitaiModelVersion(versionId.toString(), civitaiKey);
    if (!civitaiData) return { error: 'Model not found on Civitai' };

    // --- Step 3: Extract and save images/tags/prompts/notes ---
    const images = (civitaiData.images || []).map((img: any) => ({
        url: img.url,
        prompt: img.meta?.prompt || '',
        negativePrompt: img.meta?.negativePrompt || '',
        width: img.width,
        height: img.height,
        seed: img.meta?.seed,
        nsfwLevel: img.nsfwLevel,
    }));

    const tags = Array.isArray(civitaiData.trainedWords) ? civitaiData.trainedWords : [];
    const userNote = civitaiData.description || (civitaiData.model?.description ?? '');

    if (userNote) await setUserNote(model_hash, userNote);
    if (tags && tags.length) {
        for (const tag of tags) await addTag(model_hash, tag);
    }

    for (let i = 0; i < Math.min(images.length, 25); i++) {
        await saveModelImage(model_hash, images[i].url, i, images[i]);
    }

    // --- Step 4: Optionally, return extracted data for UI update ---
    return {
        civitaiData,
        images,
        tags,
        userNote,
        civitai_version_id: versionId,
    };
}
