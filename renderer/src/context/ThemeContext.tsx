import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'auto';
type ThemeContextType = {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
};

export const ThemeContext = createContext<ThemeContextType>({
    theme: 'auto',
    setTheme: () => {},
    toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>('auto');

    useEffect(() => {
        // Load persisted theme on mount
        const stored = window.localStorage.getItem('theme') as Theme | null;
        if (stored) setTheme(stored);
    }, []);

    useEffect(() => {
        // Set class on <html> element for Tailwind/Dark mode
        const html = document.documentElement;
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (
            theme === 'dark' ||
            (theme === 'auto' && systemDark)
        ) {
            html.classList.add('dark');
        } else {
            html.classList.remove('dark');
        }
        window.localStorage.setItem('theme', theme);
    }, [theme]);

    // Added: Toggle between light/dark/auto (cycles if needed)
    const toggleTheme = () => {
        setTheme((curr) =>
            curr === 'light'
                ? 'dark'
                : curr === 'dark'
                    ? 'auto'
                    : 'light'
        );
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

// *** Added: The recommended custom hook ***
export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
    return ctx;
}
