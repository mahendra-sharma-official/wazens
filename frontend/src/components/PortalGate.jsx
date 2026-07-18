import { useWallet } from "../context/WalletContext.jsx";
import { Notice } from "./Notice.jsx";

// Shown inside the Portal area whenever the visitor hasn't cleared
// every step needed to get in: connect a wallet, have that wallet be
// recognized as a department head/official/admin, and sign the
// sign-in message proving they control it.
export function PortalGate() {
  const { address, connect, connecting, canAccessPortal, rolesLoading, isSignedIn, signIn, signingIn, error } =
    useWallet();

  if (!address) {
    return (
      <div className="portal-gate">
        <h2>Official Portal</h2>
        <p>Connect the wallet registered as a department head or official to continue.</p>
        <button className="btn btn-primary" onClick={connect} disabled={connecting}>
          {connecting ? "Connecting..." : "Connect wallet"}
        </button>
        <Notice status={error ? "error" : "idle"} message={error} />
      </div>
    );
  }

  if (rolesLoading) {
    return (
      <div className="portal-gate">
        <h2>Official Portal</h2>
        <p>Checking this wallet's roles on chain...</p>
      </div>
    );
  }

  if (!canAccessPortal) {
    return (
      <div className="portal-gate">
        <h2>Official Portal</h2>
        <p>
          The connected wallet is not registered as a department head or official in GovRegistry, so there is
          nothing to manage here. Browse the public site instead, or connect a different wallet.
        </p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="portal-gate">
        <h2>Sign in to continue</h2>
        <p>
          This wallet is recognized by the registry. Sign a message (no transaction, no gas) to prove you control
          it before entering the portal.
        </p>
        <button className="btn btn-primary" onClick={signIn} disabled={signingIn}>
          {signingIn ? "Waiting for signature..." : "Sign in as official"}
        </button>
        <Notice status={error ? "error" : "idle"} message={error} />
      </div>
    );
  }

  return null;
}
