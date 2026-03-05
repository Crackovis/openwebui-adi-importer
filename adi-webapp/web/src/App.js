import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
export const App = () => {
    return (_jsxs("div", { className: "app-shell", children: [_jsx("div", { className: "background-glow", "aria-hidden": "true" }), _jsxs("header", { className: "app-header", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "OpenWebUI Import Operations" }), _jsx("h1", { children: "ADI Importer v1" })] }), _jsx("nav", { "aria-label": "Main navigation", children: navItems.map((item) => (_jsx(NavLink, { className: ({ isActive }) => (isActive ? "nav-link nav-link-active" : "nav-link"), to: item.to, end: item.to === "/", children: item.label }, item.to))) })] }), _jsx("main", { className: "app-main", children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(DashboardPage, {}) }), _jsx(Route, { path: "/wizard", element: _jsx(ImportWizardPage, {}) }), _jsx(Route, { path: "/jobs", element: _jsx(JobHistoryPage, {}) }), _jsx(Route, { path: "/jobs/:id", element: _jsx(JobDetailPage, {}) }), _jsx(Route, { path: "/settings", element: _jsx(SettingsPage, {}) })] }) })] }));
};
