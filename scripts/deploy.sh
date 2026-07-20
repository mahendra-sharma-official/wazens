#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f .env ]; then
    source .env
fi

NETWORK="${1:-local}"

ANVIL_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"

case "$NETWORK" in 
    local)
        RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
        CHAIN_ID=31337
        DEPLOY_KEY="$ANVIL_KEY"
        SHOULD_SEED=true
        NETWORK_NAME="Anvil Local"
        ;;

    sepolia)
        : "${SEPOLIA_RPC_URL:?SEPOLIA_RPC_URL is not set}"
        : "${PRIVATE_KEY:?PRIVATE_KEY is not set}"

        RPC_URL="$SEPOLIA_RPC_URL"
        CHAIN_ID=11155111
        DEPLOY_KEY="$PRIVATE_KEY"
        SHOULD_SEED=false
        NETWORK_NAME="Sepolia"
        ;;

    *)
        echo "Usage: $0 [local|sepolia]"
        exit 1
        ;;
esac

echo "==> Target network: $NETWORK_NAME"

if ! cast chain-id --rpc-url "$RPC_URL" >/dev/null 2>&1; then
    echo "Could not reach network at:"
    echo "  $RPC_URL"
    exit 1
fi

cd contracts

echo "==> Building contracts..."
forge build

echo "==> Deploying contracts..."

PRIVATE_KEY="$DEPLOY_KEY" \
forge script script/Deploy.s.sol \
    --rpc-url "$RPC_URL" \
    --broadcast \
    -vv

cd ..

echo "==> Writing frontend/.env.local..."
node scripts/write-env.mjs "$CHAIN_ID" "$RPC_URL"

REGISTRY_ADDRESS=$(grep VITE_REGISTRY_ADDRESS frontend/.env.local | cut -d= -f2)
LEDGER_ADDRESS=$(grep VITE_LEDGER_ADDRESS frontend/.env.local | cut -d= -f2)
TENDER_ADDRESS=$(grep VITE_TENDER_ADDRESS frontend/.env.local | cut -d= -f2)
TREASURY_ADDRESS=$(grep VITE_TREASURY_ADDRESS frontend/.env.local | cut -d= -f2)

if [ "$SHOULD_SEED" = true ]; then
    echo "==> Seeding demo data..."

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
else
    echo "==> Skipping demo data on Sepolia."
fi

echo "==> Syncing contract ABIs..."
node scripts/sync-abi.mjs

echo
echo "========================================"
echo "Deployment complete."
echo "Network:            $NETWORK_NAME"
echo "GovRegistry:        $REGISTRY_ADDRESS"
echo "ProjectLedger:      $LEDGER_ADDRESS"
echo "Tender:             $TENDER_ADDRESS"
echo "ReportingTreasury:  $TREASURY_ADDRESS"
echo "========================================"

if [ "$NETWORK" = "local" ]; then
    echo
    echo "Run:"
    echo "  ./scripts/start-relayer.sh"
    echo "  ./scripts/dev.sh"
fi