import React from 'react';

/**
 * Spinner loading indicator, centered by default.
 */
const Spinner: React.FC = () => (
    <div className="flex justify-center items-center min-h-[200px]">
        <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <span className="ml-4 text-primary text-lg">Loading...</span>
    </div>
);

export default Spinner;
