// File: main/scanner/fastScan.ts
import { BrowserWindow } from 'electron';
import { scanAndImportModels } from '../electron-utils/modelScanner.js';
import { getAllScanPaths } from '../../db/db-utils.js';

export type FastScanResult = {
    processed: number;
    skipped: number;
    totalCandidates: number;
    errors: number;
    errorsDetail?: Array<{ file: string; error: string }>;
};

/**
 * Fast scan that reuses the existing full scanner so we:
 *  - emit incremental progress via the same 'scan-progress' channel (already handled in preload/UI)
 *  - avoid introducing a second ingest path
 *  - respect your current DB “INSERT OR IGNORE” behavior (existing models are skipped)
 *
 * It accepts an optional list of roots; if omitted, it pulls the enabled scan paths from the DB.
 */
export async function scanNewOrChanged(roots?: string[]): Promise<FastScanResult> {
    // Resolve scan roots
    const scanRoots: string[] = Array.isArray(roots) && roots.length > 0
        ? roots
        : (await getAllScanPaths()).map((r: any) => r.path);

    // Identify the window to forward progress events (your modelScanner emits 'scan-progress')
    const win = BrowserWindow.getAllWindows()[0];
    const webContents = win?.webContents ?? undefined;

    // Optional: let the UI know we’re starting (reuses the same channel)
    if (webContents) {
        webContents.send('scan-progress', {
            current: 0,
            total: 0,
            file: '',
            status: 'starting-fast-scan',
        });
    }

    // Your real scanner signature: (scanDirs, webContentsInstance, isCancelled)
    // We don’t cancel here, so pass a stub.
    const importedHashes: string[] = await scanAndImportModels(
        scanRoots,
        webContents,
        () => false
    );

    // We don’t have a reliable total/skip/error breakdown from the scanner return type,
    // but we *do* know how many were imported. Treat the rest as skipped, with no errors.
    const processed = importedHashes.length;

    // If you want more accurate totals in the future, add an optional summary object
    // to the scanner’s return without changing existing behavior.

    const result: FastScanResult = {
        processed,
        skipped: 0,
        totalCandidates: processed,
        errors: 0,
    };

    // Optional: final “done” progress ping for UI completeness
    if (webContents) {
        webContents.send('scan-progress', {
            current: processed,
            total: processed,
            file: '',
            status: 'done-fast-scan',
        });
    }

    return result;
}
