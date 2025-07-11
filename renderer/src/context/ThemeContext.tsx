import React, { createContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark' | 'auto';
type ThemeContextType = {
    theme: Theme;
    setTheme: (theme: Theme) => void;
};

export const ThemeContext = createContext<ThemeContextType>({
    theme: 'auto',
    setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>('auto');

    useEffect(() => {
        // Example: Persist theme to local storage (can sync to settings DB)
        const stored = window.localStorage.getItem('theme') as Theme | null;
        if (stored) setTheme(stored);
    }, []);

    useEffect(() => {
        // Set class on <html> element for Tailwind/Dark mode
        const html = document.documentElement;
        if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            html.classList.add('dark');
        } else {
            html.classList.remove('dark');
        }
        window.localStorage.setItem('theme', theme);
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};
