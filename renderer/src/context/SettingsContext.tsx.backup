// START OF FILE: renderer/src/context/SettingsContext.tsx
import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    ReactNode,
} from 'react';

export type MaskStyle = 'blur' | 'pixelate';

type Settings = {
    sfwMode: boolean;
    maskStyle: MaskStyle;
    maskAll: boolean;
    maskUnknown: boolean;
    blurAmount: number; // px
    pixelGrid: number;  // px
    [k: string]: any;
};

type Ctx = {
    settings: Settings;
    setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
    refresh: () => Promise<void>;
};

const SettingsContext = createContext<Ctx | null>(null);

async function invokeGetUserSettings(): Promise<Partial<Settings> | undefined> {
    const anyWin = window as any;
    try {
        if (anyWin.electronAPI?.getUserSettings) {
            return await anyWin.electronAPI.getUserSettings();
        }
        if (anyWin.electron?.ipcRenderer?.invoke) {
            return await anyWin.electron.ipcRenderer.invoke('getUserSettings');
        }
    } catch (err) {
        console.warn('[SettingsContext] getUserSettings failed:', err);
    }
    return undefined;
}

async function invokeUpdateUserSettings(
    patch: Partial<Settings>
): Promise<Partial<Settings> | undefined> {
    const anyWin = window as any;
    try {
        if (anyWin.electronAPI?.updateUserSettings) {
            return await anyWin.electronAPI.updateUserSettings(patch);
        }
        if (anyWin.electron?.ipcRenderer?.invoke) {
            return await anyWin.electron.ipcRenderer.invoke('updateUserSettings', patch);
        }
    } catch (err) {
        console.warn('[SettingsContext] updateUserSettings failed:', err);
    }
    return undefined;
}

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
    const [settings, setSettings] = useState<Settings>({
        sfwMode: true,
        maskStyle: 'blur',
        maskAll: false,
        maskUnknown: false,
        blurAmount: 12,
        pixelGrid: 8,
    });

    const refresh = async () => {
        const s = await invokeGetUserSettings();
        if (s && typeof s === 'object') {
            setSettings((prev) => ({ ...prev, ...s }));
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    const setSetting = async (key: keyof Settings, value: any) => {
        const next = await invokeUpdateUserSettings({ [key]: value });
        if (next && typeof next === 'object') {
            setSettings((prev) => ({ ...prev, ...next }));
        } else {
            setSettings((prev) => ({ ...prev, [key]: value }));
        }
    };

    const value = useMemo(() => ({ settings, setSetting, refresh }), [settings]);

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
    return ctx;
};
// END OF FILE: renderer/src/context/SettingsContext.tsx
