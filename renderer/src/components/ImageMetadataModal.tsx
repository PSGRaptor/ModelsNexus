// File: renderer/src/components/ImageMetadataModal.tsx
import React, { useState, useEffect } from 'react';
import { FaCopy, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

interface Meta { [key: string]: any; }

export function ImageMetadataModal({
                                       folderFiles,
                                       startIndex,
                                       initialMeta,
                                       onClose,
                                   }: {
    folderFiles: string[];
    startIndex: number;
    initialMeta: Meta;
    onClose: () => void;
}) {
    const [index, setIndex] = useState(startIndex);
    const [meta, setMeta] = useState<Meta>(initialMeta);

    useEffect(() => {
        if (index !== startIndex) {
            window.electronAPI.getImageMetadata(folderFiles[index]).then(setMeta);
        }
    }, [index, startIndex, folderFiles]);

    const copyAll = () => {
        const txt = Object.entries(meta)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n');
        navigator.clipboard.writeText(txt);
    };

    // Simple native modal overlay
    return (
        <div
            className="fixed inset-0 z-50 bg-black bg-opacity-70 flex flex-col items-center justify-center"
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 50,
                background: 'rgba(0,0,0,0.7)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <button
                className="absolute top-4 right-8 text-3xl text-white font-bold"
                onClick={onClose}
                title="Close"
                style={{
                    position: 'absolute',
                    top: 24,
                    right: 32,
                    fontSize: '2rem',
                    color: 'white',
                    fontWeight: 'bold',
                }}
            >
                &times;
            </button>
            <img
                src={`file://${folderFiles[index]}`}
                alt=""
                style={{ maxWidth: '80vw', maxHeight: '40vh', borderRadius: 12, marginBottom: 16, background: '#222' }}
            />
            <div
                style={{
                    overflowY: 'auto',
                    maxHeight: '36vh',
                    minWidth: 320,
                    background: 'rgba(24,24,24,0.95)',
                    borderRadius: 10,
                    padding: '1rem',
                    margin: '1rem 0',
                    color: '#eee',
                }}
            >
                {meta.error ? (
                    <p style={{ color: 'red' }}>Error: {meta.error}</p>
                ) : (
                    Object.entries(meta).map(([k, v]) => (
                        <div key={k} style={{ marginBottom: '0.5rem', wordBreak: 'break-all' }}>
                            <strong>{k}</strong>: {v}
                            <button
                                style={{
                                    marginLeft: 6,
                                    background: 'none',
                                    border: 'none',
                                    color: '#44e',
                                    cursor: 'pointer',
                                    verticalAlign: 'middle',
                                }}
                                title="Copy value"
                                onClick={() => navigator.clipboard.writeText(String(v))}
                            >
                                <FaCopy />
                            </button>
                        </div>
                    ))
                )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: 400 }}>
                <button
                    disabled={index === 0}
                    onClick={() => setIndex(index - 1)}
                    style={{
                        padding: '0.5em 1em',
                        marginRight: 8,
                        borderRadius: 8,
                        background: index === 0 ? '#333' : '#44e',
                        color: '#fff',
                        border: 'none',
                        cursor: index === 0 ? 'not-allowed' : 'pointer',
                    }}
                >
                    <FaChevronLeft /> Prev
                </button>
                <button
                    onClick={copyAll}
                    style={{
                        padding: '0.5em 1em',
                        borderRadius: 8,
                        background: '#222',
                        color: '#fff',
                        border: '1px solid #44e',
                        cursor: 'pointer',
                    }}
                >
                    <FaCopy /> Copy All
                </button>
                <button
                    disabled={index === folderFiles.length - 1}
                    onClick={() => setIndex(index + 1)}
                    style={{
                        padding: '0.5em 1em',
                        marginLeft: 8,
                        borderRadius: 8,
                        background: index === folderFiles.length - 1 ? '#333' : '#44e',
                        color: '#fff',
                        border: 'none',
                        cursor: index === folderFiles.length - 1 ? 'not-allowed' : 'pointer',
                    }}
                >
                    Next <FaChevronRight />
                </button>
            </div>
        </div>
    );
}

export default ImageMetadataModal;
