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

const PLACEHOLDER = './images/placeholder-model.png';

// Fixed card sizing
const CARD_W = 320;
const CARD_H = 450;

// Spacing between cards
const GAP_X = 10; // horizontal gap
const GAP_Y = 6;  // vertical gap (reduced)

// Each grid cell = card size + gap
const CELL_W = CARD_W + GAP_X;
const CELL_H = CARD_H + GAP_Y;

function useContainerSize<T extends HTMLElement>() {
    const ref = useRef<T | null>(null);
    const [size, setSize] = useState({ width: 1200, height: 800 });

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const update = () => {
            const rect = el.getBoundingClientRect();
            setSize({
                width: Math.max(320, Math.floor(rect.width)),
                height: Math.max(400, Math.floor(rect.height)),
            });
        };

        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);

        return () => {
            try { ro.disconnect(); } catch {}
        };
    }, []);

    return { ref, ...size };
}

const ModelGrid: React.FC<ModelGridProps> = ({ models, onSelectModel, onToggleFavorite }) => {
    const { ref, width: containerWidth, height: containerHeight } = useContainerSize<HTMLDivElement>();

    const columns = useMemo(
        () => Math.max(1, Math.floor(containerWidth / CELL_W)),
        [containerWidth]
    );

    const rowCount = useMemo(
        () => Math.ceil(models.length / columns),
        [models.length, columns]
    );

    const Cell = ({ columnIndex, rowIndex, style }: any) => {
        const index = rowIndex * columns + columnIndex;
        const model = models[index];
        if (!model) return null;

        const imgSrc =
            model.cover_image
                ? (model.cover_image.startsWith('file://') ? model.cover_image : `file://${model.cover_image}`)
                : placeholderModel;

        // Make the image area tall while keeping total card height = 450
        // We’ll budget roughly: padding (p-3 => 24px vertical), title (~20px), subtitle (~16px), small gaps (~8px)
        // => image wrapper ≈ 450 - (24 + 20 + 16 + 8) = 382px. We’ll set ~360–380 as a safe value.
        const imageHeight = 372; // adjust if you tweak text sizes later

        return (
            <div
                style={{
                    ...style,
                    width: CARD_W,
                    height: CARD_H,
                    left: (style.left ?? 0) + GAP_X / 2,
                    top: (style.top ?? 0) + GAP_Y / 2,
                }}
                className="bg-white dark:bg-zinc-800 rounded-lg shadow hover:shadow-lg transition p-3 cursor-pointer overflow-hidden"
                onClick={() => onSelectModel(model.model_hash)}
            >
                <div className="relative w-full" style={{ height: imageHeight }}>
                    <img
                        src={imgSrc}
                        alt={model.file_name}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover rounded-md"
                        onError={(e) => {
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

                <h3 className="mt-3 mb-[5px] text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {model.file_name}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {model.base_model || model.model_type || '–'}
                </p>
            </div>
        );
    };

    return (
        <div
            ref={ref}
            className="p-4"
            style={{
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
