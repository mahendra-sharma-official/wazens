import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getReadTender, getReadRegistry } from "../lib/contracts.js";
import { useWallet } from "../context/WalletContext.jsx";
import { TenderStatusStamp } from "./TenderStatusStamp.jsx";
import { formatBudget, formatTimestamp } from "../lib/format.js";
import { CreateTenderForm } from "./CreateTenderForm.jsx";

export function PortalTenders() {
  const navigate = useNavigate();
  const { isSuperAdmin, myDepartments } = useWallet();
  const [tenders, setTenders] = useState([]);
  const [departmentNames, setDepartmentNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const tender = getReadTender();
    const registry = getReadRegistry();

    let ids;
    if (isSuperAdmin) {
      const count = await tender.getTenderCount();
      ids = Array.from({ length: Number(count) }, (_, i) => i + 1);
    } else {
      const idsPerDept = await Promise.all(myDepartments.map((d) => tender.getDepartmentTenderIds(d.id)));
      ids = idsPerDept.flat().map(Number);
    }

    const items = await Promise.all(ids.map((id) => tender.getTender(id)));
    setTenders(items);

    const deptIds = [...new Set(items.map((t) => Number(t.departmentId)))];
    const names = {};
    await Promise.all(
      deptIds.map(async (id) => {
        const dept = await registry.getDepartment(id);
        names[id] = dept.name;
      })
    );
    setDepartmentNames(names);
    setLoading(false);
  }, [isSuperAdmin, myDepartments]);

  useEffect(() => {
    load();
  }, [load, refreshNonce]);

  const allowedDepartmentIds = isSuperAdmin ? undefined : myDepartments.map((d) => d.id);

  return (
    <section className="page">
      <div className="page-heading">
        <h2>Manage tenders</h2>
        <p>Tenders published by the department(s) you can act for.</p>
      </div>

      <button className="btn btn-outline" onClick={() => setShowCreate((v) => !v)}>
        {showCreate ? "Close form" : "Publish a new tender"}
      </button>

      {showCreate && (
        <CreateTenderForm
          allowedDepartmentIds={allowedDepartmentIds}
          onCreated={() => {
            setShowCreate(false);
            setRefreshNonce((n) => n + 1);
          }}
        />
      )}

      {loading ? (
        <p className="empty-state">Loading tenders...</p>
      ) : tenders.length === 0 ? (
        <p className="empty-state">No tenders yet in your department(s).</p>
      ) : (
        <div className="card-grid">
          {tenders.map((t) => (
            <article
              key={String(t.id)}
              className="panel project-card"
              onClick={() => navigate(`/portal/tenders/${Number(t.id)}`)}
            >
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
