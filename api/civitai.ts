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

// Fetch preview images for a model
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

// Add more endpoints as needed...
