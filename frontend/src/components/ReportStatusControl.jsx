import { useWallet } from "../context/WalletContext.jsx";
import { getWriteLedger } from "../lib/contracts.js";
import { useTxRunner } from "../hooks/useTxRunner.js";
import { Notice } from "./Notice.jsx";

const REPORT_STATUS_LABELS = ["Open", "Under review", "Resolved", "Dismissed"];

export function ReportStatusControl({ projectId, reportIndex, currentStatus, onChanged }) {
  const { signer } = useWallet();
  const { status, message, run } = useTxRunner();

  async function handleChange(e) {
    if (!signer) return;
    const ledger = getWriteLedger(signer);
    const newStatus = Number(e.target.value);
    const ok = await run(() => ledger.updateReportStatus(projectId, reportIndex, newStatus), {
      successMessage: "Report status updated.",
    });
    if (ok) onChanged?.();
  }

  return (
    <div className="report-status-control">
      <select value={currentStatus} onChange={handleChange} disabled={status === "pending"}>
        {REPORT_STATUS_LABELS.map((label, idx) => (
          <option key={label} value={idx}>
            {label}
          </option>
        ))}
      </select>
      <Notice status={status} message={message} />
    </div>
  );
}

export { REPORT_STATUS_LABELS };
