// Runtime configuration for the dapp. Values come from frontend/.env.local,
// which the deploy script (scripts/deploy.sh) writes automatically after
// deploying the contracts to your local anvil chain. See README for how
// to point this at a different network (e.g. a public testnet) later.

export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 31337);
export const RPC_URL = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545";
export const REGISTRY_ADDRESS = import.meta.env.VITE_REGISTRY_ADDRESS || "";
export const LEDGER_ADDRESS = import.meta.env.VITE_LEDGER_ADDRESS || "";
export const TENDER_ADDRESS = import.meta.env.VITE_TENDER_ADDRESS || "";
export const NETWORK_NAME = import.meta.env.VITE_NETWORK_NAME || "GovLedger Local (Anvil)";

export const CHAIN_ID_HEX = "0x" + CHAIN_ID.toString(16);

export function configIsReady() {
  return Boolean(REGISTRY_ADDRESS && LEDGER_ADDRESS && TENDER_ADDRESS);
}
