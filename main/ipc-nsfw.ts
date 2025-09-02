// START OF FILE: main/ipc-nsfw.ts
import { ipcMain } from 'electron';
import {
    loadIndex,
    setModelNSFW,
    setImageNSFW,
    mergeNSFWBatch,
} from './nsfw-index.js'; // NOTE: keep .js for NodeNext/ESM builds

/**
 * Register (or re-register) NSFW IPC handlers safely.
 * This function is idempotent: it removes old handlers before adding new ones,
 * so calling it twice won't crash Electron with "Attempted to register a second handler".
 */
export function registerNsfwIpc() {
    const channels = [
        'nsfw:getIndex',
        'nsfw:setModel',
        'nsfw:setImage',
        'nsfw:merge',
    ] as const;

    // Remove any previous handlers to avoid "second handler" errors (safe on first run)
    for (const ch of channels) {
        try {
            ipcMain.removeHandler(ch);
        } catch {
            // ignore – removeHandler is safe even if nothing was registered
        }
    }

    ipcMain.handle('nsfw:getIndex', async () => loadIndex());

    ipcMain.handle('nsfw:setModel', async (_e, hash: string, value: boolean) =>
        setModelNSFW(hash, value)
    );

    ipcMain.handle('nsfw:setImage', async (_e, src: string, value: boolean) =>
        setImageNSFW(src, value)
    );

    ipcMain.handle('nsfw:merge', async (_e, batch) => mergeNSFWBatch(batch));
}
// END OF FILE: main/ipc-nsfw.ts
