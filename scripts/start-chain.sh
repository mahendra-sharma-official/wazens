#!/usr/bin/env bash
# Starts a local anvil chain in the foreground. Keep this running in
# its own terminal, then use scripts/deploy.sh and scripts/dev.sh from
# another terminal. (If you just want one command to do everything,
# use scripts/run-local.sh instead.)
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Starting anvil on http://127.0.0.1:8545 (chain id 31337, 16 funded accounts)..."
echo "Leave this running. Press Ctrl+C to stop it."
exec anvil --port 8545 --accounts 16
