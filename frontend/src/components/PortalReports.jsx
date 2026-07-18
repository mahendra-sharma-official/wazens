import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getReadLedger, getReadRegistry } from "../lib/contracts.js";
import { useWallet } from "../context/WalletContext.jsx";
import { shortAddress, formatDateTime } from "../lib/format.js";
import { ReportStatusControl, REPORT_STATUS_LABELS } from "./ReportStatusControl.jsx";

export function PortalReports() {
  const navigate = useNavigate();
  const { isSuperAdmin, myDepartments } = useWallet();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("open"); // open | all
  const [refreshNonce, setRefreshNonce] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const ledger = getReadLedger();
    const registry = getReadRegistry();

    let projectIds;
    if (isSuperAdmin) {
      const count = await ledger.getProjectCount();
      projectIds = Array.from({ length: Number(count) }, (_, i) => i + 1);
    } else {
      const idsPerDept = await Promise.all(myDepartments.map((d) => ledger.getDepartmentProjectIds(d.id)));
      projectIds = idsPerDept.flat().map(Number);
    }

    const projects = await Promise.all(projectIds.map((id) => ledger.getProject(id)));
    const projectById = Object.fromEntries(projects.map((p) => [Number(p.id), p]));

    const deptIds = [...new Set(projects.map((p) => Number(p.departmentId)))];
    const deptNames = {};
    await Promise.all(
      deptIds.map(async (id) => {
        const dept = await registry.getDepartment(id);
        deptNames[id] = dept.name;
      })
    );

    const reportLists = await Promise.all(projectIds.map((id) => ledger.getReports(id)));
    const flat = [];
    reportLists.forEach((list, i) => {
      const projectId = projectIds[i];
      list.forEach((r, reportIndex) => {
        flat.push({
          projectId,
          projectName: projectById[projectId]?.name,
          departmentName: deptNames[Number(projectById[projectId]?.departmentId)],
          reportIndex,
          reporter: r.reporter,
          comment: r.comment,
          timestamp: Number(r.timestamp),
          status: Number(r.status),
        });
      });
    });

    flat.sort((a, b) => b.timestamp - a.timestamp);
    setRows(flat);
    setLoading(false);
  }, [isSuperAdmin, myDepartments]);

  useEffect(() => {
    load();
  }, [load, refreshNonce]);

  const visibleRows = filter === "open" ? rows.filter((r) => r.status === 0 || r.status === 1) : rows;

  return (
    <section className="page">
      <div className="page-heading">
        <h2>Citizen reports</h2>
        <p>Reports filed against projects in your department(s), oldest triage first.</p>
      </div>

      <div className="filter-row">
        <label>
          <input type="radio" name="filter" checked={filter === "open"} onChange={() => setFilter("open")} />
          Open and under review
        </label>
        <label>
          <input type="radio" name="filter" checked={filter === "all"} onChange={() => setFilter("all")} />
          All reports
        </label>
      </div>

      {loading ? (
        <p className="empty-state">Loading reports...</p>
      ) : visibleRows.length === 0 ? (
        <p className="empty-state">Nothing to review right now.</p>
      ) : (
        <ul className="report-list">
          {visibleRows.map((r) => (
            <li key={`${r.projectId}-${r.reportIndex}`}>
              <div className="report-list-row">
                <div>
                  <p className="eyebrow">
                    {r.departmentName} -{" "}
                    <button className="btn-text-inline" onClick={() => navigate(`/portal/projects/${r.projectId}`)}>
                      {r.projectName}
                    </button>
                  </p>
                  <p>{r.comment}</p>
                  <p className="hint">
                    {shortAddress(r.reporter)} - {formatDateTime(r.timestamp)}
                    {" - "}
                    <span className={`report-status report-status-${r.status}`}>{REPORT_STATUS_LABELS[r.status]}</span>
                  </p>
                </div>
                <ReportStatusControl
                  projectId={r.projectId}
                  reportIndex={r.reportIndex}
                  currentStatus={r.status}
                  onChanged={() => setRefreshNonce((n) => n + 1)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
