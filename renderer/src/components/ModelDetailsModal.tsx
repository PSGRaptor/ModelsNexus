import React, { useEffect, useState } from 'react';

/**
 * ModelDetailsModal Component
 * Shows detailed info, images, prompts, tags, notes for selected model
 * Props:
 *   modelHash: string (unique hash for model)
 *   onClose: () => void
 */
const ModelDetailsModal: React.FC<{
    modelHash: string;
    onClose: () => void;
}> = ({ modelHash, onClose }) => {
    // Placeholder for demo—fetch model details and images by modelHash in real app
    const model = {
        file_name: 'anything-v4.5.safetensors',
        model_type: 'SD1',
        version: '4.5',
        base_model: 'Anything',
        file_path: 'F:/_AI-Models/anything-v4.5.safetensors',
        hash: modelHash,
        images: [
            // Up to 25 per model; placeholder
            { path: '/images/abc123/1.png', meta: '{}' },
            { path: '/images/abc123/2.png', meta: '{}' },
        ],
        tags: ['portrait', 'anime'],
        userNotes: 'Performs best with portrait prompts.',
        civitai_url: 'https://civitai.com/models/abc123',
        huggingface_url: '',
    };

    const [images, setImages] = useState<string[]>([]);

    useEffect(() => {
        (async () => {
            setImages(await window.electronAPI.getModelImages(modelHash));
        })();
    }, [modelHash]);

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
                <div className="flex gap-6">
                    <div className="w-1/3">
                        {/* Show up to 5 thumbnails; link to image folder */}
                        <div className="mb-3">
                            <div className="grid grid-cols-3 gap-2">
                                {model.images.slice(0, 5).map(img =>
                                    <img key={img.path} src={img.path} alt="Model preview" className="rounded shadow" />
                                )}
                            </div>
                            <div className="text-xs mt-2 text-muted">
                                {model.images.length} images stored
                            </div>
                        </div>
                        {/* Tags */}
                        <div className="mb-3">
                            <span className="font-semibold">Tags:</span>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {model.tags.map(tag =>
                                    <span key={tag} className="bg-primary/10 text-primary px-2 py-1 rounded">{tag}</span>
                                )}
                            </div>
                        </div>
                        {/* User Notes */}
                        <div className="mb-3">
                            <span className="font-semibold">Notes:</span>
                            <textarea className="w-full p-2 border rounded bg-muted mt-1" rows={3} defaultValue={model.userNotes}></textarea>
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
                            <div><strong>Hash:</strong> {model.hash}</div>
                        </div>
                        {/* External links */}
                        <div className="flex gap-4 mb-4">
                            <a href={model.civitai_url} target="_blank" rel="noopener" className="text-blue-600 underline">Civitai</a>
                            {model.huggingface_url &&
                                <a href={model.huggingface_url} target="_blank" rel="noopener" className="text-blue-600 underline">Hugging Face</a>
                            }
                        </div>
                        {/* Prompts & Keywords */}
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
