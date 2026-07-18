import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getReadLedger, getReadRegistry, getWriteLedger, ProjectStatus } from "../lib/contracts.js";
import { useWallet } from "../context/WalletContext.jsx";
import { useAuthorization } from "../hooks/useAuthorization.js";
import { useTxRunner } from "../hooks/useTxRunner.js";
import { StatusStamp } from "./StatusStamp.jsx";
import { BudgetBar } from "./BudgetBar.jsx";
import { MilestoneForm } from "./MilestoneForm.jsx";
import { SpendingForm } from "./SpendingForm.jsx";
import { ReportForm } from "./ReportForm.jsx";
import { ReportStatusControl, REPORT_STATUS_LABELS } from "./ReportStatusControl.jsx";
import { Notice } from "./Notice.jsx";
import { shortAddress, formatTimestamp, formatDateTime, formatBudget } from "../lib/format.js";

/// `mode` controls whether this is the public read-mostly view (with a
/// citizen report form) or the Official Portal view (which also shows
/// the management controls, gated a second time here by on chain
/// authorization so a signed-in official can only manage their own
/// department's projects).
export function ProjectDetail({ mode = "public" }) {
  const { id } = useParams();
  const projectId = Number(id);
  const navigate = useNavigate();
  const { signer } = useWallet();
  const [project, setProject] = useState(null);
  const [departmentName, setDepartmentName] = useState("");
  const [milestones, setMilestones] = useState([]);
  const [spending, setSpending] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const { authorized } = useAuthorization(project ? Number(project.departmentId) : undefined);
  const canManage = mode === "portal" && authorized;
  const statusTx = useTxRunner();

  const load = useCallback(async () => {
    setLoading(true);
    const ledger = getReadLedger();
    const registry = getReadRegistry();

    const p = await ledger.getProject(projectId);
    setProject(p);

    const [dept, m, s, r] = await Promise.all([
      registry.getDepartment(p.departmentId),
      ledger.getMilestones(projectId),
      ledger.getSpendingRecords(projectId),
      ledger.getReports(projectId),
    ]);
    setDepartmentName(dept.name);
    setMilestones(m);
    setSpending(s);
    setReports(r);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load, refreshNonce]);

  const refresh = () => setRefreshNonce((n) => n + 1);

  async function handleCompleteMilestone(index) {
    if (!signer) return;
    const ledger = getWriteLedger(signer);
    const evidence = window.prompt("Optional evidence link (photo, report, IPFS URI):", "") || "";
    await statusTx.run(() => ledger.completeMilestone(projectId, index, evidence), {
      successMessage: "Milestone marked complete.",
    });
    refresh();
  }

  async function handleStatusChange(e) {
    if (!signer) return;
    const ledger = getWriteLedger(signer);
    const newStatus = Number(e.target.value);
    await statusTx.run(() => ledger.setProjectStatus(projectId, newStatus), {
      successMessage: "Status updated.",
    });
    refresh();
  }

  if (loading || !project) {
    return (
      <section className="page">
        <button className="btn btn-text" onClick={() => navigate(mode === "portal" ? "/portal/projects" : "/projects")}>
          Back
        </button>
        <p className="empty-state">Loading project...</p>
      </section>
    );
  }

  return (
    <section className="page">
      <button className="btn btn-text" onClick={() => navigate(mode === "portal" ? "/portal/projects" : "/projects")}>
        Back
      </button>

      <div className="case-file">
        <div className="case-file-header">
          <div>
            <p className="eyebrow">
              {departmentName} - Case file #{String(project.id)}
            </p>
            <h2>{project.name}</h2>
            <p>{project.description}</p>
          </div>
          <StatusStamp status={Number(project.status)} />
        </div>

        <dl className="fact-grid">
          <div>
            <dt>Responsible official</dt>
            <dd className="mono">{project.responsibleOfficial}</dd>
          </div>
          <div>
            <dt>Registered by</dt>
            <dd className="mono">{shortAddress(project.createdBy)}</dd>
          </div>
          <div>
            <dt>Registered on</dt>
            <dd>{formatTimestamp(project.createdAt)}</dd>
          </div>
          <div>
            <dt>Allocated budget</dt>
            <dd>{formatBudget(project.allocatedBudget)}</dd>
          </div>
        </dl>

        <BudgetBar allocated={project.allocatedBudget} spent={project.spentBudget} />

        {canManage && (
          <div className="manage-strip">
            <label>
              Update status
              <select
                value={Number(project.status)}
                onChange={handleStatusChange}
                disabled={statusTx.status === "pending"}
              >
                {ProjectStatus.map((label, idx) => (
                  <option key={label} value={idx}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <Notice status={statusTx.status} message={statusTx.message} />
          </div>
        )}
      </div>

      <div className="ledger-section">
        <h3>Milestones</h3>
        {milestones.length === 0 ? (
          <p className="empty-state">No milestones recorded yet.</p>
        ) : (
          <ol className="milestone-list">
            {milestones.map((m, idx) => (
              <li key={idx} className={m.completed ? "milestone milestone-done" : "milestone"}>
                <div>
                  <p className="milestone-title">{m.description}</p>
                  <p className="hint">
                    Target: {formatTimestamp(m.targetDate)}
                    {m.completed && (
                      <>
                        {" "}
                        - Completed {formatDateTime(m.completedAt)} by {shortAddress(m.completedBy)}
                      </>
                    )}
                  </p>
                  {m.completed && m.evidenceURI && (
                    <p className="hint">
                      Evidence: <span className="mono">{m.evidenceURI}</span>
                    </p>
                  )}
                </div>
                {!m.completed && canManage && (
                  <button className="btn btn-outline" onClick={() => handleCompleteMilestone(idx)}>
                    Mark complete
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
        {canManage && <MilestoneForm projectId={projectId} onAdded={refresh} />}
      </div>

      <div className="ledger-section">
        <h3>Spending records</h3>
        {spending.length === 0 ? (
          <p className="empty-state">No spending recorded against this project yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Purpose</th>
                <th>Recipient</th>
                <th>Recorded by</th>
              </tr>
            </thead>
            <tbody>
              {spending.map((s, idx) => (
                <tr key={idx}>
                  <td>{formatTimestamp(s.timestamp)}</td>
                  <td>{formatBudget(s.amount)}</td>
                  <td>{s.purpose}</td>
                  <td className="mono">{shortAddress(s.recipient)}</td>
                  <td className="mono">{shortAddress(s.recordedBy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canManage && <SpendingForm projectId={projectId} onAdded={refresh} />}
      </div>

      <div className="ledger-section">
        <h3>Citizen reports</h3>
        {reports.length === 0 ? (
          <p className="empty-state">No reports filed on this project yet.</p>
        ) : (
          <ul className="report-list">
            {reports.map((r, idx) => (
              <li key={idx}>
                <div className="report-list-row">
                  <div>
                    <p>{r.comment}</p>
                    <p className="hint">
                      {shortAddress(r.reporter)} - {formatDateTime(r.timestamp)}
                      {" - "}
                      <span className={`report-status report-status-${Number(r.status)}`}>
                        {REPORT_STATUS_LABELS[Number(r.status)]}
                      </span>
                    </p>
                  </div>
                  {canManage && (
                    <ReportStatusControl
                      projectId={projectId}
                      reportIndex={idx}
                      currentStatus={Number(r.status)}
                      onChanged={refresh}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {mode === "public" && <ReportForm projectId={projectId} onAdded={refresh} />}
      </div>
    </section>
  );
}
