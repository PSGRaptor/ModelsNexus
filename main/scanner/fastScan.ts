import * as fs from 'node:fs';
import * as path from 'node:path';
import { processModelFile as ingestModel } from './ingestModel.js';

export type FastScanResult = {
    processed: number;
    skipped: number;
    totalCandidates: number;
    errors: number;
    errorsDetail?: { file: string; error: string }[];
};

console.log('[fast-scan] USING DIRECT INGEST (no fallback)');

const MODEL_EXTS = new Set([
    '.safetensors', '.ckpt', '.pth', '.pt', '.onnx', '.bin', '.gguf', '.ckpt2', '.model', '.pickle',
]);

function isLikelyModelFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return MODEL_EXTS.has(ext);
}

function normAbs(p: string): string {
    const abs = path.resolve(p).replace(/\//g, path.sep);
    return process.platform === 'win32'
        ? abs.replace(/^([A-Z]):\\/, (m, d) => d.toLowerCase() + ':\\')
        : abs;
}

// Stub until you wire your DB’s known paths
async function loadKnownPaths(): Promise<Set<string>> {
    return new Set<string>();
}

export async function scanNewOrChanged(roots: string[]): Promise<FastScanResult> {
    const errorsDetail: { file: string; error: string }[] = [];
    let totalCandidates = 0, processed = 0, skipped = 0, errors = 0;

    if (!Array.isArray(roots) || roots.length === 0) {
        return { processed, skipped, totalCandidates, errors, errorsDetail };
    }
    if (typeof ingestModel !== 'function') {
        throw new Error('Named export processModelFile not found from ./ingestModel.js');
    }

    const known = await loadKnownPaths();

    async function walk(root: string) {
        const rootAbs = normAbs(root);
        let st: fs.Stats;
        try { st = fs.statSync(rootAbs); } catch (e) {
            errors++; errorsDetail.push({ file: rootAbs, error: (e as Error).message }); return;
        }
        if (!st.isDirectory()) return;

        const stack = [rootAbs];
        while (stack.length) {
            const dir = stack.pop()!;
            let entries: fs.Dirent[];
            try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
            catch (e) { errors++; errorsDetail.push({ file: dir, error: (e as Error).message }); continue; }

            for (const ent of entries) {
                const full = normAbs(path.join(dir, ent.name));
                if (ent.isDirectory()) { stack.push(full); continue; }
                if (!isLikelyModelFile(full)) continue;

                totalCandidates++;
                if (known.has(full)) { skipped++; continue; }

                try { await ingestModel(full); processed++; }
                catch (e) { errors++; errorsDetail.push({ file: full, error: (e as Error).message }); }
            }
        }
    }

    for (const r of roots) await walk(r);
    return { processed, skipped, totalCandidates, errors, errorsDetail };
}
