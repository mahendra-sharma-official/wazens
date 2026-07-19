#!/usr/bin/env bash
# Deploys GovRegistry + ProjectLedger + Tender to a local anvil chain
# that is already running (see scripts/start-chain.sh), seeds it with
# a demo dataset (four departments, projects and tenders in various
# states, a few citizen reports), then syncs the ABI and contract
# addresses into the frontend. Safe to re-run: it deploys fresh
# contracts each time, which also gives you a clean demo state.
#
# The demo data is entirely derived from anvil's well known default
# test mnemonic ("test test test test test test test test test test
# test junk"), the same one anvil itself uses, so no private keys need
# to be hardcoded here. Account 0 is the super admin/deployer.
set -euo pipefail
cd "$(dirname "$0")/.."

RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
CHAIN_ID="${CHAIN_ID:-31337}"
ADMIN_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

echo "==> Checking anvil is reachable at $RPC_URL ..."
if ! cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
  echo "Could not reach anvil at $RPC_URL."
  echo "Start it first with ./scripts/start-chain.sh (in another terminal), then re-run this script."
  exit 1
fi

cd contracts

echo "==> Building contracts..."
forge build

echo "==> Deploying GovRegistry + ProjectLedger + Tender..."
PRIVATE_KEY="$ADMIN_KEY" forge script script/Deploy.s.sol \
  --rpc-url "$RPC_URL" \
  --broadcast \
  -vv

cd ..
echo "==> Writing frontend/.env.local..."
node scripts/write-env.mjs "$CHAIN_ID" "$RPC_URL"

# Read back the addresses we just wrote so SeedDemo can use them.
REGISTRY_ADDRESS=$(grep VITE_REGISTRY_ADDRESS frontend/.env.local | cut -d= -f2)
LEDGER_ADDRESS=$(grep VITE_LEDGER_ADDRESS frontend/.env.local | cut -d= -f2)
TENDER_ADDRESS=$(grep VITE_TENDER_ADDRESS frontend/.env.local | cut -d= -f2)
TREASURY_ADDRESS=$(grep VITE_TREASURY_ADDRESS frontend/.env.local | cut -d= -f2)

echo "==> Seeding demo data (four departments, projects, tenders, reports)..."
cd contracts
REGISTRY_ADDRESS="$REGISTRY_ADDRESS" \
LEDGER_ADDRESS="$LEDGER_ADDRESS" \
TENDER_ADDRESS="$TENDER_ADDRESS" \
TREASURY_ADDRESS="$TREASURY_ADDRESS" \
  forge script script/SeedDemo.s.sol \
  --rpc-url "$RPC_URL" \
  --broadcast \
  -vv
cd ..

echo "==> Syncing contract ABIs into the frontend..."
node scripts/sync-abi.mjs

echo ""
echo "Deployment complete."
echo "GovRegistry:       $REGISTRY_ADDRESS"
echo "ProjectLedger:     $LEDGER_ADDRESS"
echo "Tender:            $TENDER_ADDRESS"
echo "ReportingTreasury: $TREASURY_ADDRESS (funded with 5 test ETH for sponsoring citizen reports)"
echo ""
echo "All demo accounts come from anvil's default mnemonic. In MetaMask,"
echo "import any of the private keys anvil printed on startup:"
echo "  Account 0            Super admin"
echo "  Account 1 / 2         Infrastructure department head / official"
echo "  Account 3 / 4         Health department head / official"
echo "  Account 5 / 6         Education department head / official"
echo "  Account 7 / 8         Water Supply department head / official"
echo "  Account 9             Ordinary citizen (no role, no ETH needed to report)"
echo "  Account 10 / 11 / 12  Vendors that bid on tenders (no role)"
echo "  Account 13            Relayer (used by ./scripts/start-relayer.sh)"
echo ""
echo "Now run ./scripts/start-relayer.sh (in its own terminal) so citizen"
echo "reports can be gas-sponsored, then ./scripts/dev.sh to start the frontend."
