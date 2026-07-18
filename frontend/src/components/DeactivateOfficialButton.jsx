import { useWallet } from "../context/WalletContext.jsx";
import { getWriteRegistry } from "../lib/contracts.js";
import { useTxRunner } from "../hooks/useTxRunner.js";

export function DeactivateOfficialButton({ officialAddress, onDeactivated }) {
  const { signer } = useWallet();
  const { status, run } = useTxRunner();

  async function handleClick() {
    if (!signer) return;
    const confirmed = window.confirm("Remove this official's access? They will no longer be able to write to the ledger for this department.");
    if (!confirmed) return;
    const registry = getWriteRegistry(signer);
    const ok = await run(() => registry.deactivateOfficial(officialAddress), {
      successMessage: "Official deactivated.",
    });
    if (ok) onDeactivated?.();
  }

  return (
    <button className="btn btn-text btn-danger" onClick={handleClick} disabled={status === "pending"}>
      {status === "pending" ? "Removing..." : "Remove access"}
    </button>
  );
}
