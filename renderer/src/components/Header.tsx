import React from 'react';

/**
 * Header Component
 * Displays app logo, title, and the settings button
 *
 * Props:
 *   logo: string (image path)
 *   onOpenConfig: () => void
 */
const Header: React.FC<{
    logo: string;
    onOpenConfig: () => void;
}> = ({ logo, onOpenConfig }) => {
    return (
        <header className="flex items-center justify-between h-16 px-6 bg-primary text-white shadow-sm">
            <div className="flex items-center gap-4">
                <img src={logo} alt="App Logo" className="h-10 w-10 rounded-xl bg-white/80 p-1" />
                <span className="text-2xl font-bold tracking-wide">Models Nexus</span>
            </div>
            <button
                className="p-2 rounded bg-white/10 hover:bg-white/20"
                title="Settings"
                onClick={onOpenConfig}
            >
                <span className="material-icons">settings</span>
            </button>
        </header>
    );
};

export default Header;
