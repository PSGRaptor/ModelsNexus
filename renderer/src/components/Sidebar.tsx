// renderer/src/components/Sidebar.tsx

import React, { useState } from 'react';
import SearchBar from './SearchBar';

type SidebarProps = {
    onOpenConfig: () => void;
    onSelectModel: (modelHash: string) => void;
    onUpdateScan: () => void;
    search: string;
    setSearch: (v: string) => void;
    onTypeFilter: (type: string) => void;
};

const modelTypes = ['SD1', 'SDXL', 'PONY', 'FLUX', 'HiDream', 'WAN', 'Safetensors', 'Lora', 'PT', 'GGUF'];

const Sidebar: React.FC<SidebarProps> = ({
                                             onOpenConfig,
                                             onSelectModel,
                                             onUpdateScan,
                                             search,
                                             setSearch,
                                             onTypeFilter
                                         }) => {
    const [selectedType, setSelectedType] = useState<string>('');

    const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedType(e.target.value);
        onTypeFilter(e.target.value);
    };

    return (
        <aside className="w-64 bg-muted border-r border-border flex flex-col py-4 px-2">
            {/* Search bar at the very top */}
            <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Search by name, type, or base..."
            />
            <h2 className="text-xl font-bold mb-4 mt-4">Filter by Type</h2>
            <select
                value={selectedType}
                onChange={handleTypeChange}
                className="w-full p-2 rounded border border-border bg-white dark:bg-zinc-900 text-xs mb-6"
            >
                <option value="">All Types</option>
                {modelTypes.map(type => (
                    <option key={type} value={type}>
                        {type}
                    </option>
                ))}
            </select>
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
