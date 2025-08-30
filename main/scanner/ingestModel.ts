/**
 * Single-file ingest shim used by fastScan.
 * Finds your existing ingest function (wherever it lives) and calls it.
 */

type AnyIngestFn = (filePath: string) => unknown;

const CANDIDATE_MODULES = [
    // scanner
    '../scanner/index.js',
    '../scanner/index.ts',
    '../scanner/scan.js',
    '../scanner/scan.ts',
    '../scanner/ingest.js',
    '../scanner/ingest.ts',

    // services
    '../services/modelScanner.js',
    '../services/modelScanner.ts',

    // db/models
    '../db/models.js',
    '../db/models.ts',

    // models
    '../models/models.js',
    '../models/models.ts',
    '../models/index.js',
    '../models/index.ts',

    // electron-utils
    '../electron-utils/modelScanner.js',
    '../electron-utils/modelScanner.ts',
] as const;

const CANDIDATE_EXPORTS = [
    'processModelFile',
    'ingestModelFromFile',
    'ingestModelFile',
    'addOrUpdateModelFromPath',
    'addModelFromFile',
    'upsertModelFromFile',
    'upsertModel',
] as const;

async function tryImport(pathLike: string): Promise<Record<string, unknown> | null> {
    try {
        // Always import with .js at runtime; when bundling TS→JS, the .ts entries above
        // will be emitted to JS alongside. If a given import fails, we just continue.
        return await import(pathLike);
    } catch {
        return null;
    }
}

/**
 * Locate a usable ingest function (by name) across common modules.
 */
async function resolveRealIngest(): Promise<{ fn: AnyIngestFn; from: string; name: string } | null> {
    for (const modPath of CANDIDATE_MODULES) {
        const mod = await tryImport(modPath);
        if (!mod) continue;

        for (const expName of CANDIDATE_EXPORTS) {
            const candidate = (mod as any)[expName];
            if (typeof candidate === 'function') {
                return { fn: candidate as AnyIngestFn, from: modPath, name: expName };
            }
        }
    }
    return null;
}

/**
 * The function fastScan calls. We normalize to Promise<void> so TS doesn’t care what the
 * underlying ingest returns (some code returns the DB row, others return boolean, etc.).
 */
export async function processModelFile(filePath: string): Promise<void> {
    const resolved = await resolveRealIngest();
    if (!resolved) {
        // Mirror the fastScan error wording so issues are obvious in logs too.
        const locations = CANDIDATE_MODULES.map(p => ` - ${p}`).join('\n');
        const names = CANDIDATE_EXPORTS.join(', ');
        const msg =
            `Could not locate a model ingest function. Please map your real ingest function ` +
            `to one of: ${names} in any of:\n${locations}`;
        throw new Error(msg);
    }

    try {
        const maybe = await resolved.fn(filePath);
        // Swallow any non-void return to conform to Promise<void>.
        void maybe;
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[ingest-shim] used ${resolved.name} from ${resolved.from} for`, filePath);
        }
    } catch (err) {
        // Re-throw to let fastScan collect the error per file.
        throw err;
    }
}
