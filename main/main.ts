import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { getAllModels, initDb } from '../db/db-utils';
import { getApiKey, setApiKey } from '../db/db-utils';
import { scanAndImportModels } from './electron-utils/modelScanner';
import { getAllScanPaths, addScanPath, removeScanPath } from '../db/db-utils';
import { saveModelImage, getModelImages } from './electron-utils/imageHandler';

// Keep a global reference of the window object
let mainWindow: BrowserWindow | null = null;

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
            : `file://${path.join(__dirname, '../renderer/public/index.html')}`
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
    const scanPaths = await getAllScanPaths(); // Reads paths from DB
    return scanAndImportModels(scanPaths.map(p => p.path));
});

// List scan paths
ipcMain.handle('getAllScanPaths', async () => {
    return await getAllScanPaths();
});

// Add a scan path
ipcMain.handle('addScanPath', async (_event, pathStr: string) => {
    await addScanPath(pathStr);
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
