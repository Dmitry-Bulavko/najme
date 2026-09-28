#!/bin/bash
# SessionStart hook: prepare the workspace in Claude Code on the web sessions.
# Local sessions are left alone — developers manage their own installs.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

if [ ! -f package.json ]; then
  exit 0
fi

# pnpm version comes from "packageManager" in package.json via Corepack.
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack enable pnpm >/dev/null 2>&1 || npm install -g corepack >/dev/null 2>&1 && corepack enable pnpm

# Frozen install keeps the lockfile untouched; if it is out of date on this branch, warn instead of
# failing the session start — the agent will see the error when it runs pnpm itself.
if ! pnpm install --frozen-lockfile; then
  echo "session-start: 'pnpm install --frozen-lockfile' failed (lockfile out of date?). Run 'pnpm install' and commit pnpm-lock.yaml." >&2
fi
