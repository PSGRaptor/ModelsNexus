/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                // Custom branding (edit as desired)
                primary: '#6366f1',
                'primary-dark': '#4f46e5',
                secondary: '#10b981',
                background: '#18181b',
                foreground: '#f1f5f9',
                muted: '#27272a',
                card: '#22223b',
                border: '#393955',
            }
        }
    },
    plugins: [],
}
