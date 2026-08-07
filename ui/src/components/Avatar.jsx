import { useState } from 'react';
import { useConfig } from '../context/ConfigContext';

/**
 * A user's avatar, with the Tapestry Assistant badged.
 *
 * The assistant is a real nostr user that signs on the instance owner's behalf,
 * so its avatar answers two questions at once: it shows the OWNER'S picture
 * (whose assistant) wearing the brand mark (that it is the assistant). ADR
 * ta-avatar/0001.
 *
 * Pictures are tried in order and each one that fails to load is dropped, so a
 * dead URL falls through to the lettered tier instead of leaving the browser's
 * broken-image glyph — the behavior every avatar site in this app is missing.
 * The badge is attached to the wrapper, not the image, so it survives that fall.
 *
 * @param {string}  pubkey   whose avatar this is
 * @param {object=} profile  that pubkey's kind-0, if the caller already has it
 * @param {number=} size     pixel diameter
 */
export default function Avatar({ pubkey, profile, size = 40, className }) {
  // The assistant pubkey is created per deployment and is recreated whenever the
  // identity is — it is never a literal (CLAUDE.md § "Per-deployment TA pubkey").
  const { taPubkey, ownerProfile } = useConfig();
  const [dead, setDead] = useState({});

  const isTA = !!pubkey && !!taPubkey && pubkey === taPubkey;

  const ownerName = ownerProfile?.display_name || ownerProfile?.name || '';
  const subjectName = profile?.display_name || profile?.name || '';

  // The assistant borrows the owner's face; its own kind-0 (usually unpublished)
  // is the fallback. Everyone else has only their own.
  const candidates = (isTA ? [ownerProfile?.picture, profile?.picture] : [profile?.picture])
    .filter(Boolean);
  const src = candidates.find((url) => !dead[url]);

  // The letter names whoever the picture would have shown — the owner for the
  // assistant, so even a pictureless instance still says whose assistant it is.
  const letterFrom = isTA ? ownerName : subjectName;
  const letter = (letterFrom || '?').trim().charAt(0).toUpperCase() || '?';

  const label = isTA ? `Tapestry Assistant of ${ownerName || 'this instance'}` : undefined;

  return (
    <span
      className={`avatar-wrap${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
      title={label}
      aria-label={label}
      role={label ? 'img' : undefined}
    >
      {src ? (
        <img
          className="avatar-img"
          src={src}
          alt=""
          onError={() => setDead((d) => (d[src] ? d : { ...d, [src]: true }))}
        />
      ) : (
        <span className="avatar-initial" style={{ fontSize: Math.round(size * 0.42) }}>{letter}</span>
      )}
      {isTA && <img className="avatar-ta-badge" src="/ta-badge.svg" alt="" />}
    </span>
  );
}
