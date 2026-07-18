import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getReadTender, getReadRegistry, getReadLedger, getWriteTender } from "../lib/contracts.js";
import { useWallet } from "../context/WalletContext.jsx";
import { useAuthorization } from "../hooks/useAuthorization.js";
import { useTxRunner } from "../hooks/useTxRunner.js";
import { TenderStatusStamp } from "./TenderStatusStamp.jsx";
import { BidForm } from "./BidForm.jsx";
import { Notice } from "./Notice.jsx";
import { shortAddress, formatTimestamp, formatDateTime, formatBudget } from "../lib/format.js";

const OPEN = 0;
const CLOSED = 1;
const AWARDED = 2;

export function TenderDetail({ mode = "public" }) {
  const { id } = useParams();
  const tenderId = Number(id);
  const navigate = useNavigate();
  const { signer } = useWallet();

  const [t, setT] = useState(null);
  const [departmentName, setDepartmentName] = useState("");
  const [relatedProjectName, setRelatedProjectName] = useState("");
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [selectedBid, setSelectedBid] = useState("0");

  const { authorized } = useAuthorization(t ? Number(t.departmentId) : undefined);
  const canManage = mode === "portal" && authorized;
  const actionTx = useTxRunner();

  const load = useCallback(async () => {
    setLoading(true);
    const tenderContract = getReadTender();
    const registry = getReadRegistry();
    const ledger = getReadLedger();

    const info = await tenderContract.getTender(tenderId);
    setT(info);

    const [dept, bidList] = await Promise.all([registry.getDepartment(info.departmentId), tenderContract.getBids(tenderId)]);
    setDepartmentName(dept.name);
    setBids(bidList);

    if (Number(info.relatedProjectId) > 0) {
      const project = await ledger.getProject(info.relatedProjectId);
      setRelatedProjectName(project.name);
    } else {
      setRelatedProjectName("");
    }

    setLoading(false);
  }, [tenderId]);

  useEffect(() => {
    load();
  }, [load, refreshNonce]);

  const refresh = () => setRefreshNonce((n) => n + 1);

  async function handleCloseBidding() {
    if (!signer) return;
    const tenderContract = getWriteTender(signer);
    await actionTx.run(() => tenderContract.closeBidding(tenderId), { successMessage: "Bidding closed." });
    refresh();
  }

  async function handleAward(e) {
    e.preventDefault();
    if (!signer) return;
    const tenderContract = getWriteTender(signer);
    await actionTx.run(() => tenderContract.awardTender(tenderId, selectedBid), {
      successMessage: "Tender awarded.",
    });
    refresh();
  }

  async function handleCancel() {
    if (!signer) return;
    const confirmed = window.confirm("Cancel this tender? This cannot be undone.");
    if (!confirmed) return;
    const tenderContract = getWriteTender(signer);
    await actionTx.run(() => tenderContract.cancelTender(tenderId), { successMessage: "Tender cancelled." });
    refresh();
  }

  if (loading || !t) {
    return (
      <section className="page">
        <button className="btn btn-text" onClick={() => navigate(mode === "portal" ? "/portal/tenders" : "/tenders")}>
          Back
        </button>
        <p className="empty-state">Loading tender...</p>
      </section>
    );
  }

  const status = Number(t.status);
  const deadlinePassed = Date.now() / 1000 > Number(t.submissionDeadline);

  return (
    <section className="page">
      <button className="btn btn-text" onClick={() => navigate(mode === "portal" ? "/portal/tenders" : "/tenders")}>
        Back
      </button>

      <div className="case-file">
        <div className="case-file-header">
          <div>
            <p className="eyebrow">
              {departmentName} - Tender #{String(t.id)}
              {relatedProjectName && <> - linked to {relatedProjectName}</>}
            </p>
            <h2>{t.title}</h2>
            <p>{t.description}</p>
          </div>
          <TenderStatusStamp status={status} />
        </div>

        <dl className="fact-grid">
          <div>
            <dt>Estimated budget</dt>
            <dd>{formatBudget(t.estimatedBudget)}</dd>
          </div>
          <div>
            <dt>Submission deadline</dt>
            <dd>
              {formatTimestamp(t.submissionDeadline)}
              {status === OPEN && deadlinePassed && " (passed)"}
            </dd>
          </div>
          <div>
            <dt>Published by</dt>
            <dd className="mono">{shortAddress(t.createdBy)}</dd>
          </div>
          <div>
            <dt>Published on</dt>
            <dd>{formatTimestamp(t.createdAt)}</dd>
          </div>
        </dl>

        {status === AWARDED && (
          <dl className="fact-grid">
            <div>
              <dt>Awarded to</dt>
              <dd className="mono">{t.awardedBidder}</dd>
            </div>
            <div>
              <dt>Awarded amount</dt>
              <dd>{formatBudget(t.awardedAmount)}</dd>
            </div>
          </dl>
        )}

        {canManage && (status === OPEN || status === CLOSED) && (
          <div className="manage-strip">
            <div className="portal-quick-links">
              {status === OPEN && (
                <button className="btn btn-outline" onClick={handleCloseBidding} disabled={actionTx.status === "pending"}>
                  Close bidding
                </button>
              )}
              <button className="btn btn-text btn-danger" onClick={handleCancel} disabled={actionTx.status === "pending"}>
                Cancel tender
              </button>
            </div>

            {status === CLOSED && bids.length > 0 && (
              <form className="inline-form award-form" onSubmit={handleAward}>
                <label>
                  Award to bid
                  <select value={selectedBid} onChange={(e) => setSelectedBid(e.target.value)}>
                    {bids.map((b, idx) => (
                      <option key={idx} value={idx}>
                        #{idx} - {shortAddress(b.bidder)} - {formatBudget(b.amount)}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn btn-primary" type="submit" disabled={actionTx.status === "pending"}>
                  {actionTx.status === "pending" ? "Awarding..." : "Award tender"}
                </button>
              </form>
            )}

            <Notice status={actionTx.status} message={actionTx.message} />
          </div>
        )}
      </div>

      <div className="ledger-section">
        <h3>Bids</h3>
        {bids.length === 0 ? (
          <p className="empty-state">No bids submitted yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Bidder</th>
                <th>Amount</th>
                <th>Proposal</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {bids.map((b, idx) => (
                <tr key={idx} className={status === AWARDED && idx === Number(t.awardedBidIndex) ? "row-winner" : ""}>
                  <td>{idx}</td>
                  <td className="mono">{shortAddress(b.bidder)}</td>
                  <td>{formatBudget(b.amount)}</td>
                  <td>{b.proposal}</td>
                  <td>{formatDateTime(b.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {status === OPEN && !deadlinePassed && <BidForm tenderId={tenderId} onAdded={refresh} />}
        {status === OPEN && deadlinePassed && <p className="hint">The submission deadline has passed, no more bids can be placed.</p>}
      </div>
    </section>
  );
}
