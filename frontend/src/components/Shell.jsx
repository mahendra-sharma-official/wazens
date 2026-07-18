import { useWallet } from "../context/WalletContext.jsx";
import { Header } from "./Header.jsx";

// Shared page chrome (header + footer) for both the public site and
// the Official Portal. Keeping this in one place means both areas
// stay visually consistent automatically.
export function Shell({ children }) {
  const { error } = useWallet();

  return (
    <div className="app-shell">
      <Header />
      {error && <p className="notice notice-error top-notice">{error}</p>}
      <main className="main-content">{children}</main>
      <footer className="site-footer">
        <p>Prototype running on a local test network. Not connected to any real government system.</p>
      </footer>
    </div>
  );
}
