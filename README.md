# Models Nexus

![Platform](https://img.shields.io/badge/platform-Windows%2011%20%7C%20Mac%20%7C%20Linux-blue)
![Build](https://img.shields.io/github/actions/workflow/status/your-org/models-nexus/ci.yml)
![License](https://img.shields.io/github/license/your-org/models-nexus)

**Cross-Platform Model Manager for AI Model Libraries**

---

## Overview

**Models Nexus** is a cross-platform desktop application (starting on Windows 11, expandable to MacOS and Linux) for managing, cataloging, and enriching local and network AI model libraries.  
It automates model file discovery, fetches live metadata from Civitai and Hugging Face, displays prompt examples and images, and allows users to annotate/tag models—all in a fast, modern UI.

---

## Features

- **Recursive folder/network scan** for model files (.safetensors, .pt, .ckpt, .lora, .gguf, and more)
- **Automatic metadata enrichment** from Civitai & Hugging Face (API keys required)
- **Sample images & prompts**: Download up to 25 preview images per model, view both image and embedded metadata
- **User notes and custom tags** stored alongside model records
- **Powerful search & filter**: By type, tags, name, hash, and more
- **Local SQLite database**: Robust, portable, easy to maintain
- **Configurable folders & themes**: Dark/light mode, easy theme swap, installer with location selection
- **Zero regression policy**: Every new feature preserves all previous functions; each code stage is fully tested
- **IntelliJ IDEA Ultimate** & GitHub-based workflow

---

## Folder Structure

```plaintext
models-nexus/
│
├── main/                 # Electron main process (Node.js)
│   ├── main.ts
│   ├── preload.ts
│   └── electron-utils/
│
├── renderer/             # React frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── views/
│   │   ├── context/
│   │   ├── themes/
│   │   └── assets/
│   └── public/
│
├── db/
│   ├── models.db
│   ├── schema.sql
│   └── db-utils.ts
│
├── api/
│   ├── civitai.ts
│   ├── huggingface.ts
│   └── api-utils.ts
│
├── images/
│   └── [model_hash]/      # Up to 25 preview images per model
│
├── config/
│   ├── user-settings.json
│   └── default-config.json
│
├── .env
├── package.json
├── electron-builder.json
├── README.md
└── LICENSE

Roadmap
Phase 1: Foundation

Repo & project structure initialized

Electron + React + TypeScript app bootstrapped

Config modal: scan path management, API key entry, theme selection

Recursive model file scanner implemented

SQLite DB schema & local storage logic

Model list/grid UI, sortable & searchable

    Basic placeholder branding and theme switching

Phase 2: API Integration & Data Enrichment

Civitai API connector (metadata, images, prompts)

Hugging Face API connector (metadata, images, prompts)

Enrichment logic: Fetch/store API data, merge into DB

Details modal: show images, triggers, usage tips, prompts

Image retention: 25-image FIFO folder per model

    Embedded image metadata reader

Phase 3: User Features & UX Polish

User notes/tag editor with DB sync

Advanced search/filter (type, tag, notes, hash)

Favorite/star models

Settings panel polish (API key mgmt, DB location, theme)

    Export/import DB and user settings

Phase 4: Packaging & Platform Expansion

Electron Forge/Squirrel packaging with installer

Install location selection and post-install run option

Platform abstraction/prep for MacOS/Linux

    Theme/branding polish, About dialog, version info

Phase 5: Pro/Advanced Features (Future)

Batch operations (tagging, rescanning, deleting)

Plugin/extension system (TBD)

    Custom themes & UI tweaks

Development/Contribution

    IDE: JetBrains IntelliJ IDEA Ultimate

    Version control: GitHub, with atomic commits, full file listings, and detailed comments

    Zero regression: Every new feature must retain all previous functionality unless specified

    Testing: Manual regression checks at each milestone (optionally expand with Jest/React Testing Library)
