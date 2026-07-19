import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getReadRegistry } from "../lib/contracts.js";
import { shortAddress } from "../lib/format.js";

// The public officials registry: every department head and every
// official ever registered, active or not, across every department.
// This is the shared source of truth dropdown selectors elsewhere in
// the app pull from (see useDepartmentOfficials), surfaced here as
// its own browsable, searchable directory.
export function Officials() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const registry = getReadRegistry();
    const count = await registry.getDepartmentCount();
    const deptIds = Array.from({ length: Number(count) }, (_, i) => i + 1);
    const depts = await Promise.all(deptIds.map((id) => registry.getDepartment(id)));

    const heads = depts.map((d) => ({
      address: d.head,
      name: d.headName,
      role: "head",
      departmentName: d.name,
      departmentId: Number(d.id),
      active: true,
    }));

    const officialLists = await Promise.all(
      depts.map(async (d) => {
        const addresses = await registry.getDepartmentOfficials(d.id);
        const infos = await Promise.all(addresses.map((a) => registry.getOfficial(a)));
        return addresses.map((addr, i) => ({
          address: addr,
          name: infos[i].name,
          role: "official",
          departmentName: d.name,
          departmentId: Number(d.id),
          active: infos[i].active,
        }));
      })
    );

    setRows([...heads, ...officialLists.flat()]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!showInactive && !r.active) return false;
      if (term) {
        const haystack = `${r.name} ${r.address} ${r.departmentName}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [rows, search, showInactive]);

  return (
    <section className="page">
      <div className="page-heading">
        <h2>Officials registry</h2>
        <p>Every department head and official recognized on chain, with a public profile and activity history each.</p>
      </div>

      <div className="filter-bar">
        <input
          type="search"
          placeholder="Search by name, address, or department..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <label className="checkbox-label">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Include former officials
        </label>
      </div>

      {loading ? (
        <p className="empty-state">Loading officials...</p>
      ) : filtered.length === 0 ? (
        <p className="empty-state">No officials match your search.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Department</th>
              <th>Address</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={`${r.address}-${r.departmentId}-${r.role}`} className="row-clickable" onClick={() => navigate(`/officials/${r.address}`)}>
                <td>{r.name}</td>
                <td>{r.role === "head" ? "Department head" : "Official"}</td>
                <td>{r.departmentName}</td>
                <td className="mono">{shortAddress(r.address)}</td>
                <td>{r.active ? <span className="report-status report-status-2">ACTIVE</span> : <span className="report-status report-status-3">FORMER</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
