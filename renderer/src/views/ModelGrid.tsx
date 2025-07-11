import React from 'react';

/**
 * ModelGrid Component
 * Displays a grid or list of model cards
 * Props:
 *   onSelectModel: (modelHash: string) => void
 *   models: Model[]
 */
type Model = {
    id: number;
    file_name: string;
    model_hash: string;
    file_path: string;
    model_type?: string;
    version?: string;
    base_model?: string;
    is_favorite?: number;
};

const ModelGrid: React.FC<{
    onSelectModel: (modelHash: string) => void;
    models: Model[];
}> = ({ onSelectModel, models }) => (
    <div>
        <h1 className="text-2xl font-bold mb-6">Model Library</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {models.map(model => (
                <div
                    key={model.model_hash}
                    className="bg-card shadow rounded-2xl p-4 cursor-pointer hover:ring-2 ring-primary transition"
                    onClick={() => onSelectModel(model.model_hash)}
                >
                    <div className="flex items-center justify-between">
                        <span className="font-semibold">{model.file_name}</span>
                        {model.is_favorite ? (
                            <span className="material-icons text-yellow-400">star</span>
                        ) : (
                            <span className="material-icons text-gray-300">star_outline</span>
                        )}
                    </div>
                    <div className="text-sm text-muted mt-2">
                        Type: {model.model_type} | Version: {model.version}
                    </div>
                    <div className="text-xs text-muted mt-1 truncate">
                        Path: {model.file_path}
                    </div>
                </div>
            ))}
        </div>
    </div>
);

export default ModelGrid;
