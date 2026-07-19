import { LEDGER_ADDRESS, CHAIN_ID, RELAYER_URL } from "./config.js";
import { getReadLedger } from "./contracts.js";

// The EIP-712 typed data structure a citizen signs to file a gasless
// report. Must match ProjectLedger.sol's REPORT_TYPEHASH exactly, or
// the signature will simply fail to recover to the signer's address
// on chain.
function buildDomain() {
  return {
    name: "GovLedger",
    version: "1",
    chainId: CHAIN_ID,
    verifyingContract: LEDGER_ADDRESS,
  };
}

const REPORT_TYPES = {
  CitizenReport: [
    { name: "reporter", type: "address" },
    { name: "projectId", type: "uint256" },
    { name: "comment", type: "string" },
    { name: "nonce", type: "uint256" },
  ],
};

/// Signs a citizen report with the connected wallet (a MetaMask
/// "signature request", not a transaction, so it costs no gas and
/// requires no ETH balance), then hands it to the local relayer, which
/// submits the actual transaction and pays its own gas, reimbursed by
/// ReportingTreasury. Returns the relayer's response ({ txHash }).
export async function signAndRelayReport(signer, reporter, projectId, comment) {
  const ledger = getReadLedger();
  const nonce = await ledger.reportNonces(reporter);

  const domain = buildDomain();
  const value = { reporter, projectId, comment, nonce };
  const signature = await signer.signTypedData(domain, REPORT_TYPES, value);

  const res = await fetch(`${RELAYER_URL}/relay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reporter, projectId, comment, signature }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || "The relayer could not submit your report.");
  }
  return body;
}

export async function checkRelayerHealth() {
  try {
    const res = await fetch(`${RELAYER_URL}/health`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
