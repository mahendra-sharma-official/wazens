import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getReadRegistry } from "../lib/contracts.js";
import { useOfficialHistory } from "../hooks/useOfficialHistory.js";
import { shortAddress, formatBudget, formatDateTime } from "../lib/format.js";

export function OfficialProfile() {
  const { address } = useParams();
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [name, setName] = useState("");
  const [addedInfo, setAddedInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const { entries, stats, loading: historyLoading } = useOfficialHistory(address);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const registry = getReadRegistry();
      const count = await registry.getDepartmentCount();
      const deptIds = Array.from({ length: Number(count) }, (_, i) => i + 1);
      const depts = await Promise.all(deptIds.map((id) => registry.getDepartment(id)));

      const foundRoles = [];
      let resolvedName = "";

      for (const d of depts) {
        if (d.head.toLowerCase() === address.toLowerCase()) {
          foundRoles.push({ role: "head", departmentName: d.name, departmentId: Number(d.id), active: true });
          resolvedName = d.headName;
        }
      }

      const info = await registry.getOfficial(address);
      if (info.addedAt > 0n) {
        const dept = depts.find((d) => Number(d.id) === Number(info.departmentId));
        foundRoles.push({
          role: "official",
          departmentName: dept ? dept.name : `Department ${info.departmentId}`,
          departmentId: Number(info.departmentId),
          active: info.active,
        });
        if (!resolvedName) resolvedName = info.name;
        setAddedInfo(info);
      }

      if (!cancelled) {
        setRoles(foundRoles);
        setName(resolvedName);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (loading) {
    return (
      <section className="page">
        <button className="btn btn-text" onClick={() => navigate("/officials")}>
          Back
        </button>
        <p className="empty-state">Loading profile...</p>
      </section>
    );
  }

  return (
    <section className="page">
      <button className="btn btn-text" onClick={() => navigate("/officials")}>
        Back to officials registry
      </button>

      <div className="case-file">
        <div className="case-file-header">
          <div>
            <p className="eyebrow">Official profile</p>
            <h2>{name || "Unregistered address"}</h2>
            <p className="mono">{address}</p>
          </div>
        </div>

        {roles.length === 0 ? (
          <p className="empty-state">This address has no roles recorded in GovRegistry.</p>
        ) : (
          <ul className="role-list">
            {roles.map((r) => (
              <li key={`${r.departmentId}-${r.role}`}>
                <strong>{r.departmentName}</strong> - {r.role === "head" ? "Department head" : "Official"}
                {!r.active && " (no longer active)"}
              </li>
            ))}
          </ul>
        )}

        {addedInfo && addedInfo.addedBy !== "0x0000000000000000000000000000000000000000" && (
          <p className="hint">
            Added by <Link to={`/officials/${addedInfo.addedBy}`} className="mono">{shortAddress(addedInfo.addedBy)}</Link>{" "}
            on {formatDateTime(addedInfo.addedAt)}
            {!addedInfo.active && addedInfo.deactivatedBy !== "0x0000000000000000000000000000000000000000" && (
              <>
                {" "}
                - removed by <Link to={`/officials/${addedInfo.deactivatedBy}`} className="mono">{shortAddress(addedInfo.deactivatedBy)}</Link>{" "}
                on {formatDateTime(addedInfo.deactivatedAt)}
              </>
            )}
          </p>
        )}
      </div>

      {stats && (
        <div className="stat-grid">
          <div className="stat-card stat-card-static">
            <p className="stat-value">{stats.projectsResponsibleFor}</p>
            <p className="stat-label">Projects responsible for</p>
          </div>
          <div className="stat-card stat-card-static">
            <p className="stat-value">{formatBudget(stats.totalSpendingRecorded)}</p>
            <p className="stat-label">Spending recorded</p>
          </div>
          <div className="stat-card stat-card-static">
            <p className="stat-value">{stats.milestonesCompleted}</p>
            <p className="stat-label">Milestones completed</p>
          </div>
          <div className="stat-card stat-card-static">
            <p className="stat-value">{stats.reportsTriaged}</p>
            <p className="stat-label">Reports triaged</p>
          </div>
          <div className="stat-card stat-card-static">
            <p className="stat-value">{stats.tendersPublished}</p>
            <p className="stat-label">Tenders published</p>
          </div>
          <div className="stat-card stat-card-static">
            <p className="stat-value">{stats.tendersWon}</p>
            <p className="stat-label">Tenders won as a bidder</p>
          </div>
        </div>
      )}

      <div className="ledger-section">
        <h3>Activity history</h3>
        {historyLoading ? (
          <p className="empty-state">Reading on-chain history...</p>
        ) : entries.length === 0 ? (
          <p className="empty-state">No on-chain activity found for this address yet.</p>
        ) : (
          <ul className="history-list">
            {entries.map((e, idx) => (
              <li key={idx} className={`history-item history-item-${e.type}`}>
                <div>
                  <p>
                    {e.label}
                    {e.projectId && (
                      <>
                        {" "}
                        - <Link to={`/projects/${e.projectId}`}>project #{e.projectId}</Link>
                      </>
                    )}
                    {e.tenderId && (
                      <>
                        {" "}
                        - <Link to={`/tenders/${e.tenderId}`}>tender #{e.tenderId}</Link>
                      </>
                    )}
                  </p>
                  <p className="hint">{e.timestamp ? formatDateTime(e.timestamp) : `Block #${e.blockNumber}`}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
