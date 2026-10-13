import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { fetchProfilesChunked } from '../utils/profileBatch';

/**
 * "About this Brainstorm Instance": who runs this instance and how many customers it has, at the bottom of /about
 * (story about-this-instance #1, ADR about-this-instance/0001 Decision 6). The Claude Design "About" screen's layout in
 * /about's own dark styling. The same for every viewer: these are facts about the instance, not a point of view.
 */

const ACCENT = '#a5b4fc';

const labelStyle = {
  display: 'flex', alignItems: 'center', gap: '8px', margin: '1.5rem 0 0.6rem',
  fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.6,
};
const chipStyle = {
  padding: '0 8px', borderRadius: '999px', background: 'rgba(165, 180, 252, 0.15)', color: ACCENT,
  fontSize: '0.75rem', letterSpacing: 0,
};
const boxStyle = {
  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.1)', background: 'rgba(255, 255, 255, 0.03)',
};
const avatarStyle = { width: 40, height: 40, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' };
const ellipsis = { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
const noteStyle = { margin: 0, fontSize: '0.9rem', opacity: 0.7 };

/** "npub1" and the next four characters, an ellipsis, and the last four. */
function shortNpub(pubkey) {
  try {
    const npub = nip19.npubEncode(pubkey);
    return `${npub.slice(0, 9)}…${npub.slice(-4)}`;
  } catch {
    return `${pubkey.slice(0, 8)}…`;
  }
}

/** One person: avatar or initial, name, NIP-05 when there is one, and a chevron; opens their profile. */
function PersonCard({ pubkey, profile }) {
  const [pictureFailed, setPictureFailed] = useState(false);
  const name = profile?.display_name || profile?.name || shortNpub(pubkey);
  const nip05 = typeof profile?.nip05 === 'string' ? profile.nip05 : '';
  const picture = !pictureFailed && typeof profile?.picture === 'string' ? profile.picture : '';

  return (
    <Link to={`/user/${pubkey}`} style={{ ...boxStyle, color: 'inherit', textDecoration: 'none' }}>
      {picture ? (
        <img src={picture} alt="" style={avatarStyle} onError={() => setPictureFailed(true)} />
      ) : (
        <span aria-hidden="true" style={{
          ...avatarStyle, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(165, 180, 252, 0.15)', color: ACCENT, fontWeight: 700,
        }}>
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ ...ellipsis, fontWeight: 600 }}>{name}</span>
        {nip05 && <span style={{ ...ellipsis, fontSize: '0.85rem', opacity: 0.65 }}>{nip05}</span>}
      </span>
      <span aria-hidden="true" style={{ flexShrink: 0, fontSize: '1.25rem', opacity: 0.5 }}>›</span>
    </Link>
  );
}

export default function AboutThisInstance() {
  const { hash } = useLocation();
  const [state, setState] = useState({ status: 'loading', about: null });
  const [profiles, setProfiles] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let about;
      try {
        const res = await fetch('/api/about-this-instance');
        about = await res.json();
        if (!res.ok || !about || about.success !== true) throw new Error(about?.error || `HTTP ${res.status}`);
      } catch {
        if (!cancelled) setState({ status: 'failed', about: null });
        return;
      }
      if (cancelled) return;
      setState({ status: 'ready', about });

      // Names, NIP-05s and pictures for the cards. A failed lookup only leaves a card on its shortened npub.
      const people = [about.ownerPubkey, ...(about.adminPubkeys || [])].filter(Boolean);
      await fetchProfilesChunked(people, {
        isCancelled: () => cancelled,
        onBatch: (batch) => { if (!cancelled) setProfiles((prev) => ({ ...prev, ...batch })); },
      });
    })();
    return () => { cancelled = true; };
  }, []);

  // Land on the section when the address names it, on mount and again once the answer has rendered: the browser's
  // own jump happens before this single-page app has drawn the section, and the page grows when the answer arrives.
  useEffect(() => {
    if (hash !== '#this-instance') return;
    document.getElementById('this-instance')?.scrollIntoView();
  }, [hash, state.status]);

  const { status, about } = state;
  const admins = about?.adminPubkeys || [];
  const count = about?.customerCount;

  return (
    <section id="this-instance" style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
      <h2 style={{ fontSize: '1.25rem', margin: 0 }}>About this Brainstorm Instance</h2>
      <p style={{ margin: '0.4rem 0 0', fontSize: '0.95rem', opacity: 0.75 }}>
        Who runs this instance, and how many customers it serves.
      </p>

      {status === 'loading' && <p style={{ ...noteStyle, marginTop: '1.5rem' }}>Loading…</p>}

      {status === 'failed' && (
        <p role="status" style={{ ...noteStyle, marginTop: '1.5rem' }}>Couldn't load this instance's details.</p>
      )}

      {status === 'ready' && (
        <>
          <div style={labelStyle}>Owner</div>
          {about.ownerPubkey
            ? <PersonCard pubkey={about.ownerPubkey} profile={profiles[about.ownerPubkey]} />
            : <p style={noteStyle}>No owner configured</p>}

          <div style={labelStyle}>
            <span>Admins</span> <span style={chipStyle}>{admins.length}</span>
          </div>
          {admins.length === 0 ? (
            <p style={noteStyle}>No admins</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {admins.map((pubkey) => <PersonCard key={pubkey} pubkey={pubkey} profile={profiles[pubkey]} />)}
            </div>
          )}

          <div style={labelStyle}>Customers</div>
          <div style={{ ...boxStyle, alignItems: 'baseline' }}>
            {typeof count === 'number' ? (
              <>
                <span style={{ fontSize: '2rem', fontWeight: 700, color: ACCENT, lineHeight: 1 }}>{count.toLocaleString()}</span>
                <span style={{ opacity: 0.8 }}>{count === 1 ? 'customer' : 'customers'}</span>
              </>
            ) : (
              <span style={{ opacity: 0.8 }}>Customer count unavailable</span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
