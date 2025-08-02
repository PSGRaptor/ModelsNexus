// File: renderer/src/components/PromptViewerModal.tsx

import React, { useEffect, useState } from 'react';
import { FaTimes } from 'react-icons/fa';

// No declare global here, global.d.ts handles types

interface PromptViewerModalProps {
    imagePath: string; // file:// URI
    onClose: () => void;
}

/**
 * Only one exported component! No duplicates.
 */
const PromptViewerModal: React.FC<PromptViewerModalProps> = ({
                                                                 imagePath,
                                                                 onClose,
                                                             }) => {
    const [metadata, setMetadata] = useState<string>('Loading metadata…');

    function normalizeImagePath(imagePath: string): string {
        // Remove file:// or file:/// prefix
        let p = imagePath.replace(/^file:\/+/, '');
        // On Windows, remove leading slash if present
        if (navigator.userAgent.includes('Windows') && p[0] === '/') {
            p = p.slice(1);
        }
        return p;
    }

    useEffect(() => {
        const localPath = normalizeImagePath(imagePath);
        window.promptAPI
            ?.getPromptMetadata?.(localPath)
            .then((meta: string) => setMetadata(meta || '<No metadata available>'))
            .catch((err: Error) => {
                console.error(err);
                setMetadata('<Error reading metadata>');
            });
    }, [imagePath]);


    return (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-lg max-w-[90vw] max-h-[90vh] overflow-hidden flex relative">
                <button
                    className="absolute top-2 right-2 text-white text-2xl"
                    onClick={onClose}
                >
                    <FaTimes />
                </button>
                <div className="flex flex-1">
                    <div className="w-1/2 bg-black flex items-center justify-center">
                        <img
                            src={imagePath}
                            alt="Prompt"
                            className="max-h-[90vh] max-w-full object-contain"
                        />
                    </div>
                    <div className="w-1/2 p-4 overflow-auto bg-gray-50 dark:bg-zinc-800 text-sm font-mono whitespace-pre-wrap text-gray-800 dark:text-gray-100">
                        {metadata}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PromptViewerModal;
