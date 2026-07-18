import { useEffect, useState } from "react";
import { parseEther } from "ethers";
import { useWallet } from "../context/WalletContext.jsx";
import { getReadRegistry, getReadLedger, getWriteTender } from "../lib/contracts.js";
import { useTxRunner } from "../hooks/useTxRunner.js";
import { Notice } from "./Notice.jsx";

export function CreateTenderForm({ onCreated, allowedDepartmentIds }) {
  const { signer } = useWallet();
  const { status, message, run } = useTxRunner();
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({
    departmentId: "",
    relatedProjectId: "0",
    title: "",
    description: "",
    estimatedBudget: "",
    deadlineDate: "",
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

  useEffect(() => {
    async function loadProjects() {
      if (!form.departmentId) return;
      const ledger = getReadLedger();
      const ids = await ledger.getDepartmentProjectIds(form.departmentId);
      const items = await Promise.all(ids.map((id) => ledger.getProject(id)));
      setProjects(items);
    }
    loadProjects();
  }, [form.departmentId]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!signer) return;
    const tender = getWriteTender(signer);
    const deadlineUnix = Math.floor(new Date(form.deadlineDate).getTime() / 1000);
    const ok = await run(
      () =>
        tender.createTender(
          form.departmentId,
          form.relatedProjectId,
          form.title,
          form.description,
          parseEther(form.estimatedBudget || "0"),
          deadlineUnix
        ),
      { successMessage: "Tender published." }
    );
    if (ok) {
      setForm((f) => ({ ...f, title: "", description: "", estimatedBudget: "", deadlineDate: "", relatedProjectId: "0" }));
      onCreated?.();
    }
  }

  if (departments.length === 0) {
    return <p className="empty-state">Create a department first before publishing a tender.</p>;
  }

  return (
    <form className="panel form-panel" onSubmit={handleSubmit}>
      <h3>Publish a new tender</h3>
      <p className="hint">
        You need to be the head of the chosen department, or an official registered under it, for this to succeed.
      </p>

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
        Related project (optional)
        <select value={form.relatedProjectId} onChange={(e) => update("relatedProjectId", e.target.value)}>
          <option value="0">Not tied to a specific project</option>
          {projects.map((p) => (
            <option key={String(p.id)} value={String(p.id)}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Tender title
        <input value={form.title} onChange={(e) => update("title", e.target.value)} required />
      </label>

      <label>
        Description
        <textarea value={form.description} onChange={(e) => update("description", e.target.value)} required rows={3} />
      </label>

      <label>
        Estimated budget
        <input
          value={form.estimatedBudget}
          onChange={(e) => update("estimatedBudget", e.target.value)}
          required
          placeholder="e.g. 300"
          inputMode="decimal"
        />
      </label>

      <label>
        Bid submission deadline
        <input
          type="date"
          value={form.deadlineDate}
          onChange={(e) => update("deadlineDate", e.target.value)}
          required
        />
      </label>

      <button className="btn btn-primary" type="submit" disabled={status === "pending"}>
        {status === "pending" ? "Publishing..." : "Publish tender"}
      </button>
      <Notice status={status} message={message} />
    </form>
  );
}
