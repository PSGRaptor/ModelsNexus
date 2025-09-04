// START OF FILE: renderer/src/components/SafeImage.tsx
import React, { CSSProperties, useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';
import useNsfwIndex, { canonPath } from '../hooks/useNsfwIndex';
import '../styles/safe-image.css';

export type MaskStyle = 'blur' | 'pixelate';

type SafeImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
    nsfwHint?: boolean;
    meta?: any;
    maskStyle?: MaskStyle;
    forceMask?: boolean;
    withOverlay?: boolean;
};

type NsfwAssessment = { isNSFW: boolean; known: boolean };

function assessFromFields(meta?: any): NsfwAssessment {
    if (!meta) return { isNSFW: false, known: false };
    for (const key of ['nsfw', 'is_nsfw', 'unsafe']) {
        if (typeof meta[key] === 'boolean') return { isNSFW: !!meta[key], known: true };
    }
    if (typeof meta['sfw'] === 'boolean') return { isNSFW: meta['sfw'] === false, known: true };
    const s = String(meta.nsfw ?? meta.rating ?? meta.safety ?? meta.content_rating ?? meta.contentRating ?? '')
        .toLowerCase()
        .trim();
    if (/(explicit|mature|nsfw|r-?18|xxx|18\+)/.test(s)) return { isNSFW: true, known: true };
    if (s === 'safe' || s === 'none') return { isNSFW: false, known: true };
    const tags: string[] = Array.isArray(meta?.tags) ? meta.tags : Array.isArray(meta?.keywords) ? meta.keywords : [];
    if (tags.some((t) => /\b(explicit|nudity|porn|nsfw|r-?18|uncensored)\b/i.test(String(t)))) {
        return { isNSFW: true, known: true };
    }
    if (meta.nsfw_content_detected === true) return { isNSFW: true, known: true };
    return { isNSFW: false, known: false };
}

export default function SafeImage(props: SafeImageProps) {
    const {
        nsfwHint,
        meta,
        maskStyle: propMaskStyle,
        forceMask = false,
        withOverlay = false,
        className,
        style,
        src,
        ...imgProps
    } = props;

    const { settings } = useSettings() as any;
    const sfwMode = !!settings?.sfwMode;
    const maskAll = !!(settings?.maskAll ?? settings?.maskEverything ?? false);
    const maskUnknown = !!settings?.maskUnknown;
    const globalMaskStyle: MaskStyle = settings?.maskStyle ?? 'blur';
    const effectiveMask: MaskStyle = propMaskStyle ?? globalMaskStyle;

    const nsfwIndex = useNsfwIndex();
    const modelHash: string | undefined = meta?.model_hash ?? meta?.modelHash ?? meta?.hash ?? meta?.id;
    const imgKey = canonPath(src);

    const evalRes = useMemo<NsfwAssessment>(() => {
        if (typeof nsfwHint === 'boolean') return { isNSFW: nsfwHint, known: true };
        const imgFlag = imgKey ? nsfwIndex.getImage(imgKey) : undefined;
        const modelFlag = modelHash ? nsfwIndex.getModel(modelHash) : undefined;
        if (imgFlag === true || modelFlag === true) return { isNSFW: true, known: true };
        if (imgFlag === false || modelFlag === false) return { isNSFW: false, known: true };
        return assessFromFields(meta);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nsfwHint, imgKey, modelHash, meta, nsfwIndex]);

    const forcedByIndex =
        (imgKey && nsfwIndex.getImage(imgKey) === true) ||
        (modelHash && nsfwIndex.getModel(modelHash) === true);

    const shouldMask =
        sfwMode && (forceMask || forcedByIndex || maskAll || evalRes.isNSFW || (maskUnknown && !evalRes.known));

    const intensityVars: CSSProperties = {
        ...(style as CSSProperties),
        ['--sfw-blur' as any]: `${Math.max(0, Number(settings?.blurAmount ?? 12))}px`,
        ['--sfw-grid' as any]: `${Math.max(4, Number(settings?.pixelGrid ?? 8))}px`,
    };

    const imgMaskClass =
        shouldMask && effectiveMask === 'blur'
            ? 'sfw-blur-img'
            : shouldMask && effectiveMask === 'pixelate'
                ? 'sfw-soft-blur-img'
                : '';

    // Add data-* for quick inspection (no layout/click impact)
    const dataAttrs = {
        'data-sfw': String(!!sfwMode),
        'data-mask': String(!!shouldMask),
        'data-known': String(evalRes.known),
        'data-nsfw': String(evalRes.isNSFW || forcedByIndex || forceMask),
    } as any;

    if (!withOverlay || effectiveMask === 'blur') {
        // eslint-disable-next-line jsx-a11y/alt-text
        return (
            <img
                {...imgProps}
                {...dataAttrs}
                src={src}
                className={[className, imgMaskClass].filter(Boolean).join(' ')}
                style={intensityVars}
                draggable={imgProps.draggable ?? false}
            />
        );
    }

    return (
        <span className="relative block h-full w-full" style={intensityVars}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img
                {...imgProps}
                {...dataAttrs}
                src={src}
                className={[className, imgMaskClass].filter(Boolean).join(' ')}
                draggable={imgProps.draggable ?? false}
            />
            {shouldMask && <span className="pointer-events-none absolute inset-0 z-30 sfw-overlay-pixelate" />}
    </span>
    );
}
// END OF FILE: renderer/src/components/SafeImage.tsx
