#!/usr/bin/env bash
# Starts the frontend dev server. Run this after scripts/deploy.sh.
set -euo pipefail
cd "$(dirname "$0")/../frontend"

if [ ! -d node_modules ]; then
  echo "==> Installing frontend dependencies (first run only)..."
  npm install
fi

echo "==> Starting frontend dev server..."
npm run dev
