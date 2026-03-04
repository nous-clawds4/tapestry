import { NavLink, Outlet } from 'react-router-dom';

const manageNav = [
  { to: '/kg/manage/audit', label: '🔍 Audit' },
  // Future: { to: '/kg/manage/normalize', label: '🔧 Normalize' },
  // Future: { to: '/kg/manage/bios', label: '🧬 BIOS' },
];

export default function ManageIndex() {
  return (
    <div className="manage-page">
      <h1>🛠️ Manage</h1>
      <p className="page-subtitle">Operational tools for inspecting and maintaining the concept graph.</p>
      <nav className="manage-nav">
        {manageNav.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `manage-nav-link ${isActive ? 'active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
