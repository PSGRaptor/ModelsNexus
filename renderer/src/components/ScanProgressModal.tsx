import React from 'react';

type ScanProgressModalProps = {
    current: number;
    total: number;
    file: string;
    status?: string;
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

const ScanProgressModal: React.FC<ScanProgressModalProps> = ({ current, total, file, status }) => {
    // Calculate progress percent (guard against division by zero)
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;

    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center transition-all">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 min-w-[340px] max-w-sm flex flex-col items-center relative">
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
              {status !== 'cancelled' && (
                  <button
                      className="bg-red-500 text-white px-4 py-1 rounded mt-4 hover:bg-red-700 transition"
                      onClick={() => window.electronAPI.cancelScan()}
                  >
                      Cancel
                  </button>
              )}
              {status === 'cancelled' && (
                  <div className="w-full text-center text-red-600 font-semibold mt-4">
                      Scan cancelled by user.
                  </div>
              )}
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
