import { useEffect, useState } from "react";
import { useWallet } from "../context/WalletContext.jsx";
import { getReadRegistry } from "../lib/contracts.js";

// Tells a component whether the currently connected wallet is allowed
// to write ledger entries for a given department (department head,
// an official of that department, or the super admin). Re-checks
// whenever the connected address or the department changes.
export function useAuthorization(departmentId) {
  const { address } = useWallet();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!address || departmentId === undefined || departmentId === null) {
        setAuthorized(false);
        return;
      }
      setLoading(true);
      try {
        const registry = getReadRegistry();
        const result = await registry.isAuthorizedForDepartment(address, departmentId);
        if (!cancelled) setAuthorized(result);
      } catch (err) {
        if (!cancelled) setAuthorized(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [address, departmentId]);

  return { authorized, loading };
}
