#!/usr/bin/env bash
# One time setup: installs contract dependencies and frontend
# dependencies. Safe to re-run any time.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Checking for foundry (forge/anvil/cast)..."
if ! command -v forge >/dev/null 2>&1; then
  echo "forge was not found on PATH."
  echo "Install foundry first: curl -L https://foundry.paradigm.xyz | bash && foundryup"
  exit 1
fi

echo "==> Installing contract dependencies (forge-std, OpenZeppelin)..."
cd contracts
forge install --no-git foundry-rs/forge-std || true
forge install --no-git OpenZeppelin/openzeppelin-contracts || true
forge build
cd ..

echo "==> Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo ""
echo "Setup complete. Next, run ./scripts/run-local.sh"
