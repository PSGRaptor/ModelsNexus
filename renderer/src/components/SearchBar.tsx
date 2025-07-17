// renderer/src/components/SearchBar.tsx

import React from 'react';

export type SearchBarProps = {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    inputClassName?: string; // <-- Add this line
};

const SearchBar: React.FC<SearchBarProps> = ({
                                                 value,
                                                 onChange,
                                                 placeholder = 'Search...',
                                                 inputClassName = '',      // <-- Add this line
                                             }) => (
    <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={
            inputClassName ||
            "w-full p-2 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary transition"
        }
        autoComplete="off"
        spellCheck={false}
    />
);

export default SearchBar;
