// File: renderer/src/components/ModelDetailsModal.tsx

import React, { useEffect, useState, ChangeEvent, DragEvent } from 'react';
import PromptViewerModal from './PromptViewerModal';
import placeholderModel from '../assets/placeholder-model.png';
import SafeImage from './SafeImage';

import {
    FaExternalLinkAlt,
    FaChevronLeft,
    FaChevronRight,
    FaEdit,
    FaSave,
    FaTimes,
    FaPlus,
    FaTrash
} from 'react-icons/fa';

const MODEL_TYPES = [
    'SD1', 'SDXL', 'PONY', 'FLUX', 'HiDream', 'WAN',
    'Safetensors', 'Lora', 'PT', 'GGUF'
];

// Helpers
function getFileName(path: string): string {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1];
}
function defaultRename(name: string): string {
    const i = name.lastIndexOf('.');
    const base = i >= 0 ? name.slice(0, i) : name;
    const ext = i >= 0 ? name.slice(i) : '';
    return `${base}_${Date.now()}${ext}`;
}

interface AddedFile {
    file: File | { path: string };
    saveName: string;
    url: string;
}
interface ModelDetailsModalProps {
    modelHash: string;
    onClose: () => void;
}

const ModelDetailsModal: React.FC<ModelDetailsModalProps> = ({ modelHash, onClose }) => {
    // Display state
    const [model, setModel] = useState<any>(null);
    const [images, setImages] = useState<string[]>([]);
    const [userNote, setUserNote] = useState<string>('');
    const [tags, setTags] = useState<string[]>([]);
    const [apiEnriching, setApiEnriching] = useState<boolean>(false);

    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editFields, setEditFields] = useState<any>({});
    const [editTags, setEditTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState<string>('');
    const [editNote, setEditNote] = useState<string>('');
    const [editImages, setEditImages] = useState<string[]>([]);
    const [addedFiles, setAddedFiles] = useState<AddedFile[]>([]);

    // Drag/drop & conflicts
    const [isDragActive, setIsDragActive] = useState(false);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [conflictFile, setConflictFile] = useState<AddedFile | null>(null);
    const [renameValue, setRenameValue] = useState<string>('');

    // Nested modals
    const [modalImageIdx, setModalImageIdx] = useState<number | null>(null);
    const [showOnlineUrl, setShowOnlineUrl] = useState<string | null>(null);
    const [notesExpanded, setNotesExpanded] = useState(false);

    const [promptModalOpen, setPromptModalOpen] = useState(false);
    const [currentPromptPath, setCurrentPromptPath] = useState<string | null>(null);

    // Add local paths from native dialog
    const addLocalFiles = (paths: string[]) => {
        const entries = paths.map(p => ({
            file: { path: p },
            saveName: getFileName(p),
            url: p.startsWith('file://') ? p : `file://${p}`
        }));
        setAddedFiles(af => [...af, ...entries]);
        setEditImages(imgs => [...imgs, ...entries.map(e => e.url)]);
    };

    // Add dropped File objects
    const safeAddFile = (file: File, saveName: string) => {
        const url = URL.createObjectURL(file);
        setAddedFiles(af => [...af, { file, saveName, url }]);
        setEditImages(imgs => [...imgs, url]);
    };

    // Load model details
    useEffect(() => {
        (async () => {
            const imgs = (await window.electronAPI.getModelImages(modelHash)).filter(Boolean);
            setImages(imgs);
            setUserNote(await window.electronAPI.getUserNote(modelHash));
            setTags((await window.electronAPI.getTags(modelHash)).map((t: any) => t.tag));
            if (window.electronAPI.getModelByHash) {
                setModel(await window.electronAPI.getModelByHash(modelHash));
            }
        })();
        setIsEditing(false);
    }, [modelHash]);

    // Enrich
    const handleEnrich = async () => {
        setApiEnriching(true);
        await window.electronAPI.enrichModelFromAPI(modelHash);
        const imgs = (await window.electronAPI.getModelImages(modelHash)).filter(Boolean);
        setImages(imgs);
        setApiEnriching(false);
        if (window.electronAPI.getModelByHash) {
            setModel(await window.electronAPI.getModelByHash(modelHash));
        }
    };

    // Start & cancel editing
    const handleStartEdit = () => {
        setEditFields({
            model_name: model?.model_name || model?.file_name || '',
            model_type: model?.model_type || '',
            base_model: model?.base_model || '',
            version: model?.version || '',
            prompt_positive: model?.prompt_positive || '',
            prompt_negative: model?.prompt_negative || ''
        });
        setEditTags([...tags]);
        setNewTag('');
        setEditNote(userNote);
        setEditImages([...images]);
        setAddedFiles([]);
        setIsEditing(true);
    };
    const handleCancelEdit = () => {
        setIsEditing(false);
        setAddedFiles([]);
        setEditFields({});
        setConflictFile(null);
    };

    // Drag & drop
    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragActive(false);
        setPendingFiles(Array.from(e.dataTransfer.files));
    };

    // Conflict resolution
    useEffect(() => {
        if (!pendingFiles.length || conflictFile) return;
        const newAdded: AddedFile[] = [];
        let leftover: File[] = [];

        for (const f of pendingFiles) {
            const existing = new Set([
                ...images.map(getFileName),
                ...addedFiles.map(a => a.saveName),
                ...newAdded.map(a => a.saveName)
            ]);
            if (existing.has(f.name)) {
                leftover = pendingFiles.slice(pendingFiles.indexOf(f) + 1);
                const def = defaultRename(f.name);
                setRenameValue(def);
                setConflictFile({ file: f, saveName: def, url: URL.createObjectURL(f) });
                break;
            } else {
                newAdded.push({ file: f, saveName: f.name, url: URL.createObjectURL(f) });
            }
        }

        if (newAdded.length) {
            setAddedFiles(af => [...af, ...newAdded]);
            setEditImages(imgs => [...imgs, ...newAdded.map(a => a.url)]);
        }
        setPendingFiles(leftover);
    }, [pendingFiles, conflictFile, images, addedFiles]);

    // Save all edits
    const handleSave = async () => {
        // Save images (local paths or dropped files)
        for (const a of addedFiles) {
            const p = (a.file as any).path;
            const source = p ?? a.url;
            await window.electronAPI.saveModelImage(modelHash, source);
        }

        // Tags diff & update
        const oldSet = new Set(tags), newSet = new Set(editTags);
        const toAdd = editTags.filter(t => !oldSet.has(t));
        const toRemove = tags.filter(t => !newSet.has(t));
        const updated = {
            ...model,
            ...editFields,
            tags: editTags,
            notes: editNote,
            model_hash: modelHash,
            model_name: editFields.model_name || model?.model_name || model?.file_name || ''
        };
        await window.electronAPI.updateModel({
            model: updated,
            tagsToAdd: toAdd,
            tagsToRemove: toRemove,
            userNote: editNote
        });

        // Reload state
        setIsEditing(false);
        const imgs = (await window.electronAPI.getModelImages(modelHash)).filter(Boolean);
        setImages(imgs);
        setUserNote(await window.electronAPI.getUserNote(modelHash));
        setTags((await window.electronAPI.getTags(modelHash)).map((t: any) => t.tag));
        if (window.electronAPI.getModelByHash) {
            setModel(await window.electronAPI.getModelByHash(modelHash));
        }
    };

    // Delete an image
    const handleDelete = async (url: string) => {
        const idx = addedFiles.findIndex(a => a.url === url);
        if (idx >= 0) {
            setAddedFiles(af => af.filter((_, i) => i !== idx));
        } else {
            const p = url.startsWith('file://') ? url.slice(7) : url;
            const name = getFileName(p);
            await (window.electronAPI as any).deleteModelImage(modelHash, name);
            setImages(imgs => imgs.filter(i => i !== url));
        }
        setEditImages(imgs => imgs.filter(i => i !== url));
    };

    // Tags
    const handleAddTag = () => {
        if (newTag && !editTags.includes(newTag)) setEditTags(ts => [...ts, newTag]);
        setNewTag('');
    };
    const handleRemoveTag = (t: string) => setEditTags(ts => ts.filter(x => x !== t));

    // Conflict actions
    const conflictOverwrite = () => {
        if (!conflictFile) return;
        safeAddFile(conflictFile.file as File, conflictFile.saveName);
        setConflictFile(null);
    };
    const conflictRename = () => {
        if (!conflictFile) return;
        safeAddFile(conflictFile.file as File, renameValue);
        setConflictFile(null);
    };
    const conflictCancel = () => setConflictFile(null);

    // Helpers
    const showName = model?.model_name || model?.file_name || modelHash;
    const civI = model?.civitai_model_id || model?.meta?.civitai_model_id;
    const civUrl = civI ? `https://civitai.com/models/${civI}` : model?.civitai_url;
    const renderHtml = (html: string) => (
        <div className="prose max-w-full" dangerouslySetInnerHTML={{ __html: html }} />
    );

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-5xl min-w-[800px] p-8 max-h-[94vh] overflow-y-auto relative">
                {/* Close */}
                <button
                    className="absolute top-4 right-6 text-2xl text-zinc-400 dark:text-zinc-200 hover:text-blue-600"
                    onClick={onClose}
                >&times;</button>

                {/* Header & Controls */}
                <div className="flex justify-between items-end mb-4 pr-12">
                    <div>
                        {isEditing ? (
                            <input
                                className="text-2xl font-bold bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1"
                                value={editFields.model_name}
                                onChange={e => setEditFields((f: any) => ({ ...f, model_name: e.target.value }))}
                            />
                        ) : (
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{showName}</h2>
                        )}
                        {civI && (
                            <span className="text-xs text-blue-700 dark:text-blue-200 bg-blue-100 dark:bg-blue-900 rounded px-2 py-1 ml-2">
                Civitai ID: {civI}
              </span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {!isEditing ? (
                            <button onClick={handleStartEdit} className="px-4 py-1 bg-blue-600 text-white rounded flex items-center gap-1">
                                <FaEdit /> Edit
                            </button>
                        ) : (
                            <>
                                <button onClick={handleSave} className="px-4 py-1 bg-green-600 text-white rounded flex items-center gap-1">
                                    <FaSave /> Save
                                </button>
                                <button onClick={handleCancelEdit} className="px-4 py-1 bg-zinc-300 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 rounded flex items-center gap-1">
                                    <FaTimes /> Cancel
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Enrich */}
                <button
                    onClick={handleEnrich}
                    className="mb-4 px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    disabled={apiEnriching}
                >
                    {apiEnriching ? 'Fetching…' : 'Enrich from API'}
                </button>

                <div className="mb-4">
                    <span className="font-semibold text-gray-800 dark:text-gray-100">Main Image:</span>
                    <div className="mt-2">
                        {model?.main_image_path ? (
                            <SafeImage
                                src={model.main_image_path}
                                alt="Main"
                                className="max-h-40 rounded shadow border"
                                meta={model}
                            />
                        ) : (
                            <SafeImage
                                src={placeholderModel}
                                alt="Placeholder"
                                className="max-h-40 w-full object-contain rounded shadow border bg-gray-100 dark:bg-zinc-800"
                            />
                        )}
                    </div>
                    <button
                        className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-xs flex items-center gap-1"
                        onClick={async () => {
                            const res = await window.electronAPI.selectModelMainImage(modelHash);
                            if (!res.canceled && window.electronAPI.getModelByHash) {
                                const updated = await window.electronAPI.getModelByHash(modelHash);
                                setModel(updated);
                            }
                        }}
                    >
                        <FaEdit /> Change Main Image
                    </button>
                </div>

                <div className="flex gap-8 flex-wrap mb-6">
                    {/* Images & Tags Column */}
                    <div className="w-1/3 min-w-[180px]">
                        <div
                            className={`grid grid-cols-3 gap-2 ${
                                isEditing
                                    ? isDragActive
                                        ? 'border-2 border-blue-500 p-2'
                                        : 'border-2 border-dashed border-gray-400 p-2'
                                    : ''
                            }`}
                            onDragOver={e => { if (isEditing) { e.preventDefault(); setIsDragActive(true); } }}
                            onDragLeave={() => isEditing && setIsDragActive(false)}
                            onDrop={e => isEditing && handleDrop(e)}
                        >
                            {(isEditing ? editImages : images).slice(0, 6).map((img, idx) =>
                                    img && (
                                        <div key={img} className="relative">
                                            <SafeImage
                                                src={img.startsWith('file://') ? img : `file://${img}`}
                                                alt="preview"
                                                className="rounded shadow cursor-pointer bg-zinc-100 dark:bg-zinc-800"
                                                onClick={() => setModalImageIdx(idx)}
                                                draggable={false}
                                                meta={{ fileName: img }}   // lets SafeImage check filename for NSFW hints
                                            />
                                            {isEditing && (
                                                <button
                                                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1"
                                                    onClick={() => handleDelete(img)}
                                                >
                                                    <FaTrash />
                                                </button>
                                            )}
                                        </div>
                                    )
                            )}
                        </div>

                        {isEditing && (
                            <button
                                type="button"
                                className="block w-full mt-2 px-2 py-1 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100 rounded border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                onClick={async () => {
                                    const paths: string[] = await window.electronAPI.openFileDialog({
                                        filters: [{ name: 'Images', extensions: ['png','jpg','jpeg','webp'] }],
                                        properties: ['openFile','multiSelections']
                                    });
                                    if (paths.length) addLocalFiles(paths);
                                }}
                            >
                                <FaPlus className="inline mr-1" /> Choose Images…
                            </button>
                        )}

                        <div className="text-xs mt-2 text-gray-400 dark:text-gray-200">
                            {(isEditing ? editImages : images).length} images stored
                        </div>

                        {/* Tags */}
                        <div className="mt-4">
                            <span className="font-semibold text-gray-800 dark:text-gray-100">Tags:</span>
                            <div className="flex flex-wrap gap-2 mt-2">
                                {(isEditing ? editTags : tags).map(tag => (
                                    <span key={tag} className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 px-2 py-1 rounded flex items-center gap-1">
                    {tag}
                                        {isEditing && (
                                            <button onClick={() => handleRemoveTag(tag)} className="text-red-400 dark:text-red-300">&times;</button>
                                        )}
                  </span>
                                ))}
                                {isEditing && (
                                    <>
                                        <input
                                            value={newTag}
                                            onChange={e => setNewTag(e.target.value)}
                                            placeholder="Add tag"
                                            className="border rounded px-2 py-1 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100"
                                            onKeyDown={e => e.key==='Enter' && handleAddTag()}
                                        />
                                        <button onClick={handleAddTag} className="bg-blue-600 text-white px-2 py-1 rounded">
                                            <FaPlus size={12}/>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Prompts, File info & Links */}
                    <div className="flex-1 min-w-[240px]">
                        <div className="mb-2 text-sm text-gray-700 dark:text-gray-100">
                            <div><strong>Hash:</strong> <span className="font-mono">{modelHash}</span></div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-300 mt-1 truncate">
                                <strong>Path:</strong> {model?.file_path}
                            </div>
                        </div>
                        <div className="flex gap-4 mb-4">
                            {civUrl && (
                                <button onClick={() => setShowOnlineUrl(civUrl)} className="px-3 py-1 bg-blue-600 text-white rounded text-xs flex items-center gap-1">
                                    <FaExternalLinkAlt/>View on Civitai
                                </button>
                            )}
                            {model?.huggingface_url && (
                                <button onClick={() => setShowOnlineUrl(model.huggingface_url!)} className="px-3 py-1 bg-violet-600 text-white rounded text-xs flex items-center gap-1">
                                    <FaExternalLinkAlt/>View on HF
                                </button>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div>
                                <span className="font-semibold text-gray-800 dark:text-gray-100">Positive Prompt:</span>
                                {isEditing ? (
                                    <textarea
                                        rows={2}
                                        className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100"
                                        value={editFields.prompt_positive}
                                        onChange={e => setEditFields((f:any)=>( {...f, prompt_positive: e.target.value} ))}
                                    />
                                ) : (
                                    <pre className="whitespace-pre-wrap font-mono">{model?.prompt_positive||'–'}</pre>
                                )}
                            </div>
                            <div>
                                <span className="font-semibold text-gray-800 dark:text-gray-100">Negative Prompt:</span>
                                {isEditing ? (
                                    <textarea
                                        rows={2}
                                        className="w-full p-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100"
                                        value={editFields.prompt_negative}
                                        onChange={e => setEditFields((f:any)=>( {...f, prompt_negative: e.target.value} ))}
                                    />
                                ) : (
                                    <pre className="whitespace-pre-wrap font-mono">{model?.prompt_negative||'–'}</pre>
                                )}
                            </div>
                            <div className="flex gap-4">
                                <div>
                                    <span className="font-semibold text-gray-800 dark:text-gray-100">Type:</span>{' '}
                                    {isEditing ? (
                                        <select
                                            className="border px-2 py-1 rounded bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100"
                                            value={editFields.model_type||''}
                                            onChange={e=>setEditFields((f:any)=>( {...f, model_type: e.target.value} ))}
                                        >
                                            <option value="">–</option>
                                            {MODEL_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                                        </select>
                                    ) : (
                                        <span className="px-2 py-1 bg-gray-200 dark:bg-zinc-800 rounded text-gray-800 dark:text-gray-200">{model?.model_type||'–'}</span>
                                    )}
                                </div>
                                <div>
                                    <span className="font-semibold text-gray-800 dark:text-gray-100">Base:</span>{' '}
                                    {isEditing ? (
                                        <input
                                            className="border px-2 py-1 rounded bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100"
                                            value={editFields.base_model||''}
                                            onChange={e=>setEditFields((f:any)=>( {...f, base_model: e.target.value} ))}
                                        />
                                    ) : (
                                        <span className="px-2 py-1 bg-gray-200 dark:bg-zinc-800 rounded text-gray-800 dark:text-gray-200">{model?.base_model||'–'}</span>
                                    )}
                                </div>
                                <div>
                                    <span className="font-semibold text-gray-800 dark:text-gray-100">Version:</span>{' '}
                                    {isEditing ? (
                                        <input
                                            className="border px-2 py-1 rounded bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100"
                                            value={editFields.version||''}
                                            onChange={e=>setEditFields((f:any)=>( {...f, version: e.target.value} ))}
                                        />
                                    ) : (
                                        <span className="px-2 py-1 bg-gray-200 dark:bg-zinc-800 rounded text-gray-800 dark:text-gray-200">{model?.version||'–'}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Notes */}
                <div className={`mb-4 transition-all ${notesExpanded ? 'max-h-[400px]' : 'max-h-[120px]'}`}>
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-gray-800 dark:text-gray-100">Notes:</span>
                        <button
                            className="text-xs text-blue-600 dark:text-blue-300 underline"
                            onClick={()=>setNotesExpanded(x=>!x)}
                        >{notesExpanded?'Collapse':'Expand'}</button>
                    </div>
                    <div className="border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2 py-2 rounded overflow-auto">
                        {isEditing ? (
                            <textarea
                                className="w-full p-2 bg-zinc-100 dark:bg-zinc-800 text-gray-900 dark:text-gray-100"
                                rows={notesExpanded?6:2}
                                value={editNote}
                                onChange={e=>setEditNote(e.target.value)}
                            />
                        ) : userNote.trim().startsWith('<') ? (
                            renderHtml(userNote)
                        ) : (
                            <pre className="whitespace-pre-wrap text-gray-900 dark:text-gray-100">{userNote||'<No notes>'}</pre>
                        )}
                    </div>
                </div>

                {/* Full-size image carousel modal */}
                {modalImageIdx !== null && (
                    <div className="fixed inset-0 bg-black/75 flex items-center justify-center" onClick={()=>setModalImageIdx(null)}>
                        <button className="absolute top-4 right-4 text-2xl text-white"><FaTimes/></button>
                        <button className="absolute left-4 text-3xl text-white" onClick={e=>{e.stopPropagation();setModalImageIdx(i=>(i!>0?i!-1: (isEditing?editImages:images).length-1));}}>
                            <FaChevronLeft/>
                        </button>
                        <SafeImage
                            src={(isEditing ? editImages : images)[modalImageIdx]!}
                            alt="full"
                            className="max-h-[90vh] max-w-[90vw] rounded shadow-lg"
                            meta={{ fileName: (isEditing ? editImages : images)[modalImageIdx]! }}
                        />
                        <button className="absolute right-4 text-3xl text-white" onClick={e=>{e.stopPropagation();setModalImageIdx(i=>(i!< (isEditing?editImages:images).length-1?i!+1:0));}}>
                            <FaChevronRight/>
                        </button>
                        {/* Prompt Viewer action */}
                        <button
                            onClick={() => {
                                const selected = (isEditing ? editImages : images)[modalImageIdx];
                                setCurrentPromptPath(selected.startsWith('file://') ? selected : `file://${selected}`);
                                setPromptModalOpen(true);
                            }}
                            className="absolute bottom-4 right-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            Prompt Viewer
                        </button>
                    </div>
                )}

                {/* Conflict modal */}
                {conflictFile && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
                        <div className="bg-white dark:bg-zinc-900 p-4 rounded shadow-lg max-w-sm">
                            <p className="mb-2">“{conflictFile.saveName}” exists. Overwrite or rename?</p>
                            <input
                                value={renameValue}
                                onChange={e=>setRenameValue(e.target.value)}
                                className="w-full mb-2 border px-2 py-1 rounded"
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={conflictCancel} className="px-2 py-1 rounded">Cancel</button>
                                <button onClick={conflictOverwrite} className="px-2 py-1 bg-red-500 text-white rounded">Overwrite</button>
                                <button onClick={conflictRename} className="px-2 py-1 bg-blue-500 text-white rounded">Rename</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Online link modal */}
                {showOnlineUrl && (
                    <div className="fixed inset-0 bg-black/75 flex items-center justify-center">
                        <div className="bg-white dark:bg-zinc-900 w-full h-full max-w-4xl max-h-[90vh] rounded-lg overflow-hidden relative">
                            <button
                                className="absolute top-2 right-2 text-2xl text-zinc-400 dark:text-zinc-200 hover:text-blue-600"
                                onClick={()=>setShowOnlineUrl(null)}
                            ><FaTimes/></button>
                            <iframe
                                src={showOnlineUrl}
                                className="w-full h-full border-0"
                                sandbox="allow-scripts allow-same-origin allow-popups"
                            />
                        </div>
                    </div>
                )}
                {promptModalOpen && currentPromptPath && (
                    <PromptViewerModal
                        imagePath={currentPromptPath}
                        onClose={() => {
                            setPromptModalOpen(false);
                            setCurrentPromptPath(null);
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default ModelDetailsModal;
