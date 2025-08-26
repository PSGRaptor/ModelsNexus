// File: main/main.ts
process.on('unhandledRejection', (reason, _promise) => {
    console.error('🚨 Unhandled Promise Rejection:', reason);
});

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import { promises as fsp } from 'fs';
import * as path from 'path';
const { dirname } = path;
import { spawn, ChildProcess, execFile } from 'child_process';
import { promisify } from 'util';
import { readSdMetadata } from './metadata/sdMetadata.js';
import { getUseExternalPromptParser, setUseExternalPromptParser } from './config/settings';

// import type { Tags } from 'exifreader'; // uncomment if you use it (and have noUnusedLocals off)

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
    updateModel,
    runIncrementalMigration,
    runPerfMigration,
    updateModelMainImage,
    getModelByHash,
} from '../db/db-utils.js';

import { scanAndImportModels } from './electron-utils/modelScanner.js';
import { enrichModelFromAPI } from './electron-utils/metadataFetcher.js';
import { buildCivitaiHashMap } from './utils/buildCivitaiHashMap.js';
import { registerScanHandlers } from './ipc/scanHandlers.js';
import { registerModelsPageHandlers } from './ipc/modelsPageHandlers.js';

// ✅ image handler utilities (provide save/get/delete, save returns void)
import { saveModelImage, getModelImages, deleteModelImage } from './electron-utils/imageHandler.js';

const execFileAsync = promisify(execFile);
const cliPath = path.join(app.getAppPath(), 'resources', 'sd-prompt-reader-cli.exe');
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let scanCancelled = false;
let promptViewerWindow: BrowserWindow | null = null;
let promptReaderProcess: ChildProcess | null = null;
let promptProcess: ChildProcess | null = null;
let lastImagePath: string | null = null;

// Format SDMeta to the string PromptViewer expects
function formatMetaString(meta: any): string {
    if (!meta) return '<No metadata available>';
    const lines: string[] = [];
    if (meta.tool) lines.push(`Tool: ${meta.tool}`);
    if (meta.positive) {
        const p = Array.isArray(meta.positive) ? meta.positive.join('\n') : meta.positive;
        lines.push('\nPositive:\n' + p);
    }
    if (meta.negative) {
        const n = Array.isArray(meta.negative) ? meta.negative.join('\n') : meta.negative;
        lines.push('\nNegative:\n' + n);
    }
    if (meta.settings && Object.keys(meta.settings).length) {
        lines.push('\nSettings:');
        for (const [k, v] of Object.entries(meta.settings)) {
            lines.push(`- ${k}: ${String(v)}`);
        }
    }
    if (lines.length === 0) lines.push('<No metadata available>');
    return lines.join('\n');
}

// Call bundled CLI in /resources when toggle is ON
function callSdPromptReaderCLI(imgPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
        // Use the CLI exe already bundled in root/resources
        const exe = path.join(process.cwd(), 'resources', 'sd-prompt-reader-cli.exe');

        const args = ['-r', '-i', imgPath, '-f', 'JSON'];
        const p = spawn(exe, args, { windowsHide: true });

        let out = '';
        let err = '';
        p.stdout.on('data', (d) => (out += d.toString()));
        p.stderr.on('data', (d) => (err += d.toString()));
        p.on('close', (code) => {
            if (code === 0 && out.trim()) {
                try { resolve(JSON.parse(out)); }
                catch { resolve({ raw: out }); }
            } else {
                reject(new Error(err || `sd-prompt-reader-cli exit ${code}`));
            }
        });
    });
}

function getPromptReaderExePath(): string {
    const base = app.isPackaged
        ? process.resourcesPath
        : path.resolve(__dirname, '../resources');
    let exePath = path.join(base, 'sd-prompt-reader.exe');
    if (!fs.existsSync(exePath) && fs.existsSync(path.join(base, 'app.asar.unpacked', 'resources', 'sd-prompt-reader.exe'))) {
        exePath = path.join(base, 'app.asar.unpacked', 'resources', 'sd-prompt-reader.exe');
    }
    return exePath;
}

// Spawn the EXE if not already running
function startPromptReader(imagePath?: string) {
    if (promptReaderProcess && !promptReaderProcess.killed) {
        if (imagePath && imagePath !== lastImagePath) {
            sendImageToPromptReader(imagePath);
        }
        bringPromptReaderToFront();
        return;
    }
    const exePath = getPromptReaderExePath();
    if (!fs.existsSync(exePath)) {
        console.error('[PromptReader] EXE not found:', exePath);
        return;
    }
    const args = imagePath ? [imagePath] : [];
    // ❌ do NOT kill it immediately; just spawn it
    promptReaderProcess = spawn(exePath, args, { detached: true, stdio: 'ignore' });
    lastImagePath = imagePath || null;
}

// Bring EXE window to front (Windows only)
function bringPromptReaderToFront() {
    // No-op for now; can be enhanced with win32 APIs if needed.
}

// Send new image path to EXE
function sendImageToPromptReader(imagePath: string) {
    if (!promptReaderProcess) return;
    try {
        promptReaderProcess.kill();
    } catch {}
    promptReaderProcess = null;
    startPromptReader(imagePath);
}

function getPromptViewerWindow() {
    if (promptViewerWindow && !promptViewerWindow.isDestroyed()) {
        return promptViewerWindow;
    }
    promptViewerWindow = new BrowserWindow({
        width: 520,
        height: 720,
        show: false,
        title: 'Prompt Viewer',
        resizable: true,
        minimizable: false,
        maximizable: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    promptViewerWindow.loadFile(path.join(__dirname, '../renderer/dist/prompt-viewer.html'));
    promptViewerWindow.on('close', (e) => {
        e.preventDefault();
        promptViewerWindow?.hide();
    });
    promptViewerWindow.on('closed', () => {
        promptViewerWindow = null;
    });
    return promptViewerWindow;
}

// --- Open and update Prompt Viewer on demand ---
ipcMain.handle('openPromptViewer', async (_event, imagePath: string) => {
    startPromptReader(imagePath);
});

/**
 * Create the main application window
 */
function createMainWindow() {
    const iconPath = path.join(__dirname, '../resources/icon.png');
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        show: false,
    });

    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
    }

    mainWindow.once('ready-to-show', () => mainWindow?.show());
    mainWindow.on('closed', () => { mainWindow = null; });
}

// Electron app events
app.on('ready', async () => {
    // getPromptViewerWindow();
    startPromptReader();

    try {
        const db = await initDb();

        // ✅ run known migrations (as exported by your db-utils)
        await runIncrementalMigration(db);
        await runPerfMigration(db);

        console.log('✅ Database initialized');

        // Preload scan roots once for the handler getter
        const scanPathRows = await getAllScanPaths();
        const scanRoots = (Array.isArray(scanPathRows) ? scanPathRows : []).map((r: any) => r.path);

        // IPC registrations
        registerScanHandlers(
            db as any,
            () => scanRoots,
            () => ['.safetensors', '.pt', '.ckpt', '.lora', '.gguf']
        );
        registerModelsPageHandlers(db as any);

    } catch (err) {
        console.error('❌ Database initialization failed:', err);
        app.quit();
        return;
    }

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
// Save new image (imageHandler.saveModelImage returns void)
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
ipcMain.handle('dialog:openFileDialog', async (_event, options: Electron.OpenDialogOptions) => {
    if (!mainWindow) return [];
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result.canceled ? [] : result.filePaths;
});

// ---- APP VERSION ----
ipcMain.handle('get-app-version', () => app.getVersion());

// ---- MODEL SCANNING (legacy handler kept for compatibility) ----
ipcMain.handle('scanAndImportModels', async () => {
    scanCancelled = false;
    const scanPaths = await getAllScanPaths();
    const win = mainWindow ?? BrowserWindow.getAllWindows()[0];
    if (!win) throw new Error('No window for scan-progress');

    // 1️⃣ Run the folder‑import scan
    const result = await scanAndImportModels(
        scanPaths.map(p => p.path),
        win.webContents,
        () => scanCancelled
    );

    // 2️⃣ Enrich + save images (no assumption about return value)
    try {
        const all = await getAllModels();
        for (const m of all) {
            if (!m.main_image_path) {
                const metadata = await enrichModelFromAPI(m.model_hash);

                if (metadata.cover_image_url) {
                    // Save cover image locally; do NOT assume a return path
                    await saveModelImage(m.model_hash, metadata.cover_image_url);
                    // Do not set main_image_path from a return value; getAllModelsWithCover will pick up first image
                }

                if (Array.isArray((metadata as any).image_urls)) {
                    for (const url of (metadata as any).image_urls) {
                        if (!url || !/\.png($|[?&])/i.test(url)) {
                            console.log(`[scanAndImportModels] Skipping non-PNG image: ${url}`);
                            continue;
                        }
                        await saveModelImage(m.model_hash, url);
                    }
                }
            }
        }
    } catch (err) {
        console.error('[scanAndImportModels] metadata enrichment failed:', err);
    }

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
ipcMain.handle('enrichModelFromAPI', async (_e, hash: string) => {
    const metadata = await enrichModelFromAPI(hash);

    const urls: string[] = [];
    if ((metadata as any).cover_image_url) urls.push((metadata as any).cover_image_url);
    if (Array.isArray((metadata as any).image_urls)) urls.push(...(metadata as any).image_urls);
    if (Array.isArray((metadata as any).gallery)) urls.push(...(metadata as any).gallery);

    // Prefer PNG, then JPEG, up to 25
    const pngUrls = urls.filter(u => typeof u === 'string' && /\.png($|[?&])/i.test(u));
    const jpegUrls = urls.filter(u => typeof u === 'string' && /\.jpe?g($|[?&])/i.test(u) && !pngUrls.includes(u));
    const selectedUrls = pngUrls.concat(jpegUrls).slice(0, 25);

    for (let i = 0; i < selectedUrls.length; i++) {
        const url = selectedUrls[i];
        if (!url) continue;
        try {
            // Save image locally; do NOT assume a returned path
            await saveModelImage(hash, url);
            // If you want to set main_image_path explicitly, you can compute your own file:// destination
            // based on userData + modelHash + extension, but since getAllModelsWithCover() falls back
            // to the first image, we can skip that here to avoid regressions.
        } catch (err) {
            console.error(`[enrichModelFromAPI] failed to save image ${url}:`, err);
        }
    }

    return metadata;
});

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

// ---- Select a main image from disk ----
ipcMain.handle('selectModelMainImage', async (_e, modelHash: string) => {
    if (!mainWindow) throw new Error('No window to attach dialog');
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Main Image for Model',
        properties: ['openFile'],
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
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
        console.log('[get-image-metadata] Attempting to read image metadata');
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
    const candidates = [
        path.join(process.resourcesPath, exeName),
        path.join(process.resourcesPath, 'resources', exeName),
    ];
    const exePath = candidates.find(fs.existsSync);
    if (!exePath) {
        console.error('❌ Cannot find Prompt Reader exe in:', candidates);
        return false;
    }

    let realImage = imagePath;
    if (app.isPackaged && imagePath.includes(`app.asar${path.sep}`)) {
        realImage = imagePath.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
    }

    console.log('Launching Prompt Reader GUI:', exePath, realImage);

    if (promptProcess && !promptProcess.killed) {
        promptProcess.kill();
    }

    promptProcess = spawn(exePath, [realImage], {
        shell: true,
        windowsHide: false,
        detached: false
    });

    promptProcess.on('error', err => console.error('❌ Failed to launch Prompt Reader:', err));
    promptProcess.on('exit', (code, signal) => {
        console.log(`🔔 Prompt Reader exited with code=${code} signal=${signal}`);
    });
    promptProcess.stdout?.on('data', d => console.log('📤 Prompt Reader stdout:', d.toString()));
    promptProcess.stderr?.on('data', d => console.error('📥 Prompt Reader stderr:', d.toString()));

    return true;
});

ipcMain.handle('selectFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
});

// File: main/main.ts  — REPLACE the entire existing getPromptMetadata handler with this
ipcMain.handle('getPromptMetadata', async (_e, imagePath: string) => {
    try {
        const normalized = path.normalize(imagePath);

        if (getUseExternalPromptParser()) {
            try {
                const j = await callSdPromptReaderCLI(normalized);
                // Normalize a few common fields from CLI JSON to our format
                const tool = j?.tool || j?.source || (j?.data?.tool) || 'Unknown';
                const positive = j?.positive || j?.prompt || j?.data?.prompt;
                const negative = j?.negative || j?.data?.negative_prompt;
                const settings = j?.settings || j?.params || {};
                const formatted = formatMetaString({ tool, positive, negative, settings });
                return formatted || '<No metadata available>';
            } catch {
                // fall through to internal reader if CLI fails
            }
        }

        const meta = await readSdMetadata(normalized);
        return formatMetaString(meta);
    } catch (err: any) {
        console.error('[getPromptMetadata] error:', err);
        return '<Error reading metadata>';
    }
});

ipcMain.handle('open-prompt-viewer', async (event, imagePath: string) => {
    try {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) {
            win.webContents.send('showPrompt', imagePath);
        }
        return;
    } catch (err) {
        console.error('[open-prompt-viewer] error:', err);
        return;
    }
});

// ---- NOTES & TAGS ----
ipcMain.handle('getUserNote', (_e, hash: string) => getUserNote(hash));
ipcMain.handle('setUserNote', (_e, hash: string, note: string) => setUserNote(hash, note));
ipcMain.handle('getTags', (_e, hash: string) => getTags(hash));
ipcMain.handle('addTag', (_e, hash: string, tag: string) => addTag(hash, tag));
ipcMain.handle('removeTag', (_e, hash: string, tag: string) => removeTag(hash, tag));
ipcMain.handle('getUseExternalPromptParser', async () => getUseExternalPromptParser());
ipcMain.handle('setUseExternalPromptParser', async (_e, v: boolean) => setUseExternalPromptParser(!!v));
