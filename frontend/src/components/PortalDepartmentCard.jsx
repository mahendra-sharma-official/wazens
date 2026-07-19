import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getReadRegistry } from "../lib/contracts.js";
import { shortAddress, formatDateTime } from "../lib/format.js";
import { AddOfficialForm } from "./AddOfficialForm.jsx";
import { DeactivateOfficialButton } from "./DeactivateOfficialButton.jsx";

// The Portal's version of a department card: same information as the
// public one, plus the ability to add or remove officials, and who
// added each one and when, so a manually entered address always has
// an accountable source. Only ever rendered inside the Portal, after
// the sign-in gate.
export function PortalDepartmentCard({ department, canManageOfficials }) {
  const [officials, setOfficials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const registry = getReadRegistry();
    const addresses = await registry.getDepartmentOfficials(department.id);
    const infos = await Promise.all(addresses.map((addr) => registry.getOfficial(addr)));
    setOfficials(addresses.map((addr, i) => ({ address: addr, ...infos[i] })));
    setLoading(false);
  }, [department.id]);

  useEffect(() => {
    load();
  }, [load, refreshNonce]);

  const activeOfficials = officials.filter((o) => o.active);
  const formerOfficials = officials.filter((o) => !o.active);

  return (
    <article className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Department {String(department.id)}</p>
          <h3>{department.name}</h3>
          <p className="hint">
            Head:{" "}
            <Link to={`/officials/${department.head}`}>{department.headName || shortAddress(department.head)}</Link>
          </p>
        </div>
      </div>

      <div className="panel-body">
        {loading ? (
          <p className="empty-state">Loading officials...</p>
        ) : activeOfficials.length === 0 ? (
          <p className="empty-state">No officials registered under this department yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Address</th>
                <th>Added by</th>
                {canManageOfficials && <th />}
              </tr>
            </thead>
            <tbody>
              {activeOfficials.map((o) => (
                <tr key={o.address}>
                  <td>
                    <Link to={`/officials/${o.address}`}>{o.name}</Link>
                  </td>
                  <td className="mono">{shortAddress(o.address)}</td>
                  <td className="hint">
                    <Link to={`/officials/${o.addedBy}`} className="mono">
                      {shortAddress(o.addedBy)}
                    </Link>{" "}
                    on {formatDateTime(o.addedAt)}
                  </td>
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

        {formerOfficials.length > 0 && (
          <details className="former-officials">
            <summary>{formerOfficials.length} former official(s)</summary>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Address</th>
                  <th>Removed by</th>
                </tr>
              </thead>
              <tbody>
                {formerOfficials.map((o) => (
                  <tr key={o.address}>
                    <td>{o.name}</td>
                    <td className="mono">{shortAddress(o.address)}</td>
                    <td className="hint">
                      <Link to={`/officials/${o.deactivatedBy}`} className="mono">
                        {shortAddress(o.deactivatedBy)}
                      </Link>{" "}
                      on {formatDateTime(o.deactivatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}

        {canManageOfficials && (
          <AddOfficialForm departmentId={department.id} onAdded={() => setRefreshNonce((n) => n + 1)} />
        )}
      </div>
    </article>
  );
}
