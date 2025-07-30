// File: renderer/src/components/PromptViewerModal.tsx

import React, { useEffect, useState } from 'react';

// Add TypeScript declaration so window.promptAPI is recognized
declare global {
    interface Window {
        promptAPI?: {
            onShowPrompt?: (cb: (img: string) => void) => void;
        };
    }
}

const PromptViewerModal: React.FC = () => {
    const [imagePath, setImagePath] = useState<string | null>(null);

    useEffect(() => {
        // Listen for prompt image changes from main process
        window.promptAPI?.onShowPrompt?.((img: string) => setImagePath(img));
    }, []);

    if (!imagePath) {
        return <div className="text-center mt-10">No prompt image selected.</div>;
    }
    return (
        <div className="flex flex-col items-center p-4">
            <img src={imagePath} alt="Prompt" className="max-h-[90vh] max-w-[90vw] rounded-lg shadow" />
        </div>
    );
};

export default PromptViewerModal;
