#!/usr/bin/env bash
set -euo pipefail

echo "=== eas-build-pre-install hook starting ==="
echo "Node version: $(node --version)"
echo "Initial pnpm version: $(pnpm --version 2>/dev/null || echo 'not installed')"

# Install pnpm 10.26.1 globally via npm (bypasses corepack entirely)
echo "Installing pnpm@10.26.1 via npm..."
npm install -g pnpm@10.26.1 --force

echo "Final pnpm version: $(pnpm --version)"
echo "pnpm location: $(which pnpm)"
echo "=== eas-build-pre-install hook done ==="
