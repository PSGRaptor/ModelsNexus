import React from 'react';
import ThemeToggle from './ThemeToggle';

type HeaderProps = {
    logo: string;
    onOpenConfig: () => void;
};

const Header: React.FC<HeaderProps> = ({ logo, onOpenConfig }) => (
    <header className="w-full flex items-center justify-between px-6 py-4 bg-card border-b border-border shadow">
        <div className="flex items-center gap-3">
            <img src={logo} alt="Models Nexus" className="h-10 w-10 rounded-lg shadow" />
            <span className="font-bold text-2xl tracking-tight text-primary">Models Nexus</span>
        </div>
        <div className="flex items-center gap-4">
            <ThemeToggle />
            <button
                className="bg-primary text-white px-3 py-2 rounded-lg hover:bg-primary-dark font-semibold"
                onClick={onOpenConfig}
                title="Settings"
            >
                <span className="material-icons">settings</span>
            </button>
        </div>
    </header>
);

export default Header;
