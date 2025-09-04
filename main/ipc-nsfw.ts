// START OF FILE: main/ipc-nsfw.ts
import { ipcMain } from 'electron';
import {
    canonPath,
    getNsfwIndex,
    setImageFlag,
    setModelFlag,
    type NsfwIndex,
} from './nsfw-index.js'; // IMPORTANT: .js for ESM runtime

function normalizeIndex(idx: NsfwIndex) {
    const outImages: Record<string, boolean> = {};
    const outModels: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(idx.images ?? {})) outImages[canonPath(k)] = !!v;
    for (const [k, v] of Object.entries(idx.models ?? {})) {
        outModels[k] = !!v;
        outModels[k.toLowerCase?.() ?? k] = !!v;
    }
    return { images: outImages, models: outModels };
}

let registered = false;

export function registerNsfwIpc() {
    if (registered) return;
    registered = true;

    ipcMain.handle('nsfw:getIndex', async () => {
        const raw = await getNsfwIndex();
        return normalizeIndex(raw);
    });

    ipcMain.handle('nsfw:markImage', async (_evt, imageKey: string, value: boolean) => {
        const key = canonPath(String(imageKey));
        await setImageFlag(key, !!value);
        return { ok: true, key, value: !!value };
    });

    ipcMain.handle('nsfw:setImage', async (_evt, imageKey: string, value: boolean) => {
        const key = canonPath(String(imageKey));
        await setImageFlag(key, !!value);
        return { ok: true, key, value: !!value };
    });

    ipcMain.handle('nsfw:markModel', async (_evt, modelHash: string, value: boolean) => {
        const h = String(modelHash).trim();
        await setModelFlag(h, !!value);
        return { ok: true, model: h, value: !!value };
    });

    ipcMain.handle('nsfw:setModel', async (_evt, modelHash: string, value: boolean) => {
        const h = String(modelHash).trim();
        await setModelFlag(h, !!value);
        return { ok: true, model: h, value: !!value };
    });
}
// END OF FILE: main/ipc-nsfw.ts
