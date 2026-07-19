import { Contract, JsonRpcProvider } from "ethers";
import { REGISTRY_ADDRESS, LEDGER_ADDRESS, TENDER_ADDRESS, TREASURY_ADDRESS, RPC_URL } from "./config.js";
import GovRegistryAbi from "./generated/GovRegistryAbi.json";
import ProjectLedgerAbi from "./generated/ProjectLedgerAbi.json";
import TenderAbi from "./generated/TenderAbi.json";
import ReportingTreasuryAbi from "./generated/ReportingTreasuryAbi.json";

// A read only provider that talks directly to the local chain's RPC.
// Used for all "everyone can view the ledger" reads, so the site works
// even for visitors who have not connected a wallet at all.
let _readProvider = null;
export function getReadProvider() {
  if (!_readProvider) {
    _readProvider = new JsonRpcProvider(RPC_URL);
  }
  return _readProvider;
}

export function getReadRegistry() {
  return new Contract(REGISTRY_ADDRESS, GovRegistryAbi, getReadProvider());
}

export function getReadLedger() {
  return new Contract(LEDGER_ADDRESS, ProjectLedgerAbi, getReadProvider());
}

export function getReadTender() {
  return new Contract(TENDER_ADDRESS, TenderAbi, getReadProvider());
}

export function getReadTreasury() {
  return new Contract(TREASURY_ADDRESS, ReportingTreasuryAbi, getReadProvider());
}

// Writable instances, connected to the signer of whichever account is
// active in MetaMask. Only used once a wallet is connected.
export function getWriteRegistry(signer) {
  return new Contract(REGISTRY_ADDRESS, GovRegistryAbi, signer);
}

export function getWriteLedger(signer) {
  return new Contract(LEDGER_ADDRESS, ProjectLedgerAbi, signer);
}

export function getWriteTender(signer) {
  return new Contract(TENDER_ADDRESS, TenderAbi, signer);
}

export function getWriteTreasury(signer) {
  return new Contract(TREASURY_ADDRESS, ReportingTreasuryAbi, signer);
}

export const ProjectStatus = ["Planned", "Ongoing", "Completed", "Cancelled"];
export const TenderStatus = ["Open", "Closed", "Awarded", "Cancelled"];
