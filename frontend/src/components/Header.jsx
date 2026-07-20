import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ConnectButton } from "./ConnectButton.jsx";
import { useWallet } from "../context/WalletContext.jsx";
import { CurrencyToggle } from "./CurrencyToggle.jsx";

function navClass({ isActive }) {
  return isActive ? "nav-link nav-link-active" : "nav-link";
}

export function Header() {
  const { address, canAccessPortal, rolesLoading } = useWallet();
  const location = useLocation();
  const navigate = useNavigate();
  const inPortal = location.pathname.startsWith("/portal");

  return (
    <header className="site-header">
      <div className="brand" onClick={() => navigate("/")} role="button" tabIndex={0}>
        <span className="seal-mark" aria-hidden="true">
          WZ
        </span>
        <div>
          <p className="brand-name">Wazens</p>
          <p className="brand-tagline">Public accountability register</p>
        </div>
      </div>

      <nav className="main-nav">
        <NavLink to="/" end className={navClass}>
          Home
        </NavLink>
        <NavLink to="/projects" className={navClass}>
          Projects
        </NavLink>
        <NavLink to="/tenders" className={navClass}>
          Tenders
        </NavLink>
        <NavLink to="/officials" className={navClass}>
          Officials
        </NavLink>
        <NavLink to="/departments" className={navClass}>
          Departments
        </NavLink>
        {address && (canAccessPortal || rolesLoading) && (
          <NavLink
            to="/portal"
            className={() => (inPortal ? "nav-link nav-link-active nav-link-portal" : "nav-link nav-link-portal")}
          >
            Official Portal
          </NavLink>
        )}
      </nav>
        <CurrencyToggle/>
      <ConnectButton />
    </header>
  );
}
