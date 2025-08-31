// main/settings.ts
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export type MaskStyle = 'blur' | 'pixelate';

export type UserSettings = Record<string, any> & {
    /** true = hide NSFW app-wide */
    sfwMode?: boolean;
    /** visual style of the mask */
    maskStyle?: MaskStyle;
};

const ensureDir = (p: string) => {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
};

const getUserDataDir = () => app.getPath('userData');
const getConfigDir = () => path.join(getUserDataDir());
const getUserSettingsPath = () => path.join(getConfigDir(), 'user-settings.json');

// Resolve default-config.json for dev/prod
const getDefaultSettingsPath = () => {
    const devPath = path.join(app.getAppPath(), 'config', 'default-config.json');
    const prodPath = path.join(process.resourcesPath || '', 'config', 'default-config.json');
    if (fs.existsSync(devPath)) return devPath;
    if (fs.existsSync(prodPath)) return prodPath;
    return devPath; // fallback to dev structure
};

function readJsonSafe<T = any>(file: string): T | {} {
    try {
        const raw = fs.readFileSync(file, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function writeJsonSafe(file: string, data: any) {
    ensureDir(path.dirname(file));
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

export function loadSettings(): UserSettings {
    const def = readJsonSafe<UserSettings>(getDefaultSettingsPath());
    const user = readJsonSafe<UserSettings>(getUserSettingsPath());
    // Safe defaults (SFW enabled + blur)
    const merged: UserSettings = {
        sfwMode: true,
        maskStyle: 'blur',
        ...def,
        ...user,
    };
    return merged;
}

export function patchSettings(patch: Partial<UserSettings>): UserSettings {
    const current = loadSettings();
    const updated = { ...current, ...patch };
    writeJsonSafe(getUserSettingsPath(), updated);
    return updated;
}
