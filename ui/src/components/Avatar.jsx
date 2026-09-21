import { useState } from 'react';
import { useConfig } from '../context/ConfigContext';
import { useAssistantRoster } from '../context/AssistantRosterContext';
import { assistantPubkeys } from '../utils/authorScope';

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
  const { assistants } = useAssistantRoster();
  const [dead, setDead] = useState({});

  // Widened from "is the owner's assistant" to "is an assistant this instance controls"
  // (ADR author-scoped-inspection/0002). With several assistants in one column, badging only the
  // owner's reads as a distinction that is not there. The taPubkey test stays as a fast path so
  // the owner's assistant is still badged before the roster resolves.
  const isOwnerTA = !!pubkey && !!taPubkey && pubkey === taPubkey;
  const isTA = isOwnerTA || (!!pubkey && assistantPubkeys(assistants).has(pubkey));

  const ownerName = ownerProfile?.display_name || ownerProfile?.name || '';
  const subjectName = profile?.display_name || profile?.name || '';

  // The OWNER's assistant borrows the owner's face; its own kind-0 (usually unpublished) is the
  // fallback. Everyone else — including another account's assistant — has only their own, and
  // falls through to the lettered tier when they have none. Generalising the borrowing would need
  // a profile fetch per controller; deliberately not built (ADR author-scoped-inspection/0002).
  const candidates = (isOwnerTA ? [ownerProfile?.picture, profile?.picture] : [profile?.picture])
    .filter(Boolean);
  const src = candidates.find((url) => !dead[url]);

  // The letter names whoever the picture would have shown — the owner for the
  // assistant, so even a pictureless instance still says whose assistant it is.
  const letterFrom = isOwnerTA ? ownerName : subjectName;
  const letter = (letterFrom || '?').trim().charAt(0).toUpperCase() || '?';

  const label = isOwnerTA
    ? `Tapestry Assistant of ${ownerName || 'this instance'}`
    : (isTA ? 'Tapestry Assistant' : undefined);

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
