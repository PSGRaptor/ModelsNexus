// START OF FILE: renderer/src/components/SafeImage.tsx
import React, { useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';

type MaskStyle = 'blur' | 'pixelate';

type SafeImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
    /** Optional hint if caller already knows it’s NSFW */
    nsfwHint?: boolean;
    /** Optional meta object that may contain nsfw flags/tags/filenames */
    meta?: any;
    /** Optional override; defaults to global settings.maskStyle */
    maskStyle?: MaskStyle;
    /** If true, force-mask regardless of meta detection */
    forceMask?: boolean;
    /** If true, render mosaic overlay (requires a positioned ancestor); else fallback to blur only */
    withOverlay?: boolean;
};

type NsfwAssessment = { isNSFW: boolean; known: boolean };

function assessNSFW(meta?: any): NsfwAssessment {
    if (!meta) return { isNSFW: false, known: false };

    // Boolean flag wins
    if (typeof meta.nsfw === 'boolean') return { isNSFW: meta.nsfw, known: true };

    // Common string fields: 'none'/'safe' (false), 'soft'/'mature'/'explicit' (true)
    const v = String(meta.nsfw ?? meta.rating ?? meta.safety ?? '').toLowerCase().trim();
    if (v === 'none' || v === 'safe') return { isNSFW: false, known: true };
    if (['soft', 'mature', 'explicit', 'nsfw', 'r18'].includes(v)) return { isNSFW: true, known: true };

    // Tags heuristics
    const tags: string[] = Array.isArray(meta.tags) ? meta.tags : [];
    if (tags.some((t) => /nsfw|explicit|nudity|porn|adult|sexy|r-?18/i.test(t))) {
        return { isNSFW: true, known: true };
    }

    // Filename/path hints
    const name: string = meta.fileName ?? meta.filename ?? meta.path ?? meta.src ?? '';
    if (typeof name === 'string' && /nsfw|explicit|r-?18/i.test(name)) {
        return { isNSFW: true, known: true };
    }

    // Diffusers safety checker flag
    if (meta.nsfw_content_detected === true) return { isNSFW: true, known: true };

    return { isNSFW: false, known: false };
}

export default function SafeImage(props: SafeImageProps) {
    const {
        nsfwHint,
        meta,
        className,
        style,
        maskStyle: maskOverride,
        forceMask = false,
        withOverlay = false,
        ...imgProps
    } = props;

    const { settings } = useSettings();

    const assessed = useMemo(() => assessNSFW(meta), [meta]);
    const explicitHint = Boolean(nsfwHint);
    const isNSFW = forceMask || explicitHint || assessed.isNSFW;
    const isKnown = forceMask || explicitHint || assessed.known;

    // Filter policy:
    // - If maskAll: mask everything while SFW is on.
    // - Else if known NSFW: mask.
    // - Else if unknown and maskUnknown: mask.
    const shouldMask =
        settings.sfwMode &&
        (settings.maskAll || (isKnown && isNSFW) || (!isKnown && settings.maskUnknown));

    const effectiveMask: MaskStyle = maskOverride ?? settings.maskStyle ?? 'blur';

    // Intensity custom properties (use plain CSSProperties to allow numbers)
    const styleWithVars: React.CSSProperties = {
        ...(style as React.CSSProperties),
        // Custom properties for CSS — cast key to any so TS doesn't complain about '--*'
        ['--sfw-blur' as any]: `${Math.max(0, Number(settings.blurAmount ?? 12))}px`,
        ['--sfw-grid' as any]: `${Math.max(4, Number(settings.pixelGrid ?? 8))}px`,
    };

    // Choose classes
    const imgMaskClass =
        shouldMask && (effectiveMask === 'blur' || !withOverlay)
            ? 'sfw-blur-img'
            : shouldMask && effectiveMask === 'pixelate'
                ? 'sfw-soft-blur-img'
                : '';

    // PASS-THROUGH <img> to avoid size/position regressions.
    if (!withOverlay || effectiveMask === 'blur') {
        // eslint-disable-next-line jsx-a11y/alt-text
        return (
            <img
                {...imgProps}
                className={[className, imgMaskClass].filter(Boolean).join(' ')}
                style={styleWithVars}
                draggable={imgProps.draggable ?? false}
            />
        );
    }

    // Pixelate overlay mode (needs positioned ancestor in parent layout)
    return (
        <span className="relative block h-full w-full" style={styleWithVars}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img
                {...imgProps}
                className={[className, imgMaskClass].filter(Boolean).join(' ')}
                draggable={imgProps.draggable ?? false}
            />
            {shouldMask && (
                <span className="pointer-events-none absolute inset-0 z-30 sfw-overlay-pixelate" />
            )}
    </span>
    );
}
// END OF FILE: renderer/src/components/SafeImage.tsx
