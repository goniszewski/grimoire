#!/bin/sh
chown -R grimoire:grimoire /app/data
chmod 755 /app/data
bun --bun run run-migrations && bun ./build/index.js
