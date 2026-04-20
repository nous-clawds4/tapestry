import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import { useAuth } from '../context/AuthContext';
import TrustWidget from './TrustWidget';

/**
 * Nav items split into two menus: main and management.
 * Both start with Dashboard. The active menu is determined by the current route.
 */
const dashboardItem = { to: '/tapestry/', label: '📊 Dashboard', end: true };

const mainNavItems = [
  dashboardItem,
  {
    label: '📋 Simple Lists',
    prefix: '/tapestry/lists',
    children: [
      { to: '/tapestry/lists', label: 'List Headers', end: true },
      { to: '/tapestry/lists/items', label: 'List Items' },
    ],
  },
  {
    label: '🧩 Concepts',
    prefix: '/tapestry/concepts',
    children: [
      { to: '/tapestry/concepts', label: 'Concept Headers', end: true },
    ],
  },
  {
    label: '🍇 My Grapevine',
    prefix: '/tapestry/grapevine',
    children: [
      { to: '/tapestry/grapevine/trusted-assertions', label: 'TA Treasure Map' },
      { to: '/tapestry/grapevine/assertions', label: 'Trusted Assertions' },
      { to: '/tapestry/grapevine/trusted-lists', label: 'Trusted Lists' },
      { to: '/tapestry/grapevine/trust-determination', label: 'Trust Determination' },
      { to: '/tapestry/grapevine/search-preferences', label: 'Search Preferences' },
      { to: '/tapestry/grapevine/meilisearch', label: 'Meilisearch' },
    ],
  },
  {
    label: '👤 Nostr Users',
    prefix: '/tapestry/users',
    children: [
      { to: '/tapestry/users', label: 'Directory', end: true },
      { to: '/tapestry/users/search', label: 'Search' },
    ],
  },
  { to: '/tapestry/relay-discovery', label: '📡 Relay Discovery' },
];

const managementNavItems = [
  dashboardItem,
  {
    label: '🗄️ Databases',
    prefix: '/tapestry/databases',
    children: [
      {
        label: 'Neo4j',
        prefix: '/tapestry/databases/neo4j',
        children: [
          { to: '/tapestry/databases/neo4j', label: 'Overview', end: true },
          { to: '/tapestry/databases/neo4j/nodes', label: 'Nodes' },
        ],
      },
      {
        label: 'Strfry',
        prefix: '/tapestry/databases/strfry',
        children: [
          { to: '/tapestry/databases/strfry', label: 'Overview', end: true },
        ],
      },
    ],
  },
  {
    label: '📥 I/O',
    prefix: '/tapestry/io',
    children: [
      { to: '/tapestry/io/import', label: 'Import' },
      { to: '/tapestry/io/export', label: 'Export' },
    ],
  },
];

/** Route prefixes that trigger the management menu */
const MANAGEMENT_PREFIXES = ['/tapestry/settings', '/tapestry/databases', '/tapestry/io', '/tapestry/manage'];

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
  const isOwner = user?.classification === 'owner' || user?.classification === 'admin';
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const isManagement = MANAGEMENT_PREFIXES.some(p => location.pathname.startsWith(p));
  const navItems = isManagement ? managementNavItems : mainNavItems;

  return (
    <div className="app-layout">
      <Header onToggleSidebar={() => setSidebarOpen(o => !o)} />

      {/* Overlay behind sidebar (mobile only, controlled by CSS) */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <nav className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        {isManagement && (
          <div style={{
            padding: '0.5rem 1rem',
            fontSize: '0.7rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted, #888)',
          }}>
            ⚙️ Management
          </div>
        )}
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
      <TrustWidget />
    </div>
  );
}
