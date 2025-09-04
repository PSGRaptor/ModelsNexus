import React from 'react';
import { useSettings } from '../context/SettingsContext';

const NSFWQuickToggle: React.FC = () => {
    const ctx = useSettings() as any;
    const settings = ctx?.settings ?? {};
    const sfw = !!settings.sfwMode;

    const apply = async (next: boolean) => {
        // optimistic UI so it changes instantly
        if (typeof ctx?.setSettings === 'function') {
            ctx.setSettings((s: any) => ({ ...(s ?? {}), sfwMode: next }));
        } else if (ctx?.settings) {
            // fallback optimistic overwrite
            ctx.settings.sfwMode = next;
        }
        // persist via preload API
        await (window as any).electronAPI?.updateUserSettings?.({ sfwMode: next });
    };

    return (
        <button
            type="button"
            onClick={() => apply(!sfw)}
            title={sfw ? 'SFW mode is ON — click to turn OFF' : 'SFW mode is OFF — click to turn ON'}
            className="ml-2 inline-flex items-center gap-2 px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs text-gray-800 dark:text-gray-100 hover:bg-zinc-100 dark:hover:bg-zinc-700"
        >
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: sfw ? '#10B981' : '#9CA3AF' }} />
            {sfw ? 'SFW' : 'NSFW'}
        </button>
    );
};

export default NSFWQuickToggle;
