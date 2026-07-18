import { useState } from "react";
import { useWallet } from "../context/WalletContext.jsx";
import { getWriteLedger } from "../lib/contracts.js";
import { useTxRunner } from "../hooks/useTxRunner.js";
import { Notice } from "./Notice.jsx";

export function MilestoneForm({ projectId, onAdded }) {
  const { signer } = useWallet();
  const { status, message, run } = useTxRunner();
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!signer) return;
    const ledger = getWriteLedger(signer);
    const targetUnix = targetDate ? Math.floor(new Date(targetDate).getTime() / 1000) : 0;
    const ok = await run(() => ledger.addMilestone(projectId, description, targetUnix), {
      successMessage: "Milestone added.",
    });
    if (ok) {
      setDescription("");
      setTargetDate("");
      onAdded?.();
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <label>
        Milestone description
        <input value={description} onChange={(e) => setDescription(e.target.value)} required />
      </label>
      <label>
        Target date
        <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
      </label>
      <button className="btn btn-secondary" type="submit" disabled={status === "pending"}>
        {status === "pending" ? "Adding..." : "Add milestone"}
      </button>
      <Notice status={status} message={message} />
    </form>
  );
}
