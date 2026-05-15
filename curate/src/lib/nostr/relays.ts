/**
 * Default relay set for Curate. Sourced from feat/communities
 * config/concept-graph.conf.template — `dcosl.brainstorm.world` is the
 * highest-priority target because it's Tapestry's primary DList relay
 * and the lists we want to discover live there.
 */
export const DEFAULT_RELAYS = [
  "wss://dcosl.brainstorm.world",
  "wss://relay.damus.io",
  "wss://relay.primal.net",
  "wss://nos.lol",
  "wss://relay.nostr.band",
] as const;

export type RelayUrl = string;

const WSS_RE = /^wss:\/\/[^\s]+$/i;

export function isValidRelayUrl(url: string): boolean {
  return WSS_RE.test(url.trim());
}

export function normalizeRelayUrl(url: string): string {
  const trimmed = url.trim();
  // Strip trailing slash for consistent identity.
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}
