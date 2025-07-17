// root/renderer/src/main.tsx

import './index.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './context/ThemeContext';

const root = document.getElementById('root');
if (root) {
    createRoot(root).render(
        <ThemeProvider>
            <App />
        </ThemeProvider>
    );
}

