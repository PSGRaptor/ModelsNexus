import React from 'react';
import { FaSun, FaMoon } from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext'; // <- Adjust if your context is elsewhere

type HeaderProps = {
    logo: string;
    onOpenConfig: () => void;
};

const Header: React.FC<HeaderProps> = ({ logo, onOpenConfig }) => {
    const { theme, toggleTheme } = useTheme();

    return (
        <header className="w-full flex items-center justify-between px-6 py-4 bg-card border-b border-border shadow">
            <div className="flex items-center gap-3">
                <img src={logo} alt="Models Nexus" className="h-10 w-10 rounded-lg shadow" />
                <span className="font-bold text-2xl tracking-tight text-primary">Models Nexus</span>
            </div>
            <div className="flex items-center gap-4">
                <button
                    aria-label="Toggle theme"
                    className="ml-2 px-2 py-1 rounded-full transition"
                    onClick={toggleTheme}
                >
                    {theme === 'dark'
                        ? <FaSun size={20} title="Switch to Light Mode" />
                        : <FaMoon size={20} title="Switch to Dark Mode" />}
                </button>
                <button
                    onClick={onOpenConfig}
                    className="ml-3 px-3 py-1 rounded bg-primary text-white hover:bg-primary-dark font-semibold"
                >
                    Settings
                </button>
            </div>
        </header>
    );
};

export default Header;
