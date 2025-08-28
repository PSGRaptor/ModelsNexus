import { BUILD_DATE, COMMIT_HASH } from "../buildInfo.js";

import React, { useState } from "react";
import { Github, X } from "lucide-react";
// Import version directly from root package.json
import { version as appVersion } from "../../../package.json";

interface AboutModalProps {
    appName: string;
    logoSrc: string;
    shortDescription: string;
    longDescription: string;
    author: string;
    githubUrl: string;
}

export default function AboutModal({
                                       appName,
                                       logoSrc,
                                       shortDescription,
                                       longDescription,
                                       author,
                                       githubUrl
                                   }: AboutModalProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Safely format build date (falls back to "Unknown" if missing/invalid)
    let lastUpdateStr = "Unknown";
    try {
        if (BUILD_DATE) {
            const d = new Date(BUILD_DATE);
            if (!Number.isNaN(d.getTime())) {
                lastUpdateStr = d.toLocaleString();
            }
        }
    } catch {
        // noop – keep "Unknown"
    }

    const shortCommit = (COMMIT_HASH || "").slice(0, 7);

    return (
        <>
            {/* Trigger button styled like Settings */}
            <button
                onClick={() => setIsOpen(true)}
                className="px-4 py-2 rounded-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow focus:ring-2 focus:ring-blue-400 transition border border-blue-700"
            >
                About
            </button>

            {isOpen && (
                <div className="fixed inset-0 flex items-center justify-center z-50">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black bg-opacity-50"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Modal container */}
                    <div className="relative bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg shadow-lg max-w-lg w-full mx-4 p-6">
                        {/* Close button */}
                        <button
                            onClick={() => setIsOpen(false)}
                            className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                        >
                            <X size={20} />
                        </button>

                        {/* Header */}
                        <div className="flex items-center space-x-4 mb-4">
                            <img
                                src={logoSrc}
                                alt={`${appName} logo`}
                                className="h-[120px] w-[120px] shadow"
                            />
                            <h2 className="text-2xl font-semibold">{appName}</h2>
                        </div>

                        {/* Short description */}
                        <p className="mb-4 text-gray-700 dark:text-gray-300">{shortDescription}</p>

                        {/* Long description */}
                        <textarea
                            readOnly
                            value={longDescription}
                            className="w-full h-32 p-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 resize-none mb-4"
                        />

                        {/* Info block */}
                        <div className="space-y-1 text-sm mb-4">
                            <p><strong>Author:</strong> {author}</p>
                            <p><strong>Last Update:</strong> {lastUpdateStr}</p>
                            <p><strong>Version:</strong> {appVersion}</p>
                            {shortCommit && <p><strong>Commit:</strong> {shortCommit}</p>}
                        </div>

                        {/* GitHub link */}
                        <div className="text-right">
                            <a
                                href={githubUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center space-x-1 px-3 py-1 border border-gray-400 dark:border-gray-600 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                            >
                                <Github size={16} />
                                <span>GitHub</span>
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
