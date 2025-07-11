import React, { useEffect, useState } from 'react';

/**
 * ConfigModal Component
 * Modal for user to configure:
 *  - Model scan paths (add/remove)
 *  - API keys for Civitai and Hugging Face
 *  - Theme (light/dark/auto)
 *  - Other settings (future)
 *
 * Props:
 *   onClose: () => void
 */
const ConfigModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [scanPaths, setScanPaths] = useState<string[]>([]);
    const [newPath, setNewPath] = useState('');
    const [civitaiKey, setCivitaiKey] = useState('');
    const [huggingfaceKey, setHuggingfaceKey] = useState('');

    useEffect(() => {
        (async () => {
            const paths = await window.electronAPI.getAllScanPaths();
            setScanPaths(paths.map((p: any) => p.path));
            setCivitaiKey(await window.electronAPI.getApiKey('civitai'));
            setHuggingfaceKey(await window.electronAPI.getApiKey('huggingface'));
        })();
    }, []);

    const handleAddPath = async () => {
        if (newPath && !scanPaths.includes(newPath)) {
            const paths = await window.electronAPI.addScanPath(newPath);
            setScanPaths(paths.map((p: any) => p.path));
            setNewPath('');
        }
    };

    const handleRemovePath = async (removePath: string) => {
        const paths = await window.electronAPI.removeScanPath(removePath);
        setScanPaths(paths.map((p: any) => p.path));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        await window.electronAPI.setApiKey('civitai', civitaiKey);
        await window.electronAPI.setApiKey('huggingface', huggingfaceKey);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg p-6">
                <h2 className="text-xl font-bold mb-4">Settings & Configuration</h2>
                <form>
                    {/* Folder scan paths */}
                    <div className="mb-4">
                        <label className="font-semibold">Model Folders</label>
                        <div className="flex gap-2 mt-2">
                            <input
                                type="text"
                                placeholder="Add folder path..."
                                className="flex-1 p-2 border rounded"
                                value={newPath}
                                onChange={e => setNewPath(e.target.value)}
                            />
                            <button
                                type="button"
                                className="bg-primary text-white px-3 py-1 rounded"
                                onClick={handleAddPath}
                            >
                                Add
                            </button>
                        </div>
                        <ul className="mt-2 text-sm">
                            {scanPaths.map(path => (
                                <li key={path} className="flex items-center gap-2">
                                    <span>{path}</span>
                                    <button
                                        type="button"
                                        className="text-red-400 hover:text-red-600"
                                        title="Remove"
                                        onClick={() => handleRemovePath(path)}
                                    >&times;</button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* API Keys */}
                    <div className="mb-4">
                        <label className="font-semibold">API Keys</label>
                        <div className="flex gap-2 mt-2">
                            <input
                                type="password"
                                placeholder="Civitai API Key"
                                className="flex-1 p-2 border rounded"
                                value={civitaiKey}
                                onChange={e => setCivitaiKey(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 mt-2">
                            <input
                                type="password"
                                placeholder="Hugging Face API Key"
                                className="flex-1 p-2 border rounded"
                                value={huggingfaceKey}
                                onChange={e => setHuggingfaceKey(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Theme selector */}
                    <div className="mb-4">
                        <label className="font-semibold">Theme</label>
                        <select className="p-2 rounded border ml-2">
                            <option value="auto">Auto</option>
                            <option value="dark">Dark</option>
                            <option value="light">Light</option>
                        </select>
                    </div>

                    {/* Save/close buttons */}
                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
                            className="px-4 py-2 bg-muted rounded hover:bg-zinc-200"
                            onClick={onClose}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
                        >
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ConfigModal;
