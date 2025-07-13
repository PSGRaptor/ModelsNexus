import React, { useEffect, useState } from 'react';

type ConfigModalProps = {
    onClose: () => void;
};

const ConfigModal: React.FC<ConfigModalProps> = ({ onClose }) => {
    const [scanPaths, setScanPaths] = useState<string[]>([]);
    const [newPath, setNewPath] = useState('');
    const [civitaiKey, setCivitaiKey] = useState('');
    const [huggingfaceKey, setHuggingfaceKey] = useState('');
    const [savingKeys, setSavingKeys] = useState(false);

    // Fetch initial config values
    useEffect(() => {
        (async () => {
            if (window.electronAPI) {
                const allPaths = await window.electronAPI.getAllScanPaths();
                setScanPaths(allPaths.map((p: any) => p.path));
                setCivitaiKey(await window.electronAPI.getApiKey('civitai'));
                setHuggingfaceKey(await window.electronAPI.getApiKey('huggingface'));
            }
        })();
    }, []);

    // Add a new scan path (drive letter, UNC, or folder)
    const handleAddPath = async () => {
        const folder = await window.electronAPI.selectFolder();
        if (!folder) return;
        if (!scanPaths.includes(folder)) {
            const paths = await window.electronAPI.addScanPath(folder);
            setScanPaths(paths.map((p: any) => p.path));
        }
    };

    // Remove/disable a scan path
    const handleRemovePath = async (path: string) => {
        await window.electronAPI.removeScanPath(path);
        const allPaths = await window.electronAPI.getAllScanPaths();
        setScanPaths(allPaths.map((p: any) => p.path));
    };

    // Save API keys
    const handleSaveKeys = async () => {
        setSavingKeys(true);
        await window.electronAPI.setApiKey('civitai', civitaiKey);
        await window.electronAPI.setApiKey('huggingface', huggingfaceKey);
        setSavingKeys(false);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-xl p-8 max-h-[90vh] overflow-y-auto relative">
                <button
                    className="absolute top-4 right-6 text-2xl text-muted hover:text-primary"
                    onClick={onClose}
                    title="Close"
                >&times;</button>
                <h2 className="text-2xl font-bold mb-4">Settings</h2>
                {/* Scan paths */}
                <div className="mb-6">
                    <div className="font-semibold mb-2">Model Scan Folders</div>
                    <ul className="mb-2">
                        {scanPaths.length === 0 && (
                            <li className="text-muted">No folders configured yet.</li>
                        )}
                        {scanPaths.map(path =>
                            <li key={path} className="flex items-center justify-between group">
                                <span>{path}</span>
                                <button
                                    className="text-red-400 hover:text-red-600 text-xl font-bold ml-2 opacity-0 group-hover:opacity-100 transition"
                                    onClick={() => handleRemovePath(path)}
                                    title="Remove"
                                >&times;</button>
                            </li>
                        )}
                    </ul>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            className="flex-1 p-2 rounded border border-border bg-muted"
                            placeholder="Add new folder or \\network\share"
                            value={newPath}
                            onChange={e => setNewPath(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddPath()}
                            spellCheck={false}
                            autoCorrect="off"
                            autoCapitalize="none"
                        />
                        <button
                            type="button"
                            className="bg-primary text-white px-3 py-1 rounded"
                            onClick={handleAddPath}
                        >
                            Add
                        </button>
                    </div>
                </div>
                {/* API keys */}
                <div className="mb-6">
                    <div className="font-semibold mb-2">API Keys</div>
                    <label className="block mb-2">
                        <span className="text-sm text-muted">Civitai</span>
                        <input
                            type="text"
                            className="mt-1 p-2 rounded border border-border bg-muted w-full"
                            value={civitaiKey}
                            onChange={e => setCivitaiKey(e.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </label>
                    <label className="block mb-2">
                        <span className="text-sm text-muted">Hugging Face</span>
                        <input
                            type="text"
                            className="mt-1 p-2 rounded border border-border bg-muted w-full"
                            value={huggingfaceKey}
                            onChange={e => setHuggingfaceKey(e.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </label>
                    <button
                        className={`bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark ${savingKeys ? 'opacity-60 pointer-events-none' : ''}`}
                        onClick={handleSaveKeys}
                        disabled={savingKeys}
                    >
                        {savingKeys ? 'Saving...' : 'Save API Keys'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfigModal;
