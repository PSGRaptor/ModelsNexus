// START OF FILE: renderer/src/hooks/useNsfwIndex.ts
import { useCallback, useEffect, useMemo, useState } from 'react';

type NsfwIndexMap = Record<string, boolean>;
type NsfwPayload = { images?: NsfwIndexMap; models?: NsfwIndexMap };

// Only local override bucket; DO NOT redeclare electronAPI here (avoid TS2687)
declare global {
    interface Window {
        __NSFW_OVERRIDES__?: { images: NsfwIndexMap; models: NsfwIndexMap };
    }
}

function ensureOverrides() {
    if (!window.__NSFW_OVERRIDES__) {
        window.__NSFW_OVERRIDES__ = { images: {}, models: {} };
    }
    return window.__NSFW_OVERRIDES__;
}

// Canonical form used for both write and read
export function canonPath(p?: string): string {
    if (!p) return '';
    let raw = p.startsWith('file://') ? p.slice(7) : p;
    try { raw = decodeURIComponent(raw); } catch {}
    return raw.replace(/\\/g, '/').toLowerCase();
}

// Variants so legacy entries still match
function variants(p?: string): string[] {
    if (!p) return [];
    const noScheme = p.startsWith('file://') ? p.slice(7) : p;
    const fwd = noScheme.replace(/\\/g, '/');
    const low = fwd.toLowerCase();
    const set = new Set<string>([p, noScheme, fwd, low]);
    return Array.from(set);
}

export default function useNsfwIndex() {
    const [images, setImages] = useState<NsfwIndexMap>({});
    const [models, setModels] = useState<NsfwIndexMap>({});
    const [tick, setTick] = useState(0); // re-render when overrides change

    const refresh = useCallback(async () => {
        try {
            const api: any = (window as any).electronAPI;
            const res: NsfwPayload = await api?.nsfwGetIndex?.();
            if (res && typeof res === 'object') {
                setImages(res.images ?? {});
                setModels(res.models ?? {});
            }
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);

    useEffect(() => {
        const onOverride = () => setTick((t) => t + 1);
        window.addEventListener('nsfw:override' as any, onOverride as any);
        return () => window.removeEventListener('nsfw:override' as any, onOverride as any);
    }, []);

    const getImage = useCallback((key?: string): boolean | undefined => {
        if (!key) return undefined;
        const o = ensureOverrides();
        for (const v of variants(key)) if (v in o.images) return o.images[v];
        const c = canonPath(key);
        if (c in o.images) return o.images[c];

        for (const v of variants(key)) if (v in images) return images[v];
        if (c in images) return images[c];

        return undefined;
    }, [images, tick]);

    const getModel = useCallback((hash?: string): boolean | undefined => {
        if (!hash) return undefined;
        const o = ensureOverrides();
        if (hash in o.models) return o.models[hash];
        const low = hash.toLowerCase();
        if (low in o.models) return o.models[low];

        if (hash in models) return models[hash];
        if (low in models) return models[low];

        return undefined;
    }, [models, tick]);

    const markImage = useCallback(async (key: string, value: boolean) => {
        const o = ensureOverrides();
        const c = canonPath(key);
        o.images[c] = value; // optimistic override for immediate UI
        window.dispatchEvent(new Event('nsfw:override'));
        try {
            const api: any = (window as any).electronAPI;
            if (typeof api?.nsfwMarkImage === 'function') {
                await api.nsfwMarkImage(c, value);
            } else if (typeof api?.nsfwSetImage === 'function') {
                await api.nsfwSetImage(c, value);
            } else if (typeof api?.nsfwSet === 'function') {
                await api.nsfwSet({ image: c, value });
            }
            void refresh();
        } catch { /* ignore */ }
    }, [refresh]);

    const markModel = useCallback(async (hash: string, value: boolean) => {
        const o = ensureOverrides();
        const h = (hash || '').trim();
        o.models[h] = value;
        o.models[h.toLowerCase()] = value;
        window.dispatchEvent(new Event('nsfw:override'));
        try {
            const api: any = (window as any).electronAPI;
            if (typeof api?.nsfwMarkModel === 'function') {
                await api.nsfwMarkModel(h, value);
            } else if (typeof api?.nsfwSetModel === 'function') {
                await api.nsfwSetModel(h, value);
            } else if (typeof api?.nsfwSet === 'function') {
                await api.nsfwSet({ model: h, value });
            }
            void refresh();
        } catch { /* ignore */ }
    }, [refresh]);

    return useMemo(() => ({
        getImage,
        getModel,
        markImage,
        markModel,
        refresh,
    }), [getImage, getModel, markImage, markModel, refresh]);
}
// END OF FILE: renderer/src/hooks/useNsfwIndex.ts
