import { useState } from "react";
import { parseEther } from "ethers";
import { useWallet } from "../context/WalletContext.jsx";
import { getWriteTender } from "../lib/contracts.js";
import { useTxRunner } from "../hooks/useTxRunner.js";
import { Notice } from "./Notice.jsx";

// Open to any connected wallet, no registry role required, the same
// way citizen reports work. A vendor bidding on a government tender
// does not need to be a recognized official.
export function BidForm({ tenderId, onAdded }) {
  const { signer, address, connect } = useWallet();
  const { status, message, run } = useTxRunner();
  const [amount, setAmount] = useState("");
  const [proposal, setProposal] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!signer) {
      await connect();
      return;
    }
    const tender = getWriteTender(signer);
    const ok = await run(() => tender.submitBid(tenderId, parseEther(amount || "0"), proposal), {
      successMessage: "Bid submitted.",
    });
    if (ok) {
      setAmount("");
      setProposal("");
      onAdded?.();
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <label>
        Bid amount
        <input value={amount} onChange={(e) => setAmount(e.target.value)} required inputMode="decimal" placeholder="e.g. 280" />
      </label>
      <label>
        Proposal
        <textarea
          value={proposal}
          onChange={(e) => setProposal(e.target.value)}
          required
          rows={2}
          placeholder="Brief description of what you're offering, timeline, warranty, etc."
        />
      </label>
      <button className="btn btn-primary" type="submit" disabled={status === "pending"}>
        {!address ? "Connect wallet to bid" : status === "pending" ? "Submitting..." : "Submit bid"}
      </button>
      <Notice status={status} message={message} />
    </form>
  );
}
