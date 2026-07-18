import { useCallback, useEffect, useState } from "react";
import { getReadRegistry } from "../lib/contracts.js";
import { DepartmentCard } from "./DepartmentCard.jsx";

// Public, read-only. Creating departments and managing officials
// happens in the Official Portal.
export function Departments() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const registry = getReadRegistry();
    const count = await registry.getDepartmentCount();
    const ids = Array.from({ length: Number(count) }, (_, i) => i + 1);
    const items = await Promise.all(ids.map((id) => registry.getDepartment(id)));
    setDepartments(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="page">
      <div className="page-heading">
        <h2>Departments</h2>
        <p>Every government department entered into the register, and who leads it.</p>
      </div>

      {loading ? (
        <p className="empty-state">Loading departments...</p>
      ) : departments.length === 0 ? (
        <p className="empty-state">No departments have been registered yet.</p>
      ) : (
        <div className="card-grid">
          {departments.map((d) => (
            <DepartmentCard key={String(d.id)} department={d} />
          ))}
        </div>
      )}
    </section>
  );
}
