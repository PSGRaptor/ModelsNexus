// scripts/genBuildInfo.js  (ESM-friendly)
// Produces build-time defines for Vite.

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

function safeGit(cmd) {
    try {
        return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] })
            .toString()
            .trim();
    } catch {
        return '';
    }
}

export function generateBuildDefines() {
    // Load package version
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkgPath = resolve(__dirname, '../package.json');

    let version = '';
    try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        version = String(pkg.version || '');
    } catch {
        version = '';
    }

    const commit = safeGit('git rev-parse --short HEAD');
    const date = new Date().toISOString();

    // Vite needs stringified literals in `define`
    return {
        __APP_VERSION__: JSON.stringify(version),
        __COMMIT_HASH__: JSON.stringify(commit),
        __BUILD_DATE__: JSON.stringify(date),
    };
}

// Optional CLI mode: `node scripts/genBuildInfo.js` -> prints JSON
if (process.argv[1] && process.argv[1].endsWith('genBuildInfo.js')) {
    const defs = generateBuildDefines();
    // Print as plain JSON so it’s usable in other contexts if needed
    console.log(JSON.stringify(defs));
}
