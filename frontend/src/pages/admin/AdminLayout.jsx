import { NavLink, Outlet } from "react-router-dom";

const adminTabs = [
  { to: "/admin/overview", label: "概览" },
  { to: "/admin/knowledge", label: "知识库" },
  { to: "/admin/evaluation", label: "评估" },
  { to: "/admin/users", label: "用户" },
  { to: "/admin/system", label: "系统" },
];

export function AdminLayout() {
  return (
    <div className="admin-layout">
      <div className="admin-header-card">
        <div>
          <span className="eyebrow">Admin Console</span>
          <h2>企业知识库管理后台</h2>
          <p>把聊天入口和管理后台分开，知识库、评估、用户和系统设置都在这里统一处理。</p>
        </div>
      </div>

      <nav className="admin-tabs" aria-label="后台导航">
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
