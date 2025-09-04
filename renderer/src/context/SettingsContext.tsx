// renderer/src/context/SettingsContext.tsx
import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    ReactNode,
} from 'react';

export type MaskStyle = 'blur' | 'pixelate';

export type Settings = {
    sfwMode: boolean;
    maskStyle: MaskStyle;
    // allow future keys without type churn
    [key: string]: any;
};

type Ctx = {
    settings: Settings;
    /** Optimistic setter: updates React immediately, then persists via Electron */
    setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
    /** Force-refresh from persisted settings */
    refresh: () => Promise<void>;
};

const DEFAULTS: Settings = {
    sfwMode: false,
    maskStyle: 'blur',
};

const SettingsContext = createContext<Ctx | null>(null);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<Settings>(DEFAULTS);

    // initial load
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const s = await (window as any)?.electronAPI?.getUserSettings?.();
                if (!alive) return;
                if (s && typeof s === 'object') {
                    setSettings({ ...DEFAULTS, ...s });
                }
            } catch {
                // ignore – keep defaults
            }
        })();
        return () => { alive = false; };
    }, []);

    const refresh = async () => {
        try {
            const s = await (window as any)?.electronAPI?.getUserSettings?.();
            if (s && typeof s === 'object') {
                setSettings((prev) => ({ ...prev, ...s }));
            }
        } catch {
            // ignore refresh errors
        }
    };

    const setSetting = async <K extends keyof Settings>(key: K, value: Settings[K]) => {
        // 1) Optimistic local update so UI changes instantly
        setSettings((prev) => ({ ...prev, [key]: value }));
        // 2) Persist, then reconcile with whatever main returns
        try {
            const next = await (window as any)?.electronAPI?.updateUserSettings?.({ [key]: value });
            if (next && typeof next === 'object') {
                setSettings((prev) => ({ ...prev, ...next }));
            }
        } catch {
            // keep optimistic value; user can re-open Settings to resync later
        }
    };

    const value = useMemo<Ctx>(() => ({ settings, setSetting, refresh }), [settings]);

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
    return ctx;
};
