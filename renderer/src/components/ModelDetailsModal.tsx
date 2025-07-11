// renderer/src/components/ModelDetailsModal.tsx

import React, { useEffect, useState } from 'react';

type ModelDetailsModalProps = {
    modelHash: string;
    onClose: () => void;
};

const ModelDetailsModal: React.FC<ModelDetailsModalProps> = ({ modelHash, onClose }) => {
    // Main model info (replace placeholders with real DB fetch if desired)
    const [model, setModel] = useState<{
        file_name?: string;
        model_type?: string;
        version?: string;
        base_model?: string;
        file_path?: string;
        civitai_url?: string;
        huggingface_url?: string;
    }>({
        file_name: '',
        model_type: '',
        version: '',
        base_model: '',
        file_path: '',
        civitai_url: '',
        huggingface_url: '',
    });

    // User notes and tags
    const [userNote, setUserNote] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');
    // Images for this model
    const [images, setImages] = useState<string[]>([]);
    // API enrichment spinner
    const [apiEnriching, setApiEnriching] = useState(false);

    // Fetch model, notes, tags, images
    useEffect(() => {
        (async () => {
            // Optionally fetch full model from DB (for demo, use placeholder)
            setModel({
                file_name: 'anything-v4.5.safetensors',
                model_type: 'SD1',
                version: '4.5',
                base_model: 'Anything',
                file_path: 'F:/_AI-Models/anything-v4.5.safetensors',
                civitai_url: 'https://civitai.com/models/abc123',
                huggingface_url: '',
            });

            setUserNote(await window.electronAPI.getUserNote(modelHash));
            setTags((await window.electronAPI.getTags(modelHash)).map((t: any) => t.tag));
            setImages(await window.electronAPI.getModelImages(modelHash));
        })();
    }, [modelHash]);

    // Notes handlers
    const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => setUserNote(e.target.value);

    const saveNote = async () => {
        await window.electronAPI.setUserNote(modelHash, userNote);
    };

    // Tags handlers
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

    // API enrichment
    const handleEnrichFromAPI = async () => {
        setApiEnriching(true);
        await window.electronAPI.enrichModelFromAPI(modelHash);
        setImages(await window.electronAPI.getModelImages(modelHash)); // reload images after enrichment
        setApiEnriching(false);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-3xl p-8 max-h-[90vh] overflow-y-auto relative">
                <button
                    className="absolute top-4 right-6 text-2xl text-muted hover:text-primary"
                    onClick={onClose}
                >
                    &times;
                </button>
                <h2 className="text-2xl font-bold mb-4">{model.file_name}</h2>
                <button
                    onClick={handleEnrichFromAPI}
                    className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-700 mt-2 mb-4"
                    disabled={apiEnriching}
                >
                    {apiEnriching ? 'Fetching…' : 'Enrich from API'}
                </button>
                <div className="flex gap-6">
                    <div className="w-1/3">
                        {/* Show up to 5 thumbnails */}
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
                        {/* User Notes */}
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
                        {/* Metadata */}
                        <div className="mb-4">
                            <div><strong>Type:</strong> {model.model_type}</div>
                            <div><strong>Version:</strong> {model.version}</div>
                            <div><strong>Base:</strong> {model.base_model}</div>
                            <div className="text-xs text-muted mt-1 truncate">
                                <strong>Path:</strong> {model.file_path}
                            </div>
                            <div><strong>Hash:</strong> {modelHash}</div>
                        </div>
                        {/* External links */}
                        <div className="flex gap-4 mb-4">
                            {model.civitai_url &&
                                <a href={model.civitai_url} target="_blank" rel="noopener" className="text-blue-600 underline">Civitai</a>
                            }
                            {model.huggingface_url &&
                                <a href={model.huggingface_url} target="_blank" rel="noopener" className="text-blue-600 underline">Hugging Face</a>
                            }
                        </div>
                        {/* Prompts & Keywords (placeholder content) */}
                        <div className="mb-4">
                            <span className="font-semibold">Sample Prompts:</span>
                            <div className="mt-1 bg-muted rounded p-2 text-sm">
                                <span>Positive:</span> <span className="font-mono">masterpiece, portrait, <b>{model.base_model}</b>, high quality</span>
                                <br />
                                <span>Negative:</span> <span className="font-mono">lowres, bad anatomy, blurry</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ModelDetailsModal;
