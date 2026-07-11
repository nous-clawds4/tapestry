import { Link } from 'react-router-dom';
import { parseNostrContent } from '../utils/nostrEntities';

/**
 * Render a note's text content with NIP-21 `nostr:` entity references turned into
 * in-app links — the standard nostr-client treatment: `nostr:npub…`/`nostr:nprofile…`
 * become profile mentions (→ /user/<pubkey>), and `nostr:note…`/`nostr:nevent…`/
 * `nostr:naddr…` become event links (→ /event?…). Everything else renders as plain
 * text; the parent's white-space:pre-wrap preserves newlines/spacing.
 *
 * A profile mention shows the person's display name ("@name") when the read path
 * resolved it (the optional `mentions` map: pubkey → displayName, from local kind-0);
 * otherwise it falls back to the truncated npub the parser produced. The exact npub
 * is always available on hover (title).
 *
 * All parsing/decoding lives in the pure parseNostrContent helper; this component is
 * just the React mapping over its segments. Links are react-router <Link>s (SPA nav),
 * matching the feed's author links.
 */
export default function NoteContent({ content, mentions }) {
  const segments = parseNostrContent(content);
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'profile') {
          const name = mentions && seg.pubkey ? mentions[seg.pubkey] : null;
          const label = name ? `@${name}` : seg.label;
          return (
            <Link key={i} to={seg.href} className="bsp-note-mention" title={seg.bech32}>
              {label}
            </Link>
          );
        }
        if (seg.type === 'event') {
          return (
            <Link key={i} to={seg.href} className="bsp-note-entity" title={seg.bech32}>
              {seg.label}
            </Link>
          );
        }
        return <span key={i}>{seg.text}</span>;
      })}
    </>
  );
}
