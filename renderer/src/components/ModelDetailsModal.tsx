import React, { useEffect, useState } from 'react';

type ModelDetailsModalProps = {
    modelHash: string;
    onClose: () => void;
};

const ModelDetailsModal: React.FC<ModelDetailsModalProps> = ({ modelHash, onClose }) => {
    // Placeholder - you should fetch real model data by hash
    const [images, setImages] = useState<string[]>([]);
    const [apiEnriching, setApiEnriching] = useState(false);

    // Notes and tags state
    const [userNote, setUserNote] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');

    useEffect(() => {
        (async () => {
            setImages(await window.electronAPI.getModelImages(modelHash));
            setUserNote(await window.electronAPI.getUserNote(modelHash));
            setTags((await window.electronAPI.getTags(modelHash)).map((t: any) => t.tag));
        })();
    }, [modelHash]);

    const handleEnrichFromAPI = async () => {
        setApiEnriching(true);
        await window.electronAPI.enrichModelFromAPI(modelHash);
        setImages(await window.electronAPI.getModelImages(modelHash));
        setApiEnriching(false);
    };

    // Tag and note handlers
    const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => setUserNote(e.target.value);
    const saveNote = async () => await window.electronAPI.setUserNote(modelHash, userNote);

    const addTag = async () => {
        if (newTag && !tags.includes(newTag)) {
            await window.electronAPI.addTag(modelHash, newTag);
            setTags([...tags, newTag]);
            setNewTag('');
        }
    };
    const removeTag = async (tag: string) => {
        await window.electronAPI.removeTag(modelHash, tag);
        setTags(tags.filter(t => t !== tag));
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-3xl p-8 max-h-[90vh] overflow-y-auto relative">
                <button
                    className="absolute top-4 right-6 text-2xl text-muted hover:text-primary"
                    onClick={onClose}
                >&times;</button>
                <h2 className="text-2xl font-bold mb-4">Model Details</h2>
                <button
                    onClick={handleEnrichFromAPI}
                    className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-700 mt-2 mb-4"
                    disabled={apiEnriching}
                >
                    {apiEnriching ? 'Fetching…' : 'Enrich from API'}
                </button>
                <div className="flex gap-6">
                    <div className="w-1/3">
                        {/* Images */}
                        <div className="mb-3">
                            <div className="grid grid-cols-3 gap-2">
                                {images.slice(0, 5).map(img =>
                                    <img
                                        key={img}
                                        src={`file://${img}`}
                                        alt="Model preview"
                                        className="rounded shadow"
                                        draggable={false}
                                    />
                                )}
                            </div>
                            <div className="text-xs mt-2 text-muted">
                                {images.length} images stored
                            </div>
                        </div>
                        {/* Tags */}
                        <div className="mb-3">
                            <span className="font-semibold">Tags:</span>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {tags.map(tag =>
                                    <span key={tag} className="bg-primary/10 text-primary px-2 py-1 rounded flex items-center gap-1">
                                        {tag}
                                        <button className="text-red-400 ml-1" onClick={() => removeTag(tag)} title="Remove tag">&times;</button>
                                    </span>
                                )}
                                <input
                                    type="text"
                                    value={newTag}
                                    onChange={e => setNewTag(e.target.value)}
                                    placeholder="Add tag"
                                    className="border rounded px-2 py-1 w-20"
                                    onKeyDown={e => e.key === 'Enter' && addTag()}
                                />
                                <button
                                    className="bg-primary text-white rounded px-2 py-1 ml-1"
                                    onClick={addTag}
                                >+</button>
                            </div>
                        </div>
                        {/* Notes */}
                        <div className="mb-3">
                            <span className="font-semibold">Notes:</span>
                            <textarea
                                className="w-full p-2 border rounded bg-muted mt-1"
                                rows={3}
                                value={userNote}
                                onChange={handleNoteChange}
                                onBlur={saveNote}
                            />
                        </div>
                    </div>
                    <div className="flex-1">
                        {/* Placeholder for additional model data */}
                        <div className="mb-4">
                            <div><strong>Hash:</strong> {modelHash}</div>
                            <div className="text-xs text-muted mt-1 truncate">
                                <strong>More metadata can go here…</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ModelDetailsModal;
