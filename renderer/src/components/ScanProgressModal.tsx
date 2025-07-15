import React from 'react';

type ScanProgressModalProps = {
    current: number;
    total: number;
    file: string;
    status?: string;
    onCancel: () => void; // <-- Add this to your parent and wire to setScanInProgress(false)
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
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center transition-all">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 min-w-[340px] max-w-sm flex flex-col items-center relative">
                {/* X button */}
                <button
                    className="absolute top-4 right-4 text-2xl text-muted hover:text-primary"
                    onClick={handleCancel}
                    aria-label="Cancel scan"
                    title="Cancel scan"
                >
                    &times;
                </button>
                <div className="w-full mb-4">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-primary">Model Scan Progress</span>
                        <span className="text-xs text-muted">{percent}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-zinc-800 rounded-full h-3">
                        <div
                            className="bg-primary h-3 rounded-full transition-all"
                            style={{ width: `${percent}%` }}
                        ></div>
                    </div>
                </div>
                <div className="w-full text-xs text-muted mb-2">
                    {current} of {total} models scanned
                </div>
                <div className="w-full mb-2">
                    <span className="text-sm text-primary font-semibold">
                        {getStatusMessage(status)}
                    </span>
                </div>
                <div className="w-full truncate text-xs font-mono bg-muted rounded px-2 py-1 mb-1">
                    {file}
                </div>
                <div className="w-full text-xs text-center text-gray-400 mt-2">
                    Please do not close the app while scanning models.
                </div>
            </div>
        </div>
    );
};

export default ScanProgressModal;
