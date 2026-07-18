import { formatBudget } from "../lib/format.js";

export function BudgetBar({ allocated, spent }) {
  const allocatedNum = Number(allocated);
  const spentNum = Number(spent);
  const pct = allocatedNum > 0 ? Math.min(100, (spentNum / allocatedNum) * 100) : 0;

  return (
    <div className="budget-bar">
      <div className="budget-bar-track">
        <div className="budget-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="budget-bar-label">
        {formatBudget(spent)} spent of {formatBudget(allocated)} allocated ({pct.toFixed(0)}%)
      </p>
    </div>
  );
}
