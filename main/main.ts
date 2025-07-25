// File: main/main.ts
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Promise Rejection:', reason);
});
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { fileURLToPath } from 'url';
import * as fs from 'fs';                      // for existsSync, mkdirSync, etc.
import { promises as fsp } from 'fs';          // for async mkdir, readFile, etc.

import * as path from 'path';                  // namespace import for path
// If you still need dirname(), you can do:
const { dirname } = path;
// import path, { dirname } from 'path';
import { spawn, ChildProcess } from 'child_process';
let promptProcess: ChildProcess | null = null;
import { updateModelMainImage } from '../db/db-utils.js';
import {
    getAllModels,
    initDb,
    getAllScanPaths,
    addScanPath,
    removeScanPath,
    getApiKey,
    setApiKey,
    updateFavorite,
    getUserNote,
    setUserNote,
    getTags,
    addTag,
    removeTag,
    getAllModelsWithCover,
    updateModel
} from '../db/db-utils.js';
import { scanAndImportModels } from './electron-utils/modelScanner.js';
// ← Added deleteModelImage here:
import { saveModelImage, getModelImages, deleteModelImage } from './electron-utils/imageHandler.js';
import { enrichModelFromAPI } from './electron-utils/metadataFetcher.js';
import { getModelByHash } from '../db/db-utils.js';
import { buildCivitaiHashMap } from './utils/buildCivitaiHashMap.js';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const cliPath = path.join(app.getAppPath(), 'resources', 'sd-prompt-reader-cli.exe');
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let scanCancelled = false;

/**
 * Create the main application window
 */
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        },
        show: false, // Hide until ready-to-show for better UX
    });

    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Electron app events
app.on('ready', async () => {
    // ── Step 2: Initialize the DB (create file  run migrations) ─────────
    try {
        await initDb();
        console.log('✅ Database initialized');
    } catch (err) {
        console.error('❌ Database initialization failed:', err);
        // If the DB can’t open or migrate, quit rather than continue in a broken state
        app.quit();
        return;
    }
    // ── Now safe to spin up your window ───────────────────────────────────
    createMainWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
    if (mainWindow === null) createMainWindow();
});

/**
 * IPC handlers for secure communications
 */

// ---- EDIT MODEL HANDLER ----
ipcMain.handle('updateModel', async (_event, data) => {
    try {
        console.log('[updateModel] called with:', data);
        if (!data?.model?.model_hash) {
            console.error('[updateModel] Missing model_hash');
            return { success: false, error: 'Missing model_hash' };
        }

        await updateModel(data.model);

        if (Array.isArray(data.tagsToAdd)) {
            for (const tag of data.tagsToAdd) {
                await addTag(data.model.model_hash, tag);
            }
        }
        if (Array.isArray(data.tagsToRemove)) {
            for (const tag of data.tagsToRemove) {
                await removeTag(data.model.model_hash, tag);
            }
        }
        if (typeof data.userNote === 'string') {
            await setUserNote(data.model.model_hash, data.userNote);
        }

        return { success: true };
    } catch (err: any) {
        console.error('[updateModel] error:', err);
        return { success: false, error: err.message || String(err) };
    }
});

// ---- IMAGE HANDLERS ----
// Save new image
ipcMain.handle('saveModelImage', async (_e, modelHash: string, imageUrl: string) =>
    saveModelImage(modelHash, imageUrl)
);
// List images
ipcMain.handle('getModelImages', (_e, modelHash: string) => getModelImages(modelHash));
// Delete image
ipcMain.handle('deleteModelImage', async (_e, modelHash: string, fileName: string) =>
    deleteModelImage(modelHash, fileName)
);

// ---- NATIVE FILE DIALOG ----
ipcMain.handle(
    'dialog:openFileDialog',
    async (_event, options: Electron.OpenDialogOptions) => {
        if (!mainWindow) return [];
        const result = await dialog.showOpenDialog(mainWindow, options);
        return result.canceled ? [] : result.filePaths;
    }
);

// ---- APP VERSION ----
ipcMain.handle('get-app-version', () => app.getVersion());

// ---- MODEL SCANNING ----
ipcMain.handle('scanAndImportModels', async () => {
    scanCancelled = false;
    const scanPaths = await getAllScanPaths();
    const win = mainWindow ?? BrowserWindow.getAllWindows()[0];
    if (!win) throw new Error('No window for scan-progress');
    // 1️⃣ Run the folder‐import scan
    const result = await scanAndImportModels(
        scanPaths.map(p => p.path),
        win.webContents,
        () => scanCancelled
    );

    // 2️⃣ Immediately enrich each model’s metadata so we get cover_image_url populated
    try {
        const all = await getAllModels();  // Imported from './db/db-utils.js'
        for (const m of all) {
            if (!m.cover_image_url) {
                // This writes the cover_image_url into the DB
                await enrichModelFromAPI(m.model_hash);
            }
        }
    } catch (err) {
        console.error('[scanAndImportModels] metadata enrichment failed:', err);
    }

    // 3️⃣ Return the original scan result
    return result;
});

ipcMain.handle('cancelScan', async () => {
    scanCancelled = true;
    return { success: true };
});

ipcMain.handle('getAllScanPaths', () => getAllScanPaths());
ipcMain.handle('addScanPath', async (_e, p: string) => {
    await addScanPath(p);
    return getAllScanPaths();
});
ipcMain.handle('removeScanPath', async (_e, p: string) => {
    await removeScanPath(p);
    return getAllScanPaths();
});

// ---- API KEYS ----
ipcMain.handle('getApiKey', (_e, provider: string) => getApiKey(provider));
ipcMain.handle('setApiKey', (_e, provider: string, key: string) => setApiKey(provider, key));

// ---- FAVORITES ----
ipcMain.handle('toggleFavoriteModel', async (_e, hash: string) => {
    const all = await getAllModels();
    const m = all.find(x => x.model_hash === hash);
    await updateFavorite(hash, m?.is_favorite ? 0 : 1);
    return true;
});

// ---- METADATA ENRICHMENT ----
ipcMain.handle('enrichModelFromAPI', (_e, hash: string) => enrichModelFromAPI(hash));
ipcMain.handle('getModelByHash', (_e, hash: string) => getModelByHash(hash));

// ---- CIVITAI HASH MAP ----
ipcMain.handle('updateHashMap', async () => {
    try {
        await buildCivitaiHashMap();
        return { success: true };
    } catch (err: any) {
        console.error('updateHashMap error:', err);
        return { success: false, error: err.message || String(err) };
    }
});
ipcMain.handle('reenrichAllModels', async () => {
    try {
        const all = await getAllModels();
        for (const m of all) {
            if (m.model_hash) await enrichModelFromAPI(m.model_hash);
        }
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message || String(err) };
    }
});

// ---- MODEL LISTING ----
ipcMain.handle('getAllModels', () => getAllModels());
ipcMain.handle('getAllModelsWithCover', () => getAllModelsWithCover());

// main/main.ts

ipcMain.handle('selectModelMainImage', async (_e, modelHash: string) => {
    if (!mainWindow) throw new Error('No window to attach dialog');
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Main Image for Model',
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','webp'] }],
    });
    if (canceled || filePaths.length === 0) {
        return { canceled: true };
    }

    const src = filePaths[0];
    const destDir = path.join(app.getPath('userData'), 'modelImages');
    await fsp.mkdir(destDir, { recursive: true });
    const ext = path.extname(src);
    const destName = `${modelHash}${ext}`;
    const destPath = path.join(destDir, destName);
    await fsp.copyFile(src, destPath);

    // store with file:// so renderer can load it directly
    const fileUrl = `file://${destPath}`;
    await updateModelMainImage(modelHash, fileUrl);

    return { canceled: false, path: fileUrl };
});


// ---- IMAGE METADATA via external CLI ----
ipcMain.handle('get-image-metadata', (_e, imgPath: string) =>
    new Promise(resolve => {
        execFile(cliPath, ['-r', '-i', imgPath, '-f', 'JSON'], (err, stdout) => {
            if (err) return resolve({ error: err.message });
            try {
                resolve(JSON.parse(stdout));
            } catch {
                resolve({ error: 'Invalid JSON from CLI' });
            }
        });
    })
);

ipcMain.handle('open-prompt-viewer', (_evt, imagePath: string) => {
    const exeName = 'sd-prompt-reader.exe';

    // Possible locations for the GUI exe
    const candidates = [
        path.join(process.resourcesPath, exeName),
        path.join(process.resourcesPath, 'resources', exeName),
    ];
    const exePath = candidates.find(fs.existsSync);
    if (!exePath) {
        console.error('❌ Cannot find Prompt Reader exe in:', candidates);
        return false;
    }

    // If your image is still inside the ASAR, point at the unpacked copy
    let realImage = imagePath;
    if (app.isPackaged && imagePath.includes(`app.asar${path.sep}`)) {
        realImage = imagePath.replace(
            `app.asar${path.sep}`,
            `app.asar.unpacked${path.sep}`
        );
    }

    console.log('Launching Prompt Reader GUI:', exePath, realImage);

    // Kill any prior instance
    if (promptProcess && !promptProcess.killed) {
        promptProcess.kill();
    }

    // Spawn with shell: true for better Windows compatibility
    promptProcess = spawn(exePath, [ realImage ], {
        shell: true,
        windowsHide: false,
        // stdio: 'ignore',          // ← comment out for now so we see stdout/stderr
        detached: false             // ← run attached so the parent console captures output
    });

    // Diagnostics:
    promptProcess.on('error', err => {
        console.error('❌ Failed to launch Prompt Reader:', err);
    });
    promptProcess.on('exit', (code, signal) => {
        console.log(`🔔 Prompt Reader exited with code=${code} signal=${signal}`);
    });
    promptProcess.stdout?.on('data', d =>
        console.log('📤 Prompt Reader stdout:', d.toString())
    );
    promptProcess.stderr?.on('data', d =>
        console.error('📥 Prompt Reader stderr:', d.toString())
    );

    // No .unref() while debugging
    return true;
});

ipcMain.handle('selectFolder', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    // If the user cancelled, return null; otherwise return the first folder path.
    return result.canceled ? null : result.filePaths[0];
});

// ---- NOTES & TAGS ----
ipcMain.handle('getUserNote', (_e, hash: string) => getUserNote(hash));
ipcMain.handle('setUserNote', (_e, hash: string, note: string) => setUserNote(hash, note));
ipcMain.handle('getTags', (_e, hash: string) => getTags(hash));
ipcMain.handle('addTag', (_e, hash: string, tag: string) => addTag(hash, tag));
ipcMain.handle('removeTag', (_e, hash: string, tag: string) => removeTag(hash, tag));

