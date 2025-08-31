// File: renderer/src/components/ConfigModal.tsx

import React, { useEffect, useMemo, useState } from 'react';
import { useTheme, Theme } from '../context/ThemeContext';

type ConfigModalProps = {
    onClose: () => void;
};

// Progress event payload from main process
type FastScanProgress = {
    phase: 'start' | 'progress' | 'done';
    totalCandidates: number;
    checked: number;
    processed: number;
    skipped: number;
    errors: number;
    currentFile?: string;
    lastResult?: 'added' | 'updated' | 'skipped' | 'error';
};

const THEME_LABELS: Record<Theme, string> = {
    light: 'Light',
    dark: 'Dark',
    auto: 'Auto (System)',
};

const ConfigModal: React.FC<ConfigModalProps> = ({ onClose }) => {
    const [scanPaths, setScanPaths] = useState<string[]>([]);
    const [newPath, setNewPath] = useState('');
    const [civitaiKey, setCivitaiKey] = useState('');
    const [huggingfaceKey, setHuggingfaceKey] = useState('');
    const [savingKeys, setSavingKeys] = useState(false);

    const [updating, setUpdating] = useState(false);
    const [updateStatus, setUpdateStatus] = useState<string | null>(null);

    // --- Fast scan state (existing) ---
    const [fastScanBusy, setFastScanBusy] = useState(false);
    const [fastScanStatus, setFastScanStatus] = useState<string | null>(null);
    const [fastScanResult, setFastScanResult] = useState<{
        processed: number;
        skipped: number;
        totalCandidates: number;
        errors: number;
        errorsDetail?: { file: string; error: string }[];
    } | null>(null);

    // --- New: live progress subscription state ---
    const [scanProgress, setScanProgress] = useState<FastScanProgress | null>(null);
    const percent = useMemo(() => {
        if (!scanProgress || scanProgress.totalCandidates === 0) return 0;
        return Math.floor((scanProgress.checked / scanProgress.totalCandidates) * 100);
    }, [scanProgress]);

    // External parser toggle (logic preserved)
    const [useExternalParser, setUseExternalParser] = useState(false);
    const [parserBusy, setParserBusy] = useState(false);

    // Theme control
    const { theme, setTheme } = useTheme();

    // Initial load
    useEffect(() => {
        (async () => {
            if (window.electronAPI) {
                const allPaths = await window.electronAPI.getAllScanPaths();
                setScanPaths(allPaths.map((p: any) => p.path));
                setCivitaiKey(await window.electronAPI.getApiKey('civitai'));
                setHuggingfaceKey(await window.electronAPI.getApiKey('huggingface'));
            }
            if (window.settingsAPI) {
                const flag = await window.settingsAPI.getUseExternalPromptParser();
                setUseExternalParser(!!flag);
            }
        })();
    }, []);

    // Subscribe to incremental fast-scan progress (safe with optional chaining)
    // AFTER: use the real helper exposed by preload
    useEffect(() => {
        const api = window.electronAPI as any;
        if (!api?.onScanProgress) return;

        // Call the subscription; it may return undefined or an unsubscribe function.
        const maybeUnsub = api.onScanProgress((p: FastScanProgress) => {
            setScanProgress(p);
            setFastScanBusy(p.phase !== 'done');
        }) as unknown;

        // Cleanup: only call if a function was returned
        return () => {
            if (typeof maybeUnsub === 'function') {
                try { (maybeUnsub as () => void)(); } catch { /* no-op */ }
            } else if (typeof api?.offScanProgress === 'function') {
                // Optional: if your preload exposes an explicit "off" helper
                try { api.offScanProgress(); } catch { /* no-op */ }
            }
        };
    }, []);


    // Add a new scan path
    const handleAddPath = async () => {
        const folder = await window.electronAPI.selectFolder();
        if (!folder) return;
        if (!scanPaths.includes(folder)) {
            const paths = await window.electronAPI.addScanPath(folder);
            setScanPaths(paths.map((p: any) => p.path));
        }
    };

    // Remove scan path
    const handleRemovePath = async (p: string) => {
        await window.electronAPI.removeScanPath(p);
        const allPaths = await window.electronAPI.getAllScanPaths();
        setScanPaths(allPaths.map((x: any) => x.path));
    };

    // Save API keys
    const handleSaveKeys = async () => {
        setSavingKeys(true);
        await window.electronAPI.setApiKey('civitai', civitaiKey);
        await window.electronAPI.setApiKey('huggingface', huggingfaceKey);
        setSavingKeys(false);
    };

    // Re-enrich all
    const handleReenrichAll = async () => {
        setUpdating(true);
        setUpdateStatus(null);
        try {
            const res = await window.electronAPI.reenrichAllModels();
            if (res?.success) setUpdateStatus('All models have been re-enriched!');
            else setUpdateStatus(`Failed: ${res?.error || 'Unknown error'}`);
        } catch (err) {
            setUpdateStatus(`Failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        setUpdating(false);
    };

    // Toggle external parser
    const toggleExternalParser = async () => {
        if (!window.settingsAPI) return;
        setParserBusy(true);
        const next = !useExternalParser;
        await window.settingsAPI.setUseExternalPromptParser(next);
        setUseExternalParser(next);
        setParserBusy(false);
    };

    // Fast scan: only new/changed
    const onFastScan = async () => {
        setFastScanBusy(true);
        setFastScanStatus(null);
        setFastScanResult(null);
        setScanProgress(null); // clear previous live progress
        try {
            const roots =
                scanPaths.length > 0
                    ? scanPaths
                    : (await window.electronAPI.getAllScanPaths()).map((p: any) => p.path);

            const res = await window.electronAPI.scanNewOrChanged(roots);

            // Persist raw result for optional details UI
            setFastScanResult(res);

            const processed = res?.processed ?? 0;
            const skipped = res?.skipped ?? 0;
            const totalCandidates = res?.totalCandidates ?? processed + skipped + (res?.errors ?? 0);
            const errors =
                typeof res?.errors === 'number'
                    ? res.errors
                    : Math.max(0, totalCandidates - processed - skipped);

            setFastScanStatus(
                `Fast scan complete. Processed: ${processed}, Skipped: ${skipped}${
                    errors ? `, Errors: ${errors}` : ''
                }.`
            );
        } catch (e) {
            setFastScanStatus(`Fast scan failed: ${e instanceof Error ? e.message : String(e)}`);
        }
        setFastScanBusy(false);
    };

    const renderThemeSelector = () => (
        <div className="mb-6">
            <div className="font-semibold mb-2 text-zinc-700 dark:text-zinc-200">App Theme</div>
            <div className="flex gap-2">
                {(Object.keys(THEME_LABELS) as Theme[]).map((t) => (
                    <button
                        key={t}
                        className={`px-4 py-2 rounded font-semibold border text-sm
              ${
                            theme === t
                                ? 'bg-blue-600 text-white border-blue-700 shadow'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700'
                        }
              transition`}
                        onClick={() => setTheme(t)}
                        disabled={theme === t}
                    >
                        {THEME_LABELS[t]}
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-xl p-8 max-h-[90vh] overflow-y-auto relative transition-colors">
                <button
                    className="absolute top-4 right-6 text-2xl text-zinc-500 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-300"
                    onClick={onClose}
                    title="Close"
                >
                    &times;
                </button>

                <h2 className="text-2xl font-bold mb-4 text-blue-800 dark:text-white">Settings</h2>

                {/* Theme selector */}
                {renderThemeSelector()}

                {/* Scan paths */}
                <div className="mb-6">
                    <div className="font-semibold mb-2 text-zinc-700 dark:text-zinc-200">Model Scan Folders</div>
                    <ul className="mb-2">
                        {scanPaths.length === 0 && (
                            <li className="text-zinc-500 dark:text-zinc-400">No folders configured yet.</li>
                        )}
                        {scanPaths.map((p) => (
                            <li key={p} className="flex items-center justify-between group">
                                <span className="truncate text-zinc-800 dark:text-zinc-100">{p}</span>
                                <button
                                    className="text-red-400 hover:text-red-600 text-xl font-bold ml-2 opacity-0 group-hover:opacity-100 transition"
                                    onClick={() => handleRemovePath(p)}
                                    title="Remove"
                                >
                                    &times;
                                </button>
                            </li>
                        ))}
                    </ul>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            className="flex-1 p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100"
                            placeholder="Add new folder or \\network\share"
                            value={newPath}
                            onChange={(e) => setNewPath(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddPath()}
                            spellCheck={false}
                            autoCorrect="off"
                            autoCapitalize="none"
                        />
                        <button
                            type="button"
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold"
                            onClick={handleAddPath}
                        >
                            Add
                        </button>
                    </div>
                </div>

                {/* API keys */}
                <div className="mb-6">
                    <div className="font-semibold mb-2 text-zinc-700 dark:text-zinc-200">API Keys</div>
                    <label className="block mb-2">
                        <span className="text-sm text-zinc-500 dark:text-zinc-300">Civitai</span>
                        <input
                            type="text"
                            className="mt-1 p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 w-full"
                            value={civitaiKey}
                            onChange={(e) => setCivitaiKey(e.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </label>
                    <label className="block mb-2">
                        <span className="text-sm text-zinc-500 dark:text-zinc-300">Hugging Face</span>
                        <input
                            type="text"
                            className="mt-1 p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 w-full"
                            value={huggingfaceKey}
                            onChange={(e) => setHuggingfaceKey(e.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </label>
                    <button
                        className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold mt-1 ${
                            savingKeys ? 'opacity-60 pointer-events-none' : ''
                        }`}
                        onClick={handleSaveKeys}
                        disabled={savingKeys}
                    >
                        {savingKeys ? 'Saving…' : 'Save API Keys'}
                    </button>
                </div>

                {/* Maintenance */}
                <div className="mb-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                    <div className="font-semibold mb-2 text-zinc-700 dark:text-zinc-200">Maintenance</div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleReenrichAll}
                            disabled={updating}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-semibold shadow disabled:opacity-60"
                        >
                            {updating ? 'Re-enriching All Models…' : 'Re-enrich All Models'}
                        </button>

                        <button
                            onClick={onFastScan}
                            disabled={fastScanBusy}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded font-semibold shadow disabled:opacity-60"
                            title="Scan only new/changed models"
                        >
                            {fastScanBusy ? 'Scanning new/changed…' : 'Scan new/changed (fast)'}
                        </button>
                    </div>

                    {/* --- New: live progress block --- */}
                    {scanProgress && (
                        <div className="mt-3 rounded-md border border-zinc-300 dark:border-zinc-700 p-3">
                            <div className="flex items-center justify-between text-sm">
                                <div className="font-medium">
                                    {scanProgress.phase === 'done' ? 'Fast scan complete' : 'Scanning…'}
                                </div>
                                <div className="tabular-nums">
                                    {scanProgress.checked}/{scanProgress.totalCandidates} ({percent}%)
                                </div>
                            </div>

                            {/* progress bar */}
                            <div className="mt-2 h-2 w-full bg-zinc-200 dark:bg-zinc-800 rounded">
                                <div
                                    className="h-2 rounded bg-blue-500 transition-all"
                                    style={{ width: `${percent}%` }}
                                />
                            </div>

                            {/* counters */}
                            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                                <div className="rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-1">
                                    Added/Processed: <b className="tabular-nums">{scanProgress.processed}</b>
                                </div>
                                <div className="rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-1">
                                    Skipped: <b className="tabular-nums">{scanProgress.skipped}</b>
                                </div>
                                <div className="rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1">
                                    Errors: <b className="tabular-nums">{scanProgress.errors}</b>
                                </div>
                            </div>

                            {/* current file */}
                            {scanProgress.currentFile && scanProgress.phase !== 'done' && (
                                <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-300 truncate">
                                    <span className="opacity-70">Now: </span>
                                    {scanProgress.currentFile}
                                </div>
                            )}
                        </div>
                    )}

                    {updateStatus && (
                        <div
                            className={`mt-2 text-sm ${
                                updateStatus.startsWith('Failed') ? 'text-red-500' : 'text-green-600'
                            }`}
                        >
                            {updateStatus}
                        </div>
                    )}

                    {fastScanStatus && (
                        <div
                            className={`mt-1 text-sm ${
                                fastScanStatus.startsWith('Fast scan failed') ? 'text-red-500' : 'text-emerald-600'
                            }`}
                        >
                            {fastScanStatus}
                        </div>
                    )}

                    {fastScanResult && (
                        <div className="mt-2 text-sm">
                            <div>
                                Fast scan complete. Processed: {fastScanResult.processed}, Skipped:{' '}
                                {fastScanResult.skipped}, Errors: {fastScanResult.errors}.
                            </div>
                            {fastScanResult.errors > 0 && fastScanResult.errorsDetail?.length ? (
                                <details className="mt-1">
                                    <summary>
                                        Show first {Math.min(10, fastScanResult.errorsDetail.length)} errors
                                    </summary>
                                    <ul className="list-disc pl-5 mt-1">
                                        {fastScanResult.errorsDetail.slice(0, 10).map((e, i) => (
                                            <li key={i}>
                                                <code>{e.file}</code> — {e.error}
                                            </li>
                                        ))}
                                    </ul>
                                </details>
                            ) : null}
                        </div>
                    )}

                    <div className="text-xs text-zinc-500 dark:text-zinc-300 mt-1">
                        Use <span className="font-medium">Scan new/changed (fast)</span> to ingest only files
                        detected as new or modified since the last run. Use{' '}
                        <span className="font-medium">Re-enrich</span> to refresh metadata for everything.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfigModal;
