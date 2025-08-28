// renderer/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { generateBuildDefines } from '../scripts/genBuildInfo.js';
import tailwindcss from '@tailwindcss/vite';

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the renderer package.json (safe + always available in this folder)
const pkgJsonPath = join(__dirname, 'package.json');
const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));

function getCommit() {
    try {
        // Allow building even if not a git checkout (CI tarballs, etc.)
        return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
            .toString()
            .trim();
    } catch {
        return 'unknown';
    }
}

const BUILD_INFO = {
    version: pkg.version ?? '0.0.0',
    commit: getCommit(),
    timestamp: new Date().toISOString(),
};

export default defineConfig({
    base: './',
    plugins: [react(), tailwindcss()],
    build: { outDir: 'dist', emptyOutDir: true },
    define: {
        __BUILD_INFO__: JSON.stringify(BUILD_INFO),
        __APP_VERSION__: JSON.stringify(BUILD_INFO.version),
        ...generateBuildDefines(),
    },
});

