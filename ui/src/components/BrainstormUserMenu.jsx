import { useState, useEffect, useRef } from 'react';
import { usePov } from '../context/PovContext';

/**
 * Compact user avatar + dropdown menu for Brainstorm Search pages.
 * Shows avatar, welcome, a POV SWITCH (House ⇄ My WoT) writing through the shared
 * PovContext selection (pov-selectable-tag-surfaces Story 4), settings link, sign out.
 */
export default function BrainstormUserMenu({ user, login, logout }) {
  const [open, setOpen] = useState(false);
  // The POV selection is the single shared PovContext value — not local state
  // (Story 4: one writer, so changing it here reflects everywhere).
  const { selectedPov, setSelectedPov } = usePov() || {};
  const pov = selectedPov || 'nosfabrica';
  const [hasDelegate, setHasDelegate] = useState(false); // "My WoT" offered only when a delegate is configured
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
      // "My WoT" is offered only when the viewer has a delegate configured
      // (rankAuthor). The selection itself comes from PovContext, not here.
      try {
        const resp = await fetch('/api/user-prefs');
        const data = await resp.json();
        if (data.success && data.preferences?.rankAuthor) setHasDelegate(true);
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
    return <button className="bs-link-btn" onClick={() => login().catch(() => {})}>Sign in with nostr</button>;
  }

  const displayName = user.profile?.name || user.pubkey.slice(0, 8) + '…';
  const picture = user.profile?.picture;
  const isOwnerOrAdmin = user.classification === 'owner' || user.classification === 'admin';

  const houseName = houseProfile?.name || 'House';

  return (
    <div className="bs-usermenu" ref={menuRef}>
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
            <div className="bs-usermenu-pov-switch" role="group" aria-label="Point of view">
              <span className="bs-usermenu-pov-switch-label">Searching as</span>
              <div className="bs-usermenu-pov-switch-btns">
                <button
                  type="button"
                  className={`bs-usermenu-pov-btn${pov !== 'user' ? ' is-active' : ''}`}
                  onClick={() => setSelectedPov && setSelectedPov('nosfabrica')}
                >
                  {houseProfile?.picture && (
                    <img src={houseProfile.picture} alt="" className="bs-usermenu-pov-avatar" onError={e => { e.target.style.display = 'none'; }} />
                  )}
                  {houseName}
                </button>
                <button
                  type="button"
                  className={`bs-usermenu-pov-btn${pov === 'user' ? ' is-active' : ''}`}
                  disabled={!hasDelegate}
                  title={hasDelegate ? 'Use your personal Web of Trust' : 'Set up your Web of Trust in Settings to use My WoT'}
                  onClick={() => hasDelegate && setSelectedPov && setSelectedPov('user')}
                >
                  My WoT
                </button>
              </div>
            </div>
          </div>

          <div className="bs-usermenu-footer">
            <a
              href="/pins"
              className="bs-usermenu-pins-btn"
              onClick={() => setOpen(false)}
            >
              📌 Your pins
            </a>
            <a
              href="/settings"
              className="bs-usermenu-settings-btn"
              onClick={() => setOpen(false)}
            >
              ⚙️ Settings
            </a>
            <button className="bs-usermenu-signout" onClick={() => { setOpen(false); logout(); }}>
              Sign out
            </button>
          </div>

          {isOwnerOrAdmin && (
            <div className="bs-usermenu-admin-panel">
              <div className="bs-usermenu-admin-label">
                <span className="bs-usermenu-admin-dot" />
                {user.classification === 'owner' ? 'Owner' : 'Admin'}
              </div>
              <a
                href="/tapestry/"
                className="bs-usermenu-admin-btn"
                onClick={() => setOpen(false)}
              >
                Tapestry Dashboard
              </a>
              <a
                href="/legacy/"
                className="bs-usermenu-admin-btn"
                onClick={() => setOpen(false)}
              >
                Legacy Dashboard
              </a>
            </div>
          )}
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
