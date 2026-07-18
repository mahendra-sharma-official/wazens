import { useState } from "react";
import { useWallet } from "../context/WalletContext.jsx";
import { getWriteRegistry } from "../lib/contracts.js";
import { useTxRunner } from "../hooks/useTxRunner.js";
import { Notice } from "./Notice.jsx";

export function CreateDepartmentForm({ onCreated }) {
  const { signer } = useWallet();
  const { status, message, run, reset } = useTxRunner();
  const [name, setName] = useState("");
  const [head, setHead] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!signer) return;
    const registry = getWriteRegistry(signer);
    const ok = await run(() => registry.createDepartment(name, head), {
      successMessage: "Department created.",
    });
    if (ok) {
      setName("");
      setHead("");
      onCreated?.();
    }
  }

  return (
    <form className="panel form-panel" onSubmit={handleSubmit}>
      <h3>Create department</h3>
      <p className="hint">Only the super admin account can do this.</p>

      <label>
        Department name
        <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ministry of Health" />
      </label>

      <label>
        Department head address
        <input
          value={head}
          onChange={(e) => setHead(e.target.value)}
          required
          placeholder="0x..."
          className="mono-input"
        />
      </label>

      <button className="btn btn-primary" type="submit" disabled={status === "pending"}>
        {status === "pending" ? "Submitting..." : "Create department"}
      </button>
      <Notice status={status} message={message} />
      {status === "success" && (
        <button type="button" className="btn btn-text" onClick={reset}>
          Create another
        </button>
      )}
    </form>
  );
}
