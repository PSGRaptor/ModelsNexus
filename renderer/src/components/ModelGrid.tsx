// START OF FILE: renderer/src/components/ModelGrid.tsx

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { FixedSizeGrid } from 'react-window';
import { FaStar, FaRegStar } from 'react-icons/fa';
import placeholderModel from '../assets/placeholder-model.png';
import SafeImage from './SafeImage';
import useNsfwIndex from '../hooks/useNsfwIndex';

export interface ModelInfo {
    model_hash: string;
    cover_image: string | null;
    file_name: string;
    base_model?: string;
    model_type?: string;
    is_favorite: number;
    // Optional fields that might exist in your data:
    nsfw?: boolean;
    rating?: string;
    safety?: string;
}

interface ModelGridProps {
    models: ModelInfo[];
    onSelectModel: (modelHash: string) => void;
    onToggleFavorite: (modelHash: string) => void;
}

// Fixed card sizing (preserved from your working backup)
const CARD_W = 320;
const CARD_H = 450;

// Spacing between cards (preserved)
const GAP_X = 10; // horizontal
const GAP_Y = 6;  // vertical

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

// --------- NSFW helpers (key normalization + tri-state hint) ----------
function normalizeKey(src: string): string {
    if (!src) return '';
    const raw = src.startsWith('file://') ? src.slice(7) : src;
    return decodeURIComponent(raw).replace(/\\/g, '/');
}

function toImgSrc(input?: string | null): string | null {
    if (!input || input.trim() === '') return null;
    const v = input.trim();
    if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('file://')) return v;
    if (/^[a-zA-Z]:[\\/]/.test(v) || v.startsWith('/')) return `file://${v}`;
    return v;
}

function resolveImageFlag(
    getImage: (k: string) => boolean | undefined,
    src?: string
): boolean | undefined {
    if (!src) return undefined;
    const norm = normalizeKey(src);
    const variants = new Set<string>([
        src,
        src.startsWith('file://') ? src.slice(7) : `file://${src}`,
        norm,
        norm.toLowerCase(),
    ]);
    for (const v of variants) {
        const hit = getImage(v);
        if (typeof hit === 'boolean') return hit;
    }
    return undefined;
}

function nsfwFieldFlag(model: any): boolean | undefined {
    if (!model) return undefined;
    if (typeof model.nsfw === 'boolean' && model.nsfw) return true;
    const s = String(model.rating ?? model.safety ?? '').toLowerCase();
    if (/explicit|nsfw|r-?18|xxx|18\+/.test(s)) return true;
    return undefined;
}
// --------------------------------------------------------------------

const ModelGrid: React.FC<ModelGridProps> = ({ models, onSelectModel, onToggleFavorite }) => {
    const { ref, width: containerWidth, height: containerHeight } = useContainerSize<HTMLDivElement>();
    const nsfwIndex = useNsfwIndex();

    const columns = useMemo(
        () => Math.max(1, Math.floor(containerWidth / CELL_W)),
        [containerWidth]
    );

    const rowCount = useMemo(
        () => Math.ceil(models.length / columns),
        [models.length, columns]
    );

    const [menu, setMenu] = useState<null | { x: number; y: number; model: ModelInfo; imgSrc: string | null }>(null);

    useEffect(() => {
        if (!menu) return;
        const close = () => setMenu(null);
        const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
        window.addEventListener('click', close, { capture: true });
        window.addEventListener('keydown', onEsc);
        return () => {
            window.removeEventListener('click', close, { capture: true } as any);
            window.removeEventListener('keydown', onEsc);
        };
    }, [menu]);

    const Cell = ({ columnIndex, rowIndex, style }: any) => {
        const index = rowIndex * columns + columnIndex;
        const model = models[index];
        if (!model) return null;

        const rawCover = model.cover_image || '';
        const imgSrc = toImgSrc(rawCover) ?? placeholderModel;

        // Tri-state nsfwHint: only TRUE when we *know* it’s NSFW; otherwise undefined (never false)
        const modelFlag = nsfwIndex.getModel(model.model_hash);
        const imageFlag = resolveImageFlag(nsfwIndex.getImage, imgSrc);
        const fieldFlag = nsfwFieldFlag(model);
        const nsfwHint = [modelFlag, imageFlag, fieldFlag].some((v) => v === true) ? true : undefined;

        const imageHeight = 372; // preserved tall image area within 450px card

        const isFav = !!model.is_favorite;

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
                onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ x: e.clientX, y: e.clientY, model, imgSrc });
                }}
            >
                {/* Image area (absolute fill inside a fixed-height wrapper) */}
                <div className="relative w-full" style={{ height: imageHeight }}>
                    <SafeImage
                        src={imgSrc}
                        alt={model.file_name}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover rounded-md"
                        meta={model}
                        nsfwHint={nsfwHint}
                        withOverlay={true}
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
                        title={isFav ? 'Unfavorite' : 'Favorite'}
                        className="absolute top-2 right-2 bg-white dark:bg-zinc-700 p-1 rounded-full shadow-sm"
                    >
                        {isFav ? <FaStar className="text-yellow-400" /> : <FaRegStar className="text-gray-400" />}
                    </button>
                </div>

                {/* Title & subtitle (unchanged) */}
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

            {/* Tiny context menu — inline styles; does NOT affect layout */}
            {menu && (
                <div
                    style={{
                        position: 'fixed',
                        top: menu.y,
                        left: menu.x,
                        zIndex: 9999,
                        background: document.documentElement.classList.contains('dark') ? '#111827' : '#ffffff',
                        color: document.documentElement.classList.contains('dark') ? '#E5E7EB' : '#111827',
                        border: document.documentElement.classList.contains('dark')
                            ? '1px solid rgba(255,255,255,0.12)'
                            : '1px solid rgba(0,0,0,0.12)',
                        borderRadius: 8,
                        boxShadow: document.documentElement.classList.contains('dark')
                            ? '0 8px 24px rgba(0,0,0,0.55)'
                            : '0 8px 24px rgba(0,0,0,0.18)',
                        overflow: 'hidden',
                        minWidth: 180,
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    <button
                        style={{ display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13 }}
                        onClick={async () => {
                            await nsfwIndex.markModel(menu.model.model_hash, true);
                            setMenu(null);
                        }}
                    >
                        Mark model as NSFW
                    </button>
                    <button
                        style={{
                            display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13,
                            borderTop: document.documentElement.classList.contains('dark')
                                ? '1px solid rgba(255,255,255,0.06)'
                                : '1px solid rgba(0,0,0,0.06)'
                        }}
                        onClick={async () => {
                            await nsfwIndex.markModel(menu.model.model_hash, false);
                            setMenu(null);
                        }}
                    >
                        Mark model as SFW
                    </button>
                    {menu.imgSrc && (
                        <>
                            <button
                                style={{
                                    display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13,
                                    borderTop: document.documentElement.classList.contains('dark')
                                        ? '1px solid rgba(255,255,255,0.06)'
                                        : '1px solid rgba(0,0,0,0.06)'
                                }}
                                onClick={async () => {
                                    await nsfwIndex.markImage(normalizeKey(menu.imgSrc!), true);
                                    setMenu(null);
                                }}
                            >
                                Mark image as NSFW
                            </button>
                            <button
                                style={{
                                    display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13,
                                    borderTop: document.documentElement.classList.contains('dark')
                                        ? '1px solid rgba(255,255,255,0.06)'
                                        : '1px solid rgba(0,0,0,0.06)'
                                }}
                                onClick={async () => {
                                    await nsfwIndex.markImage(normalizeKey(menu.imgSrc!), false);
                                    setMenu(null);
                                }}
                            >
                                Mark image as SFW
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ModelGrid;

// END OF FILE: renderer/src/components/ModelGrid.tsx
