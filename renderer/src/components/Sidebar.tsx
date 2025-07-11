import React from 'react';

/**
 * Sidebar Component
 * - Filters by model type
 * - Quick search
 * - Tag cloud (to be implemented)
 * - Update Scan button
 * - Settings (Config) button
 *
 * Props:
 *   onOpenConfig: () => void      // open config modal
 *   onSelectModel: (modelHash: string) => void  // select a model from the sidebar (if applicable)
 */
type SidebarProps = {
    onOpenConfig: () => void;
    onSelectModel: (modelHash: string) => void;
    onUpdateScan: () => void;
};

const Sidebar: React.FC<SidebarProps> = ({ onOpenConfig, onSelectModel, onUpdateScan }) => {
    // Placeholder: Static model types; to be dynamic from DB/API
    const modelTypes = ['SD1', 'SDXL', 'PONY', 'FLUX', 'HiDream', 'WAN'];
    return (
        <aside className="w-64 bg-muted border-r border-border flex flex-col py-4 px-2">
            <h2 className="text-xl font-bold mb-4">Filter by Type</h2>
            <div className="flex flex-col gap-2 mb-6">
                {modelTypes.map(type => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="accent-primary" /> {type}
                    </label>
                ))}
            </div>
            <input
                type="text"
                placeholder="Quick search…"
                className="mb-4 p-2 rounded bg-background border border-border"
            />

            {/* Tag cloud can be added here in future */}
            {/* <div className="mb-4">Tags: ...</div> */}

            <button
                className="mb-2 p-2 rounded bg-primary text-white hover:bg-primary-dark font-semibold"
                onClick={onUpdateScan}
            >
                Update Scan
            </button>

            <button
                className="p-2 rounded bg-background border border-primary text-primary hover:bg-primary hover:text-white mt-auto"
                onClick={onOpenConfig}
            >
                Settings
            </button>
        </aside>
    );
};

export default Sidebar;
