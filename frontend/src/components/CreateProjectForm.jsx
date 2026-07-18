import { useEffect, useState } from "react";
import { parseEther } from "ethers";
import { useWallet } from "../context/WalletContext.jsx";
import { getReadRegistry, getWriteLedger } from "../lib/contracts.js";
import { useTxRunner } from "../hooks/useTxRunner.js";
import { Notice } from "./Notice.jsx";

export function CreateProjectForm({ onCreated, allowedDepartmentIds }) {
  const { signer } = useWallet();
  const { status, message, run } = useTxRunner();
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    departmentId: "",
    responsibleOfficial: "",
    allocatedBudget: "",
  });

  useEffect(() => {
    async function loadDepartments() {
      const registry = getReadRegistry();
      let ids;
      if (allowedDepartmentIds) {
        ids = allowedDepartmentIds;
      } else {
        const count = await registry.getDepartmentCount();
        ids = Array.from({ length: Number(count) }, (_, i) => i + 1);
      }
      const items = await Promise.all(ids.map((id) => registry.getDepartment(id)));
      setDepartments(items);
      if (items.length > 0) {
        setForm((f) => ({ ...f, departmentId: String(items[0].id) }));
      }
    }
    loadDepartments();
  }, [allowedDepartmentIds]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!signer) return;
    const ledger = getWriteLedger(signer);
    const ok = await run(
      () =>
        ledger.createProject(
          form.name,
          form.description,
          form.departmentId,
          form.responsibleOfficial,
          parseEther(form.allocatedBudget || "0")
        ),
      { successMessage: "Project created." }
    );
    if (ok) {
      setForm((f) => ({ ...f, name: "", description: "", responsibleOfficial: "", allocatedBudget: "" }));
      onCreated?.();
    }
  }

  if (departments.length === 0) {
    return <p className="empty-state">Create a department first before adding projects.</p>;
  }

  return (
    <form className="panel form-panel" onSubmit={handleSubmit}>
      <h3>Register a new project</h3>
      <p className="hint">
        You need to be the head of the chosen department, or an official registered under it, for this to succeed.
      </p>

      <label>
        Project name
        <input value={form.name} onChange={(e) => update("name", e.target.value)} required />
      </label>

      <label>
        Description
        <textarea
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          required
          rows={3}
        />
      </label>

      <label>
        Department
        <select value={form.departmentId} onChange={(e) => update("departmentId", e.target.value)}>
          {departments.map((d) => (
            <option key={String(d.id)} value={String(d.id)}>
              {d.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Responsible official address
        <input
          value={form.responsibleOfficial}
          onChange={(e) => update("responsibleOfficial", e.target.value)}
          required
          placeholder="0x..."
          className="mono-input"
        />
      </label>

      <label>
        Allocated budget
        <input
          value={form.allocatedBudget}
          onChange={(e) => update("allocatedBudget", e.target.value)}
          required
          placeholder="e.g. 1000"
          inputMode="decimal"
        />
      </label>

      <button className="btn btn-primary" type="submit" disabled={status === "pending"}>
        {status === "pending" ? "Submitting..." : "Register project"}
      </button>
      <Notice status={status} message={message} />
    </form>
  );
}
