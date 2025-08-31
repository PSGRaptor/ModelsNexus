// renderer/src/types/settings-augment.d.ts
// Augment the global electronAPI surface with our two new methods.
// We use `any & { ... }` to avoid conflicts with your existing strict typing.

export {};

declare global {
    interface Window {
        electronAPI: any & {
            getUserSettings: () => Promise<any>;
            updateUserSettings: (patch: any) => Promise<any>;
        };
    }
}
