import React, { useState } from 'react';
import { FaStar, FaRegStar, FaExternalLinkAlt } from 'react-icons/fa';

type Model = {
    id: number;
    file_name: string;
    model_name?: string; // allow from enrich
    model_hash: string;
    file_path: string;
    model_type?: string;
    version?: string;
    base_model?: string;
    is_favorite?: number;
    preview_image_url?: string; // local or downloaded, can be file://
    images?: string[];          // local file paths or URLs
    tags?: string[];
    prompt_positive?: string;
    prompt_negative?: string;
    civitai_url?: string;
    huggingface_url?: string;
};

type ModelGridProps = {
    onSelectModel: (modelHash: string) => void;
    onToggleFavorite: (modelHash: string) => void;
    models: Model[];
};

// Local modal for large image previews
const ImageModal: React.FC<{ images: string[], index: number, onClose: () => void }> = ({ images, index, onClose }) => {
    const [current, setCurrent] = useState(index);
    if (!images.length) return null;
    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-70 flex flex-col items-center justify-center">
            <button
                className="absolute top-4 right-8 text-3xl text-white font-bold"
                onClick={onClose}
                title="Close"
            >&times;</button>
            <img
                src={images[current].startsWith('file://') ? images[current] : `file://${images[current]}`}
                alt="Full preview"
                className="rounded-lg shadow-xl max-h-[80vh] max-w-[90vw] mb-4 border-4 border-primary"
                draggable={false}
            />
            <div className="flex gap-2 mt-2">
                {images.map((img, idx) => (
                    <img
                        key={img}
                        src={img.startsWith('file://') ? img : `file://${img}`}
                        alt={`Thumb ${idx + 1}`}
                        className={`w-16 h-16 object-cover rounded cursor-pointer border ${current === idx ? 'border-primary' : 'border-gray-400'}`}
                        onClick={() => setCurrent(idx)}
                    />
                ))}
            </div>
        </div>
    );
};

const ModelGrid: React.FC<ModelGridProps> = ({ onSelectModel, onToggleFavorite, models }) => {
    const [modalImages, setModalImages] = useState<string[] | null>(null);
    const [modalImageIdx, setModalImageIdx] = useState(0);

    // --- Group models by extension
    const groups = {
        safetensors: models.filter(m => m.file_name.endsWith('.safetensors')),
        lora: models.filter(m => m.file_name.endsWith('.lora')),
        pt: models.filter(m => m.file_name.endsWith('.pt')),
        gguf: models.filter(m => m.file_name.endsWith('.gguf')),
        other: models.filter(m =>
            !m.file_name.endsWith('.safetensors') &&
            !m.file_name.endsWith('.lora') &&
            !m.file_name.endsWith('.pt') &&
            !m.file_name.endsWith('.gguf')
        )
    };

    const handleOpenImageModal = (images: string[], idx: number) => {
        setModalImages(images);
        setModalImageIdx(idx);
    };

    const handleCloseImageModal = () => {
        setModalImages(null);
    };

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">Model Library</h1>
            {Object.entries(groups).every(([_, arr]) => arr.length === 0) ? (
                <div className="col-span-full text-center text-muted text-lg py-24">
                    No models found. Click “Update Scan” or add model folders.
                </div>
            ) : (
                Object.entries(groups).map(([group, groupModels]) =>
                        groupModels.length > 0 && (
                            <div key={group} className="mb-8">
                                <h2 className="text-xl font-bold mb-3 capitalize">{group}</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                                    {groupModels.map(model => {
                                        const images = model.images && model.images.length ? model.images : (model.preview_image_url ? [model.preview_image_url] : []);
                                        const mainImage = images[0] || '/images/placeholder.png';
                                        return (
                                            <div
                                                key={model.model_hash}
                                                className="bg-card shadow-xl rounded-2xl p-5 flex flex-col relative items-center min-h-[420px] max-w-xs mx-auto hover:ring-2 ring-primary transition cursor-pointer group"
                                                onClick={() => onSelectModel(model.model_hash)}
                                            >
                                                {/* Favorite Star */}
                                                <button
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        onToggleFavorite(model.model_hash);
                                                    }}
                                                    className="absolute top-4 right-4 text-yellow-400 text-2xl z-10"
                                                    title={model.is_favorite ? "Unstar model" : "Star model"}
                                                >
                                                    {model.is_favorite ? <FaStar /> : <FaRegStar />}
                                                </button>

                                                {/* Model Name */}
                                                <div className="font-bold text-lg mb-1 truncate text-center w-full" title={model.model_name || model.file_name}>
                                                    {model.model_name || model.file_name}
                                                </div>
                                                {/* Model type, base, version */}
                                                <div className="flex items-center gap-2 text-xs mb-2 w-full justify-center">
                                                    <span className="bg-primary/10 text-primary px-2 py-1 rounded">{model.model_type || "N/A"}</span>
                                                    <span className="bg-muted px-2 py-1 rounded text-muted-foreground">{model.base_model || "-"}</span>
                                                    <span className="bg-muted px-2 py-1 rounded text-muted-foreground">v{model.version || "-"}</span>
                                                </div>

                                                {/* Preview Image */}
                                                <img
                                                    src={mainImage.startsWith('file://') ? mainImage : `file://${mainImage}`}
                                                    alt="Preview"
                                                    className="rounded-xl mb-2 object-cover w-full h-36 bg-zinc-200 dark:bg-zinc-800 hover:opacity-85 transition"
                                                    onClick={e => { e.stopPropagation(); handleOpenImageModal(images, 0); }}
                                                    loading="lazy"
                                                />

                                                {/* Thumbnail Gallery */}
                                                <div className="flex gap-1 mb-2 overflow-x-auto w-full justify-center">
                                                    {images.slice(0, 5).map((img, idx) =>
                                                        <img
                                                            key={img}
                                                            src={img.startsWith('file://') ? img : `file://${img}`}
                                                            alt={`Thumb ${idx + 1}`}
                                                            className="w-9 h-9 rounded shadow cursor-pointer hover:ring-2 ring-primary"
                                                            onClick={e => { e.stopPropagation(); handleOpenImageModal(images, idx); }}
                                                        />
                                                    )}
                                                    {images.length > 5 && (
                                                        <span className="text-xs text-zinc-500 dark:text-zinc-300 px-2">+{images.length - 5} more</span>
                                                    )}
                                                </div>

                                                {/* Tags/Trigger Words */}
                                                {model.tags && model.tags.length > 0 && (
                                                    <div className="mb-1 flex flex-wrap gap-1 justify-center">
                                                        {model.tags.slice(0, 6).map(tag =>
                                                            <span key={tag} className="bg-primary/10 text-primary px-2 py-0.5 rounded text-xs">{tag}</span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Prompts */}
                                                <div className="mt-1 text-xs w-full">
                                                    <div>
                                                        <span className="font-semibold text-muted-foreground">Positive:</span>{' '}
                                                        <span className="font-mono">{model.prompt_positive || "–"}</span>
                                                    </div>
                                                    <div>
                                                        <span className="font-semibold text-muted-foreground">Negative:</span>{' '}
                                                        <span className="font-mono">{model.prompt_negative || "–"}</span>
                                                    </div>
                                                </div>

                                                {/* Action Links */}
                                                <div className="flex items-center gap-2 mt-auto pt-3 w-full justify-between">
                                                    {model.civitai_url && (
                                                        <a href={model.civitai_url} target="_blank" rel="noopener" title="View on Civitai"
                                                           onClick={e => e.stopPropagation()} className="text-blue-600 hover:underline flex items-center gap-1 text-xs">
                                                            Civitai <FaExternalLinkAlt />
                                                        </a>
                                                    )}
                                                    {model.huggingface_url && (
                                                        <a href={model.huggingface_url} target="_blank" rel="noopener" title="View on Hugging Face"
                                                           onClick={e => e.stopPropagation()} className="text-blue-600 hover:underline flex items-center gap-1 text-xs">
                                                            HuggingFace <FaExternalLinkAlt />
                                                        </a>
                                                    )}
                                                    <span className="text-xs truncate ml-auto text-zinc-500 dark:text-zinc-300" title={model.file_path}>
                                                    {model.file_path && model.file_path.split(/[\\/]/).pop()}
                                                </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )
                )
            )}
            {/* Image modal */}
            {modalImages && (
                <ImageModal
                    images={modalImages}
                    index={modalImageIdx}
                    onClose={handleCloseImageModal}
                />
            )}
        </div>
    );
};

export default ModelGrid;
