import { useState } from "react";
import { useWallet } from "../context/WalletContext.jsx";
import { getWriteRegistry } from "../lib/contracts.js";
import { useTxRunner } from "../hooks/useTxRunner.js";
import { Notice } from "./Notice.jsx";

export function AddOfficialForm({ departmentId, onAdded }) {
  const { signer } = useWallet();
  const { status, message, run } = useTxRunner();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!signer) return;
    const registry = getWriteRegistry(signer);
    const ok = await run(() => registry.addOfficial(address, name, departmentId), {
      successMessage: "Official added.",
    });
    if (ok) {
      setName("");
      setAddress("");
      onAdded?.();
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Full name" />
      </label>
      <label>
        Wallet address
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
          placeholder="0x..."
          className="mono-input"
        />
      </label>
      <button className="btn btn-secondary" type="submit" disabled={status === "pending"}>
        {status === "pending" ? "Adding..." : "Add official"}
      </button>
      <Notice status={status} message={message} />
    </form>
  );
}
