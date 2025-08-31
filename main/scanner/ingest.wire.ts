/**
 * Explicit wiring for your project's real model-ingest function.
 *
 * ACTION REQUIRED:
 * Replace the "null" export below with a real re-export of your ingest function.
 * Example (pick the one that matches your repo):
 *
 *   // Example A: your ingest is exported as addOrUpdateModelFromPath
 *   export { addOrUpdateModelFromPath as directIngest } from '../db/models.js';
 *
 *   // Example B: your ingest is exported as upsertModelFromFile
 *   export { upsertModelFromFile as directIngest } from '../models/index.js';
 *
 *   // Example C: your ingest is exported as processModelFile already
 *   export { processModelFile as directIngest } from '../ingestModel.js';
 *
 * Make sure the import path is correct **relative to this file** (main/scanner/ingest.wire.ts)
 * and that you use the *.js suffix in the string (ESM compiled output).
 */

export const directIngest: ((filePath: string) => Promise<unknown>) | null = null;
