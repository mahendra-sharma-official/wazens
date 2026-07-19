import { useState } from "react";
import { useWallet } from "../context/WalletContext.jsx";
import { signAndRelayReport } from "../lib/relay.js";
import { Notice } from "./Notice.jsx";

// Filing a report never costs the citizen anything: they sign an
// EIP-712 message (a MetaMask "signature request", no transaction, no
// gas, works with a zero balance wallet) and a local relayer submits
// it on their behalf, reimbursed by ReportingTreasury. See
// lib/relay.js and relayer/server.mjs.
export function ReportForm({ projectId, onAdded }) {
  const { signer, address, connect } = useWallet();
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!signer) {
      await connect();
      return;
    }
    setStatus("pending");
    setMessage("Waiting for your signature (no gas, no transaction)...");
    try {
      await signAndRelayReport(signer, address, projectId, comment);
      setStatus("success");
      setMessage("Report filed, gas sponsored by the reporting treasury.");
      setComment("");
      onAdded?.();
    } catch (err) {
      setStatus("error");
      setMessage(err.message || "Could not file that report.");
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
        {!address ? "Connect wallet to report" : status === "pending" ? "Signing..." : "File report (free)"}
      </button>
      <p className="hint">Reporting is free. You only sign a message, the government's reporting fund covers gas.</p>
      <Notice status={status} message={message} />
    </form>
  );
}
