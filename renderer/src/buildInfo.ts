// renderer/src/buildInfo.ts

// These are replaced at build time by Vite's `define` (see vite.config.ts).
declare const __APP_VERSION__: string | undefined;
declare const __BUILD_DATE__: string | undefined;
declare const __COMMIT_HASH__: string | undefined;

// Fallbacks keep the app running in dev if the defines aren't set.
export const APP_VERSION: string = __APP_VERSION__ ?? "";
export const BUILD_DATE: string = __BUILD_DATE__ ?? "";
export const COMMIT_HASH: string = __COMMIT_HASH__ ?? "";

// Unified shape used by AboutModal and elsewhere
export const buildInfo = {
    version: APP_VERSION,
    commit: COMMIT_HASH,
    timestamp: BUILD_DATE, // ISO 8601 string
};

export default buildInfo;
