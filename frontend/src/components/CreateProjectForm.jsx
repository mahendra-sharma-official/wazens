import { useEffect, useState } from "react";
import { parseEther } from "ethers";
import { useWallet } from "../context/WalletContext.jsx";
import { getReadRegistry, getWriteLedger } from "../lib/contracts.js";
import { useDepartmentOfficials } from "../hooks/useDepartmentOfficials.js";
import { useTxRunner } from "../hooks/useTxRunner.js";
import { Notice } from "./Notice.jsx";
import { shortAddress } from "../lib/format.js";

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

  const { entries: officialOptions, loading: officialsLoading } = useDepartmentOfficials(
    form.departmentId ? Number(form.departmentId) : undefined
  );

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

  // Whenever the available officials for the chosen department change,
  // default the selection to the first one instead of leaving it
  // pointed at an official from the previously selected department.
  useEffect(() => {
    if (officialOptions.length > 0) {
      setForm((f) => ({ ...f, responsibleOfficial: officialOptions[0].address }));
    } else {
      setForm((f) => ({ ...f, responsibleOfficial: "" }));
    }
  }, [officialOptions]);

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
      setForm((f) => ({ ...f, name: "", description: "", allocatedBudget: "" }));
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
        Responsible official
        {officialsLoading ? (
          <p className="hint">Loading officials...</p>
        ) : officialOptions.length === 0 ? (
          <p className="hint">This department has no officials yet, add one in Departments first.</p>
        ) : (
          <select value={form.responsibleOfficial} onChange={(e) => update("responsibleOfficial", e.target.value)}>
            {officialOptions.map((o) => (
              <option key={o.address} value={o.address}>
                {o.name} ({o.role === "head" ? "department head" : "official"}) - {shortAddress(o.address)}
              </option>
            ))}
          </select>
        )}
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

      <button className="btn btn-primary" type="submit" disabled={status === "pending" || officialOptions.length === 0}>
        {status === "pending" ? "Submitting..." : "Register project"}
      </button>
      <Notice status={status} message={message} />
    </form>
  );
}
