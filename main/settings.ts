// START OF FILE: main/settings.ts
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export type MaskStyle = 'blur' | 'pixelate';

export type UserSettings = Record<string, any> & {
    /** SFW master toggle */
    sfwMode?: boolean;
    /** Visual style of the mask */
    maskStyle?: MaskStyle;
    /** If true, mask ALL images while SFW is on (hammer mode). Default: false */
    maskAll?: boolean;
    /** If true, mask images with UNKNOWN NSFW state while SFW is on. Default: false */
    maskUnknown?: boolean;
    /** Blur strength in pixels. Default: 12 */
    blurAmount?: number;
    /** Pixel grid size in pixels (mosaic cell size). Default: 8 */
    pixelGrid?: number;
};

const ensureDir = (p: string) => {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
};

const getUserDataDir = () => app.getPath('userData');
const getUserSettingsPath = () => path.join(getUserDataDir(), 'user-settings.json');

const getDefaultSettingsPath = () => {
    const devPath = path.join(app.getAppPath(), 'config', 'default-config.json');
    const prodPath = path.join(process.resourcesPath || '', 'config', 'default-config.json');
    if (fs.existsSync(devPath)) return devPath;
    if (fs.existsSync(prodPath)) return prodPath;
    return devPath;
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

    // Filter-friendly defaults (no hammer):
    const merged: UserSettings = {
        sfwMode: true,
        maskStyle: 'blur',
        maskAll: false,      // only flagged NSFW are masked
        maskUnknown: false,  // unknowns are shown by default
        blurAmount: 12,
        pixelGrid: 8,
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
// END OF FILE: main/settings.ts
