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
import type { Tags } from 'exifreader';

const execFileAsync = promisify(execFile);
const cliPath = path.join(app.getAppPath(), 'resources', 'sd-prompt-reader-cli.exe');
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let scanCancelled = false;
let promptViewerWindow: BrowserWindow | null = null;
let promptReaderProcess: ChildProcess | null = null;
let lastImagePath: string | null = null;

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
        // If running and we have a new image, send image path
        if (imagePath && imagePath !== lastImagePath) {
            sendImageToPromptReader(imagePath);
        }
        // Try to show window (Windows only)
        bringPromptReaderToFront();
        return;
    }
    const exePath = getPromptReaderExePath();
    if (!fs.existsSync(exePath)) {
        console.error('[PromptReader] EXE not found:', exePath);
        return;
    }
    const args = imagePath ? [imagePath] : [];
    promptReaderProcess = spawn(exePath, args, { detached: true, stdio: 'ignore' });
    if (promptReaderProcess) {
        promptReaderProcess.kill();
    }
    lastImagePath = imagePath || null;
}

// Bring EXE window to front (Windows only)
function bringPromptReaderToFront() {
    // You can use "node-window-manager" or "ffi-napi" for true window activation,
    // but for most CLI image viewers, relaunching with the same process is sufficient.
    // For a minimal solution, do nothing; most EXEs will auto-activate.
    // To make this robust, you can add win32 API code to force show, if needed.
}

// Send new image path to EXE (if your EXE supports e.g. an IPC or custom file drop)
function sendImageToPromptReader(imagePath: string) {
    if (!promptReaderProcess) return;
    // If your EXE supports a watcher file, named pipe, or accepts stdin, use it here.
    // If not, the only way to update is to close & respawn with the new image.
    // We'll just relaunch for now, which ensures the image shows.
    // Kill the previous process and start a new one
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
        title: "Prompt Viewer",
        resizable: true,
        minimizable: false,
        maximizable: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // adjust as needed!
            contextIsolation: true,
            nodeIntegration: false,
        },
    });
    // Load your prompt viewer HTML or route (React: use loadURL to point to correct route)
    promptViewerWindow.loadFile(path.join(__dirname, '../renderer/dist/prompt-viewer.html'));
    // Or if using Vite/React SPA, use: promptViewerWindow.loadURL('app://.../prompt-viewer')
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
    //const win = getPromptViewerWindow();
    //if (!win) return;
    //win.show();
    //win.focus();
    // Send the new image path to renderer side for display
    //win.webContents.send('showPrompt', imagePath);
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
    // getPromptViewerWindow();
    startPromptReader();
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

    // 2️⃣ Immediately enrich each model’s metadata and save a LOCAL main image
    try {
        const all = await getAllModels();  // Imported from './db/db-utils.js'
        for (const m of all) {
            // CHANGE: Use m.main_image_path, not m.cover_image_url
            if (!m.main_image_path) {
                // 2.1️⃣ Fetch metadata & update DB
                const metadata = await enrichModelFromAPI(m.model_hash);

                // 2.2️⃣ Download the cover image (if provided)
                if (metadata.cover_image_url) {
                    // Download and get local path
                    const localCoverPath = await saveModelImage(m.model_hash, metadata.cover_image_url);
                    const fileUrl = localCoverPath.startsWith('file://') ? localCoverPath : `file://${localCoverPath}`;
                    // Save file:// path to main_image_path in the database
                    await updateModelMainImage(m.model_hash, fileUrl);
                }

                // 2.3️⃣ Download any additional gallery images
                if (Array.isArray((metadata as any).image_urls)) {
                    for (const url of (metadata as any).image_urls) {
                        if (!url || !url.toLowerCase().endsWith('.png')) {
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
//ipcMain.handle('enrichModelFromAPI', (_e, hash: string) => enrichModelFromAPI(hash));
// File: main/main.ts

// File: main/main.ts

ipcMain.handle('enrichModelFromAPI', async (_e, hash: string) => {
    // 1️⃣ Fetch metadata & update DB (same as before)
    const metadata = await enrichModelFromAPI(hash);

    // 2️⃣ Gather all image URLs you want to save (PNG priority, then JPEG)
    const urls = [];
    let mainImageLocalPath = null;
    if (metadata.cover_image_url) {
        urls.push(metadata.cover_image_url);
    }
    if (Array.isArray(metadata.image_urls)) {
        urls.push(...metadata.image_urls);
    }
    if (Array.isArray(metadata.gallery)) {
        urls.push(...metadata.gallery);
    }

    // PATCH: prioritize PNG, fallback to JPEG, up to 25 total images
    const pngUrls = urls.filter(u => typeof u === 'string' && /\.png($|[?&])/i.test(u));
    const jpegUrls = urls.filter(u => typeof u === 'string' && /\.jpe?g($|[?&])/i.test(u) && !pngUrls.includes(u));
    const selectedUrls = pngUrls.concat(jpegUrls).slice(0, 25);

    // 3️⃣ Download & save each one locally
    for (let i = 0; i < selectedUrls.length; i++) {
        const url = selectedUrls[i];
        if (!url) continue;
        try {
            const localPath = await saveModelImage(hash, url, i);
            // The first saved image (PNG or JPEG) is the cover; update DB with file:// path
            if (i === 0 && localPath) {
                const fileUrl = localPath.startsWith('file://') ? localPath : `file://${localPath}`;
                await updateModelMainImage(hash, fileUrl);
                mainImageLocalPath = fileUrl;
            }
        } catch (err) {
            console.error(`[enrichModelFromAPI] failed to save image ${url}:`, err);
        }
    }

    // Optionally, include the updated main_image_path in the returned metadata
    if (mainImageLocalPath) {
        metadata.main_image_path = mainImageLocalPath;
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

// File: main/main.ts

ipcMain.handle('getPromptMetadata', async (_e, imagePath) => {
    try {
        console.log('[getPromptMetadata] Called with:', imagePath);

        // Normalize Windows path and strip file:// if present
        let normalizedPath = imagePath.replace(/^file:\/\//, '');
        if (process.platform === 'win32' && normalizedPath.startsWith('/')) {
            normalizedPath = normalizedPath.slice(1);
        }
        console.log('[getPromptMetadata] Normalized path:', normalizedPath);

        // Confirm file exists
        if (!require('fs').existsSync(normalizedPath)) {
            console.error('[getPromptMetadata] File does not exist:', normalizedPath);
            return '<File does not exist>';
        }

        const buffer = await fs.promises.readFile(normalizedPath);
        const ext = normalizedPath.split('.').pop()?.toLowerCase() || '';

        // --- PNG: Try SD prompt in tEXt/iTXt chunks ---
        if (ext === 'png') {
            try {
                const { PNG } = require('pngjs');
                const png = PNG.sync.read(buffer);
                if (png.text) {
                    console.log('[getPromptMetadata] PNG tEXt keys:', Object.keys(png.text));
                    if (png.text.parameters) return png.text.parameters;
                    if (png.text.Description) return png.text.Description;
                    // Try all keys heuristically
                    for (const [k, v] of Object.entries(png.text)) {
                        if (typeof v === 'string' && v.toLowerCase().includes('steps') && v.length > 40)
                            return v;
                    }
                    return JSON.stringify(png.text, null, 2);
                } else {
                    console.warn('[getPromptMetadata] PNG has no tEXt chunk');
                }
            } catch (err) {
                console.error('[getPromptMetadata] PNG tEXt parse failed:', err);
            }
        }

        // --- JPEG/JPG and fallback: EXIF/XMP via exifreader ---
        try {
            const ExifReader = require('exifreader');
            const tags = ExifReader.load(buffer, { expanded: true, includeUnknown: true });

            // Look for any reasonable description fields (for SD prompts if present in XMP/EXIF)
            const desc =
                tags['XMP:parameters']?.description ||
                tags['XMP:Description']?.description ||
                tags['ImageDescription']?.description ||
                tags['Image']?.description;
            if (typeof desc === 'string' && desc.trim()) {
                return desc;
            }
            // Otherwise show all tags (will be camera/etc for JPEGs)
            if (Object.keys(tags).length > 0) {
                return JSON.stringify(tags, null, 2);
            }
            return '<No metadata found in file>';
        } catch (err) {
            console.error('[getPromptMetadata] EXIF/XMP parse failed:', err);
        }

        return '<No metadata available>';

    } catch (err) {
        console.error('[getPromptMetadata] UNHANDLED ERROR:', err);
        return '<No metadata available>';
    }
});




// ---- NOTES & TAGS ----
ipcMain.handle('getUserNote', (_e, hash: string) => getUserNote(hash));
ipcMain.handle('setUserNote', (_e, hash: string, note: string) => setUserNote(hash, note));
ipcMain.handle('getTags', (_e, hash: string) => getTags(hash));
ipcMain.handle('addTag', (_e, hash: string, tag: string) => addTag(hash, tag));
ipcMain.handle('removeTag', (_e, hash: string, tag: string) => removeTag(hash, tag));

