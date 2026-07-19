#!/usr/bin/env node
// Copies the compiled ABI for each contract out of contracts/out into
// frontend/src/lib/generated, so the frontend always matches whatever
// is currently built. Run automatically by scripts/deploy.sh.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const contracts = [
  { name: "GovRegistry", outFile: "GovRegistry.sol/GovRegistry.json", genFile: "GovRegistryAbi.json" },
  { name: "ProjectLedger", outFile: "ProjectLedger.sol/ProjectLedger.json", genFile: "ProjectLedgerAbi.json" },
  { name: "Tender", outFile: "Tender.sol/Tender.json", genFile: "TenderAbi.json" },
  { name: "ReportingTreasury", outFile: "ReportingTreasury.sol/ReportingTreasury.json", genFile: "ReportingTreasuryAbi.json" },
];

for (const c of contracts) {
  const artifactPath = path.join(rootDir, "contracts", "out", c.outFile);
  if (!existsSync(artifactPath)) {
    console.error(`Could not find build artifact for ${c.name} at ${artifactPath}. Run forge build first.`);
    process.exit(1);
  }
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  const destPath = path.join(rootDir, "frontend", "src", "lib", "generated", c.genFile);
  writeFileSync(destPath, JSON.stringify(artifact.abi, null, 2));
  console.log(`Synced ABI for ${c.name} -> frontend/src/lib/generated/${c.genFile}`);
}
