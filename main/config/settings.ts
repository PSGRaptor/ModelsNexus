// File: main/config/settings.ts
// Minimal JSON config reader/writer used by main process.
// Stores a boolean: useExternalPromptParser (default false)

import fs from 'fs';
import path from 'path';
import { app } from 'electron';

type SettingsShape = {
    useExternalPromptParser?: boolean;
};

const CONFIG_DIR = path.join(process.cwd(), 'config'); // repo layout already has /config
const CONFIG_FILE = path.join(CONFIG_DIR, 'user-settings.json');

function ensureDir(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

export function readSettings(): SettingsShape {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
            return JSON.parse(raw) as SettingsShape;
        }
    } catch {}
    return { useExternalPromptParser: false };
}

export function writeSettings(next: SettingsShape) {
    try {
        ensureDir(CONFIG_DIR);
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf8');
    } catch (e) {
        // swallow; Settings not critical to app life
        console.error('[Settings] write error', e);
    }
}

export function getUseExternalPromptParser(): boolean {
    const s = readSettings();
    return !!s.useExternalPromptParser;
}

export function setUseExternalPromptParser(v: boolean): boolean {
    const current = readSettings();
    const next = { ...current, useExternalPromptParser: !!v };
    writeSettings(next);
    return next.useExternalPromptParser!;
}
