import { useWallet } from "../context/WalletContext.jsx";
import { shortAddress } from "../lib/format.js";

export function ConnectButton() {
  const { address, connecting, connect, disconnect, isCorrectNetwork, isSignedIn, signOut } = useWallet();

  if (address) {
    return (
      <div className="connect-wrap">
        {!isCorrectNetwork && <span className="badge badge-warn">Wrong network</span>}
        {isSignedIn && <span className="badge badge-signed-in">Signed in</span>}
        <button
          className="btn btn-outline"
          onClick={() => {
            if (isSignedIn) signOut();
            disconnect();
          }}
          title={address}
        >
          <span className="dot dot-live" />
          {shortAddress(address)}
        </button>
      </div>
    );
  }

  return (
    <button className="btn btn-primary" onClick={connect} disabled={connecting}>
      {connecting ? "Connecting..." : "Connect wallet"}
    </button>
  );
}
