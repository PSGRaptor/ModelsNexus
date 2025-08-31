// renderer/src/types/electron-api.d.ts
export {};

declare global {
    interface Window {
        electronAPI: {
            getUserSettings: () => Promise<any>;
            updateUserSettings: (patch: any) => Promise<any>;
            // other existing APIs remain available
        };
    }
}
