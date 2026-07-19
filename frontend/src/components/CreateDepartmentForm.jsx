import { useState } from "react";
import { useWallet } from "../context/WalletContext.jsx";
import { getWriteRegistry } from "../lib/contracts.js";
import { Notice } from "./Notice.jsx";

let rowIdCounter = 0;
function newRow() {
  rowIdCounter += 1;
  return { id: rowIdCounter, name: "", address: "" };
}

// Creating a department and immediately staffing it are combined into
// one form: the super admin can register a department's first
// official(s) right away, in the same session, without needing the
// new head to log in first. Under the hood this is still just
// createDepartment followed by addOfficial calls in sequence (the
// admin is authorized for both), not a single atomic transaction, so
// progress is reported step by step.
export function CreateDepartmentForm({ onCreated }) {
  const { signer } = useWallet();
  const [name, setName] = useState("");
  const [head, setHead] = useState("");
  const [headName, setHeadName] = useState("");
  const [officials, setOfficials] = useState([newRow()]);
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  function updateOfficial(id, field, value) {
    setOfficials((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function addOfficialRow() {
    setOfficials((rows) => [...rows, newRow()]);
  }

  function removeOfficialRow(id) {
    setOfficials((rows) => rows.filter((r) => r.id !== id));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!signer) return;

    const registry = getWriteRegistry(signer);
    const validOfficials = officials.filter((o) => o.name.trim() && o.address.trim());

    setStatus("pending");
    try {
      setMessage("Creating department...");
      const tx = await registry.createDepartment(name, head, headName);
      const receipt = await tx.wait();

      // Pull the new department id out of the DepartmentCreated event
      // rather than assuming it, in case other departments were
      // created concurrently.
      const event = receipt.logs
        .map((log) => {
          try {
            return registry.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed) => parsed && parsed.name === "DepartmentCreated");
      const departmentId = event ? event.args.departmentId : null;

      for (let i = 0; i < validOfficials.length; i++) {
        const o = validOfficials[i];
        setMessage(`Adding official ${i + 1} of ${validOfficials.length} (${o.name})...`);
        const officialTx = await registry.addOfficial(o.address, o.name, departmentId);
        await officialTx.wait();
      }

      setStatus("success");
      setMessage(
        validOfficials.length > 0
          ? `Department created with ${validOfficials.length} official(s) added.`
          : "Department created."
      );
      setName("");
      setHead("");
      setHeadName("");
      setOfficials([newRow()]);
      onCreated?.();
    } catch (err) {
      setStatus("error");
      setMessage(err.reason || err.shortMessage || err.message || "Something went wrong.");
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
        Department head name
        <input value={headName} onChange={(e) => setHeadName(e.target.value)} required placeholder="Full name" />
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

      <fieldset className="official-fieldset">
        <legend>Initial officials (optional)</legend>
        <p className="hint">
          You can staff the department right now instead of waiting for the head to add officials themselves.
        </p>
        {officials.map((row) => (
          <div className="official-row" key={row.id}>
            <input
              placeholder="Official name"
              value={row.name}
              onChange={(e) => updateOfficial(row.id, "name", e.target.value)}
            />
            <input
              placeholder="0x..."
              className="mono-input"
              value={row.address}
              onChange={(e) => updateOfficial(row.id, "address", e.target.value)}
            />
            <button type="button" className="remove-row-btn" onClick={() => removeOfficialRow(row.id)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-text" onClick={addOfficialRow}>
          + Add another official
        </button>
      </fieldset>

      <button className="btn btn-primary" type="submit" disabled={status === "pending"}>
        {status === "pending" ? "Submitting..." : "Create department"}
      </button>
      <Notice status={status} message={message} />
    </form>
  );
}
