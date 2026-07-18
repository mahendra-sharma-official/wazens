import { NavLink } from "react-router-dom";
import { useWallet } from "../context/WalletContext.jsx";

function subNavClass({ isActive }) {
  return isActive ? "subnav-link subnav-link-active" : "subnav-link";
}

export function PortalSubNav() {
  const { isSuperAdmin } = useWallet();

  return (
    <nav className="portal-subnav">
      <NavLink to="/portal" end className={subNavClass}>
        Dashboard
      </NavLink>
      <NavLink to="/portal/projects" className={subNavClass}>
        Projects
      </NavLink>
      <NavLink to="/portal/tenders" className={subNavClass}>
        Tenders
      </NavLink>
      <NavLink to="/portal/reports" className={subNavClass}>
        Reports
      </NavLink>
      <NavLink to="/portal/departments" className={subNavClass}>
        {isSuperAdmin ? "Departments" : "Officials"}
      </NavLink>
    </nav>
  );
}
