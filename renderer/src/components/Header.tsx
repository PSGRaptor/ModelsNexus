// root/renderer/src/components/Header.tsx

import React from 'react';
import * as FaIcons from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext';
import AboutModal from './AboutModal';

type HeaderProps = {
    logo: string;
    onOpenConfig: () => void;
};

// Choose tailwind text color for icon wrapper <span>
const themeIcon = (theme: string) => {
    if (theme === 'dark') {
        return (
            <span className="text-yellow-300">
                <FaIcons.FaSun size={20} title="Switch to Light Mode" />
            </span>
        );
    } else if (theme === 'light') {
        return (
            <span className="text-blue-700">
                <FaIcons.FaMoon size={20} title="Switch to Dark Mode" />
            </span>
        );
    } else {
        // "Auto": gray in light, white in dark
        return (
            <span className="text-zinc-500 dark:text-zinc-100">
                <FaIcons.FaDesktop size={20} title="Follow System (Auto)" />
            </span>
        );
    }
};

const themeLabel = (theme: string) =>
    theme === 'dark'
        ? 'Dark'
        : theme === 'light'
            ? 'Light'
            : 'Auto';

const Header: React.FC<HeaderProps> = ({ logo, onOpenConfig }) => {
    const { theme, toggleTheme } = useTheme();

    return (
        <header className="
            w-full flex items-center justify-between px-6 py-4
            bg-white dark:bg-zinc-950
            border-b border-zinc-200 dark:border-zinc-800
            shadow transition-colors
        ">
            <div className="flex items-center gap-3">
                <img
                    src={logo}
                    alt="Models Nexus"
                    className="
                        h-10 w-10 rounded-lg shadow
                        border-2 border-blue-600
                        dark:border-white dark:shadow-[0_0_0_3px_rgba(255,255,255,0.3)]
                        bg-white dark:bg-zinc-900
                        transition
                    "
                    style={{
                        boxShadow: theme === 'dark'
                            ? '0 0 0 3px rgba(255,255,255,0.2), 0 2px 8px rgba(0,0,0,0.25)'
                            : undefined
                    }}
                />
                <span className="font-bold text-2xl tracking-tight text-blue-700 dark:text-white">
                    Models Nexus
                </span>
            </div>
            <div className="flex items-center gap-4">
                {/* About button/modal */}
                <AboutModal
                    appName="Models Nexus"
                    logoSrc={logo}
                    shortDescription="Catalog and explore AI model files locally."
                    longDescription="Models Nexus scans local and network folders for AI model files (safetensor, gguf, .pt, LoRAs, etc.), fetches metadata from Civitai/Hugging Face, and presents it in a searchable, sortable database."
                    author="Badaxiom"
                    githubUrl="https://github.com/PSGRaptor/ModelsNexus"
                />
                <button
                    aria-label="Toggle theme"
                    className="ml-2 px-2 py-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition relative group"
                    onClick={toggleTheme}
                >
                    {themeIcon(theme)}
                    <span className="absolute bottom-[-1.6rem] left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 bg-zinc-800 text-white px-2 py-1 text-xs rounded shadow transition pointer-events-none">
                        {themeLabel(theme)} Mode
                    </span>
                </button>
                <button
                    onClick={onOpenConfig}
                    className="
                        ml-3 px-4 py-2 rounded-lg font-semibold
                        bg-blue-600 hover:bg-blue-700 text-white
                        shadow focus:ring-2 focus:ring-blue-400
                        transition border border-blue-700
                    "
                >
                    Settings
                </button>
            </div>
        </header>
    );
};

export default Header;
