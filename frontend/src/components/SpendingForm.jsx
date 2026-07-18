import { useState } from "react";
import { parseEther } from "ethers";
import { useWallet } from "../context/WalletContext.jsx";
import { getWriteLedger } from "../lib/contracts.js";
import { useTxRunner } from "../hooks/useTxRunner.js";
import { Notice } from "./Notice.jsx";

export function SpendingForm({ projectId, onAdded }) {
  const { signer } = useWallet();
  const { status, message, run } = useTxRunner();
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [recipient, setRecipient] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!signer) return;
    const ledger = getWriteLedger(signer);
    const ok = await run(() => ledger.recordSpending(projectId, parseEther(amount || "0"), purpose, recipient), {
      successMessage: "Spending recorded.",
    });
    if (ok) {
      setAmount("");
      setPurpose("");
      setRecipient("");
      onAdded?.();
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <label>
        Amount
        <input value={amount} onChange={(e) => setAmount(e.target.value)} required inputMode="decimal" placeholder="e.g. 50" />
      </label>
      <label>
        Purpose
        <input value={purpose} onChange={(e) => setPurpose(e.target.value)} required placeholder="Cement purchase" />
      </label>
      <label>
        Recipient address
        <input
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          required
          placeholder="0x..."
          className="mono-input"
        />
      </label>
      <button className="btn btn-secondary" type="submit" disabled={status === "pending"}>
        {status === "pending" ? "Recording..." : "Record spending"}
      </button>
      <Notice status={status} message={message} />
    </form>
  );
}
