import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getReadLedger, getReadRegistry } from "../lib/contracts.js";
import { useWallet } from "../context/WalletContext.jsx";
import { StatusStamp } from "./StatusStamp.jsx";
import { BudgetBar } from "./BudgetBar.jsx";
import { shortAddress } from "../lib/format.js";
import { CreateProjectForm } from "./CreateProjectForm.jsx";

export function PortalProjects() {
  const navigate = useNavigate();
  const { isSuperAdmin, myDepartments } = useWallet();
  const [projects, setProjects] = useState([]);
  const [departmentNames, setDepartmentNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const ledger = getReadLedger();
    const registry = getReadRegistry();

    let ids;
    if (isSuperAdmin) {
      const count = await ledger.getProjectCount();
      ids = Array.from({ length: Number(count) }, (_, i) => i + 1);
    } else {
      const idsPerDept = await Promise.all(myDepartments.map((d) => ledger.getDepartmentProjectIds(d.id)));
      ids = idsPerDept.flat().map(Number);
    }

    const items = await Promise.all(ids.map((id) => ledger.getProject(id)));
    setProjects(items);

    const deptIds = [...new Set(items.map((p) => Number(p.departmentId)))];
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
        <h2>Manage projects</h2>
        <p>Projects in the department(s) you can act for.</p>
      </div>

      <button className="btn btn-outline" onClick={() => setShowCreate((v) => !v)}>
        {showCreate ? "Close form" : "Register a new project"}
      </button>

      {showCreate && (
        <CreateProjectForm
          allowedDepartmentIds={allowedDepartmentIds}
          onCreated={() => {
            setShowCreate(false);
            setRefreshNonce((n) => n + 1);
          }}
        />
      )}

      {loading ? (
        <p className="empty-state">Loading projects...</p>
      ) : projects.length === 0 ? (
        <p className="empty-state">No projects yet in your department(s).</p>
      ) : (
        <div className="card-grid">
          {projects.map((p) => (
            <article key={String(p.id)} className="panel project-card" onClick={() => navigate(`/portal/projects/${Number(p.id)}`)}>
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
