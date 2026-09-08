import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { personalLinks, destinationLinks } from '../config/avatarMenuLinks';

function shortPubkey(pk) {
  if (!pk) return '';
  return pk.slice(0, 8) + '…' + pk.slice(-4);
}

function classificationBadge(classification) {
  switch (classification) {
    case 'owner': return { label: 'Owner', className: 'badge-owner' };
    case 'admin': return { label: 'Admin', className: 'badge-owner' };
    case 'customer': return { label: 'Customer', className: 'badge-customer' };
    case 'guest': return { label: 'Guest', className: 'badge-guest' };
    default: return null;
  }
}

/**
 * One row in the personal / destinations sections of the Tapestry avatar menu
 * (navigation-scaffolding #2). A link with no target — the assistant profile,
 * for a caller with no provisioned assistant key — renders disabled rather than
 * vanishing, so the menu reads the same for every signed-in user.
 */
function MenuItem({ link, onGo }) {
  // The tooltip lives on a wrapping span, not on the disabled button: Firefox
  // suppresses pointer events on disabled form controls, so a `title` there can
  // silently never appear — and the tooltip is the whole point of this state.
  if (!link.to) {
    return (
      <span className="dropdown-item-wrap" title={link.disabledReason}>
        <button className="dropdown-item" disabled aria-disabled="true">
          {link.icon} {link.label}
        </button>
      </span>
    );
  }
  return (
    <button className="dropdown-item" onClick={() => onGo(link)}>
      {link.icon} {link.label}
    </button>
  );
}

export default function Header({ onToggleSidebar }) {
  const { taPubkey: TA_PUBKEY } = useConfig();
  const { user, loading, login, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleLogin() {
    try {
      setLoggingIn(true);
      await login(); // failures are surfaced by the shared LoginErrorModal
    } catch {
      // already reported via the modal; swallow to avoid an unhandled rejection
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
  }

  const displayName = user?.profile?.display_name || user?.profile?.name || shortPubkey(user?.pubkey);
  const avatar = user?.profile?.picture;
  const badge = user ? classificationBadge(user.classification) : null;

  // The Tapestry menu keeps its profile links on the control-panel user pages
  // (navigation-scaffolding #2).
  const myLinks = user
    ? personalLinks({
        pubkey: user.pubkey,
        assistantPubkey: user.assistantPubkey,
        profileBase: '/tapestry/users',
      })
    : [];

  // `/legacy/` is served by Express, outside the React router — handing it to
  // navigate() would 404 into NotFound.
  function go(link) {
    setMenuOpen(false);
    if (link.external) {
      window.location.href = link.to;
    } else {
      navigate(link.to);
    }
  }

  return (
    <header className="app-header">
      <button className="sidebar-toggle" onClick={onToggleSidebar} aria-label="Toggle menu">
        ☰
      </button>
      <div className="header-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
        <span className="header-brand-name">🧠 Tapestry</span>
      </div>
      <div className="header-spacer" />

      <div className="header-auth">
        {loading ? (
          <span className="header-loading">…</span>
        ) : user ? (
          <div className="header-user" ref={menuRef}>
            <button
              className="user-button"
              onClick={() => setMenuOpen(o => !o)}
              title={user.pubkey}
            >
              {avatar ? (
                <img src={avatar} alt="" className="user-avatar" />
              ) : (
                <div className="user-avatar-placeholder">
                  {(displayName || '?')[0].toUpperCase()}
                </div>
              )}
              <span className="user-name">{displayName}</span>
              {badge && (
                <span className={`user-badge ${badge.className}`}>{badge.label}</span>
              )}
              <span className="dropdown-arrow">▾</span>
            </button>

            {menuOpen && (
              <div className="user-dropdown">
                <div className="dropdown-header">
                  <span className="dropdown-pubkey" title={user.pubkey}>
                    {shortPubkey(user.pubkey)}
                  </span>
                </div>
                <hr className="dropdown-divider" />
                {myLinks.map(link => (
                  <MenuItem key={link.key} link={link} onGo={go} />
                ))}
                {(user.classification === 'owner' || user.classification === 'admin') && (
                  <button className="dropdown-item" onClick={() => { setMenuOpen(false); navigate('/tapestry/settings'); }}>
                    ⚙️ Settings
                  </button>
                )}
                <hr className="dropdown-divider" />
                {destinationLinks.map(link => (
                  <MenuItem key={link.key} link={link} onGo={go} />
                ))}
                <hr className="dropdown-divider" />
                <button className="dropdown-item" onClick={() => { setMenuOpen(false); navigate('/tapestry/about'); }}>
                  ℹ️ About
                </button>
                <button className="dropdown-item" onClick={handleLogout}>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="header-signin">
            <button
              className="signin-button"
              onClick={handleLogin}
              disabled={loggingIn}
            >
              {loggingIn ? 'Signing in…' : 'Sign in with Nostr'}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
