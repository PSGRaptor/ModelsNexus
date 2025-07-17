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

const modelTypes = [
    'SD1', 'SDXL', 'PONY', 'FLUX', 'HiDream', 'WAN',
    'Safetensors', 'Lora', 'PT', 'GGUF'
];

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
        <aside className="
            w-64 min-w-[220px] flex flex-col py-5 px-3
            bg-zinc-100 dark:bg-zinc-900
            border-r border-zinc-300 dark:border-zinc-700
            shadow-sm
            transition-colors duration-300
        ">
            <div className="mb-6">
                <SearchBar
                    value={search}
                    onChange={setSearch}
                    placeholder="Search by name, type, or base..."
                    inputClassName="w-full p-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
            </div>

            <h2 className="text-lg font-semibold mb-3 text-zinc-800 dark:text-zinc-100 tracking-tight">
                Filter by Type
            </h2>

            <select
                value={selectedType}
                onChange={handleTypeChange}
                className="
                    w-full p-2 mb-6 rounded-lg border
                    border-zinc-300 dark:border-zinc-600
                    bg-white dark:bg-zinc-800
                    text-sm text-zinc-900 dark:text-zinc-100
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                    transition
                "
            >
                <option value="">All Types</option>
                {modelTypes.map(type => (
                    <option key={type} value={type}>
                        {type}
                    </option>
                ))}
            </select>

            <button
                className="
                    mb-2 p-2 rounded-lg font-semibold
                    bg-blue-600 hover:bg-blue-700
                    text-white shadow focus:ring-2 focus:ring-blue-400
                    transition
                    border border-blue-700
                "
                onClick={onUpdateScan}
            >
                Update Scan
            </button>

            <button
                className="
                    p-2 rounded-lg mt-auto font-semibold border
                    bg-zinc-200 dark:bg-zinc-800
                    text-blue-700 dark:text-zinc-100
                    border-blue-700 dark:border-zinc-600
                    hover:bg-blue-100 dark:hover:bg-blue-900
                    hover:text-blue-900 dark:hover:text-white
                    focus:ring-2 focus:ring-blue-400
                    transition
                "
                onClick={onOpenConfig}
            >
                Settings
            </button>
        </aside>
    );
};

export default Sidebar;
