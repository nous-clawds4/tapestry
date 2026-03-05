import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { TA_PUBKEY } from '../config/pubkeys';

function shortPubkey(pk) {
  if (!pk) return '';
  return pk.slice(0, 8) + '…' + pk.slice(-4);
}

function classificationBadge(classification) {
  switch (classification) {
    case 'owner': return { label: 'Owner', className: 'badge-owner' };
    case 'customer': return { label: 'Customer', className: 'badge-customer' };
    case 'guest': return { label: 'Guest', className: 'badge-guest' };
    default: return null;
  }
}

export default function Header() {
  const { user, loading, login, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginError, setLoginError] = useState(null);
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
      setLoginError(null);
      setLoggingIn(true);
      await login();
    } catch (err) {
      setLoginError(err.message);
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

  return (
    <header className="app-header">
      <div className="header-brand" onClick={() => navigate('/kg/')} style={{ cursor: 'pointer' }}>
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
                <button className="dropdown-item" onClick={() => { setMenuOpen(false); navigate(`/kg/users/${user.pubkey}`); }}>
                  👤 My Profile
                </button>
                <button className="dropdown-item" onClick={() => { setMenuOpen(false); navigate(`/kg/users/${TA_PUBKEY}`); }}>
                  🤖 My Assistant's Profile
                </button>
                {user.classification === 'owner' && (
                  <button className="dropdown-item" onClick={() => { setMenuOpen(false); navigate('/kg/settings'); }}>
                    ⚙️ Settings
                  </button>
                )}
                <hr className="dropdown-divider" />
                <button className="dropdown-item" onClick={() => { setMenuOpen(false); navigate('/kg/about'); }}>
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
            {loginError && (
              <span className="signin-error" title={loginError}>⚠️ {loginError}</span>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
