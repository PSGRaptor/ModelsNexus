// START OF FILE: renderer/src/components/SafeImage.tsx
import React, { CSSProperties, useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';
import useNsfwIndex from '../hooks/useNsfwIndex';
// Ensure the masking classes are bundled
import '../styles/safe-image.css';

export type MaskStyle = 'blur' | 'pixelate';

type SafeImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
    /** Optional hint if caller already knows it’s NSFW */
    nsfwHint?: boolean;
    /** Optional meta object that may contain nsfw flags/tags/filenames */
    meta?: any;
    /** Optional override; defaults to global settings.maskStyle */
    maskStyle?: MaskStyle;
    /** If true, force-mask regardless of meta detection */
    forceMask?: boolean;
    /** If true, render mosaic overlay (requires a positioned ancestor) */
    withOverlay?: boolean;
};

type NsfwAssessment = { isNSFW: boolean; known: boolean };

// -------- helpers ----------------------------------------------------------
function get(obj: any, path: string): any {
    if (!obj) return undefined;
    return path.split('.').reduce((a, k) => (a ? a[k] : undefined), obj);
}
function coalesceBool(obj: any, keys: string[], fallback = false): boolean {
    for (const k of keys) {
        const v = get(obj, k);
        if (typeof v === 'boolean') return v;
        if (typeof v === 'number') return v !== 0;
        if (typeof v === 'string') {
            const s = v.toLowerCase();
            if (s === 'true') return true;
            if (s === 'false') return false;
        }
    }
    return fallback;
}
function normalizeKey(src: string): string {
    if (!src) return '';
    const raw = src.startsWith('file://') ? src.slice(7) : src;
    return decodeURIComponent(raw).replace(/\\/g, '/');
}
// --------------------------------------------------------------------------

function assessFromMeta(meta?: any): NsfwAssessment {
    if (!meta) return { isNSFW: false, known: false };

    // boolean fields
    for (const key of ['nsfw', 'is_nsfw', 'unsafe']) {
        if (typeof meta[key] === 'boolean') return { isNSFW: !!meta[key], known: true };
    }
    if (typeof meta['sfw'] === 'boolean') return { isNSFW: meta['sfw'] === false, known: true };

    // string ratings
    const s = String(
        meta.nsfw ??
        meta.rating ??
        meta.safety ??
        meta.content_rating ??
        meta.contentRating ??
        ''
    )
        .toLowerCase()
        .trim();
    if (/(explicit|mature|nsfw|r-?18|xxx|18\+)/.test(s)) return { isNSFW: true, known: true };
    if (s === 'safe' || s === 'none') return { isNSFW: false, known: true };

    // tags/keywords
    const tags: string[] = Array.isArray(meta.tags)
        ? meta.tags
        : Array.isArray(meta.keywords)
            ? meta.keywords
            : [];
    if (tags.some((t) => /\b(explicit|nudity|porn|nsfw|r-?18|uncensored)\b/i.test(String(t)))) {
        return { isNSFW: true, known: true };
    }

    // filename hints
    const name: string = meta.fileName ?? meta.filename ?? meta.path ?? meta.src ?? '';
    if (typeof name === 'string' && /nsfw|explicit|r-?18/i.test(name)) {
        return { isNSFW: true, known: true };
    }

    // diffusers flag
    if (meta.nsfw_content_detected === true) return { isNSFW: true, known: true };

    return { isNSFW: false, known: false };
}

export default function SafeImage(props: SafeImageProps) {
    const {
        nsfwHint,
        meta,
        maskStyle: propMaskStyle,
        forceMask,
        withOverlay = false,
        className,
        style,
        ...imgProps
    } = props;

    const { settings } = useSettings();
    const nsfwIndex = useNsfwIndex();

    // Read SFW + masking prefs using multiple likely keys to avoid mismatches
    const sfwMode = coalesceBool(settings, [
        'sfwMode',
        'sfw',
        'safeForWork',
        'safe_mode',
        'sfwEnabled',
        'contentSafety.enabled',
        'filters.sfwMode',
        'nsfwFilter', // sometimes used to mean "filter NSFW ON"
        'nsfw_filter',
    ], false);

    const globalMaskStyle: MaskStyle = ((): MaskStyle => {
        const v =
            get(settings, 'maskStyle') ??
            get(settings, 'mask_style') ??
            get(settings, 'maskMode');
        return v === 'pixelate' ? 'pixelate' : 'blur';
    })();

    const maskAll = coalesceBool(settings, ['maskAll', 'maskEverything', 'mask_all', 'mask_everything'], false);
    const maskUnknown = coalesceBool(settings, ['maskUnknown', 'mask_unknown'], false);

    const maskStyle: MaskStyle = propMaskStyle ?? globalMaskStyle;

    // 1) explicit hint
    const hintAssessment: NsfwAssessment =
        typeof nsfwHint === 'boolean'
            ? { isNSFW: nsfwHint, known: true }
            : { isNSFW: false, known: false };

    // 2) index lookup by src (and by meta filename) if no explicit hint
    const indexAssessment: NsfwAssessment = useMemo(() => {
        if (typeof nsfwHint === 'boolean') return { isNSFW: nsfwHint, known: true };

        const fromSrc =
            typeof imgProps.src === 'string'
                ? nsfwIndex.getImage(imgProps.src) ??
                nsfwIndex.getImage(normalizeKey(imgProps.src))
                : undefined;
        if (typeof fromSrc === 'boolean') return { isNSFW: fromSrc, known: true };

        const fn = meta?.fileName ?? meta?.filename ?? meta?.path ?? meta?.src;
        if (typeof fn === 'string') {
            const fromMeta =
                nsfwIndex.getImage(fn) ?? nsfwIndex.getImage(normalizeKey(fn));
            if (typeof fromMeta === 'boolean') return { isNSFW: fromMeta, known: true };
        }
        return { isNSFW: false, known: false };
    }, [nsfwHint, imgProps.src, meta?.fileName, meta?.filename, meta?.path, meta?.src, nsfwIndex]);

    // 3) metadata heuristics fallback
    const metaAssessment = useMemo(() => assessFromMeta(meta), [meta]);

    // Final pre-toggle decision
    const evalRes: NsfwAssessment = useMemo(() => {
        if (hintAssessment.known) return hintAssessment;
        if (indexAssessment.known) return indexAssessment;
        return metaAssessment;
    }, [hintAssessment, indexAssessment, metaAssessment]);

    // Decide masking using global toggles
    const shouldMask = useMemo(() => {
        if (!sfwMode) return false;
        if (forceMask) return true;
        if (maskAll) return true;
        if (evalRes.isNSFW) return true;
        if (maskUnknown && !evalRes.known) return true;
        return false;
    }, [sfwMode, forceMask, maskAll, evalRes.isNSFW, evalRes.known, maskUnknown]);

    // CSS var intensity (works with your stylesheet)
    const intensityVars: CSSProperties = shouldMask
        ? ({
            ['--sfw-blur' as any]: '12px',
            ['--sfw-grid' as any]: '8px',
        } as CSSProperties)
        : {};

    // Classes from your stylesheet
    const imgMaskClass =
        shouldMask && (maskStyle === 'blur' ? 'sfw-blur-img' : 'sfw-soft-blur-img');

    // Inline blur fallback so blur works even if CSS didn’t bundle
    const inlineMaskFallback: CSSProperties =
        shouldMask && maskStyle === 'blur' ? { filter: 'blur(12px)' } : {};

    const mergedStyle: CSSProperties = {
        ...(style || {}),
        ...intensityVars,
        ...inlineMaskFallback,
    };

    // Always expose debug attributes for quick inspection
    const debugData = {
        sfw: String(sfwMode),
        mask: String(shouldMask),
        known: String(evalRes.known),
        nsfw: String(evalRes.isNSFW),
    };

    // Keep your original wrapper structure (no layout change)
    return (
        <span
            className="relative block h-full w-full"
            data-sfw={debugData.sfw}
            data-mask={debugData.mask}
            data-known={debugData.known}
            data-nsfw={debugData.nsfw}
        >
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img
                {...imgProps}
                className={[className, imgMaskClass].filter(Boolean).join(' ')}
                style={mergedStyle}
                draggable={imgProps.draggable ?? false}
            />
            {shouldMask && maskStyle === 'pixelate' && (
                <span className="pointer-events-none absolute inset-0 z-30 sfw-overlay-pixelate" />
            )}
    </span>
    );
}
// END OF FILE: renderer/src/components/SafeImage.tsx
