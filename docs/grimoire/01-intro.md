# Introduction

Grimoire is a local-first bookmark manager. Save links, extract readable content, organize with tags and categories, and find things later with keyword or meaning-based search. Your library stays on your machine.

It is a full rewrite of the old 0.x app. Same idea — private bookmark library — with a new local daemon and UI. There is no multi-user signup and no published browser-store extension yet.

## What you get

- Save public `http` / `https` links from the app, import, API, MCP, or a browser bookmarklet
- Extract readable text from normal pages, plus PDFs, GitHub repos and issues, Stack Overflow, and YouTube where available
- Tags and nested categories (up to three levels)
- Personal notes, pin, read / unread, read later, archive, and trash
- Keyword search always; semantic and hybrid search when embeddings are configured
- Optional AI summaries, tags, and categories (OpenAI, Ollama, Anthropic, OpenRouter, DeepSeek, or a custom OpenAI-compatible endpoint)
- Import browser bookmarks (HTML); export JSON or CSV
- Local backups, restore, and diagnostics
- Single user, loopback by default (`127.0.0.1:3210`)

AI providers are optional. Core save, organize, keyword search, import/export, and backup work without them.

## Start here

1. [Quick start](./02-quick-start.md) — Docker
2. [Using Grimoire](./03-using-grimoire.md) — day-to-day features
3. [Install without Docker](./05-install-without-docker.md) — native macOS/Linux

Also: [Development](./04-development.md) · [Remote access](./06-remote-access.md) · [FAQ](./faq.md)
