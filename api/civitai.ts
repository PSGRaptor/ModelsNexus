// api/civitai.ts
import axios from 'axios';

// API endpoint base
const BASE_URL = 'https://civitai.com/api/v1';

// Fetch model metadata by hash or id
export async function fetchCivitaiModel(apiKey: string, { hash, id }: { hash?: string; id?: string }) {
    const url = id
        ? `${BASE_URL}/models/${id}`
        : `${BASE_URL}/model-versions/by-hash/${hash}`;

    const res = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
        },
    });
    return res.data;
}

// Fetch preview images for a model (not recommended, use version details endpoint)
export async function fetchCivitaiImages(apiKey: string, modelVersionId: string) {
    const url = `${BASE_URL}/model-versions/${modelVersionId}/images`;
    const res = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
        },
    });
    return res.data.items as Array<{
        url: string;
        meta: object;
    }>;
}

// --- Added: Lookup model version ID by hash ---
export async function civitaiVersionIdFromHash(hash: string): Promise<number | null> {
    const url = `${BASE_URL}/model-versions/by-hash/${hash}`;
    try {
        const res = await axios.get(url);
        return res.data?.id || null; // id is the numeric version ID
    } catch (err: any) {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
            console.warn(`Civitai: No model version for hash ${hash}`);
            return null;
        }
        console.warn(`Civitai lookup failed for hash ${hash}:`, err?.response?.status || err);
        return null;
    }
}

// --- Added: Fetch model version details directly ---
export async function fetchCivitaiModelVersion(versionId: string, apiKey?: string) {
    const url = `${BASE_URL}/model-versions/${versionId}`;
    const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
    try {
        const res = await axios.get(url, { headers });
        return res.data;
    } catch (err: any) {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
            console.warn(`Civitai: Model version ${versionId} not found (404)`);
            return null;
        }
        console.error(`Civitai fetch failed for ${versionId}:`, err);
        throw err;
    }
}
