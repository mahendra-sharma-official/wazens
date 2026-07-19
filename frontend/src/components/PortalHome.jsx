import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext.jsx";
import { getReadLedger, getReadRegistry, getReadTender, getReadTreasury } from "../lib/contracts.js";
import { shortAddress, formatBudget } from "../lib/format.js";
import { FundTreasuryForm } from "./FundTreasuryForm.jsx";

export function PortalHome() {
  const navigate = useNavigate();
  const { address, isSuperAdmin, myDepartments } = useWallet();
  const [stats, setStats] = useState(null);
  const [treasuryBalance, setTreasuryBalance] = useState(null);
  const [treasuryRefreshNonce, setTreasuryRefreshNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadTreasury() {
      const treasury = getReadTreasury();
      const balance = await treasury.runner.provider.getBalance(await treasury.getAddress());
      if (!cancelled) setTreasuryBalance(balance);
    }
    loadTreasury();
    return () => {
      cancelled = true;
    };
  }, [treasuryRefreshNonce]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const ledger = getReadLedger();
      const registry = getReadRegistry();
      const tender = getReadTender();

      let deptIds;
      if (isSuperAdmin) {
        const count = await registry.getDepartmentCount();
        deptIds = Array.from({ length: Number(count) }, (_, i) => i + 1);
      } else {
        deptIds = myDepartments.map((d) => d.id);
      }

      const idsPerDept = await Promise.all(deptIds.map((id) => ledger.getDepartmentProjectIds(id)));
      const projectIds = idsPerDept.flat().map(Number);

      const tenderIdsPerDept = await Promise.all(deptIds.map((id) => tender.getDepartmentTenderIds(id)));
      const tenderIds = tenderIdsPerDept.flat().map(Number);

      const projects = await Promise.all(projectIds.map((id) => ledger.getProject(id)));
      const reportLists = await Promise.all(projectIds.map((id) => ledger.getReports(id)));
      const openReports = reportLists.flat().filter((r) => Number(r.status) === 0).length;

      const tenders = await Promise.all(tenderIds.map((id) => tender.getTender(id)));
      const openTenders = tenders.filter((t) => Number(t.status) === 0).length;

      if (!cancelled) {
        setStats({
          departmentCount: deptIds.length,
          projectCount: projects.length,
          openReports,
          openTenders,
        });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, myDepartments]);

  return (
    <section className="page">
      <div className="page-heading">
        <h2>Portal dashboard</h2>
        <p>
          Signed in as <span className="mono">{shortAddress(address)}</span>
          {isSuperAdmin && <span className="badge badge-role"> Super admin</span>}
        </p>
      </div>

      {!isSuperAdmin && (
        <div className="panel">
          <h3>Your roles</h3>
          {myDepartments.length === 0 ? (
            <p className="empty-state">No departmental roles found for this wallet.</p>
          ) : (
            <ul className="role-list">
              {myDepartments.map((d) => (
                <li key={d.id}>
                  <strong>{d.name}</strong> - {d.role === "head" ? "Department head" : "Official"}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="stat-grid">
        <button className="stat-card" onClick={() => navigate("/portal/projects")}>
          <p className="stat-value">{stats ? stats.projectCount : "..."}</p>
          <p className="stat-label">Projects you can manage</p>
        </button>
        <button className="stat-card" onClick={() => navigate("/portal/tenders")}>
          <p className="stat-value">{stats ? stats.openTenders : "..."}</p>
          <p className="stat-label">Open tenders</p>
        </button>
        <button className="stat-card" onClick={() => navigate("/portal/reports")}>
          <p className="stat-value">{stats ? stats.openReports : "..."}</p>
          <p className="stat-label">Open citizen reports</p>
        </button>
        {isSuperAdmin && (
          <button className="stat-card" onClick={() => navigate("/portal/departments")}>
            <p className="stat-value">{stats ? stats.departmentCount : "..."}</p>
            <p className="stat-label">Departments registered</p>
          </button>
        )}
      </div>

      <div className="portal-quick-links">
        <button className="btn btn-outline" onClick={() => navigate("/portal/projects")}>
          Manage projects
        </button>
        <button className="btn btn-outline" onClick={() => navigate("/portal/tenders")}>
          Manage tenders
        </button>
        <button className="btn btn-outline" onClick={() => navigate("/portal/reports")}>
          Review citizen reports
        </button>
        <button className="btn btn-outline" onClick={() => navigate("/portal/departments")}>
          {isSuperAdmin ? "Manage departments" : "Manage officials"}
        </button>
      </div>

      <div className="panel treasury-panel">
        <h3>Reporting treasury</h3>
        <p className="hint">
          Balance: {treasuryBalance !== null ? formatBudget(treasuryBalance) : "..."} - reimburses relayers who
          submit gas-sponsored citizen reports, so the public never pays to report a concern.
        </p>
        <FundTreasuryForm onFunded={() => setTreasuryRefreshNonce((n) => n + 1)} />
      </div>
    </section>
  );
}
