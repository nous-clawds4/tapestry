import { NavLink, Outlet } from 'react-router-dom';
import Header from './Header';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/kg/concepts', label: '🧩 Concepts' },
  { to: '/kg/lists', label: '📋 Simple Lists' },
  { to: '/kg/events', label: '📡 Events' },
  { to: '/kg/nodes', label: '🔵 Nodes' },
  { to: '/kg/users', label: '👤 Nostr Users' },
  { to: '/kg/relationships', label: '🔗 Relationships' },
  { to: '/kg/trusted-lists', label: '🛡️ Trusted Lists' },
  { to: '/kg/manage/audit', label: '🛠️ Manage', ownerOnly: true },
  { to: '/kg/about', label: 'ℹ️ About' },
  { to: '/kg/settings', label: '⚙️ Settings', ownerOnly: true },
];

export default function Layout() {
  const { user } = useAuth();
  const isOwner = user?.classification === 'owner';

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <h2>🧠 Tapestry</h2>
          <span className="subtitle">Knowledge Graph</span>
        </div>
        <ul className="nav-list">
          {navItems.filter(item => !item.ownerOnly || isOwner).map(item => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="main-wrapper">
        <Header />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
