import { NavLink, Route, Routes } from "react-router-dom";
import { DashboardPage } from "./pages/DashboardPage";
import { ImportWizardPage } from "./pages/ImportWizardPage";
import { JobHistoryPage } from "./pages/JobHistoryPage";
import { JobDetailPage } from "./pages/JobDetailPage";
import { SettingsPage } from "./pages/SettingsPage";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/wizard", label: "Import Wizard" },
  { to: "/jobs", label: "Job History" },
  { to: "/settings", label: "Settings" },
];

export const App = (): JSX.Element => {
  return (
    <div className="app-shell">
      <div className="background-glow" aria-hidden="true" />
      <header className="app-header">
        <div>
          <p className="eyebrow">OpenWebUI Import Operations</p>
          <h1>ADI Importer v1</h1>
        </div>
        <nav aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) => (isActive ? "nav-link nav-link-active" : "nav-link")}
              to={item.to}
              end={item.to === "/"}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/wizard" element={<ImportWizardPage />} />
          <Route path="/jobs" element={<JobHistoryPage />} />
          <Route path="/jobs/:id" element={<JobDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  );
};
