#!/usr/bin/env node
// Reads the addresses forge just deployed (from the broadcast log) and
// writes them into frontend/.env.local so Vite picks them up. Run
// automatically by scripts/deploy.sh after a successful deployment.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const chainId = process.argv[2] || "31337";
const rpcUrl = process.argv[3] || "http://127.0.0.1:8545";

const broadcastPath = path.join(rootDir, "contracts", "broadcast", "Deploy.s.sol", chainId, "run-latest.json");
const broadcast = JSON.parse(readFileSync(broadcastPath, "utf8"));

const byName = {};
for (const tx of broadcast.transactions) {
  if (tx.transactionType === "CREATE" && tx.contractName) {
    byName[tx.contractName] = tx.contractAddress;
  }
}

if (!byName.GovRegistry || !byName.ProjectLedger || !byName.Tender) {
  console.error("Could not find GovRegistry / ProjectLedger / Tender addresses in the broadcast log.");
  process.exit(1);
}

const envContent = `# Generated automatically by scripts/deploy.sh - do not edit by hand.
VITE_CHAIN_ID=${chainId}
VITE_RPC_URL=${rpcUrl}
VITE_NETWORK_NAME=GovLedger Local (Anvil)
VITE_REGISTRY_ADDRESS=${byName.GovRegistry}
VITE_LEDGER_ADDRESS=${byName.ProjectLedger}
VITE_TENDER_ADDRESS=${byName.Tender}
`;

writeFileSync(path.join(rootDir, "frontend", ".env.local"), envContent);
console.log("Wrote frontend/.env.local:");
console.log(envContent);
