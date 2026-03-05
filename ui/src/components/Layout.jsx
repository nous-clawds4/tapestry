import { NavLink, Outlet } from 'react-router-dom';
import Header from './Header';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/kg/', label: '📊 Dashboard', end: true },
  { to: '/kg/concepts', label: '🧩 Concepts' },
  { to: '/kg/lists', label: '📋 Simple Lists' },
  { to: '/kg/events', label: '📡 Events' },
  { to: '/kg/nodes', label: '🔵 Nodes' },
  { to: '/kg/users', label: '👤 Nostr Users' },
  { to: '/kg/relationships', label: '🔗 Relationships' },
  { to: '/kg/trusted-lists', label: '🛡️ Trusted Lists' },
  { to: '/kg/manage/audit', label: '🛠️ Manage', ownerOnly: true },
];

export default function Layout() {
  const { user } = useAuth();
  const isOwner = user?.classification === 'owner';

  return (
    <div className="app-layout">
      <Header />
      <nav className="sidebar">
        <ul className="nav-list">
          {navItems.filter(item => !item.ownerOnly || isOwner).map(item => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="main-wrapper">
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
