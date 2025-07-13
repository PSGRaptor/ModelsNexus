import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import { getAllModels, initDb, getAllScanPaths, addScanPath, removeScanPath, getApiKey, setApiKey } from '../db/db-utils.js';
import { getUserNote, setUserNote, getTags, addTag, removeTag } from '../db/db-utils.js';
import { scanAndImportModels } from './electron-utils/modelScanner.js';
import { saveModelImage, getModelImages } from './electron-utils/imageHandler.js';
import { enrichModelFromAPI } from './electron-utils/metadataFetcher.js';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Keep a global reference of the window object
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
            contextIsolation: true,
        },
        show: false, // Hide until ready-to-show for better UX
    });

    mainWindow.loadURL(
        process.env.NODE_ENV === 'development'
            ? 'http://localhost:3000'
            : `file://${path.join(__dirname, '../renderer/dist/index.html')}`
    );

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Electron app events
app.on('ready', async () => {
    await initDb();
    createMainWindow();
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
    if (mainWindow === null) createMainWindow();
});

app.whenReady().then(async () => {
    await initDb();
    // ...rest of window creation logic...
});

/**
 * IPC handlers for secure communications (expand as needed)
 */
ipcMain.handle('get-app-version', async () => {
    return app.getVersion();
});

ipcMain.handle('getAllModels', async () => {
    return await getAllModels();
});

// Add IPC handler to scan and import models
ipcMain.handle('scanAndImportModels', async () => {
    scanCancelled = false; // Reset before every scan
    const scanPaths = await getAllScanPaths();
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (!win) throw new Error('No browser window available for scan progress!');
    return scanAndImportModels(scanPaths.map(p => p.path), win.webContents, () => scanCancelled);
});

// List scan paths
ipcMain.handle('getAllScanPaths', async () => {
    return await getAllScanPaths();
});

// Remove (disable) a scan path
ipcMain.handle('removeScanPath', async (_event, pathStr: string) => {
    await removeScanPath(pathStr);
    return await getAllScanPaths();
});

// Get API key
ipcMain.handle('getApiKey', async (_event, provider: string) => {
    return await getApiKey(provider);
});

// Set API key
ipcMain.handle('setApiKey', async (_event, provider: string, apiKey: string) => {
    await setApiKey(provider, apiKey);
});

// Save an image for a model
ipcMain.handle('saveModelImage', async (_event, modelHash: string, imageUrl: string) => {
    return await saveModelImage(modelHash, imageUrl);
});

// Get all image paths for a model
ipcMain.handle('getModelImages', async (_event, modelHash: string) => {
    return getModelImages(modelHash);
});

ipcMain.handle('enrichModelFromAPI', async (_event, model_hash: string) => {
    const civitaiKey = await getApiKey('civitai');
    const hfKey = await getApiKey('huggingface');
    return await enrichModelFromAPI(model_hash, civitaiKey, hfKey);
});

// Add a new scan path (save to DB if not exists)
ipcMain.handle('addScanPath', async (_event, pathStr: string) => {
    await addScanPath(pathStr);
    return await getAllScanPaths();
});

ipcMain.handle('selectFolder', async (event) => {
    const win = BrowserWindow.getFocusedWindow();
    const result = win
        ? await dialog.showOpenDialog(win, { properties: ['openDirectory'] })
        : await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
});

ipcMain.handle('cancelScan', () => {
    scanCancelled = true;
});

ipcMain.handle('getUserNote', async (_event, model_hash) => getUserNote(model_hash));
ipcMain.handle('setUserNote', async (_event, model_hash, note) => setUserNote(model_hash, note));
ipcMain.handle('getTags', async (_event, model_hash) => getTags(model_hash));
ipcMain.handle('addTag', async (_event, model_hash, tag) => addTag(model_hash, tag));
ipcMain.handle('removeTag', async (_event, model_hash, tag) => removeTag(model_hash, tag));

