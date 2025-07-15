// main/electron-utils/civitaiWebSearch.ts

import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Searches Civitai's website for a BLAKE3/SHA256 hash and extracts Model ID and Version ID.
 * @param hash string
 * @returns {Promise<{ versionId: string, modelId: string } | null>}
 */
export async function civitaiFindByHash(hash: string): Promise<{ versionId: string, modelId: string } | null> {
    const url = `https://civitai.com/search/models?sortBy=models_v9&query=${hash}`;
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });

    // Print a portion of the page for debug
    console.log("DEBUG: Search page for hash:", hash, res.data.slice(0, 1000)); // Print first 1000 chars

    const $ = cheerio.load(res.data);
    const modelLink = $('a[href^="/models/"]').first();
    const href = modelLink && modelLink.attr('href');
    console.log('DEBUG: found href:', href);

    if (!href) return null;

    let match = href.match(/\/models\/(\d+)\?modelVersionId=(\d+)/);
    if (match) {
        const [, modelId, versionId] = match;
        return { modelId, versionId };
    }
    match = href.match(/\/models\/(\d+)/);
    if (match) {
        const [, modelId] = match;
        return { modelId, versionId: '' };
    }
    return null;
}
