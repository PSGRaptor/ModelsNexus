import React, { createContext, useContext, useState, useEffect } from 'react';

export type Theme = 'light' | 'dark' | 'auto';

export interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>('auto');

    // Load persisted theme
    useEffect(() => {
        try {
            const stored = localStorage.getItem('theme') as Theme | null;
            if (stored === 'light' || stored === 'dark' || stored === 'auto') {
                setTheme(stored);
            }
        } catch {
            /* ignore */
        }
    }, []);

    // Apply theme changes
    useEffect(() => {
        const root = document.documentElement;
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        const isDark = theme === 'dark' || (theme === 'auto' && systemPrefersDark);
        root.classList.toggle('dark', isDark);
        root.classList.toggle('light', !isDark); // optional for explicit styling hooks

        try {
            localStorage.setItem('theme', theme);
        } catch {
            /* ignore */
        }
    }, [theme]);

    // Cycle theme: light → dark → auto → light...
    const toggleTheme = () => {
        setTheme((prev) =>
            prev === 'light' ? 'dark' :
                prev === 'dark' ? 'auto' :
                    'light'
        );
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

// Custom hook for convenience
export function useTheme(): ThemeContextType {
    const ctx = useContext(ThemeContext);
    if (!ctx) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return ctx;
}
