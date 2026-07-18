import { Outlet } from "react-router-dom";
import { useWallet } from "../context/WalletContext.jsx";
import { Shell } from "./Shell.jsx";
import { PortalGate } from "./PortalGate.jsx";
import { PortalSubNav } from "./PortalSubNav.jsx";

// Every route under /portal renders through here. If the connected
// wallet hasn't cleared every step (connected, recognized by
// GovRegistry, signed in), the gate is shown instead of whatever
// child route was requested, no privileged screen is ever reachable
// by URL alone.
export function PortalLayout() {
  const { canAccessPortal, isSignedIn } = useWallet();
  const inPortal = canAccessPortal && isSignedIn;

  return (
    <Shell>
      {!inPortal ? (
        <PortalGate />
      ) : (
        <>
          <PortalSubNav />
          <Outlet />
        </>
      )}
    </Shell>
  );
}
