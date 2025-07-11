import React, { useEffect, useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import ModelGrid from './views/ModelGrid';
import ModelDetailsModal from './components/ModelDetailsModal';
import ConfigModal from './components/ConfigModal';
import Header from './components/Header';

// Placeholder branding image
import logo from './assets/logo.png';

/**
 * App Root Component for Models Nexus.
 * Handles theme, modal states, and layout.
 */
const App: React.FC = () => {
    // Modal state management
    const [showConfig, setShowConfig] = useState(false);
    const [selectedModel, setSelectedModel] = useState<string | null>(null);const [models, setModels] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchModels = async () => {
        setLoading(true);
        if (window.electronAPI && window.electronAPI.getAllModels) {
            setModels(await window.electronAPI.getAllModels());
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchModels();
    }, []);

    // Handler to open config/settings modal
    const handleOpenConfig = () => setShowConfig(true);
    const handleCloseConfig = () => setShowConfig(false);

    // Handler to open/close model details modal
    const handleSelectModel = (modelHash: string) => setSelectedModel(modelHash);
    const handleCloseModelDetails = () => setSelectedModel(null);
    const handleUpdateScan = async () => {
        setLoading(true);
        if (window.electronAPI && window.electronAPI.scanAndImportModels) {
            await window.electronAPI.scanAndImportModels();
        }
        await fetchModels();
        setLoading(false);
    };

    return (
        <ThemeProvider>
            <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
                {/* Header with branding and buttons */}
                <Header
                    logo={logo}
                    onOpenConfig={handleOpenConfig}
                />

                <div className="flex flex-1">
                    {/* Sidebar: filters, search, update scan, etc. */}
                    <Sidebar
                        onOpenConfig={handleOpenConfig}
                        onSelectModel={handleSelectModel}
                        onUpdateScan={handleUpdateScan}
                    />

                    {/* Main content: grid/list of models */}
                    <main className="flex-1 overflow-y-auto p-6">
                        {loading
                            ? <div className="text-xl text-center mt-12">Scanning for models…</div>
                            : <ModelGrid onSelectModel={handleSelectModel} models={models} />
                        }
                    </main>
                </div>

                {/* Modals */}
                {showConfig && <ConfigModal onClose={handleCloseConfig} />}
                {selectedModel && (
                    <ModelDetailsModal
                        modelHash={selectedModel}
                        onClose={handleCloseModelDetails}
                    />
                )}
            </div>
        </ThemeProvider>
    );
};

export default App;
