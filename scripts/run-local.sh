#!/usr/bin/env bash
# One command to run the whole prototype locally:
#   1. starts anvil in the background
#   2. deploys the contracts and seeds demo data
#   3. starts the frontend dev server in the foreground
#
# Press Ctrl+C to stop. Anvil is stopped automatically when this
# script exits.
set -euo pipefail
cd "$(dirname "$0")/.."

RPC_URL="http://127.0.0.1:8545"
ANVIL_LOG="$(mktemp)"

echo "==> Starting anvil in the background (log: $ANVIL_LOG)..."
anvil --port 8545 --accounts 16 > "$ANVIL_LOG" 2>&1 &
ANVIL_PID=$!

cleanup() {
  echo ""
  echo "==> Stopping anvil (pid $ANVIL_PID)..."
  kill "$ANVIL_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "==> Waiting for anvil to be ready..."
for i in $(seq 1 30); do
  if cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
    echo "Anvil is ready."
    break
  fi
  sleep 0.5
  if [ "$i" -eq 30 ]; then
    echo "Anvil did not start in time. Check $ANVIL_LOG for details."
    exit 1
  fi
done

./scripts/deploy.sh

echo ""
echo "==> Starting frontend (Ctrl+C to stop everything)..."
./scripts/dev.sh
