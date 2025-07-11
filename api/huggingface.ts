// api/huggingface.ts
import axios from 'axios';

const BASE_URL = 'https://huggingface.co/api';

// Fetch model metadata from Hugging Face Hub by repo id
export async function fetchHuggingFaceModel(apiKey: string, repoId: string) {
    const url = `${BASE_URL}/models/${repoId}`;
    const res = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
        },
    });
    return res.data;
}

// Fetch preview images (if supported) — can be expanded as Hugging Face adds more endpoints
export async function fetchHuggingFaceImages(apiKey: string, repoId: string) {
    // Placeholder: real implementation depends on HF repo content structure
    const url = `https://huggingface.co/api/models/${repoId}/files`;
    const res = await axios.get(url, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
        },
    });
    // Filter for image files in the repo
    return (res.data as Array<{ rfilename: string }>)
        .filter(f => /\.(png|jpg|jpeg)$/i.test(f.rfilename));
}

// Add more endpoints as needed...
