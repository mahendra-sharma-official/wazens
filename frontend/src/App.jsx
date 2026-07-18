import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WalletProvider } from "./context/WalletContext.jsx";
import { PublicLayout } from "./components/PublicLayout.jsx";
import { PortalLayout } from "./components/PortalLayout.jsx";
import { Home } from "./components/Home.jsx";
import { Departments } from "./components/Departments.jsx";
import { Projects } from "./components/Projects.jsx";
import { ProjectDetail } from "./components/ProjectDetail.jsx";
import { Tenders } from "./components/Tenders.jsx";
import { TenderDetail } from "./components/TenderDetail.jsx";
import { PortalHome } from "./components/PortalHome.jsx";
import { PortalDepartments } from "./components/PortalDepartments.jsx";
import { PortalProjects } from "./components/PortalProjects.jsx";
import { PortalReports } from "./components/PortalReports.jsx";
import { PortalTenders } from "./components/PortalTenders.jsx";
import { configIsReady } from "./lib/config.js";
import "./styles.css";

function NotConfigured() {
  return (
    <div className="setup-notice">
      <h1>GovLedger is not configured yet</h1>
      <p>
        No contract addresses were found. Run <code>./scripts/run-local.sh</code> (or{" "}
        <code>./scripts/deploy.sh</code> followed by <code>./scripts/dev.sh</code>) from the project root, which
        deploys the contracts to your local anvil chain and writes <code>frontend/.env.local</code> automatically.
      </p>
    </div>
  );
}

export default function App() {
  if (!configIsReady()) {
    return <NotConfigured />;
  }

  return (
    <WalletProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetail mode="public" />} />
            <Route path="/tenders" element={<Tenders />} />
            <Route path="/tenders/:id" element={<TenderDetail mode="public" />} />
            <Route path="/departments" element={<Departments />} />
          </Route>

          <Route path="/portal" element={<PortalLayout />}>
            <Route index element={<PortalHome />} />
            <Route path="projects" element={<PortalProjects />} />
            <Route path="projects/:id" element={<ProjectDetail mode="portal" />} />
            <Route path="tenders" element={<PortalTenders />} />
            <Route path="tenders/:id" element={<TenderDetail mode="portal" />} />
            <Route path="reports" element={<PortalReports />} />
            <Route path="departments" element={<PortalDepartments />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </WalletProvider>
  );
}
