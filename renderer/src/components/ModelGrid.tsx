// START OF FILE: renderer/src/components/ModelGrid.tsx

import React, { memo, useMemo } from 'react';
import { FaStar, FaRegStar } from 'react-icons/fa';
import SafeImage from './SafeImage';
import placeholderModel from '../assets/placeholder-model.png';

export interface ModelInfo {
    model_hash: string;
    cover_image: string | null;
    file_name: string;
    base_model?: string;
    model_type?: string;
    is_favorite?: number | boolean;
    nsfw?: boolean;
    tags?: string[];
    thumbnail_path?: string;
    main_image_path?: string;
}

type Props = {
    models: ModelInfo[];
    onSelectModel: (modelHash: string) => void;
    onToggleFavorite: (modelHash: string) => void;
};

// Normalize to a usable <img src>.
function toImgSrc(input?: string | null): string | null {
    if (!input || input.trim() === '') return null;
    const v = input.trim();
    if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('file://')) return v;
    if (/^[a-zA-Z]:[\\/]/.test(v) || v.startsWith('/')) return `file://${v}`;
    return v;
}

const ModelCard: React.FC<{
    model: ModelInfo;
    onSelect: (hash: string) => void;
    onToggleFav: (hash: string) => void;
}> = ({ model, onSelect, onToggleFav }) => {
    const src = useMemo(() => {
        const primary = toImgSrc(model.cover_image || model.thumbnail_path || model.main_image_path || '');
        return primary ?? placeholderModel;
    }, [model.cover_image, model.thumbnail_path, model.main_image_path]);

    const isFavorite = Boolean(
        typeof model.is_favorite === 'number' ? model.is_favorite === 1 : model.is_favorite
    );

    return (
        <div
            className="group relative rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm bg-white dark:bg-zinc-900 overflow-hidden hover:shadow-md transition"
            role="button"
            tabIndex={0}
            onClick={() => onSelect(model.model_hash)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSelect(model.model_hash);
            }}
        >
            {/* IMAGE AREA — fixed 3:4 portrait box (prevents 0px issues, consistent sizing) */}
            <div
                className="relative w-full bg-zinc-100 dark:bg-zinc-800"
                style={{ paddingTop: '133.333%' }} // 3:4 aspect => height = 4/3 * width
            >
                {/* Absolutely fill the box, like your original layout */}
                <div className="absolute inset-0">
                    <SafeImage
                        src={src || placeholderModel}
                        alt={model.file_name}
                        className="w-full h-full object-cover"
                        meta={model}
                        // withOverlay enables mosaic overlay for pixelate mode
                        withOverlay={true}
                        onError={(e) => {
                            const t = e.currentTarget as HTMLImageElement;
                            if (t.src !== placeholderModel) {
                                (t as any).onerror = null;
                                t.src = placeholderModel;
                            }
                        }}
                    />
                </div>

                {/* Favorite star */}
                <button
                    type="button"
                    className="absolute top-2 right-2 z-40 p-1.5 rounded-full bg-black/45 hover:bg-black/60 text-white"
                    title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleFav(model.model_hash);
                    }}
                >
                    {isFavorite ? <FaStar className="h-4 w-4" /> : <FaRegStar className="h-4 w-4" />}
                </button>
            </div>

            {/* Meta */}
            <div className="p-3">
                <div className="text-sm font-semibold truncate text-zinc-900 dark:text-zinc-100" title={model.file_name}>
                    {model.file_name}
                </div>
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300 flex gap-2">
                    {model.model_type && (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">
              {model.model_type}
            </span>
                    )}
                    {model.base_model && (
                        <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">
              {model.base_model}
            </span>
                    )}
                </div>
            </div>
        </div>
    );
};

const ModelGrid: React.FC<Props> = ({ models, onSelectModel, onToggleFavorite }) => {
    if (!models || models.length === 0) {
        return (
            <div className="text-sm text-zinc-600 dark:text-zinc-300 px-2 py-6">
                No models found. Try changing your filters or run a scan.
            </div>
        );
    }

    return (
        <div
            className="
        grid gap-4
        sm:grid-cols-2
        md:grid-cols-3
        lg:grid-cols-4
        2xl:grid-cols-6
      "
        >
            {models.map((m) => (
                <ModelCard
                    key={m.model_hash}
                    model={m}
                    onSelect={onSelectModel}
                    onToggleFav={onToggleFavorite}
                />
            ))}
        </div>
    );
};

export default memo(ModelGrid);

// END OF FILE: renderer/src/components/ModelGrid.tsx
