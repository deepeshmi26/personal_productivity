#!/usr/bin/env bash
# EAS pre-install hook (works whether invoked from root or app dir).
set -euo pipefail
echo "=== EAS pre-install hook ==="
echo "Node: $(node --version)"
echo "Initial pnpm: $(pnpm --version 2>/dev/null || echo none)"
npm install -g pnpm@10.26.1 --force
echo "Final pnpm: $(pnpm --version)"
echo "pnpm path: $(which pnpm)"
