// File: forge.config.cjs
const path   = require('path');
const os     = require('os');
const fs     = require('fs');
const rimraf = require('rimraf');
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
    packagerConfig: {
        // Your window/app icon (no extension) — packager picks .ico/.icns/.png per platform
        icon: path.resolve(__dirname, 'resources', 'icon'),

        // Keep everything in an ASAR except your image folders
        "ignore": [
            "^/dist($|/)",
            "^/out($|/)"
        ],
        asar: {
            unpack: [
                '**/images/**',
                'resources/sd-prompt-reader-cli.exe',
                'resources/sd-prompt-reader.exe'
            ]
        },

        // Copy these two binaries straight into out/.../resources/
        extraResource: [
            path.resolve(__dirname, 'resources', 'sd-prompt-reader.exe'),
            path.resolve(__dirname, 'resources', 'sd-prompt-reader-cli.exe')
        ],

        // If you need offline builds, uncomment & adjust these:
        // download: {
        //   cache: path.join(os.homedir(), 'AppData', 'Local', 'electron', 'Cache'),
        //   mirror: 'https://npmmirror.com/mirrors/electron/'
        // },
        // electronZipDir: path.join(os.homedir(), 'AppData', 'Local', 'electron', 'Cache')
    },

    rebuildConfig: {},

    makers: [
        {
            // Only one Squirrel maker!
            name: '@electron-forge/maker-squirrel',
            config: {
                authors:     'Badaxiom',
                description: 'A cross-platform model browser and prompt-viewer for Stable Diffusion models',
                setupIcon:   path.resolve(__dirname, 'resources', 'icon.ico'),
                noDelta:     true    // skip delta packages (simplifies file locking)
            }
        },
        { name: '@electron-forge/maker-zip' },
        { name: '@electron-forge/maker-deb', config: {} },
        { name: '@electron-forge/maker-rpm', config: {} },
    ],

    plugins: [
        { name: '@electron-forge/plugin-auto-unpack-natives', config: {} },
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]:                        false,
            [FuseV1Options.EnableCookieEncryption]:           true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]:    false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]:               true,
        })
    ],

    hooks: {
        // Runs before any “make” step, so we delete locked files up front
        preMake: async () => {
            console.log('⛏ Cleaning old Squirrel output…');
            rimraf.sync(path.resolve(__dirname, 'out/make/squirrel.windows'));

            console.log('⛏ Removing stale Squirrel-Releasify.log…');
            rimraf.sync(
                path.resolve(
                    __dirname,
                    'node_modules',
                    'electron-winstaller',
                    'vendor',
                    'Squirrel-Releasify.log'
                )
            );

            console.log('⛏ Cleaning temp .nupkg files…');
            const tmpdir = os.tmpdir();
            for (const entry of fs.readdirSync(tmpdir)) {
                if (entry.startsWith('si-')) {
                    const dir = path.join(tmpdir, entry);
                    if (fs.statSync(dir).isDirectory()) {
                        for (const file of fs.readdirSync(dir)) {
                            if (file.endsWith('.nupkg')) {
                                try { fs.unlinkSync(path.join(dir, file)); }
                                catch { /* ignore locks or missing files */ }
                            }
                        }
                    }
                }
            }
        }
    }
};
