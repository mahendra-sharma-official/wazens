import { useEffect, useState } from "react";
import { useWallet } from "../context/WalletContext.jsx";
import { getWriteLedger } from "../lib/contracts.js";
import { useDepartmentOfficials } from "../hooks/useDepartmentOfficials.js";
import { useTxRunner } from "../hooks/useTxRunner.js";
import { Notice } from "./Notice.jsx";

export function ChangeResponsibleOfficialControl({ projectId, departmentId, currentOfficial, onChanged }) {
  const { signer } = useWallet();
  const { entries: officialOptions } = useDepartmentOfficials(departmentId);
  const { status, message, run } = useTxRunner();
  const [selected, setSelected] = useState(currentOfficial);

  useEffect(() => {
    setSelected(currentOfficial);
  }, [currentOfficial]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!signer || selected === currentOfficial) return;
    const ledger = getWriteLedger(signer);
    const ok = await run(() => ledger.changeResponsibleOfficial(projectId, selected), {
      successMessage: "Responsible official updated.",
    });
    if (ok) onChanged?.();
  }

  if (officialOptions.length === 0) return null;

  return (
    <form className="inline-form-tight" onSubmit={handleSubmit}>
      <label>
        Reassign responsible official
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {officialOptions.map((o) => (
            <option key={o.address} value={o.address}>
              {o.name} ({o.role === "head" ? "department head" : "official"})
            </option>
          ))}
        </select>
      </label>
      <button className="btn btn-outline" type="submit" disabled={status === "pending" || selected === currentOfficial}>
        {status === "pending" ? "Updating..." : "Reassign"}
      </button>
      <Notice status={status} message={message} />
    </form>
  );
}
