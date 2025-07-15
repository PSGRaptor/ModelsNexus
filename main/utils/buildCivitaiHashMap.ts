// main/utils/buildCivitaiHashMap.ts

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const HASHMAP_PATH = path.resolve(__dirname, '../../db/civitai-hash-map.json');

export async function buildCivitaiHashMap(): Promise<Record<string, string>> {
    let page = 1;
    let hashToVersionId: Record<string, string> = {};
    let keepGoing = true;
    let lastCount = 0;

    console.log('Building full Civitai hash map...');

    while (keepGoing) {
        const url = `https://civitai.com/api/v1/model-versions?limit=100&page=${page}`;
        const res = await axios.get(url);
        const data = res.data;
        if (!data.items || data.items.length === 0) break;
        for (const item of data.items) {
            for (const file of item.files || []) {
                for (const [algo, hash] of Object.entries(file.hashes || {})) {
                    if (typeof hash === "string" && hash.length > 0) {
                        hashToVersionId[hash.toLowerCase()] = item.id.toString();
                    }
                }
            }
        }
        page += 1;
        keepGoing = data.metadata && data.metadata.currentPage < data.metadata.totalPages;
        if (Object.keys(hashToVersionId).length > lastCount + 1000) {
            lastCount = Object.keys(hashToVersionId).length;
            console.log(`Fetched ${lastCount} hashes... (page ${page})`);
        }
    }
    fs.writeFileSync(HASHMAP_PATH, JSON.stringify(hashToVersionId, null, 0), 'utf-8');
    console.log(`Civitai hash map built (${Object.keys(hashToVersionId).length} hashes saved).`);
    return hashToVersionId;
}

// CLI runner
//if (import.meta.url === `file://${process.argv[1]}`) {
//    buildCivitaiHashMap().then(() => process.exit(0));
//}
