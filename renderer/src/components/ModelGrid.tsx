// START OF FILE: renderer/src/components/ModelGrid.tsx

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { FixedSizeGrid } from 'react-window';
import { FaStar, FaRegStar } from 'react-icons/fa';
import placeholderModel from '../assets/placeholder-model.png';

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

// Card sizing for virtualization (matches your large cards)
const CELL_W = 320; // card width incl. padding/margins
const CELL_H = 420; // card height incl. padding/margins

/**
 * Small hook to measure the available container size.
 * Uses ResizeObserver so the grid recalculates on window resize.
 */
function useContainerSize<T extends HTMLElement>() {
    const ref = useRef<T | null>(null);
    const [size, setSize] = useState({ width: 1200, height: 800 });

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const update = () => {
            const rect = el.getBoundingClientRect();
            // Provide some padding so the grid doesn't get clipped
            setSize({
                width: Math.max(320, Math.floor(rect.width)),
                height: Math.max(400, Math.floor(rect.height)),
            });
        };

        update();

        const ro = new ResizeObserver(update);
        ro.observe(el);

        return () => {
            try {
                ro.disconnect();
            } catch {}
        };
    }, []);

    return { ref, ...size };
}

const ModelGrid: React.FC<ModelGridProps> = ({ models, onSelectModel, onToggleFavorite }) => {
    // Measure the container we render into
    const { ref, width: containerWidth, height: containerHeight } = useContainerSize<HTMLDivElement>();

    // Calculate how many columns we can fit
    const columns = useMemo(
        () => Math.max(1, Math.floor(containerWidth / CELL_W)),
        [containerWidth]
    );

    const rowCount = useMemo(
        () => Math.ceil(models.length / columns),
        [models.length, columns]
    );

    // Renderer for each cell in the virtual grid
    const Cell = ({ columnIndex, rowIndex, style }: any) => {
        const index = rowIndex * columns + columnIndex;
        const model = models[index];
        if (!model) return null;

        // Construct cover image url with file:// handling
        const imgSrc =
            model.cover_image
                ? (model.cover_image.startsWith('file://') ? model.cover_image : `file://${model.cover_image}`)
                : placeholderModel;

        return (
            <div style={style} className="p-3">
                <div
                    className="bg-white dark:bg-zinc-800 rounded-lg shadow hover:shadow-lg transition p-4 cursor-pointer overflow-hidden h-full"
                    onClick={() => onSelectModel(model.model_hash)}
                >
                    <div className="relative w-full aspect-[3/4]">
                        <img
                            src={imgSrc}
                            alt={model.file_name}
                            loading="lazy"
                            className="absolute inset-0 w-full h-full object-cover rounded-md"
                            onError={(e) => {
                                // Prevent infinite loop
                                const t = e.currentTarget as HTMLImageElement;
                                (t as any).onerror = null;
                                t.src = placeholderModel;
                            }}
                        />
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite(model.model_hash);
                            }}
                            title={model.is_favorite ? 'Unfavorite' : 'Favorite'}
                            className="absolute top-2 right-2 bg-white dark:bg-zinc-700 p-1 rounded-full shadow-sm"
                        >
                            {model.is_favorite ? <FaStar className="text-yellow-400" /> : <FaRegStar className="text-gray-400" />}
                        </button>
                    </div>

                    <h3 className="mt-3 mb-1.5 text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {model.file_name}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                        {model.base_model || model.model_type || '–'}
                    </p>
                </div>
            </div>
        );
    };

    return (
        <div
            ref={ref}
            className="p-4"
            style={{
                // Ensure the grid gets vertical space; parent should ideally be flex/height:100%
                width: '100%',
                height: '100%',
                minHeight: 500,
                boxSizing: 'border-box',
            }}
        >
            <FixedSizeGrid
                columnCount={columns}
                columnWidth={CELL_W}
                height={containerHeight}
                rowCount={rowCount}
                rowHeight={CELL_H}
                width={containerWidth}
            >
                {Cell}
            </FixedSizeGrid>
        </div>
    );
};

export default ModelGrid;

// END OF FILE: renderer/src/components/ModelGrid.tsx
