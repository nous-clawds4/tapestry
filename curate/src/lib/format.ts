/**
 * Small display formatters — relative time, short pubkey, count pluralization.
 */

import { nip19 } from "nostr-tools";

/** Convert hex pubkey to npub, then shorten for display: `npub1abc…wxyz`. */
export function shortNpub(hexPubkey: string, head = 8, tail = 4): string {
  if (!hexPubkey) return "";
  try {
    const npub = nip19.npubEncode(hexPubkey);
    if (npub.length <= head + tail + 1) return npub;
    return `${npub.slice(0, head)}…${npub.slice(-tail)}`;
  } catch {
    // Fallback if encoding fails
    return shortHex(hexPubkey);
  }
}

/** Get the best display name for a profile, with fallback to npub. */
export function profileDisplayName(profile: {
  displayName?: string;
  name?: string;
  nip05?: string;
  pubkey: string;
} | null, hexPubkey: string): string {
  if (profile?.displayName) return profile.displayName;
  if (profile?.name) return profile.name;
  if (profile?.nip05) return profile.nip05;
  return shortNpub(hexPubkey);
}

export function formatRelativeTime(epochSeconds: number, now = Date.now()): string {
  if (!epochSeconds) return "—";
  const deltaMs = now - epochSeconds * 1000;
  const sec = Math.round(deltaMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.round(day / 365);
  return `${yr}y ago`;
}

/** Shorten a hex pubkey to `abc…xyz` for inline display. */
export function shortHex(hex: string, head = 4, tail = 4): string {
  if (!hex) return "";
  if (hex.length <= head + tail + 1) return hex;
  return `${hex.slice(0, head)}…${hex.slice(-tail)}`;
}

export function pluralizeCount(n: number, singular: string, plural?: string): string {
  if (n === 1) return `1 ${singular}`;
  return `${n.toLocaleString()} ${plural ?? singular + "s"}`;
}
