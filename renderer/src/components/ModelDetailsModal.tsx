// File: root/renderer/src/components/ModelDetailsModal.tsx

import React, { useEffect, useState } from 'react';
import { FaExternalLinkAlt, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

const OnlineModal: React.FC<{ url: string; onClose: () => void }> = ({ url, onClose }) => (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-80 flex items-center justify-center">
        <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-[96vw] h-[82vh] overflow-hidden">
            <button
                className="absolute top-3 right-5 text-3xl text-zinc-700 dark:text-zinc-100 font-bold z-20 hover:text-blue-500 transition"
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
                className="absolute top-4 right-8 text-3xl text-zinc-300 dark:text-zinc-200 font-bold z-20 hover:text-blue-400 transition"
                onClick={onClose}
                title="Close"
            >&times;</button>
            <button className="absolute left-8 text-4xl text-zinc-300 hover:text-blue-500 z-20" onClick={goLeft} title="Previous image">
                <FaChevronLeft />
            </button>
            <img
                src={images[current].startsWith('file://') ? images[current] : `file://${images[current]}`}
                alt="Full preview"
                className="rounded-lg shadow-xl max-h-[80vh] max-w-[92vw] border-4 border-blue-400 dark:border-blue-600 bg-white dark:bg-zinc-800"
                draggable={false}
            />
            <button className="absolute right-8 text-4xl text-zinc-300 hover:text-blue-500 z-20" onClick={goRight} title="Next image">
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

    useEffect(() => {
        (async () => {
            setImages((await window.electronAPI.getModelImages(modelHash)).filter(Boolean));
            setUserNote(await window.electronAPI.getUserNote(modelHash));
            setTags((await window.electronAPI.getTags(modelHash)).map((t: any) => t.tag));
            if (window.electronAPI?.getModelByHash) {
                setModel(await window.electronAPI.getModelByHash(modelHash));
            }
        })();
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

    const renderHtml = (html: string) => <div className="prose max-w-full" dangerouslySetInnerHTML={{ __html: html }} />;

    const showModelName = model?.model_name || model?.file_name || modelHash;
    const civitaiModelId = extractCivitaiModelId(model);
    const type = model?.model_type || "–";
    const base = model?.base_model || "–";
    const version = model?.version || "–";

    const civitaiUrl = civitaiModelId ? `https://civitai.com/models/${civitaiModelId}` : model?.civitai_url;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-5xl min-w-[340px] p-8 max-h-[94vh] overflow-y-auto relative transition-colors">
                {/* Close button */}
                <button
                    className="absolute top-4 right-6 text-2xl text-zinc-400 dark:text-zinc-200 hover:text-blue-600 dark:hover:text-blue-400"
                    onClick={onClose}
                >&times;</button>
                {/* Header */}
                <div className="flex flex-wrap justify-between items-end mb-2">
                    <div>
                        <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-200 mb-1">{showModelName}</h2>
                        {civitaiModelId && (
                            <span className="text-xs text-blue-600 dark:text-blue-300 font-bold bg-blue-100 dark:bg-blue-900 rounded px-2 py-1 ml-1">
                                Civitai ID: {civitaiModelId}
                            </span>
                        )}
                    </div>
                    <div className="flex gap-4 items-center mb-1">
                        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-200">Type:</span>
                        <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">{type}</span>
                        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-200">Base:</span>
                        <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-300 px-2 py-1 rounded">{base}</span>
                        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-200">Version:</span>
                        <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-300 px-2 py-1 rounded">{version}</span>
                    </div>
                </div>
                <button
                    onClick={handleEnrichFromAPI}
                    className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white mt-1 mb-4"
                    disabled={apiEnriching}
                >
                    {apiEnriching ? 'Fetching…' : 'Enrich from API'}
                </button>
                <div className="flex gap-8 mb-6 flex-wrap">
                    <div className="w-1/3 min-w-[180px]">
                        {/* Images */}
                        <div className="mb-3">
                            <div className="grid grid-cols-3 gap-2">
                                {images.slice(0, 6).map((img, idx) =>
                                        !!img && (
                                            <img
                                                key={img}
                                                src={img.startsWith('file://') ? img : `file://${img}`}
                                                alt="Model preview"
                                                className="rounded shadow cursor-pointer bg-zinc-200 dark:bg-zinc-800"
                                                draggable={false}
                                                onClick={() => setModalImageIdx(idx)}
                                            />
                                        )
                                )}
                            </div>
                            <div className="text-xs mt-2 text-zinc-400 dark:text-zinc-300">
                                {images.length} images stored
                            </div>
                        </div>
                        {/* Tags */}
                        <div className="mb-3">
                            <span className="font-semibold text-zinc-700 dark:text-zinc-200">Tags:</span>
                            <div className="flex flex-wrap gap-2 mt-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-2 py-2">
                                {tags.map(tag =>
                                    <span
                                        key={tag}
                                        className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded flex items-center gap-1"
                                    >
                                        {tag}
                                        <button
                                            className="text-red-400 ml-1 hover:text-red-600 dark:hover:text-red-300"
                                            onClick={() => removeTag(tag)}
                                            title="Remove tag"
                                        >&times;</button>
                                    </span>
                                )}
                                <input
                                    type="text"
                                    value={newTag}
                                    onChange={e => setNewTag(e.target.value)}
                                    placeholder="Add tag"
                                    className="border rounded px-2 py-1 w-20 bg-white dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-700 focus:outline-none"
                                    onKeyDown={e => e.key === 'Enter' && addTag()}
                                />
                                <button
                                    className="bg-blue-600 text-white rounded px-2 py-1 ml-1 hover:bg-blue-700"
                                    onClick={addTag}
                                >+</button>
                            </div>
                        </div>
                    </div>
                    {/* Prompts, File info, Links */}
                    <div className="flex-1 min-w-[240px]">
                        <div className="mb-2 text-sm text-zinc-700 dark:text-zinc-100">
                            <div><strong>Hash:</strong> <span className="font-mono">{modelHash}</span></div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-300 mt-1 truncate"><strong>Path:</strong> {model?.file_path}</div>
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
                                <span className="font-semibold text-zinc-700 dark:text-zinc-200">Positive Prompt:</span>{' '}
                                <span className="font-mono text-zinc-700 dark:text-zinc-100">{model?.prompt_positive || "–"}</span>
                            </div>
                            <div>
                                <span className="font-semibold text-zinc-700 dark:text-zinc-200">Negative Prompt:</span>{' '}
                                <span className="font-mono text-zinc-700 dark:text-zinc-100">{model?.prompt_negative || "–"}</span>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Notes: full width below */}
                <div className={`mb-2 transition-all ${notesExpanded ? 'max-h-[400px]' : 'max-h-[120px]'}`}>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-200">Notes:</span>
                        <button
                            className="text-xs text-blue-600 underline"
                            onClick={() => setNotesExpanded(e => !e)}
                        >{notesExpanded ? "Collapse" : "Expand"}</button>
                    </div>
                    <div className="rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 max-w-full overflow-y-auto">
                        {userNote && userNote.trim().startsWith('<') ? (
                            <div className="prose prose-blue max-w-full text-zinc-700 dark:text-zinc-100">{renderHtml(userNote)}</div>
                        ) : (
                            <textarea
                                className="w-full p-2 border-none bg-transparent text-zinc-800 dark:text-white focus:outline-none focus:bg-blue-50 dark:focus:bg-blue-950 transition"
                                rows={notesExpanded ? 8 : 3}
                                value={userNote}
                                onChange={handleNoteChange}
                                onBlur={saveNote}
                                placeholder="Add your notes here…"
                            />
                        )}
                    </div>
                </div>
                {/* Image modal */}
                {modalImageIdx !== null && (
                    <ImageModal
                        images={images}
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
