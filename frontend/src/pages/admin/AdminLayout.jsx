import { NavLink, Outlet } from "react-router-dom";

const adminTabs = [
  { to: "/admin/overview", label: "Overview" },
  { to: "/admin/knowledge", label: "Knowledge" },
  { to: "/admin/evaluation", label: "Evaluation" },
  { to: "/admin/users", label: "Users" },
  { to: "/admin/system", label: "System" },
];

export function AdminLayout() {
  return (
    <div className="admin-layout">
      <div className="admin-header-card">
        <div>
          <span className="eyebrow">Admin Console</span>
          <h2>Knowledge and operations backend</h2>
          <p>Separate chat usage from administration so knowledge, evaluation, users, and system settings stay organized.</p>
        </div>
      </div>

      <nav className="admin-tabs" aria-label="Admin tabs">
        {adminTabs.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? "admin-tab active" : "admin-tab")}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
