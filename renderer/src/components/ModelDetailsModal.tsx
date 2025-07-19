// File: root/renderer/src/components/ModelDetailsModal.tsx

import React, { useEffect, useState, ChangeEvent } from 'react';
import { FaExternalLinkAlt, FaChevronLeft, FaChevronRight, FaEdit, FaSave, FaTimes, FaPlus, FaTrash } from 'react-icons/fa';

const MODEL_TYPES = [
    'SD1', 'SDXL', 'PONY', 'FLUX', 'HiDream', 'WAN', 'Safetensors', 'Lora', 'PT', 'GGUF'
];

const OnlineModal: React.FC<{ url: string; onClose: () => void }> = ({ url, onClose }) => (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center">
        <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-[96vw] h-[82vh] overflow-hidden">
            <button
                className="absolute top-3 right-5 text-3xl text-gray-400 dark:text-gray-200 font-bold z-20 hover:text-primary transition"
                onClick={onClose}
                title="Close"
            >&times;</button>
            <iframe
                src={url}
                className="w-full h-full border-0"
                style={{ borderRadius: "1rem" }}
                sandbox="allow-scripts allow-same-origin allow-popups"
                title="External Model Page"
            />
        </div>
    </div>
);

const ImageModal: React.FC<{ images: string[], index: number, onClose: () => void }> = ({ images, index, onClose }) => {
    const [current, setCurrent] = useState(index);
    if (!images.length) return null;

    const goLeft = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrent(c => c > 0 ? c - 1 : images.length - 1);
    };
    const goRight = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrent(c => c < images.length - 1 ? c + 1 : 0);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center" onClick={onClose}>
            <button
                className="absolute top-4 right-8 text-3xl text-gray-100 font-bold z-20 hover:text-primary transition"
                onClick={onClose}
                title="Close"
            >&times;</button>
            <button className="absolute left-8 text-4xl text-gray-200 hover:text-primary z-20" onClick={goLeft} title="Previous image">
                <FaChevronLeft />
            </button>
            <img
                src={images[current].startsWith('file://') ? images[current] : `file://${images[current]}`}
                alt="Full preview"
                className="rounded-lg shadow-xl max-h-[80vh] max-w-[92vw] border-4 border-primary bg-white dark:bg-zinc-900"
                draggable={false}
            />
            <button className="absolute right-8 text-4xl text-gray-200 hover:text-primary z-20" onClick={goRight} title="Next image">
                <FaChevronRight />
            </button>
        </div>
    );
};

function extractCivitaiModelId(model: any): string | undefined {
    if (model?.civitai_model_id) return model.civitai_model_id.toString();
    if (model?.civitai_url) {
        const match = model.civitai_url.match(/\/models\/(\d+)/);
        if (match) return match[1];
    }
    if (model?.meta && model.meta.civitai_model_id) return model.meta.civitai_model_id.toString();
    return undefined;
}

const ModelDetailsModal: React.FC<{
    modelHash: string;
    onClose: () => void;
}> = ({ modelHash, onClose }) => {
    const [images, setImages] = useState<string[]>([]);
    const [apiEnriching, setApiEnriching] = useState(false);
    const [userNote, setUserNote] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');
    const [model, setModel] = useState<any>(null);

    const [modalImageIdx, setModalImageIdx] = useState<number | null>(null);
    const [showOnlineModal, setShowOnlineModal] = useState<string | null>(null);
    const [notesExpanded, setNotesExpanded] = useState(false);

    // Editing states
    const [isEditing, setIsEditing] = useState(false);
    const [editFields, setEditFields] = useState<any>({});
    const [editTags, setEditTags] = useState<string[]>([]);
    const [editNote, setEditNote] = useState('');
    const [editImages, setEditImages] = useState<string[]>([]);
    const [addedFiles, setAddedFiles] = useState<File[]>([]);

    useEffect(() => {
        (async () => {
            const imgs = (await window.electronAPI.getModelImages(modelHash)).filter(Boolean);
            setImages(imgs);
            setUserNote(await window.electronAPI.getUserNote(modelHash));
            const allTags = (await window.electronAPI.getTags(modelHash)).map((t: any) => t.tag);
            setTags(allTags);
            if (window.electronAPI?.getModelByHash) {
                setModel(await window.electronAPI.getModelByHash(modelHash));
            }
        })();
        setIsEditing(false);
    }, [modelHash]);

    const handleEnrichFromAPI = async () => {
        setApiEnriching(true);
        await window.electronAPI.enrichModelFromAPI(modelHash);
        setImages((await window.electronAPI.getModelImages(modelHash)).filter(Boolean));
        setApiEnriching(false);
        if (window.electronAPI?.getModelByHash) {
            setModel(await window.electronAPI.getModelByHash(modelHash));
        }
    };

    // Start editing
    const handleStartEdit = () => {
        setEditFields({
            model_name: model?.model_name || model?.file_name || "",
            model_type: model?.model_type || "",
            base_model: model?.base_model || "",
            version: model?.version || "",
            prompt_positive: model?.prompt_positive || "",
            prompt_negative: model?.prompt_negative || "",
        });
        setEditTags([...tags]);
        setEditNote(userNote);
        setEditImages([...images]);
        setAddedFiles([]);
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditFields({});
        setAddedFiles([]);
    };

    const handleSaveEdit = async () => {
        // 1. Add new images to db if any (skip if not used in your DB)
        for (const file of addedFiles) {
            await window.electronAPI.saveModelImage(modelHash, file.name);
        }

        // 2. Compute tags to add/remove (compare tags and editTags)
        const oldSet = new Set(tags);
        const newSet = new Set(editTags);
        const tagsToAdd = editTags.filter(tag => !oldSet.has(tag));
        const tagsToRemove = tags.filter(tag => !newSet.has(tag));

        // 3. Prepare updated model object
        const updatedModel = {
            ...model,
            ...editFields,
            tags: editTags,
            notes: editNote,
            model_hash: modelHash,
            model_name: editFields.model_name || model?.model_name || model?.file_name || ""
        };

        // 4. Call updateModel with correct structure
        await window.electronAPI.updateModel({
            model: updatedModel,
            tagsToAdd,
            tagsToRemove,
            userNote: editNote
        });

        setIsEditing(false);

        // Reload state
        setImages((await window.electronAPI.getModelImages(modelHash)).filter(Boolean));
        setUserNote(await window.electronAPI.getUserNote(modelHash));
        setTags((await window.electronAPI.getTags(modelHash)).map((t: any) => t.tag));
        if (window.electronAPI?.getModelByHash) {
            setModel(await window.electronAPI.getModelByHash(modelHash));
        }
    };


    const renderHtml = (html: string) => <div className="prose max-w-full" dangerouslySetInnerHTML={{ __html: html }} />;

    const showModelName = model?.model_name || model?.file_name || modelHash;
    const civitaiModelId = extractCivitaiModelId(model);
    const type = model?.model_type || "–";
    const base = model?.base_model || "–";
    const version = model?.version || "–";
    const civitaiUrl = civitaiModelId ? `https://civitai.com/models/${civitaiModelId}` : model?.civitai_url;

    const handleAddTag = () => {
        if (newTag && !editTags.includes(newTag)) {
            setEditTags([...editTags, newTag]);
            setNewTag('');
        }
    };
    const handleRemoveTag = (tag: string) => setEditTags(editTags.filter(t => t !== tag));

    const handleImageDelete = (img: string) => setEditImages(editImages.filter(i => i !== img));
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setAddedFiles([...addedFiles, ...Array.from(e.target.files)]);
            setEditImages([...editImages, ...Array.from(e.target.files).map(f => URL.createObjectURL(f))]);
        }
    };

    const handleFieldChange = (field: string, value: string) =>
        setEditFields({ ...editFields, [field]: value });

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-5xl min-w-[800px] p-8 max-h-[94vh] overflow-y-auto relative">
                {/* Close button */}
                <button
                    className="absolute top-4 right-6 text-2xl text-gray-400 dark:text-gray-200 hover:text-primary"
                    onClick={onClose}
                >&times;</button>
                {/* Header & edit model_name */}
                <div className="flex flex-wrap justify-between items-end mb-2">
                    <div>
                        {isEditing ? (
                            <input
                                className="text-2xl font-bold bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 border border-zinc-300 dark:border-zinc-700 rounded w-full mb-1 px-2 py-1 transition-colors"
                                value={editFields.model_name}
                                onChange={e => handleFieldChange('model_name', e.target.value)}
                                placeholder="Enter Model Name"
                            />
                        ) : (
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">{showModelName}</h2>
                        )}
                        {civitaiModelId && (
                            <span className="text-xs text-primary font-bold bg-primary/10 dark:bg-blue-900 dark:text-blue-200 rounded px-2 py-1 ml-1">Civitai ID: {civitaiModelId}</span>
                        )}
                    </div>
                    <div className="flex gap-2 items-center mb-1">
                        {!isEditing && (
                            <button className="flex items-center gap-1 px-4 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 font-semibold shadow"
                                    onClick={handleStartEdit}><FaEdit /> Edit</button>
                        )}
                        {isEditing && (
                            <>
                                <button className="flex items-center gap-1 px-4 py-1 rounded bg-green-600 text-white hover:bg-green-700 font-semibold shadow"
                                        onClick={handleSaveEdit}><FaSave /> Save</button>
                                <button className="flex items-center gap-1 px-4 py-1 rounded bg-zinc-300 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-400 dark:hover:bg-zinc-600 font-semibold shadow"
                                        onClick={handleCancelEdit}><FaTimes /> Cancel</button>
                            </>
                        )}
                    </div>
                </div>
                <button
                    onClick={handleEnrichFromAPI}
                    className="px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-700 mt-1 mb-4"
                    disabled={apiEnriching}
                >
                    {apiEnriching ? 'Fetching…' : 'Enrich from API'}
                </button>
                <div className="flex gap-8 mb-6 flex-wrap">
                    <div className="w-1/3 min-w-[180px]">
                        {/* Images */}
                        <div className="mb-3">
                            <div className="grid grid-cols-3 gap-2">
                                {(isEditing ? editImages : images).slice(0, 6).map((img, idx) =>
                                        !!img && (
                                            <div key={img} className="relative group">
                                                <img
                                                    src={img.startsWith('file://') ? img : `file://${img}`}
                                                    alt="Model preview"
                                                    className="rounded shadow cursor-pointer bg-zinc-100 dark:bg-zinc-800 transition-colors"
                                                    draggable={false}
                                                    onClick={() => setModalImageIdx(idx)}
                                                />
                                                {isEditing && (
                                                    <button
                                                        className="absolute top-0 right-0 bg-red-600 text-white rounded-full px-1 py-0 text-xs opacity-80 hover:opacity-100"
                                                        onClick={() => handleImageDelete(img)}
                                                        type="button"
                                                    ><FaTrash /></button>
                                                )}
                                            </div>
                                        )
                                )}
                            </div>
                            {isEditing && (
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="block w-full mt-2 text-sm bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100"
                                />
                            )}
                            <div className="text-xs mt-2 text-gray-400 dark:text-gray-200">
                                {(isEditing ? editImages : images).length} images stored
                            </div>
                        </div>
                        {/* Tags */}
                        <div className="mb-3">
                            <span className="font-semibold text-gray-800 dark:text-gray-100">Tags:</span>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {(isEditing ? editTags : tags).map(tag =>
                                    <span key={tag} className="bg-primary/10 dark:bg-blue-900 text-primary dark:text-blue-200 px-2 py-1 rounded flex items-center gap-1 transition-colors">
                                        {tag}
                                        {isEditing && (
                                            <button className="text-red-400 dark:text-red-300 ml-1" onClick={() => handleRemoveTag(tag)} title="Remove tag">&times;</button>
                                        )}
                                    </span>
                                )}
                                {isEditing && (
                                    <>
                                        <input
                                            type="text"
                                            value={newTag}
                                            onChange={e => setNewTag(e.target.value)}
                                            placeholder="Add tag"
                                            className="border rounded px-2 py-1 w-20 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                                            onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                                        />
                                        <button
                                            className="bg-primary text-white rounded px-2 py-1 ml-1"
                                            onClick={handleAddTag}
                                            type="button"
                                        ><FaPlus size={12} /></button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Prompts, File info, Links */}
                    <div className="flex-1 min-w-[240px]">
                        <div className="mb-2 text-sm text-gray-700 dark:text-gray-100">
                            <div><strong>Hash:</strong> <span className="font-mono">{modelHash}</span></div>
                            <div className="text-xs text-muted mt-1 truncate"><strong>Path:</strong> {model?.file_path}</div>
                        </div>
                        {/* Online link buttons */}
                        <div className="flex gap-4 mb-4 mt-2">
                            {civitaiUrl && (
                                <button
                                    onClick={() => setShowOnlineModal(civitaiUrl)}
                                    className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition text-xs"
                                >View on Civitai <FaExternalLinkAlt /></button>
                            )}
                            {model?.huggingface_url && (
                                <button
                                    onClick={() => setShowOnlineModal(model.huggingface_url)}
                                    className="flex items-center gap-1 bg-violet-600 text-white px-3 py-1 rounded hover:bg-violet-700 transition text-xs"
                                >View Hugging Face <FaExternalLinkAlt /></button>
                            )}
                        </div>
                        <div className="my-3">
                            <div>
                                <span className="font-semibold text-muted-foreground dark:text-zinc-200">Positive Prompt:</span>{' '}
                                {isEditing ? (
                                    <textarea
                                        className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors"
                                        value={editFields.prompt_positive}
                                        onChange={e => handleFieldChange('prompt_positive', e.target.value)}
                                        placeholder="Enter Positive Prompt"
                                    />
                                ) : (
                                    <span className="font-mono">{model?.prompt_positive || "–"}</span>
                                )}
                            </div>
                            <div>
                                <span className="font-semibold text-muted-foreground dark:text-zinc-200">Negative Prompt:</span>{' '}
                                {isEditing ? (
                                    <textarea
                                        className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors"
                                        value={editFields.prompt_negative}
                                        onChange={e => handleFieldChange('prompt_negative', e.target.value)}
                                        placeholder="Enter Negative Prompt"
                                    />
                                ) : (
                                    <span className="font-mono">{model?.prompt_negative || "–"}</span>
                                )}
                            </div>
                            <div className="mt-2 flex flex-col gap-2">
                                <label className="font-semibold text-muted-foreground dark:text-zinc-200">Model Type:</label>
                                {isEditing ? (
                                    <select
                                        className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors"
                                        value={editFields.model_type}
                                        onChange={e => handleFieldChange('model_type', e.target.value)}
                                    >
                                        <option value="">–</option>
                                        {MODEL_TYPES.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <span className="bg-primary/10 dark:bg-blue-900 text-primary dark:text-blue-200 px-2 py-1 rounded">{type}</span>
                                )}
                            </div>
                            <div className="mt-2 flex flex-col gap-2">
                                <label className="font-semibold text-muted-foreground dark:text-zinc-200">Base Model:</label>
                                {isEditing ? (
                                    <input
                                        className="w-full p-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors"
                                        value={editFields.base_model}
                                        onChange={e => handleFieldChange('base_model', e.target.value)}
                                        placeholder="Enter Base Model"
                                    />
                                ) : (
                                    <span className="bg-muted px-2 py-1 rounded text-muted-foreground dark:bg-zinc-800 dark:text-zinc-200">{base}</span>
                                )}
                            </div>
                            <div className="mt-2 flex flex-col gap-2">
                                <label className="font-semibold text-muted-foreground dark:text-zinc-200">Version:</label>
                                {isEditing ? (
                                    <input
                                        className="w-full p-2 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 transition-colors"
                                        value={editFields.version}
                                        onChange={e => handleFieldChange('version', e.target.value)}
                                        placeholder="Enter Version"
                                    />
                                ) : (
                                    <span className="bg-muted px-2 py-1 rounded text-muted-foreground dark:bg-zinc-800 dark:text-zinc-200">{version}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                {/* Notes: full width below */}
                <div className={`mb-2 transition-all ${notesExpanded ? 'max-h-[400px]' : 'max-h-[120px]'}`}>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-800 dark:text-gray-100">Notes:</span>
                        <button
                            className="text-xs text-blue-600 underline"
                            onClick={() => setNotesExpanded(e => !e)}
                        >{notesExpanded ? "Collapse" : "Expand"}</button>
                    </div>
                    <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-muted dark:bg-zinc-800 px-2 py-1 max-w-full overflow-y-auto transition-colors">
                        {isEditing ? (
                            <textarea
                                className="w-full p-2 border-none bg-zinc-800 text-zinc-900 dark:text-zinc-100 "
                                rows={notesExpanded ? 8 : 3}
                                value={editNote}
                                onChange={e => setEditNote(e.target.value)}
                                placeholder="Enter Notes"
                            />
                        ) : userNote && userNote.trim().startsWith('<') ? renderHtml(userNote) : (
                            <textarea
                                className="w-full p-2 border-none bg-transparent text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 "
                                rows={notesExpanded ? 8 : 3}
                                value={userNote}
                                readOnly
                                disabled
                                tabIndex={-1}
                            />
                        )}
                    </div>
                </div>
                {/* Image modal */}
                {modalImageIdx !== null && (
                    <ImageModal
                        images={isEditing ? editImages : images}
                        index={modalImageIdx}
                        onClose={() => setModalImageIdx(null)}
                    />
                )}
                {/* Online (link) modal */}
                {showOnlineModal && (
                    <OnlineModal url={showOnlineModal} onClose={() => setShowOnlineModal(null)} />
                )}
            </div>
        </div>
    );
};

export default ModelDetailsModal;
