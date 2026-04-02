import { useState, useEffect, useRef } from 'react';

/**
 * Compact user avatar + dropdown menu for Brainstorm Search pages.
 * Shows avatar, welcome, POV indicator with house profile, settings link, and sign out.
 */
export default function BrainstormUserMenu({ user, login, logout }) {
  const [open, setOpen] = useState(false);
  const [pov, setPov] = useState('nosfabrica');
  const [houseProfile, setHouseProfile] = useState(null); // { pubkey, name, picture }
  const menuRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Load POV from user prefs + fetch house POV profile
  useEffect(() => {
    if (!user) return;
    (async () => {
      // Load user POV preference
      try {
        const resp = await fetch('/api/user-prefs');
        const data = await resp.json();
        if (data.success && data.preferences?.pov) setPov(data.preferences.pov);
      } catch {}

      // Fetch house POV pubkey and profile
      try {
        const prefsResp = await fetch('/api/grapevine/preferences');
        const prefsData = await prefsResp.json();
        const povPubkey = prefsData?.preferences?.povPubkey;
        if (povPubkey) {
          const profResp = await fetch(`/api/profiles?pubkeys=${povPubkey}`);
          const profData = await profResp.json();
          const prof = profData?.profiles?.[povPubkey];
          setHouseProfile({
            pubkey: povPubkey,
            name: prof?.name || prof?.display_name || povPubkey.slice(0, 12) + '…',
            picture: prof?.picture || null,
          });
        }
      } catch {}
    })();
  }, [user]);

  // Also fetch house profile when not signed in (for the footer/indicator)
  useEffect(() => {
    if (user) return; // already handled above
    (async () => {
      try {
        const prefsResp = await fetch('/api/grapevine/preferences');
        const prefsData = await prefsResp.json();
        const povPubkey = prefsData?.preferences?.povPubkey;
        if (povPubkey) {
          const profResp = await fetch(`/api/profiles?pubkeys=${povPubkey}`);
          const profData = await profResp.json();
          const prof = profData?.profiles?.[povPubkey];
          setHouseProfile({
            pubkey: povPubkey,
            name: prof?.name || prof?.display_name || povPubkey.slice(0, 12) + '…',
            picture: prof?.picture || null,
          });
        }
      } catch {}
    })();
  }, [user]);

  if (!user) {
    return <button className="bs-link-btn" onClick={login}>Sign in with nostr</button>;
  }

  const displayName = user.profile?.name || user.pubkey.slice(0, 8) + '…';
  const picture = user.profile?.picture;
  const isOwnerOrAdmin = user.classification === 'owner' || user.classification === 'admin';

  const houseName = houseProfile?.name || 'House';

  return (
    <div className="bs-usermenu" ref={menuRef}>
      {/* Dashboard grid icon for owner/admin */}
      {isOwnerOrAdmin && (
        <a href="/kg/" className="bs-usermenu-grid-btn" title="Dashboard">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="1" y="1" width="4" height="4" rx="1" fill="currentColor"/>
            <rect x="7" y="1" width="4" height="4" rx="1" fill="currentColor"/>
            <rect x="13" y="1" width="4" height="4" rx="1" fill="currentColor"/>
            <rect x="1" y="7" width="4" height="4" rx="1" fill="currentColor"/>
            <rect x="7" y="7" width="4" height="4" rx="1" fill="currentColor"/>
            <rect x="13" y="7" width="4" height="4" rx="1" fill="currentColor"/>
            <rect x="1" y="13" width="4" height="4" rx="1" fill="currentColor"/>
            <rect x="7" y="13" width="4" height="4" rx="1" fill="currentColor"/>
            <rect x="13" y="13" width="4" height="4" rx="1" fill="currentColor"/>
          </svg>
        </a>
      )}
      <button
        className="bs-usermenu-avatar-btn"
        onClick={() => setOpen(!open)}
        title={displayName}
      >
        {picture ? (
          <img src={picture} alt="" className="bs-usermenu-avatar" onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
        ) : null}
        <div className="bs-usermenu-avatar bs-usermenu-avatar-placeholder" style={picture ? { display: 'none' } : {}}>
          {(displayName || '?')[0].toUpperCase()}
        </div>
      </button>

      {open && (
        <div className="bs-usermenu-dropdown">
          <div className="bs-usermenu-welcome">
            {picture && <img src={picture} alt="" className="bs-usermenu-dropdown-pic" onError={e => { e.target.style.display = 'none'; }} />}
            <div>
              <div className="bs-usermenu-dropdown-name">{displayName}</div>
              <div className="bs-usermenu-dropdown-pubkey">{user.pubkey.slice(0, 12)}…{user.pubkey.slice(-6)}</div>
            </div>
          </div>

          <div className="bs-usermenu-section">
            <div className="bs-usermenu-pov-indicator">
              Searching as:{' '}
              {pov === 'user' ? (
                <strong>My WoT</strong>
              ) : (
                <a href={houseProfile ? `/kg/brainstorm-search/user/${houseProfile.pubkey}` : '#'} className="bs-usermenu-pov-link" onClick={() => setOpen(false)}>
                  {houseProfile?.picture && (
                    <img src={houseProfile.picture} alt="" className="bs-usermenu-pov-avatar" onError={e => { e.target.style.display = 'none'; }} />
                  )}
                  <strong>{houseName}</strong>
                </a>
              )}
            </div>
          </div>

          <div className="bs-usermenu-footer">
            <a
              href="/kg/brainstorm-search/settings"
              className="bs-usermenu-settings-btn"
              onClick={() => setOpen(false)}
            >
              ⚙️ Settings
            </a>
            <button className="bs-usermenu-signout" onClick={() => { setOpen(false); logout(); }}>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Hook to fetch the house POV profile. Usable by any component.
 */
export function useHouseProfile() {
  const [houseProfile, setHouseProfile] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const prefsResp = await fetch('/api/grapevine/preferences');
        const prefsData = await prefsResp.json();
        const povPubkey = prefsData?.preferences?.povPubkey;
        if (!povPubkey) return;
        const profResp = await fetch(`/api/profiles?pubkeys=${povPubkey}`);
        const profData = await profResp.json();
        const prof = profData?.profiles?.[povPubkey];
        setHouseProfile({
          pubkey: povPubkey,
          name: prof?.name || prof?.display_name || povPubkey.slice(0, 12) + '…',
          picture: prof?.picture || null,
        });
      } catch {}
    })();
  }, []);

  return houseProfile;
}
