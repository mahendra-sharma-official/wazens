import { useCallback, useEffect, useState } from "react";
import { getReadRegistry } from "../lib/contracts.js";
import { useWallet } from "../context/WalletContext.jsx";
import { PortalDepartmentCard } from "./PortalDepartmentCard.jsx";
import { CreateDepartmentForm } from "./CreateDepartmentForm.jsx";

export function PortalDepartments() {
  const { isSuperAdmin, myDepartments } = useWallet();
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshNonce, setRefreshNonce] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    if (isSuperAdmin) {
      const registry = getReadRegistry();
      const count = await registry.getDepartmentCount();
      const ids = Array.from({ length: Number(count) }, (_, i) => i + 1);
      const items = await Promise.all(ids.map((id) => registry.getDepartment(id)));
      setDepartments(items);
    } else {
      const registry = getReadRegistry();
      const items = await Promise.all(myDepartments.map((d) => registry.getDepartment(d.id)));
      setDepartments(items);
    }
    setLoading(false);
  }, [isSuperAdmin, myDepartments]);

  useEffect(() => {
    load();
  }, [load, refreshNonce]);

  function canManage(departmentId) {
    if (isSuperAdmin) return true;
    const mine = myDepartments.find((d) => d.id === Number(departmentId));
    return mine?.role === "head";
  }

  return (
    <section className="page">
      <div className="page-heading">
        <h2>{isSuperAdmin ? "Manage departments" : "Manage officials"}</h2>
        <p>
          {isSuperAdmin
            ? "Create new departments and manage officials across the whole register."
            : "Add or remove officials under the department(s) you head."}
        </p>
      </div>

      {isSuperAdmin && <CreateDepartmentForm onCreated={() => setRefreshNonce((n) => n + 1)} />}

      {loading ? (
        <p className="empty-state">Loading departments...</p>
      ) : departments.length === 0 ? (
        <p className="empty-state">
          {isSuperAdmin ? "No departments have been registered yet." : "You are not the head of any department."}
        </p>
      ) : (
        <div className="card-grid">
          {departments.map((d) => (
            <PortalDepartmentCard key={String(d.id)} department={d} canManageOfficials={canManage(Number(d.id))} />
          ))}
        </div>
      )}
    </section>
  );
}
