import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrainstormUserMenu from './BrainstormUserMenu';

/**
 * Unified top-rail component (ADR-0003). Replaces inline top-bar JSX that
 * previously lived on five pages (BrainstormSearch landing+results,
 * BrainstormProfile, Tag, Tags). Adopts the `bsp-top-bar` visual.
 *
 * Auth area: by default mounts `<BrainstormUserMenu>` (the simple variant
 * used on profile/tag pages). BrainstormSearch passes its own complex
 * `<UserMenu>` (with POV controls / filters / sort) via `authMenu` because
 * those features are state-heavy and search-specific — the ADR's intent
 * ("kill the five-place top-bar duplication, expose the Tags link from
 * everywhere") is preserved without forcing BrainstormSearch to lose its
 * existing controls.
 */
const DEFAULT_NAV_LINKS = [
  { to: '/about', label: 'About' },
];

export default function TopBar({
  navLinks = DEFAULT_NAV_LINKS,
  showLogo = true,
  authMenu,
}) {
  const { user, login, logout } = useAuth();
  return (
    <div className="bsp-top-bar">
      {showLogo && (
        <Link to="/" className="bsp-logo">
          <img src="/brainstorm.svg" alt="" className="bsp-logo-img" />
          <span>Brainstorm</span>
        </Link>
      )}
      <nav className="bsp-top-nav">
        {navLinks.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `bsp-top-link${isActive ? ' is-active' : ''}`}
            end
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="bsp-auth">
        {authMenu ?? (
          <BrainstormUserMenu user={user} login={login} logout={logout} />
        )}
      </div>
    </div>
  );
}
