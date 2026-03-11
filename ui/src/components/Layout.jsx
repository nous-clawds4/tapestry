import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import { useAuth } from '../context/AuthContext';

/**
 * Nav items. Items with `children` render as collapsible groups.
 * Children can themselves have `children` for multi-level nesting.
 * - `to`: route path (for leaf items)
 * - `children`: sub-items (for group items)
 * - `prefix`: URL prefix that determines "active" state for auto-expand
 */
const navItems = [
  { to: '/kg/', label: '📊 Dashboard', end: true },
  {
    label: '🧩 Concepts',
    prefix: '/kg/concepts',
    children: [
      { to: '/kg/concepts', label: 'Concept Headers', end: true },
    ],
  },
  {
    label: '📋 Simple Lists',
    prefix: '/kg/lists',
    children: [
      { to: '/kg/lists', label: 'List Headers', end: true },
      { to: '/kg/lists/items', label: 'List Items' },
    ],
  },

  {
    label: '🗄️ Databases',
    prefix: '/kg/databases',
    children: [
      {
        label: 'Neo4j',
        prefix: '/kg/databases/neo4j',
        children: [
          { to: '/kg/databases/neo4j', label: 'Overview', end: true },
          { to: '/kg/databases/neo4j/nodes', label: 'Nodes' },
        ],
      },
      {
        label: 'Strfry',
        prefix: '/kg/databases/strfry',
        children: [
          { to: '/kg/databases/strfry', label: 'Overview', end: true },
        ],
      },
    ],
  },
  { to: '/kg/users', label: '👤 Nostr Users' },
  { to: '/kg/relationships', label: '🔗 Relationships' },
  { to: '/kg/trusted-lists', label: '🛡️ Trusted Lists' },
];

/**
 * Recursive nav group component supporting arbitrary nesting depth.
 */
function NavGroup({ item, depth = 0 }) {
  const location = useLocation();
  const isChildActive = location.pathname.startsWith(item.prefix);
  const [open, setOpen] = useState(isChildActive);

  // Auto-expand when navigating into a child route
  useEffect(() => {
    if (isChildActive) setOpen(true);
  }, [isChildActive]);

  const depthClass = depth > 0 ? `nav-depth-${Math.min(depth, 3)}` : '';

  return (
    <li>
      <button
        className={`nav-link nav-group-toggle ${depthClass} ${isChildActive ? 'active' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span>{item.label}</span>
        <span className="nav-chevron">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <ul className="nav-sublist">
          {item.children.map((child, i) => {
            if (child.children) {
              return <NavGroup key={child.label || i} item={child} depth={depth + 1} />;
            }
            return (
              <li key={child.to}>
                <NavLink
                  to={child.to}
                  end={child.end}
                  className={({ isActive }) => `nav-link nav-sublink nav-depth-${Math.min(depth + 1, 3)} ${isActive ? 'active' : ''}`}
                >
                  {child.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export default function Layout() {
  const { user } = useAuth();
  const isOwner = user?.classification === 'owner';

  return (
    <div className="app-layout">
      <Header />
      <nav className="sidebar">
        <ul className="nav-list">
          {navItems.filter(item => !item.ownerOnly || isOwner).map((item, i) => {
            if (item.children) {
              return <NavGroup key={item.label} item={item} />;
            }
            return (
              <li key={item.to || i}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
                >
                  {item.label}
                </NavLink>
              </li>
            );
          })}
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
