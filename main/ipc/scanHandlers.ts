// START OF FILE: main/ipc/scanHandlers.ts

import { BrowserWindow, ipcMain } from 'electron';
// Keep your existing indexer; it can also accept a duck-typed db that has get/run/all/exec
import { IncrementalIndexer, ScanMode } from '../scanner/incrementalIndexer.js';

let currentAbort: AbortController | null = null;

export function registerScanHandlers(
    db: any,                                  // <- accept sqlite wrapper or raw db
    getRoots: () => string[],
    getAllowedExts: () => string[]
) {
    ipcMain.handle('scan:start', async (_e, payload: { mode: ScanMode }) => {
        if (currentAbort) currentAbort.abort();
        currentAbort = new AbortController();

        const idx = new IncrementalIndexer({
            db,                                    // <- pass through
            roots: getRoots(),
            allowedExts: getAllowedExts(),
            mode: payload?.mode ?? 'incremental',
            signal: currentAbort.signal,
        });

        const win = BrowserWindow.getAllWindows()[0];
        idx.on('progress', (p) => {
            win?.webContents.send('scan:progress', p);
        });

        idx.run().catch((err) => {
            win?.webContents.send('scan:progress', { error: String(err) });
        });

        return { ok: true };
    });

    ipcMain.handle('scan:cancel', async () => {
        if (currentAbort) {
            currentAbort.abort();
            currentAbort = null;
            return { ok: true, cancelled: true };
        }
        return { ok: false, cancelled: false };
    });
}

// END OF FILE: main/ipc/scanHandlers.ts
