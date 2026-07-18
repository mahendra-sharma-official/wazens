import { useCallback, useEffect, useState } from "react";
import { getReadRegistry } from "../lib/contracts.js";
import { shortAddress } from "../lib/format.js";
import { AddOfficialForm } from "./AddOfficialForm.jsx";
import { DeactivateOfficialButton } from "./DeactivateOfficialButton.jsx";

// The Portal's version of a department card: same information as the
// public one, plus the ability to add or remove officials. Only ever
// rendered inside the Portal, after the sign-in gate.
export function PortalDepartmentCard({ department, canManageOfficials }) {
  const [officials, setOfficials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const registry = getReadRegistry();
    const addresses = await registry.getDepartmentOfficials(department.id);
    const infos = await Promise.all(
      addresses.map(async (addr) => {
        const info = await registry.getOfficial(addr);
        return { address: addr, name: info.name, active: info.active };
      })
    );
    setOfficials(infos.filter((o) => o.active));
    setLoading(false);
  }, [department.id]);

  useEffect(() => {
    load();
  }, [load, refreshNonce]);

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
      </div>

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
                {canManageOfficials && <th />}
              </tr>
            </thead>
            <tbody>
              {officials.map((o) => (
                <tr key={o.address}>
                  <td>{o.name}</td>
                  <td className="mono">{shortAddress(o.address)}</td>
                  {canManageOfficials && (
                    <td>
                      <DeactivateOfficialButton
                        officialAddress={o.address}
                        onDeactivated={() => setRefreshNonce((n) => n + 1)}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {canManageOfficials && (
          <AddOfficialForm departmentId={department.id} onAdded={() => setRefreshNonce((n) => n + 1)} />
        )}
      </div>
    </article>
  );
}
