import React from 'react';

type SidebarProps = {
    onOpenConfig: () => void;
    onSelectModel: (modelHash: string) => void;
    onUpdateScan: () => void;
};

const modelTypes = ['SD1', 'SDXL', 'PONY', 'FLUX', 'HiDream', 'WAN'];

const Sidebar: React.FC<SidebarProps> = ({ onOpenConfig, onSelectModel, onUpdateScan }) => (
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

export default Sidebar;
