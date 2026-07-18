import { useEffect, useState } from "react";
import { getReadRegistry } from "../lib/contracts.js";
import { shortAddress } from "../lib/format.js";

// Read only card used on the public Departments page. Anyone can see
// who heads a department and who its active officials are, no wallet
// needed. Management actions (adding/removing officials, creating
// departments) live in the Official Portal instead, see
// PortalDepartmentCard.jsx.
export function DepartmentCard({ department }) {
  const [expanded, setExpanded] = useState(false);
  const [officials, setOfficials] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;

    async function loadOfficials() {
      setLoading(true);
      const registry = getReadRegistry();
      const addresses = await registry.getDepartmentOfficials(department.id);
      const infos = await Promise.all(
        addresses.map(async (addr) => {
          const info = await registry.getOfficial(addr);
          return { address: addr, name: info.name, active: info.active };
        })
      );
      if (!cancelled) {
        setOfficials(infos.filter((o) => o.active));
        setLoading(false);
      }
    }

    loadOfficials();
    return () => {
      cancelled = true;
    };
  }, [expanded, department.id]);

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Department {String(department.id)}</p>
          <h3>{department.name}</h3>
          <p className="hint">
            Head: <span className="mono">{shortAddress(department.head)}</span>
          </p>
        </div>
        <button className="btn btn-outline" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Hide officials" : "View officials"}
        </button>
      </div>

      {expanded && (
        <div className="panel-body">
          {loading ? (
            <p className="empty-state">Loading officials...</p>
          ) : officials.length === 0 ? (
            <p className="empty-state">No officials registered under this department yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Address</th>
                </tr>
              </thead>
              <tbody>
                {officials.map((o) => (
                  <tr key={o.address}>
                    <td>{o.name}</td>
                    <td className="mono">{shortAddress(o.address)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </article>
  );
}
