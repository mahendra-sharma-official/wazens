#!/usr/bin/env node
// A small local relayer for gas-sponsored citizen reports.
//
// A citizen signs an EIP-712 "CitizenReport" message in their wallet
// (free, no transaction). The frontend posts that signature here.
// This process holds its own funded account (derived from anvil's
// default mnemonic, the same as every other demo account in this
// project) and submits the actual transaction to ReportingTreasury,
// which reimburses this account's gas cost out of its own balance.
// The citizen's wallet never needs any ETH at all.
//
// This is a prototype-grade relayer: single process, one relayer key,
// no request queue, no rate limiting. A real deployment would run
// several relayers behind a queue and rate-limit by IP/address, but
// the on-chain trust model (a signature authenticates the reporter,
// not who submits it) does not change.
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Contract, JsonRpcProvider, Wallet, HDNodeWallet } from "ethers";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envPath = path.join(rootDir, "frontend", ".env.local");
const abiPath = path.join(rootDir, "frontend", "src", "lib", "generated", "ReportingTreasuryAbi.json");

if (!existsSync(envPath) || !existsSync(abiPath)) {
  console.error("Could not find frontend/.env.local or the ReportingTreasury ABI.");
  console.error("Run ./scripts/deploy.sh first, then start the relayer.");
  process.exit(1);
}

const envContent = readFileSync(envPath, "utf8");
function envValue(key) {
  const match = envContent.match(new RegExp(`${key}=(.*)`));
  if (!match) throw new Error(`Missing ${key} in frontend/.env.local`);
  return match[1].trim();
}

const RPC_URL = envValue("VITE_RPC_URL");
const TREASURY_ADDRESS = envValue("VITE_TREASURY_ADDRESS");
const PORT = process.env.RELAYER_PORT || 8787;

// Anvil's default test mnemonic, account index 13: the "relayer"
// account, distinct from every department head/official/citizen/vendor
// demo account (indices 0-12), all derived from the same well known
// local test mnemonic.
const MNEMONIC = "test test test test test test test test test test test junk";
const relayerWallet = HDNodeWallet.fromPhrase(MNEMONIC, undefined, "m/44'/60'/0'/0/13");

const provider = new JsonRpcProvider(RPC_URL);
const signer = new Wallet(relayerWallet.privateKey, provider);
const treasuryAbi = JSON.parse(readFileSync(abiPath, "utf8"));
const treasury = new Contract(TREASURY_ADDRESS, treasuryAbi, signer);

function withCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, status, body) {
  withCors(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    withCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    const balance = await provider.getBalance(TREASURY_ADDRESS);
    sendJson(res, 200, {
      status: "ok",
      relayerAddress: signer.address,
      relayerBalance: (await provider.getBalance(signer.address)).toString(),
      treasuryAddress: TREASURY_ADDRESS,
      treasuryBalance: balance.toString(),
    });
    return;
  }

  if (req.method === "POST" && req.url === "/relay") {
    try {
      const body = JSON.parse(await readBody(req));
      const { reporter, projectId, comment, signature } = body;
      if (!reporter || projectId === undefined || !comment || !signature) {
        sendJson(res, 400, { error: "Missing reporter, projectId, comment, or signature." });
        return;
      }

      console.log(`Relaying report from ${reporter} on project ${projectId}...`);
      // Automatic gas estimation can under-estimate this call: the
      // refund amount is computed from gasleft() mid-execution, which
      // some estimators (including anvil's) don't always converge on
      // correctly via binary search. A fixed generous limit sidesteps
      // that; actual usage is well under this in practice.
      const tx = await treasury.sponsorReport(reporter, projectId, comment, signature, { gasLimit: 400000 });
      const receipt = await tx.wait();

      sendJson(res, 200, {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      });
    } catch (err) {
      console.error("Relay failed:", err.shortMessage || err.reason || err.message);
      sendJson(res, 400, { error: err.shortMessage || err.reason || err.message || "Relay failed." });
    }
    return;
  }

  sendJson(res, 404, { error: "Not found. POST to /relay or GET /health." });
});

server.listen(PORT, () => {
  console.log(`GovLedger relayer listening on http://localhost:${PORT}`);
  console.log(`Relayer account: ${signer.address}`);
  console.log(`Treasury contract: ${TREASURY_ADDRESS}`);
});
