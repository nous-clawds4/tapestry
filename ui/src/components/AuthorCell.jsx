import { useNavigate } from 'react-router-dom';
import Avatar from './Avatar';
import { useConfig } from '../context/ConfigContext';

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
 */
export default function AuthorCell({ pubkey, profiles, size }) {
  const navigate = useNavigate();
  const { taPubkey } = useConfig();

  if (!pubkey) return <span className="text-muted">—</span>;

  const p = profiles?.[pubkey];
  // A fresh instance's assistant has published no kind-0, so without this it
  // would be listed as a truncated pubkey — naming nothing to a reader.
  const unnamed = pubkey === taPubkey ? 'Tapestry Assistant' : shortPubkey(pubkey);
  const displayName = p?.display_name || p?.name || unnamed;

  function handleClick(e) {
    e.stopPropagation();
    navigate(`/tapestry/users/${pubkey}`);
  }

  return (
    <span className="author-cell author-cell-link" title={pubkey} onClick={handleClick}>
      <Avatar pubkey={pubkey} profile={p} size={size || 40} />
      <span className="author-name">{displayName}</span>
    </span>
  );
}
