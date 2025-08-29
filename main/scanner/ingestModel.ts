// File: main/scanner/ingestModel.ts
// Purpose: stable adapter so the rest of the app can always call `processModelFile(filePath)`
// without caring where the real ingest logic lives or what it’s named.

type IngestFn = (filePath: string) => Promise<unknown>;

/**
 * Try to load the project’s real ingest function from a few common locations/exports.
 * Add more candidates here if your repo uses a different path or name.
 */
async function loadIngest(): Promise<IngestFn> {
    // Try common module paths (adjust/add if needed later; this won’t break anything else).
    const candidates = [
        '../scanner/scan.js',
        '../scanner/scan.ts',
        '../scanner/index.js',
        '../scanner/index.ts',
        '../services/modelScanner.js',
        '../services/modelScanner.ts',
        '../db/models.js',
        '../db/models.ts',
        '../models/models.js',
        '../models/models.ts',
    ] as const;

    // For each module, try well-known export names used in model ingesters.
    const exportNames: (keyof any)[] = [
        'processModelFile',
        'ingestModelFromFile',
        'ingestModelFile',
        'addOrUpdateModelFromPath',
        'addModelFromFile',
        'upsertModelFromFile',
    ];

    for (const rel of candidates) {
        try {
            const mod = await import(rel);
            for (const name of exportNames) {
                const fn = (mod as any)[name];
                if (typeof fn === 'function') {
                    return fn as IngestFn;
                }
            }
        } catch {
            // ignore and try next candidate
        }
    }

    throw new Error(
        'Could not locate a model ingest function. ' +
        'Please map your real ingest function to one of: ' +
        exportNames.join(', ') +
        ' in any of:\n' +
        candidates.map((c) => ' - ' + c).join('\n'),
    );
}

// Cache the resolved function once.
let cached: Promise<IngestFn> | null = null;
async function getIngest(): Promise<IngestFn> {
    if (!cached) cached = loadIngest();
    return cached;
}

/**
 * Stable entry point used by the incremental scanner.
 * Delegates to your project’s actual ingest function.
 */
export async function processModelFile(filePath: string): Promise<unknown> {
    const ingest = await getIngest();
    return ingest(filePath);
}
