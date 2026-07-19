import { useState } from "react";
import { parseEther } from "ethers";
import { useWallet } from "../context/WalletContext.jsx";
import { getWriteTreasury } from "../lib/contracts.js";
import { useTxRunner } from "../hooks/useTxRunner.js";
import { Notice } from "./Notice.jsx";

// Anyone signed into the Portal can top up the reporting treasury,
// not just the super admin, a department choosing to contribute part
// of its own budget toward citizen engagement is a legitimate use of
// this. The transfer itself is a plain, transparent on-chain payment.
export function FundTreasuryForm({ onFunded }) {
  const { signer } = useWallet();
  const { status, message, run } = useTxRunner();
  const [amount, setAmount] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!signer) return;
    const treasury = getWriteTreasury(signer);
    const ok = await run(() => treasury.fund({ value: parseEther(amount || "0") }), {
      successMessage: "Treasury topped up.",
    });
    if (ok) {
      setAmount("");
      onFunded?.();
    }
  }

  return (
    <form className="inline-form-tight" onSubmit={handleSubmit}>
      <label>
        Top up reporting treasury
        <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 1" inputMode="decimal" required />
      </label>
      <button className="btn btn-outline" type="submit" disabled={status === "pending"}>
        {status === "pending" ? "Sending..." : "Fund"}
      </button>
      <Notice status={status} message={message} />
    </form>
  );
}
