// renderer/src/hooks/useModels.ts
import { useEffect, useState } from 'react';

export type Model = {
    id: number;
    file_name: string;
    model_hash: string;
    file_path: string;
    model_type?: string;
    version?: string;
    base_model?: string;
    is_favorite?: number;
};

export function useModels() {
    const [models, setModels] = useState<Model[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            setLoading(true);
            // Use Electron IPC or REST API to get all models
            if (window.electronAPI && window.electronAPI.getAllModels) {
                setModels(await window.electronAPI.getAllModels());
            } else {
                // fallback for mock/demo
                setModels([]);
            }
            setLoading(false);
        })();
    }, []);

    return { models, loading };
}
