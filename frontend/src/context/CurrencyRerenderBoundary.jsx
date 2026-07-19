import { useEffect, useState } from "react";
import { subscribeToCurrencyDisplay } from "../lib/currency.js";

// Problem this solves: formatBudget() is called as a plain function
// inside JSX all over the app (BudgetBar, Home, ProjectDetail,
// TenderDetail, Tenders, PortalTenders). None of those components
// have any state tied to the currency preference, so when the
// CurrencyToggle changes it in localStorage, React has no reason to
// re-render any of them — the toggle button itself updates, but every
// other amount on the page stays stale until something else causes
// that component to re-render (like a manual page refresh).
//
// Fix: mount this once, wrapping everything below the header in
// App.jsx. It listens for currency preference changes and forces a
// full remount of its children (via a changing `key`), which
// guarantees every formatBudget(...) call anywhere in the tree is
// recomputed with the new preference. Zero edits needed to any of
// the 6+ existing components that already call formatBudget.
export function CurrencyRerenderBoundary({ children }) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    return subscribeToCurrencyDisplay(() => setVersion((v) => v + 1));
  }, []);

  return <div key={version}>{children}</div>;
}