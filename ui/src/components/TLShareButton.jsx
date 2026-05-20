import React, { useState } from 'react';
import { nip19 } from 'nostr-tools';
import { useConfig } from '../context/ConfigContext';

/**
 * Story 11 follow-up — copy a Trusted List's NIP-19 naddr to the clipboard.
 *
 * naddr is the standard nostr identifier for an addressable replaceable
 * event: encodes (kind, pubkey, identifier=dTag, relays). Recipients
 * paste it into other nostr clients to look up the TL anywhere.
 *
 * TA pubkey is resolved at runtime via useConfig().taPubkey — never
 * hardcode (see CLAUDE.md "Per-deployment TA pubkey").
 *
 * Props:
 *   dTag — the TL's d-tag (the addressable coordinate).
 *   variant — 'compact' (small icon-style button) or 'full' (text + icon).
 */
export default function TLShareButton({ dTag, variant = 'compact' }) {
  const { taPubkey } = useConfig();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const handleClick = async () => {
    try {
      if (!taPubkey) throw new Error('TA pubkey not yet resolved');
      const naddr = nip19.naddrEncode({
        kind: 30392,
        pubkey: taPubkey,
        identifier: dTag,
        relays: [],
      });
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(naddr);
      setCopied(true);
      setError(null);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      setError(e.message || 'Copy failed');
      setTimeout(() => setError(null), 2000);
    }
  };

  const label = variant === 'compact'
    ? (copied ? '✓' : '🔗')
    : (copied ? '✓ Copied' : '🔗 Share');

  return (
    <button
      type="button"
      className={`bs-tl-share bs-tl-share-${variant}${copied ? ' is-copied' : ''}`}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleClick(); }}
      disabled={!taPubkey}
      title={error || 'Copy NIP-19 naddr to clipboard (other nostr clients can paste this to find the Trusted List)'}
      aria-label="Copy Trusted List naddr"
    >
      {label}
    </button>
  );
}
