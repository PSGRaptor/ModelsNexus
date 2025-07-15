// main/utils/modelUtils.ts

import { createReadStream } from 'fs';
import { createHash } from 'blake3';

export async function hashFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const hash = createHash();
        const stream = createReadStream(filePath);
        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => {
            // Always output hex string
            const hex = Buffer.from(hash.digest()).toString('hex');
            resolve(hex);
        });
        stream.on('error', reject);
    });
}
