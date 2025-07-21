// File: renderer/src/components/ModelGrid.tsx

import React from 'react';
import { FaStar, FaRegStar } from 'react-icons/fa';

export interface ModelInfo {
    model_hash: string;
    cover_image: string | null;
    file_name: string;
    base_model?: string;
    model_type?: string;
    is_favorite: number;
}

interface ModelGridProps {
    models: ModelInfo[];
    onSelectModel: (modelHash: string) => void;
    onToggleFavorite: (modelHash: string) => void;
}

// Path to your placeholder image in the built app
const PLACEHOLDER = './images/placeholder-model.png';

const ModelGrid: React.FC<ModelGridProps> = ({ models, onSelectModel, onToggleFavorite }) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-4">
            {models.map(model => (
                <div
                    key={model.model_hash}
                    className="bg-white dark:bg-zinc-800 rounded-lg shadow hover:shadow-lg transition p-4 cursor-pointer overflow-hidden"
                    onClick={() => onSelectModel(model.model_hash)}
                >
                    <div className="relative w-full aspect-[3/4]">
                        <img
                            src={
                                model.cover_image
                                    ? model.cover_image.startsWith('file://')
                                        ? model.cover_image
                                        : `file://${model.cover_image}`
                                    : PLACEHOLDER
                            }
                            alt={model.file_name}
                            className="absolute inset-0 w-full h-full object-cover rounded-md"
                        />
                        <button
                            onClick={e => {
                                e.stopPropagation();
                                onToggleFavorite(model.model_hash);
                            }}
                            title={model.is_favorite ? 'Unfavorite' : 'Favorite'}
                            className="absolute top-2 right-2 bg-white dark:bg-zinc-700 p-1 rounded-full shadow-sm"
                        >
                            {model.is_favorite
                                ? <FaStar className="text-yellow-400" />
                                : <FaRegStar className="text-gray-400" />}
                        </button>
                    </div>

                    <h3 className="mt-3 text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {model.file_name}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                        {model.base_model || model.model_type || '–'}
                    </p>
                </div>
            ))}
        </div>
    );
};

export default ModelGrid;
