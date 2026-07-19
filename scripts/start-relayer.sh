#!/usr/bin/env bash
# Starts the local gas-relayer for citizen reports in the foreground.
# Requires ./scripts/deploy.sh to have already run (it reads
# frontend/.env.local for the treasury address). Keep this running in
# its own terminal alongside anvil and the frontend dev server, or use
# ./scripts/run-local.sh to start everything together.
set -euo pipefail
cd "$(dirname "$0")/../relayer"

if [ ! -d node_modules ]; then
  echo "==> Installing relayer dependencies (first run only)..."
  npm install
fi

echo "==> Starting relayer..."
npm start
