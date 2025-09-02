// START OF FILE: renderer/src/hooks/useNsfwIndex.ts
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

type IndexData = {
    images: Record<string, boolean>;
    models: Record<string, boolean>;
};

// -------- Normalization helpers --------------------------------------------
function normalizeKey(src: string): string {
    if (!src) return '';
    const raw = src.startsWith('file://') ? src.slice(7) : src;
    return decodeURIComponent(raw).replace(/\\/g, '/');
}
function keyVariants(src: string): string[] {
    if (!src) return [];
    const norm = normalizeKey(src);
    const withFile = norm.startsWith('file://') ? norm : `file://${norm}`;
    const rawFile = src.startsWith('file://') ? src : `file://${src}`;
    const rawNoFile = src.startsWith('file://') ? src.slice(7) : src;

    const set = new Set<string>([
        src,
        norm,
        norm.toLowerCase(),
        withFile,
        rawFile,
        rawNoFile,
    ]);
    return Array.from(set).filter(Boolean);
}
function sanitizeIndex(payload: any): IndexData {
    const images: Record<string, boolean> = {};
    const models: Record<string, boolean> = {};
    const inImages = (payload?.images ?? {}) as Record<string, any>;
    const inModels = (payload?.models ?? {}) as Record<string, any>;

    for (const [k, v] of Object.entries(inImages)) {
        const nk = normalizeKey(k);
        if (nk) images[nk] = Boolean(v);
    }
    for (const [k, v] of Object.entries(inModels)) {
        if (k) models[k] = Boolean(v);
    }
    return { images, models };
}
// ---------------------------------------------------------------------------

// -------- Global store (singleton) -----------------------------------------
let store: IndexData = { images: {}, models: {} };
let loaded = false;
const subs = new Set<() => void>();

function emit() {
    subs.forEach((fn) => {
        try { fn(); } catch { /* noop */ }
    });
}

function getSnapshot(): IndexData {
    return store;
}
function subscribe(listener: () => void) {
    subs.add(listener);
    return () => subs.delete(listener);
}

async function loadFromBackend() {
    try {
        const data = await (window as any)?.electronAPI?.nsfwGetIndex?.();
        store = sanitizeIndex(data);
        loaded = true;
        emit();
    } catch {
        // ignore
    }
}
// ---------------------------------------------------------------------------

export default function useNsfwIndex() {
    // All components read from the same store
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    // Lazy-initialize on first mount anywhere
    useEffect(() => {
        if (!loaded) void loadFromBackend();
    }, []);

    // Reads
    const getImage = useCallback((src?: string) => {
        if (!src) return undefined;
        // Try all variants against canonical keys in store.images
        for (const v of keyVariants(src)) {
            const nk = normalizeKey(v);
            if (nk in store.images) return store.images[nk];
        }
        return undefined;
    }, []);

    const getModel = useCallback((hash?: string) => {
        if (!hash) return undefined;
        if (hash in store.models) return store.models[hash];
        const lc = hash.toLowerCase();
        if (lc in store.models) return store.models[lc];
        return undefined;
    }, []);

    // Writes
    const markImage = useCallback(async (src: string, value: boolean) => {
        const api = (window as any)?.electronAPI;
        // Persist multiple variants to avoid mismatch with how callers reference it
        for (const v of keyVariants(src)) {
            const nk = normalizeKey(v);
            try { await api?.nsfwSetImage?.(nk, value); } catch { /* continue */ }
        }
        // Update singleton store + notify all subscribers immediately
        const canonical = normalizeKey(src);
        store = {
            images: { ...store.images, [canonical]: value },
            models: store.models,
        };
        emit();
    }, []);

    const markModel = useCallback(async (hash: string, value: boolean) => {
        try { await (window as any)?.electronAPI?.nsfwSetModel?.(hash, value); } catch { /* noop */ }
        store = {
            images: store.images,
            models: { ...store.models, [hash]: value },
        };
        emit();
    }, []);

    const refresh = useCallback(async () => {
        await loadFromBackend();
    }, []);

    // Expose the API (backed by the singleton snapshot)
    return useMemo(
        () => ({
            getImage,
            getModel,
            markImage,
            markModel,
            refresh,
            // Optionally expose raw for debugging:
            _debug: snapshot,
        }),
        [getImage, getModel, markImage, markModel, refresh, snapshot]
    );
}
// END OF FILE: renderer/src/hooks/useNsfwIndex.ts
