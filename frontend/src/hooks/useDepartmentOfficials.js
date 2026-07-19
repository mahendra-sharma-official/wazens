import { useEffect, useState } from "react";
import { getReadRegistry } from "../lib/contracts.js";

/// The shared "who can be selected for this department" source of
/// truth: the department's head plus every active official under it.
/// Used both by dropdown selectors (CreateProjectForm, changing a
/// project's responsible official) and anywhere else that needs to
/// reference an official without asking someone to type an address.
///
/// Returns entries shaped { address, name, role }, role is "head" or
/// "official".
export function useDepartmentOfficials(departmentId) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!departmentId) {
        setEntries([]);
        return;
      }
      setLoading(true);
      try {
        const registry = getReadRegistry();
        const dept = await registry.getDepartment(departmentId);
        const officialAddresses = await registry.getDepartmentOfficials(departmentId);
        const infos = await Promise.all(officialAddresses.map((addr) => registry.getOfficial(addr)));

        const officials = officialAddresses
          .map((addr, i) => ({ address: addr, name: infos[i].name, role: "official", active: infos[i].active }))
          .filter((o) => o.active);

        const result = [{ address: dept.head, name: dept.headName, role: "head" }, ...officials];
        if (!cancelled) setEntries(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [departmentId]);

  return { entries, loading };
}
