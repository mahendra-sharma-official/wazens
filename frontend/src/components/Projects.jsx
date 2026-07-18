import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getReadLedger, getReadRegistry, ProjectStatus } from "../lib/contracts.js";
import { StatusStamp } from "./StatusStamp.jsx";
import { BudgetBar } from "./BudgetBar.jsx";
import { shortAddress } from "../lib/format.js";

// Public, read-only project listing with search and filters. Anyone
// can use this without a wallet. Registering or managing projects
// happens in the Official Portal instead.
export function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [departmentNames, setDepartmentNames] = useState({});
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const ledger = getReadLedger();
    const registry = getReadRegistry();

    const [count, deptCount] = await Promise.all([ledger.getProjectCount(), registry.getDepartmentCount()]);
    const ids = Array.from({ length: Number(count) }, (_, i) => i + 1);
    const items = await Promise.all(ids.map((id) => ledger.getProject(id)));
    setProjects(items);

    const deptIds = Array.from({ length: Number(deptCount) }, (_, i) => i + 1);
    const deptItems = await Promise.all(deptIds.map((id) => registry.getDepartment(id)));
    setDepartments(deptItems);
    setDepartmentNames(Object.fromEntries(deptItems.map((d) => [Number(d.id), d.name])));

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (statusFilter !== "all" && Number(p.status) !== Number(statusFilter)) return false;
      if (departmentFilter !== "all" && Number(p.departmentId) !== Number(departmentFilter)) return false;
      if (term) {
        const haystack = `${p.name} ${p.description} ${p.responsibleOfficial}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [projects, search, statusFilter, departmentFilter]);

  return (
    <section className="page">
      <div className="page-heading">
        <h2>Projects</h2>
        <p>Every project entered into the public ledger, its budget, and who is accountable for it.</p>
      </div>

      <div className="filter-bar">
        <input
          type="search"
          placeholder="Search by name, description, or official address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {ProjectStatus.map((label, idx) => (
            <option key={label} value={idx}>
              {label}
            </option>
          ))}
        </select>
        <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={String(d.id)} value={String(d.id)}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="empty-state">Loading projects...</p>
      ) : projects.length === 0 ? (
        <p className="empty-state">No projects have been registered yet.</p>
      ) : filtered.length === 0 ? (
        <p className="empty-state">No projects match your search.</p>
      ) : (
        <div className="card-grid">
          {filtered.map((p) => (
            <article key={String(p.id)} className="panel project-card" onClick={() => navigate(`/projects/${Number(p.id)}`)}>
              <div className="panel-header">
                <div>
                  <p className="eyebrow">{departmentNames[Number(p.departmentId)] || "Department"}</p>
                  <h3>{p.name}</h3>
                  <p className="hint">
                    Responsible: <span className="mono">{shortAddress(p.responsibleOfficial)}</span>
                  </p>
                </div>
                <StatusStamp status={Number(p.status)} />
              </div>
              <BudgetBar allocated={p.allocatedBudget} spent={p.spentBudget} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
