#!/usr/bin/env bash
set -euo pipefail

echo "Installing pnpm@10.26.1 via corepack..."
corepack enable
corepack prepare pnpm@10.26.1 --activate
echo "pnpm version: $(pnpm --version)"
