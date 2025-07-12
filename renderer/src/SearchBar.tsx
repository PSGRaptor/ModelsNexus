import React from 'react';

type SearchBarProps = {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
};

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange, placeholder }) => (
    <input
        type="text"
        className="w-full p-2 mb-4 rounded bg-muted border border-border shadow-inner focus:outline-none focus:ring-2 focus:ring-primary"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'Search models...'}
        aria-label="Search models"
    />
);

export default SearchBar;
