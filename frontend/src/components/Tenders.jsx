import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getReadTender, getReadRegistry, TenderStatus } from "../lib/contracts.js";
import { TenderStatusStamp } from "./TenderStatusStamp.jsx";
import { formatBudget, formatTimestamp } from "../lib/format.js";

// Public, read-only tender listing. Anyone, including a prospective
// vendor with no prior relationship to the government, can browse
// open tenders here and see exactly how past ones were awarded.
export function Tenders() {
  const navigate = useNavigate();
  const [tenders, setTenders] = useState([]);
  const [departmentNames, setDepartmentNames] = useState({});
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    const tender = getReadTender();
    const registry = getReadRegistry();

    const [count, deptCount] = await Promise.all([tender.getTenderCount(), registry.getDepartmentCount()]);
    const ids = Array.from({ length: Number(count) }, (_, i) => i + 1);
    const items = await Promise.all(ids.map((id) => tender.getTender(id)));
    setTenders(items);

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
    return tenders.filter((t) => {
      if (statusFilter !== "all" && Number(t.status) !== Number(statusFilter)) return false;
      if (departmentFilter !== "all" && Number(t.departmentId) !== Number(departmentFilter)) return false;
      if (term) {
        const haystack = `${t.title} ${t.description}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [tenders, search, statusFilter, departmentFilter]);

  return (
    <section className="page">
      <div className="page-heading">
        <h2>Tenders</h2>
        <p>Every government tender, who bid on it, and who it was awarded to.</p>
      </div>

      <div className="filter-bar">
        <input
          type="search"
          placeholder="Search by title or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {TenderStatus.map((label, idx) => (
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
        <p className="empty-state">Loading tenders...</p>
      ) : tenders.length === 0 ? (
        <p className="empty-state">No tenders have been published yet.</p>
      ) : filtered.length === 0 ? (
        <p className="empty-state">No tenders match your search.</p>
      ) : (
        <div className="card-grid">
          {filtered.map((t) => (
            <article key={String(t.id)} className="panel project-card" onClick={() => navigate(`/tenders/${Number(t.id)}`)}>
              <div className="panel-header">
                <div>
                  <p className="eyebrow">{departmentNames[Number(t.departmentId)] || "Department"}</p>
                  <h3>{t.title}</h3>
                </div>
                <TenderStatusStamp status={Number(t.status)} />
              </div>
              <p className="hint">{formatBudget(t.estimatedBudget)} estimated</p>
              <div className="tender-card-meta">
                <span>Deadline: {formatTimestamp(t.submissionDeadline)}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
