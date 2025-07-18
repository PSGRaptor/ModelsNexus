import React from 'react';

type ScanProgressModalProps = {
    current: number;
    total: number;
    file: string;
    status?: string;
    onCancel: () => void;
};

const getStatusMessage = (status?: string) => {
    switch (status) {
        case 'hash-failed': return 'Hashing failed (skipping)';
        case 'enriching': return 'Fetching model info from API…';
        case 'enriched': return 'Model info downloaded';
        case 'scanned': return 'Scanning model…';
        default: return 'Scanning…';
    }
};

const ScanProgressModal: React.FC<ScanProgressModalProps> = ({
                                                                 current,
                                                                 total,
                                                                 file,
                                                                 status,
                                                                 onCancel
                                                             }) => {
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;

    // Call cancelScan in Electron and also close modal via onCancel
    const handleCancel = () => {
        if (window.electronAPI && window.electronAPI.cancelScan) {
            window.electronAPI.cancelScan();
        }
        onCancel();
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center transition-all">
            <div className="
                bg-white dark:bg-zinc-900
                rounded-2xl shadow-xl p-8 min-w-[340px] max-w-sm flex flex-col items-center relative
                border border-zinc-200 dark:border-zinc-700
                transition-colors
            ">
                {/* X button */}
                <button
                    className="
                        absolute top-4 right-4 text-2xl
                        text-zinc-400 hover:text-red-500 dark:hover:text-red-400
                        transition
                    "
                    onClick={handleCancel}
                    aria-label="Cancel scan"
                    title="Cancel scan"
                >
                    &times;
                </button>
                <div className="w-full mb-4">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                            Model Scan Progress
                        </span>
                        <span className="text-xs text-zinc-400 dark:text-zinc-300">{percent}%</span>
                    </div>
                    <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-3">
                        <div
                            className="bg-blue-600 dark:bg-blue-400 h-3 rounded-full transition-all"
                            style={{ width: `${percent}%` }}
                        ></div>
                    </div>
                </div>
                <div className="w-full text-xs text-zinc-500 dark:text-zinc-300 mb-2">
                    {current} of {total} models scanned
                </div>
                <div className="w-full mb-2">
                    <span className="text-sm text-blue-700 dark:text-blue-300 font-semibold">
                        {getStatusMessage(status)}
                    </span>
                </div>
                <div className="w-full truncate text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded px-2 py-1 mb-1 border border-zinc-200 dark:border-zinc-700">
                    {file}
                </div>
                <div className="w-full text-xs text-center text-zinc-400 dark:text-zinc-400 mt-2">
                    Please do not close the app while scanning models.
                </div>
                <button
                    className="
                        mt-6 px-4 py-2 rounded bg-red-500 text-white font-semibold
                        hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300
                        transition
                    "
                    onClick={handleCancel}
                >
                    Cancel Scan
                </button>
            </div>
        </div>
    );
};

export default ScanProgressModal;
