import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getReadLedger, getReadRegistry, ProjectStatus } from "../lib/contracts.js";
import { formatBudget } from "../lib/format.js";
import { StatusStamp } from "./StatusStamp.jsx";
import { BudgetBar } from "./BudgetBar.jsx";

export function Home() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [recentProjects, setRecentProjects] = useState([]);
  const [departmentNames, setDepartmentNames] = useState({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const ledger = getReadLedger();
      const registry = getReadRegistry();

      const [deptCount, projCount] = await Promise.all([registry.getDepartmentCount(), ledger.getProjectCount()]);
      const projectIds = Array.from({ length: Number(projCount) }, (_, i) => i + 1);
      const projects = await Promise.all(projectIds.map((id) => ledger.getProject(id)));

      let allocatedTotal = 0n;
      let spentTotal = 0n;
      const byStatus = [0, 0, 0, 0];
      for (const p of projects) {
        allocatedTotal += p.allocatedBudget;
        spentTotal += p.spentBudget;
        byStatus[Number(p.status)] += 1;
      }

      const deptIds = [...new Set(projects.map((p) => Number(p.departmentId)))];
      const names = {};
      await Promise.all(
        deptIds.map(async (id) => {
          const dept = await registry.getDepartment(id);
          names[id] = dept.name;
        })
      );

      if (!cancelled) {
        setStats({
          departmentCount: Number(deptCount),
          projectCount: Number(projCount),
          allocatedTotal,
          spentTotal,
          byStatus,
        });
        setDepartmentNames(names);
        setRecentProjects(projects.slice(-3).reverse());
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="page">
      <div className="hero">
        <h1>A public ledger for government activity</h1>
        <p>
          Every project, its budget, its milestones, its tenders, and who is responsible for it, recorded on chain
          and open for anyone to inspect.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={() => navigate("/projects")}>
            Browse projects
          </button>
          <button className="btn btn-outline" onClick={() => navigate("/tenders")}>
            View tenders
          </button>
          <button className="btn btn-outline" onClick={() => navigate("/departments")}>
            View departments
          </button>
        </div>
      </div>

      {stats && (
        <div className="stat-grid">
          <div className="stat-card stat-card-static">
            <p className="stat-value">{stats.departmentCount}</p>
            <p className="stat-label">Departments</p>
          </div>
          <div className="stat-card stat-card-static">
            <p className="stat-value">{stats.projectCount}</p>
            <p className="stat-label">Projects</p>
          </div>
          <div className="stat-card stat-card-static">
            <p className="stat-value">{formatBudget(stats.allocatedTotal)}</p>
            <p className="stat-label">Total allocated</p>
          </div>
          <div className="stat-card stat-card-static">
            <p className="stat-value">{formatBudget(stats.spentTotal)}</p>
            <p className="stat-label">Total spent</p>
          </div>
        </div>
      )}

      {stats && stats.projectCount > 0 && (
        <div className="status-breakdown">
          {ProjectStatus.map((label, idx) => (
            <span key={label} className="status-chip">
              {label}: {stats.byStatus[idx]}
            </span>
          ))}
        </div>
      )}

      {recentProjects.length > 0 && (
        <div className="ledger-section">
          <h3>Recently registered</h3>
          <div className="card-grid">
            {recentProjects.map((p) => (
              <article
                key={String(p.id)}
                className="panel project-card"
                onClick={() => navigate(`/projects/${Number(p.id)}`)}
              >
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">{departmentNames[Number(p.departmentId)] || "Department"}</p>
                    <h3>{p.name}</h3>
                  </div>
                  <StatusStamp status={Number(p.status)} />
                </div>
                <BudgetBar allocated={p.allocatedBudget} spent={p.spentBudget} />
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
