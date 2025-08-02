// renderer/src/App.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import ModelGrid from './components/ModelGrid';
import ModelDetailsModal from './components/ModelDetailsModal';
import ConfigModal from './components/ConfigModal';
import Header from './components/Header';
import Spinner from './components/Spinner';
import ScanProgressModal from './components/ScanProgressModal';
import './index.css';

import logo from './assets/logo.png';

const App: React.FC = () => {
    const [showConfig, setShowConfig] = useState(false);
    const [selectedModel, setSelectedModel] = useState<string | null>(null);
    const [models, setModels] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [scanProgress, setScanProgress] = useState<{ current: number; total: number; file: string; status?: string } | null>(null);
    const [scanInProgress, setScanInProgress] = useState(false);

    // Filter models for search and type
    const filteredModels = models.filter(m =>
        (!typeFilter || (m.model_type && m.model_type.toLowerCase() === typeFilter.toLowerCase()) ||
            (m.file_name && m.file_name.toLowerCase().includes(typeFilter.toLowerCase())))
        &&
        (m.file_name?.toLowerCase().includes(search.toLowerCase()) ||
            m.model_type?.toLowerCase().includes(search.toLowerCase()) ||
            m.base_model?.toLowerCase().includes(search.toLowerCase()))
    );

    const fetchModels = useCallback(async () => {
        setLoading(true);
        if (window.electronAPI && window.electronAPI.getAllModelsWithCover) {
            // Pull raw rows (which include `cover_image_url`)…
            const raw = await window.electronAPI.getAllModelsWithCover();
            // …then map to the ModelGrid interface by aliasing cover_image_url → cover_image
            setModels(raw.map((m: any) => ({
                model_hash: m.model_hash,
                file_name: m.file_name,
                base_model: m.base_model,
                model_type: m.model_type,
                is_favorite: m.is_favorite,
                // ModelGrid uses `cover_image`, so copy over your DB field here:
                cover_image: m.main_image_path || null
            })));
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchModels();
    }, [fetchModels]);

    // Model details modal
    const handleOpenConfig = () => setShowConfig(true);
    const handleCloseConfig = () => setShowConfig(false);
    const handleSelectModel = (modelHash: string) => setSelectedModel(modelHash);
    const handleCloseModelDetails = () => setSelectedModel(null);

    // Scan logic
    const handleUpdateScan = async () => {
        setScanInProgress(true);
        setScanProgress({ current: 0, total: 0, file: '' });
        if (window.electronAPI && window.electronAPI.scanAndImportModels) {
            await window.electronAPI.scanAndImportModels();
        }
        await fetchModels();
        setScanInProgress(false);
        setScanProgress(null);
    };

    // Progress modal event handler
    useEffect(() => {
        const handler = (_event: any, data: any) => {
            setScanProgress({
                current: data.current,
                total: data.total,
                file: data.file,
                status: data.status,
            });
            setScanInProgress(!(data.done));
            if (data.done) {
                setTimeout(() => setScanProgress(null), 1000);
            }
        };
        window.electronAPI.onScanProgress(handler);
        return () => {
            window.electronAPI.removeScanProgress(handler);
        };
    }, []);

    // Cancel scan from modal
    const handleCancelScan = () => {
        if (window.electronAPI?.cancelScan) window.electronAPI.cancelScan();
        setScanInProgress(false);
        setScanProgress(null);
    };

    // Favorite toggle handler
    const handleToggleFavorite = async (modelHash: string) => {
        if (window.electronAPI?.toggleFavoriteModel) {
            await window.electronAPI.toggleFavoriteModel(modelHash);
            fetchModels();
        }
    };

    return (
        <ThemeProvider>
            <div className="h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
                {/* Header stays at top, never scrolls */}
                <Header logo={logo} onOpenConfig={handleOpenConfig} />
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar stays fixed on left, never scrolls */}
                    <Sidebar
                        onOpenConfig={handleOpenConfig}
                        onSelectModel={handleSelectModel}
                        onUpdateScan={handleUpdateScan}
                        search={search}
                        setSearch={setSearch}
                        onTypeFilter={setTypeFilter}
                    />
                    {/* Main content area: ONLY THIS SCROLLS */}
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
