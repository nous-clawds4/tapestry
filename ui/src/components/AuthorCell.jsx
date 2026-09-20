import { useNavigate } from 'react-router-dom';
import Avatar from './Avatar';
import { useConfig } from '../context/ConfigContext';
import { PROFILE_LOOKUP_FAILED } from '../utils/profileBatch';

function shortPubkey(pk) {
  if (!pk) return '—';
  return pk.slice(0, 8) + '…';
}

/**
 * Clickable author cell with avatar + name. Links to /tapestry/users/:pubkey.
 * Pass `profiles` map and `pubkey`. Stops event propagation to avoid triggering row clicks.
 *
 * The avatar is delegated to <Avatar>, which badges the Tapestry Assistant and
 * handles picture failures (ADR ta-avatar/0001) — this component's props are
 * unchanged, so every call site gets both without editing.
 *
 * The same lever carries the failed-lookup state (ADR profile-lookup-bounds/0001): when the
 * lookup could not be completed we say so, rather than showing a truncated pubkey as though
 * it were the answer. That is distinct from an author who has simply published no profile.
 */
export default function AuthorCell({ pubkey, profiles, size }) {
  const navigate = useNavigate();
  const { taPubkey } = useConfig();

  if (!pubkey) return <span className="text-muted">—</span>;

  const raw = profiles?.[pubkey];
  const lookupFailed = raw === PROFILE_LOOKUP_FAILED;
  const p = lookupFailed ? null : raw;
  // A fresh instance's assistant has published no kind-0, so without this it
  // would be listed as a truncated pubkey — naming nothing to a reader.
  const unnamed = pubkey === taPubkey ? 'Tapestry Assistant' : shortPubkey(pubkey);
  const displayName = p?.display_name || p?.name || unnamed;

  function handleClick(e) {
    e.stopPropagation();
    navigate(`/tapestry/users/${pubkey}`);
  }

  if (lookupFailed) {
    // `unnamed`, not the raw short pubkey: the TA's identity comes from config, so a failed
    // lookup tells us nothing about WHO this is and we still know. The ⚠ carries the
    // "couldn't check" signal without throwing away a name we already had.
    return (
      <span
        className="author-cell author-cell-link author-cell-unresolved"
        title={`${pubkey}\n\nCouldn't load this author's name — the profile lookup failed. Reload to try again.`}
        onClick={handleClick}
      >
        <Avatar pubkey={pubkey} profile={null} size={size || 40} />
        <span className="author-name">{unnamed}</span>
        <span className="author-name-unresolved" aria-label="author name unavailable">⚠</span>
      </span>
    );
  }

  return (
    <span className="author-cell author-cell-link" title={pubkey} onClick={handleClick}>
      <Avatar pubkey={pubkey} profile={p} size={size || 40} />
      <span className="author-name">{displayName}</span>
    </span>
  );
}
