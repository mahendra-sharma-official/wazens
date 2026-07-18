import { useState } from "react";
import { useWallet } from "../context/WalletContext.jsx";
import { getWriteLedger } from "../lib/contracts.js";
import { useTxRunner } from "../hooks/useTxRunner.js";
import { Notice } from "./Notice.jsx";

// Open to any connected wallet, this is the "citizen reporting"
// feature: a comment tied on chain to a project and the reporter's
// address. No moderation or status workflow yet, that is intentionally
// left as a later extension (see README).
export function ReportForm({ projectId, onAdded }) {
  const { signer, address, connect } = useWallet();
  const { status, message, run } = useTxRunner();
  const [comment, setComment] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!signer) {
      await connect();
      return;
    }
    const ledger = getWriteLedger(signer);
    const ok = await run(() => ledger.fileCitizenReport(projectId, comment), {
      successMessage: "Report filed on chain.",
    });
    if (ok) {
      setComment("");
      onAdded?.();
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <label>
        Report a concern about this project
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          required
          rows={2}
          placeholder="e.g. This section of road still looks unfinished as of this week."
        />
      </label>
      <button className="btn btn-outline" type="submit" disabled={status === "pending"}>
        {!address ? "Connect wallet to report" : status === "pending" ? "Filing..." : "File report"}
      </button>
      <Notice status={status} message={message} />
    </form>
  );
}
