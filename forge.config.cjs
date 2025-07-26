// File: forge.config.cjs
const path = require('path');
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
    packagerConfig: {
        icon: path.resolve(__dirname, 'resources', 'icon'),
        // ① keep your app in an ASAR, but unpack any images folder
        asar: {
            unpack: '**/images/**'
        },

        // ② bundle the two binaries *as flat file paths*, not objects
        extraResource: [
            path.resolve(__dirname, 'resources', 'sd-prompt-reader.exe'),
            path.resolve(__dirname, 'resources', 'sd-prompt-reader-cli.exe')
        ]
    },

    rebuildConfig: {},

    makers: [
        {
            name: '@electron-forge/maker-squirrel',
            config: {
                // ↙ this points at your .ico
                setupIcon: path.resolve(__dirname, 'resources', 'icon.ico'),
            }
        },
        { name: '@electron-forge/maker-squirrel', config: {/*…*/} },
        { name: '@electron-forge/maker-zip' },
        { name: '@electron-forge/maker-deb',  config: {} },
        { name: '@electron-forge/maker-rpm',  config: {} }
    ],

    plugins: [
        { name: '@electron-forge/plugin-auto-unpack-natives', config: {} },
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true,
        })
    ]
};
