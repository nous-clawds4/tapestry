import { useNavigate } from 'react-router-dom';

function shortPubkey(pk) {
  if (!pk) return '—';
  return pk.slice(0, 8) + '…';
}

/**
 * Clickable author cell with avatar + name. Links to /kg/users/:pubkey.
 * Pass `profiles` map and `pubkey`. Stops event propagation to avoid triggering row clicks.
 */
export default function AuthorCell({ pubkey, profiles, size }) {
  const navigate = useNavigate();

  if (!pubkey) return <span className="text-muted">—</span>;

  const p = profiles?.[pubkey];
  const displayName = p?.display_name || p?.name || shortPubkey(pubkey);
  const pic = p?.picture;

  function handleClick(e) {
    e.stopPropagation();
    navigate(`/kg/users/${pubkey}`);
  }

  const sizeStyle = size ? { width: size, height: size } : undefined;

  return (
    <span className="author-cell author-cell-link" title={pubkey} onClick={handleClick}>
      {pic ? (
        <img src={pic} alt="" className="author-avatar" style={sizeStyle} />
      ) : (
        <span className="author-avatar-placeholder" style={sizeStyle} />
      )}
      <span className="author-name">{displayName}</span>
    </span>
  );
}
