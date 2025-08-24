// START OF FILE: renderer/src/App.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import ModelGrid, { ModelInfo } from './components/ModelGrid';
import ModelDetailsModal from './components/ModelDetailsModal';
import ConfigModal from './components/ConfigModal';
import Header from './components/Header';
import Spinner from './components/Spinner';
import ScanProgressModal from './components/ScanProgressModal';
import './index.css';
import logo from './assets/logo.png';

const PAGE_SIZE = 200;

const App: React.FC = () => {
    const [showConfig, setShowConfig] = useState(false);
    const [selectedModel, setSelectedModel] = useState<string | null>(null);
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [scanProgress, setScanProgress] = useState<{ current: number; total: number; file: string; status?: string } | null>(null);
    const [scanInProgress, setScanInProgress] = useState(false);

    // Derived filtering for the grid
    const filteredModels = models
        .filter(m =>
            (
                !typeFilter ||
                (m.model_type && m.model_type.toLowerCase() === typeFilter.toLowerCase()) ||
                (m.file_name && m.file_name.toLowerCase().includes(typeFilter.toLowerCase()))
            )
            &&
            (
                m.file_name?.toLowerCase().includes(search.toLowerCase()) ||
                m.model_type?.toLowerCase().includes(search.toLowerCase()) ||
                (m.base_model || '').toLowerCase().includes(search.toLowerCase())
            )
        )
        .sort((a, b) => a.file_name.localeCompare(b.file_name, undefined, { sensitivity: 'base' }));

    // Normalize model row into ModelInfo shape
    function mapRowToModelInfo(m: any): ModelInfo {
        const cover =
            m.main_image_path /* DB cover field */ ||
            m.thumbnail_path  /* from models:list */ ||
            m.cover_image     /* pre-shaped */ ||
            null;

        return {
            model_hash: m.model_hash,
            file_name:  m.file_name || m.name || '',
            base_model: m.base_model,
            model_type: m.model_type,
            is_favorite: Number(m.is_favorite ?? 0),
            cover_image: cover,
        };
    }

    // Paged load (fast first paint, then background hydrate)
    const loadModelsPaged = useCallback(async () => {
        setLoading(true);

        const hasIpc = !!(window as any)?.electron?.ipcRenderer;
        if (hasIpc) {
            try {
                let offset = 0;

                const first: any[] = await (window as any).electron.ipcRenderer.invoke('models:list', { offset, limit: PAGE_SIZE });
                setModels(first.map(mapRowToModelInfo));
                offset += first.length;

                while (true) {
                    const next: any[] = await (window as any).electron.ipcRenderer.invoke('models:list', { offset, limit: PAGE_SIZE });
                    if (!next || next.length === 0) break;
                    setModels(prev => [...prev, ...next.map(mapRowToModelInfo)]);
                    offset += next.length;
                }

                setLoading(false);
                return; // success
            } catch (err) {
                console.warn('[App] models:list failed, falling back:', err);
            }
        }

        // Legacy fallback if new IPC isn’t wired
        if ((window as any).electronAPI?.getAllModelsWithCover) {
            const raw = await (window as any).electronAPI.getAllModelsWithCover();
            setModels(raw.map(mapRowToModelInfo));
        }
        setLoading(false);
    }, []);

    // Initial load — NO scan here (avoids 5‑minute startup delay)
    useEffect(() => {
        loadModelsPaged();
    }, [loadModelsPaged]);

    // Dialog/modals
    const handleOpenConfig = () => setShowConfig(true);
    const handleCloseConfig = () => setShowConfig(false);
    const handleSelectModel = (modelHash: string) => setSelectedModel(modelHash);
    const handleCloseModelDetails = () => setSelectedModel(null);

    // Update Scan fallback (only used if Sidebar can't reach ipcRenderer)
    const handleUpdateScan = async () => {
        try {
            setScanInProgress(true);
            setScanProgress({ current: 0, total: 0, file: '' });

            // Prefer new incremental scan
            if ((window as any).electron?.ipcRenderer) {
                await (window as any).electron.ipcRenderer.invoke('scan:start', { mode: 'incremental' });
            } else if ((window as any).electronAPI?.scanAndImportModels) {
                // Legacy full scan fallback (not ideal, but keeps old builds working)
                await (window as any).electronAPI.scanAndImportModels();
            }

            // Refresh list after scan
            await loadModelsPaged();
        } finally {
            setScanInProgress(false);
            setScanProgress(null);
        }
    };

    // Scan progress listener — supports both new ('scan:progress') and legacy bridges
    useEffect(() => {
        const ipc = (window as any)?.electron?.ipcRenderer;
        let listener: any;

        if (ipc?.on) {
            listener = (_e: any, data: any) => {
                setScanProgress({
                    current: data.processed ?? data.current ?? 0,
                    total: data.total ?? 0,
                    file: data.currentPath ?? data.file ?? '',
                    status: data.phase ?? data.status,
                });
                const done = data?.phase === 'done' || data?.done === true || (data?.processed >= data?.total && data?.total > 0);
                setScanInProgress(!done);
                if (done) setTimeout(() => setScanProgress(null), 800);
            };
            ipc.on('scan:progress', listener);

            return () => {
                try {
                    ipc.removeListener?.('scan:progress', listener);
                } catch {}
            };
        }

        // Legacy event bridge
        if ((window as any).electronAPI?.onScanProgress) {
            const legacyHandler = (_event: any, data: any) => {
                setScanProgress({
                    current: data.current,
                    total: data.total,
                    file: data.file,
                    status: data.status,
                });
                setScanInProgress(!(data.done));
                if (data.done) setTimeout(() => setScanProgress(null), 800);
            };
            (window as any).electronAPI.onScanProgress(legacyHandler);
            return () => (window as any).electronAPI?.removeScanProgress?.(legacyHandler);
        }
    }, []);

    // Cancel scan from modal
    const handleCancelScan = () => {
        (window as any).electron?.ipcRenderer?.invoke?.('scan:cancel');
        (window as any).electronAPI?.cancelScan?.();
        setScanInProgress(false);
        setScanProgress(null);
    };

    // Favorite toggle
    const handleToggleFavorite = async (modelHash: string) => {
        if ((window as any).electronAPI?.toggleFavoriteModel) {
            await (window as any).electronAPI.toggleFavoriteModel(modelHash);
            loadModelsPaged();
        }
    };

    return (
        <ThemeProvider>
            <div className="h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
                <Header logo={logo} onOpenConfig={handleOpenConfig} />
                <div className="flex flex-1 overflow-hidden">
                    <Sidebar
                        onOpenConfig={handleOpenConfig}
                        onSelectModel={handleSelectModel}
                        onUpdateScan={handleUpdateScan}   // fallback only; primary call happens in Sidebar via ipcRenderer
                        search={search}
                        setSearch={setSearch}
                        onTypeFilter={setTypeFilter}
                    />
                    <main className="flex-1 h-full overflow-y-auto p-6 bg-zinc-50 dark:bg-slate-500 transition-colors duration-300">
                        {loading
                            ? <Spinner />
                            : <ModelGrid
                                onSelectModel={handleSelectModel}
                                onToggleFavorite={handleToggleFavorite}
                                models={filteredModels}
                            />
                        }
                    </main>
                </div>

                {showConfig && <ConfigModal onClose={handleCloseConfig} />}

                {selectedModel && (
                    <ModelDetailsModal
                        modelHash={selectedModel}
                        onClose={handleCloseModelDetails}
                    />
                )}

                {scanProgress && (
                    <ScanProgressModal
                        current={scanProgress.current}
                        total={scanProgress.total}
                        file={scanProgress.file}
                        status={scanProgress.status}
                        onCancel={handleCancelScan}
                    />
                )}
            </div>
        </ThemeProvider>
    );
};

export default App;

// END OF FILE: renderer/src/App.tsx
