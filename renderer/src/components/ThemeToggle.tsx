import React, { useEffect, useState } from 'react';

/**
 * ThemeToggle
 * Switches between light and dark mode using Tailwind's `dark` class on <html>.
 */
const ThemeToggle: React.FC = () => {
    const [theme, setTheme] = useState<'light' | 'dark'>('light');

    useEffect(() => {
        // Load from localStorage, or use prefers-color-scheme
        const saved = localStorage.getItem('theme');
        if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            setTheme('dark');
            document.documentElement.classList.add('dark');
        } else {
            setTheme('light');
            document.documentElement.classList.remove('dark');
        }
    }, []);

    const toggleTheme = () => {
        if (theme === 'light') {
            setTheme('dark');
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            setTheme('light');
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    };

    return (
        <button
            className="rounded-full p-2 bg-muted hover:bg-primary text-xl transition"
            onClick={toggleTheme}
            title={theme === 'light' ? "Switch to dark mode" : "Switch to light mode"}
        >
            <span className="material-icons">
                {theme === 'dark' ? 'dark_mode' : 'light_mode'}
            </span>
        </button>
    );
};

export default ThemeToggle;
