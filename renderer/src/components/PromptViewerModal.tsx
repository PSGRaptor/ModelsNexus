// File: renderer/src/components/PromptViewerModal.tsx
import React, { useMemo } from 'react';
import { FaTimes } from 'react-icons/fa';

// Define and export the PromptData interface for type safety
export interface PromptData {
    prompt_positive: string;
    prompt_negative: string;
    [key: string]: any;
}

export interface PromptViewerModalProps {
    /** absolute filesystem path, e.g. "C:\\Users\\…\\out.png" */
    image: string;
    data: PromptData;
    onClose: () => void;
}

const PromptViewerModal: React.FC<PromptViewerModalProps> = ({ image, data, onClose }) => {
    // Compute a valid <img> src:
    // • data: URIs and file:// URLs ⇒ leave them alone
    // • http:// and https:// ⇒ leave them alone
    // • else ⇒ treat as local filepath and prepend file:///
    const src = useMemo(() => {
        if (/^(data:|file:\/\/|https?:\/\/)/.test(image)) {
            return image;
        }
        // normalize Windows backslashes to forward slashes
        const normalized = image.replace(/\\/g, '/');
        return `file:///${normalized}`;
    }, [image]);

    return (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
            <div className="relative bg-white dark:bg-zinc-900 rounded shadow-lg max-w-3xl w-full mx-4 overflow-auto">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-2xl text-gray-800 dark:text-gray-100 hover:opacity-75"
                >
                    <FaTimes />
                </button>

                <div className="p-6">
                    {/* Display the selected image via file:// URL */}
                    <img
                        src={src}
                        alt="Prompt Preview"
                        className="mx-auto max-h-72 object-contain mb-6"
                    />

                    {/* Positive Prompt */}
                    <div className="mb-4">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">
                            Positive Prompt
                        </h3>
                        <pre className="whitespace-pre-wrap bg-gray-100 dark:bg-zinc-800 p-3 rounded font-mono text-gray-900 dark:text-gray-100">
              {data.prompt_positive}
            </pre>
                    </div>

                    {/* Negative Prompt */}
                    <div>
                        <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">
                            Negative Prompt
                        </h3>
                        <pre className="whitespace-pre-wrap bg-gray-100 dark:bg-zinc-800 p-3 rounded font-mono text-gray-900 dark:text-gray-100">
              {data.prompt_negative}
            </pre>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PromptViewerModal;
