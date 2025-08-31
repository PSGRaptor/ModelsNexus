// renderer/src/components/SafeImage.tsx
import React, { useMemo, useState } from 'react';
import { useSettings } from '../context/SettingsContext';

type SafeImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
    /** Optional hint if caller already knows it’s NSFW */
    nsfwHint?: boolean;
    /** Optional meta object that may contain nsfw flags/tags */
    meta?: any;
    /** Optional override; if omitted, global settings.maskStyle is used */
    maskStyle?: 'blur' | 'pixelate';
    /** Disable one-off reveal overlay if you want strictly enforced masking */
    allowReveal?: boolean;
};

function computeNSFW(meta?: any): boolean {
    if (!meta) return false;

    // Boolean nsfw flag
    if (typeof meta.nsfw === 'boolean') return meta.nsfw;

    // Common string fields
    const v = String(meta.nsfw ?? meta.rating ?? meta.safety ?? '').toLowerCase();
    if (['none', 'safe', ''].includes(v)) {
        // proceed to check tags/filename
    } else if (v.length > 0) {
        return true;
    }

    // Tags
    const tags: string[] = Array.isArray(meta.tags) ? meta.tags : [];
    if (tags.some((t) => /nsfw|explicit|nudity|porn|adult|sexy/i.test(t))) return true;

    // Filename hints
    const name: string = meta.fileName ?? meta.filename ?? meta.path ?? meta.src ?? '';
    if (typeof name === 'string' && /nsfw|explicit/i.test(name)) return true;

    // Diffusers safety checker flag
    if (meta.nsfw_content_detected === true) return true;

    return false;
}

export default function SafeImage(props: SafeImageProps) {
    const { nsfwHint, meta, maskStyle: maskOverride, className, style, allowReveal = true, ...imgProps } = props;
    const { settings } = useSettings();
    const [revealed, setRevealed] = useState(false);

    const isNSFW = useMemo(() => Boolean(nsfwHint) || computeNSFW(meta), [nsfwHint, meta]);
    const effectiveMask: 'blur' | 'pixelate' = maskOverride ?? settings.maskStyle ?? 'blur';
    const masked = settings.sfwMode && isNSFW && !(allowReveal && revealed);

    // We apply the visual effect using an overlay that sits on top of the image.
    // - 'blur' uses backdrop-filter (soft, high quality).
    // - 'pixelate' uses a mosaic grid overlay (performance-friendly + clear visual).
    return (
        <div className="relative inline-block">
            {/* the image itself */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <img
                {...imgProps}
                className={className}
                style={style}
                draggable={imgProps.draggable ?? false}
            />

            {/* mask */}
            {masked && (
                <div
                    className={`absolute inset-0 ${effectiveMask === 'blur' ? 'sfw-overlay-blur' : 'sfw-overlay-pixelate'} flex items-center justify-center`}
                    aria-hidden="true"
                >
                    {allowReveal && (
                        <button
                            type="button"
                            className="sfw-reveal-btn px-3 py-2 rounded-xl text-white text-sm"
                            title="Image hidden in SFW mode. Click to reveal."
                            onClick={(e) => {
                                e.stopPropagation();
                                setRevealed(true);
                            }}
                        >
                            NSFW hidden — click to reveal
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
