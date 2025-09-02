// START OF FILE: renderer/src/lib/nsfwDetect.ts
import * as nsfw from 'nsfwjs';
import * as tf from '@tensorflow/tfjs';

// Cached model/promise so we only load once
let modelPromise: Promise<nsfw.NSFWJS> | null = null;

async function getModel() {
    if (!modelPromise) {
        // Ensure TF backend is ready
        await tf.ready();
        // Try WebGL for speed, fallback to CPU
        try {
            const current = tf.getBackend();
            if (current !== 'webgl' && tf.findBackend('webgl')) {
                await tf.setBackend('webgl');
                await tf.ready();
            }
        } catch {
            // ignore; will use default backend
        }
        modelPromise = nsfw.load(); // uses default hosted model; you can self-host later
    }
    return modelPromise;
}

function loadHTMLImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        // For http(s), try anonymous to keep canvas untainted. file:// is same-origin in Electron.
        if (src.startsWith('http')) img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(new Error(`Failed to load image: ${src}`));
        img.src = src.startsWith('file://') ? src : `file://${src}`;
    });
}

export type NsfwResult = {
    isNSFW: boolean;
    predictions: Array<{ className: string; probability: number }>;
};

/**
 * Classify a single image path/URL and return NSFW decision + raw predictions.
 * Default rule: NSFW if Porn >= 0.70 or Hentai >= 0.70 or Sexy >= 0.85
 */
export async function classifyImage(src: string): Promise<NsfwResult> {
    const model = await getModel();
    const imgEl = await loadHTMLImage(src);
    const preds = await model.classify(imgEl, 5);
    // Normalize output
    const predictions = preds.map((p) => ({
        className: p.className,
        probability: Number(p.probability),
    }));

    const score = (name: string) =>
        predictions.find((p) => p.className.toLowerCase() === name)?.probability ?? 0;

    const porn = score('porn');
    const hentai = score('hentai');
    const sexy = score('sexy');

    const isNSFW = porn >= 0.7 || hentai >= 0.7 || sexy >= 0.85;

    return { isNSFW, predictions };
}

/**
 * Convenience: classify and persist into nsfw-index via preload IPC.
 * Returns the final boolean written.
 */
export async function classifyAndIndexImage(src: string): Promise<boolean> {
    const { isNSFW } = await classifyImage(src);
    const anyWin = window as any;
    await anyWin?.electronAPI?.nsfwSetImage?.(src, isNSFW);
    return isNSFW;
}
// END OF FILE: renderer/src/lib/nsfwDetect.ts
