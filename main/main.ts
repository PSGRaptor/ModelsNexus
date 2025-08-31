// File: main/main.ts
process.on('unhandledRejection', (reason, _promise) => {
    console.error('🚨 Unhandled Promise Rejection:', reason);
});

import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import { promises as fsp } from 'fs';
import * as path from 'path';
const { dirname } = path;
import { spawn, ChildProcess, execFile } from 'child_process';
import { promisify } from 'util';
import { readSdMetadata } from './metadata/sdMetadata.js';
import { parseA1111Parameters } from './metadata/sdMetadata.js';
import { getUseExternalPromptParser, setUseExternalPromptParser } from './config/settings.js';
import { scanNewOrChanged } from './scanner/fastScan.js';
import { loadSettings, patchSettings } from './settings';

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

function registerFastScanIpc() {
    // Ensure we never double-register (dev reloads, multiple calls, etc.)
    ipcMain.removeHandler('scanNewOrChanged');

    ipcMain.handle('scanNewOrChanged', async (_event, rootsMaybe?: string[] | null) => {
        try {
            // Resolve roots:
            // - if the renderer passed an array with items, use it
            // - otherwise, fall back to the saved scan paths in the DB
            let roots: string[];
            if (Array.isArray(rootsMaybe) && rootsMaybe.length > 0) {
                roots = rootsMaybe;
            } else {
                const rows = await getAllScanPaths();
                roots = (Array.isArray(rows) ? rows : [])
                    .map((r: any) => r.path)
                    .filter((p: unknown): p is string => typeof p === 'string' && p.length > 0);
            }

            const result = await scanNewOrChanged(roots);
            return result;
        } catch (err: any) {
            console.error('[scanNewOrChanged] error', err);
            return {
                processed: 0,
                skipped: 0,
                totalCandidates: 0,
                errors: 1,
                errorsDetail: [
                    { file: '(ipc)', error: String(err?.message ?? err) },
                ],
            };
        }
    });
}

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

// Convert file:// URL -> local FS path; also trim quotes/spaces
function toLocalFsPath(input: string): string {
    if (!input) return input;
    const s = input.trim().replace(/^"(.*)"$/, '$1'); // strip surrounding quotes
    if (s.startsWith('file://')) {
        try { return fileURLToPath(s); } catch { /* fallthrough */ }
        // naive fallback for odd Windows URIs like file://C:/...
        return s.replace(/^file:\/+/, '');
    }
    return s;
}

function isModelFile(filePath: string): boolean {
    // Adjust to what you currently support.
    // If your repo already has this helper, import and reuse it instead.
    const ext = path.extname(filePath).toLowerCase();
    return ['.safetensors', '.ckpt', '.pt', '.pth', '.bin', '.onnx', '.gguf'].includes(ext);
}

// Call bundled CLI in /resources when toggle is ON
function callSdPromptReaderCLI(imgPath: string): Promise<{ json?: any, text?: string }> {
    return new Promise((resolve, reject) => {
        const exe = path.join(process.cwd(), 'resources', 'sd-prompt-reader-cli.exe');

        if (!fs.existsSync(exe)) {
            const msg = `[sd-cli] exe not found at ${exe}`;
            console.error(msg);
            return reject(new Error(msg));
        }

        const tryOnce = (args: string[], label: string, next?: () => void) => {
            console.log('[sd-cli] spawn:', exe, args.join(' '));
            const p = spawn(exe, args, { windowsHide: true });

            let out = '';
            let err = '';
            p.stdout.on('data', d => (out += d.toString()));
            p.stderr.on('data', d => (err += d.toString()));
            p.on('close', code => {
                console.log(`[sd-cli] ${label} exit code:`, code, 'out.len=', out.length, 'err.len=', err.length);
                if (out.trim()) {
                    try {
                        const j = JSON.parse(out);
                        return resolve({ json: j });
                    } catch {
                        return resolve({ text: out });
                    }
                }
                if (next) return next(); // try fallback
                return reject(new Error(err || `sd-prompt-reader-cli exit ${code}`));
            });
            p.on('error', e => {
                console.error('[sd-cli] spawn error:', e);
                if (next) return next();
                reject(e);
            });
        };

        // 1) Try JSON mode
        tryOnce(['-r', '-i', imgPath, '-f', 'JSON'], 'json', () => {
            // 2) Fallback to plain text (no -f)
            tryOnce(['-r', '-i', imgPath], 'text');
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
        // hide menu bar in packaged builds (Win/Linux shows on Alt if not hidden)
        autoHideMenuBar: app.isPackaged,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            devTools: !app.isPackaged, // disable DevTools in production
        },
        show: false,
        // icon: iconPath, // ← optional: uncomment if you want a custom icon here
    });

    // --- Production-only hardening ---
    if (app.isPackaged && mainWindow) {
        if (process.platform === 'darwin') {
            // Minimal macOS menu (users expect an app menu)
            const template: Electron.MenuItemConstructorOptions[] = [
                {
                    label: app.name,
                    submenu: [
                        { role: 'about', label: `About ${app.name}` },
                        { type: 'separator' },
                        { role: 'hide' },
                        { role: 'hideOthers' },
                        { role: 'unhide' },
                        { type: 'separator' },
                        { role: 'quit', label: 'Quit' },
                    ],
                },
            ];
            const menu = Menu.buildFromTemplate(template);
            Menu.setApplicationMenu(menu);
        } else {
            // Windows/Linux: remove the menu entirely
            Menu.setApplicationMenu(null);
            mainWindow.setMenuBarVisibility(false); // belt & suspenders
            // (autoHideMenuBar already true from options)
        }

        // Block common DevTools shortcuts
        mainWindow.webContents.on('before-input-event', (event, input) => {
            const isOpenDevToolsShortcut =
                input.type === 'keyDown' &&
                (
                    input.key === 'F12' ||
                    (input.control && input.shift && input.key.toUpperCase() === 'I') || // Ctrl+Shift+I (Win/Linux)
                    (input.meta && input.alt && input.key.toUpperCase() === 'I')        // Cmd+Opt+I (macOS)
                );

            if (isOpenDevToolsShortcut) {
                event.preventDefault();
            }
        });
    }

    // Load URL or file as you already do
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

        registerFastScanIpc();

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

// Optional IPC: explicit full rebuild using same module
ipcMain.handle('scan:fullRebuild', async (_e, scanRoots: string[]) => {
    // CALL WITH ONE ARG (full rebuild behavior should be handled inside fastScan module)
    const res = await scanNewOrChanged(scanRoots);
    return res;
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

    // 🔧 Normalize file://… to a real filesystem path
    const fsImagePath = toLocalFsPath(String(imagePath));

    let realImage = fsImagePath;
    if (app.isPackaged && fsImagePath.includes(`app.asar${path.sep}`)) {
        realImage = fsImagePath.replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`);
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

ipcMain.handle('getPromptMetadata', async (_e, imagePath: string) => {
    try {
        console.log('[getPromptMetadata] toggle=', getUseExternalPromptParser());
        const localPath = toLocalFsPath(imagePath);
        const normalized = path.normalize(localPath);
        // const normalized = path.normalize(imagePath);
        console.log('[getPromptMetadata] input:', imagePath);
        console.log('[getPromptMetadata] normalized:', normalized);

        if (getUseExternalPromptParser()) {
            try {
                const { json, text } = await callSdPromptReaderCLI(normalized);

                if (json) {
                    const tool = json?.tool || json?.source || (json?.data?.tool) || 'Unknown';
                    const positive = json?.positive || json?.prompt || json?.data?.prompt;
                    const negative = json?.negative || json?.data?.negative_prompt;
                    const settings = json?.settings || json?.params || {};
                    const formatted = formatMetaString({ tool, positive, negative, settings });
                    if (formatted && formatted !== '<No metadata available>') return formatted;
                }

                if (text && /Negative prompt:|Steps:\s*\d+|Sampler:/i.test(text)) {
                    const { positive, negative, settings } = parseA1111Parameters(text);
                    const formatted = formatMetaString({ tool: 'A1111', positive, negative, settings });
                    if (formatted && formatted !== '<No metadata available>') return formatted;
                }

                console.warn('[getPromptMetadata] CLI produced no usable stdout; falling back to internal reader.');
            } catch (e) {
                console.error('[getPromptMetadata] CLI error, falling back:', e);
            }
        }

        const meta = await readSdMetadata(normalized);
        console.log('[getPromptMetadata] internal reader meta keys=', meta && Object.keys(meta || {}));
        return formatMetaString(meta);
    } catch (err: any) {
        console.error('[getPromptMetadata] error:', err);
        return '<Error reading metadata>';
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
ipcMain.handle('getUserSettings', async () => loadSettings());
ipcMain.handle('updateUserSettings', async (_e, patch: any) => patchSettings(patch ?? {}));

