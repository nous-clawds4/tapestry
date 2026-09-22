'use strict';
/**
 * Identification tags — the taggings that make the handshake between a person and their Tapestry Assistant
 * (assistant-identification-tags #1, ADR 0001 sub-decisions 1–3; identification-tags-authorship #1, ADR 0001):
 *
 *   you on your Assistant:   My Tapestry Assistant (offered), My Agent (parked)
 *   your Assistant on you:   My Tapestry Owner (offered), My Human (parked)
 *
 * Pure, dependency-free CommonJS, on purpose: the server checks from it (src/api/assistant/attention.js), the UI
 * imports it through the Vite alias @tapestry/identification-tags, and the Node runner loads it as it is.
 *
 * Each OFFERED entry carries the author of its definition — the tag the page publishes against. "My Tapestry
 * Assistant" is the tag Nous published; "My Tapestry Owner" is the tag Nous' Tapestry Assistant published (both found
 * on the relays 2026-09-22; the story's § Background has the npubs). They are constants of the list, the same on
 * every instance: never a runtime TA pubkey, never an authors: filter on a read of taggings, never a signer. A
 * tagging of a same-named tag by any other author counts as present all the same (principle 2: publication is
 * permissionless; trust is filtered at read time); the author matters only for what a NEW tagging points at (its `a`
 * and `e`), and for finding that definition.
 *
 * A PARKED entry (offered: false) is listed so the page can show it, greyed out, but nothing reads, counts or
 * publishes it: the owner is undecided about it (2026-09-22). Unparking one is filling in its author and flipping
 * `offered`; no server or page change.
 */

/** Every tagging's d tag starts with this (protocols/drafts/tags.md § Taggings; ui/src/utils/publishProfileTag.js). */
const TAGGING_D_PREFIX = 'profile-tag-';

/** The address of an entry's definition, 39999:<its author>:<slug>; null for a parked entry, which has none. */
function definitionAddress(entry) {
  return entry && entry.offered && entry.author ? `39999:${entry.author}:${entry.slug}` : null;
}

/**
 * The taggings the page lists, in order — one list, the same on every instance, shipped with the app (Discovery
 * decision 7). `signer` is who signs the tagging; `target` whom it tags; `offered` whether the page can issue it
 * today; `author` the key that published its definition (null while parked). Adding a tagging later is one entry.
 */
const REQUIRED_TAGGINGS = Object.freeze([
  { key: 'my-tapestry-assistant', name: 'My Tapestry Assistant', slug: 'my-tapestry-assistant', signer: 'person', target: 'assistant', offered: true, author: '15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270' },
  { key: 'my-agent', name: 'My Agent', slug: 'my-agent', signer: 'person', target: 'assistant', offered: false, author: null },
  { key: 'my-tapestry-owner', name: 'My Tapestry Owner', slug: 'my-tapestry-owner', signer: 'assistant', target: 'person', offered: true, author: 'a73a298068496ba25d9d7f35839e5688cb60eab89d5aba095520d7835a9f9528' },
  { key: 'my-human', name: 'My Human', slug: 'my-human', signer: 'assistant', target: 'person', offered: false, author: null },
].map((entry) => Object.freeze({ ...entry, address: definitionAddress(entry) })));

/** The entries the page can issue and the check reads, in order. */
const OFFERED_TAGGINGS = Object.freeze(REQUIRED_TAGGINGS.filter((entry) => entry.offered));

/**
 * The replaceable address of one signer's stance on one slug and one target — the publisher's rule, verbatim
 * (ui/src/utils/publishProfileTag.js: `profile-tag-${tag.slug}-${targetPubkey.slice(0, 8)}-${authorPk.slice(0, 8)}`).
 * It embeds the slug, not the tag's author, so the newest event at it is the signer's latest stance whichever
 * same-named tag they pointed at. test/assistant-attention.test.js R1 keeps the two in step.
 */
function taggingDTag({ slug, targetPubkey, signerPubkey }) {
  return `${TAGGING_D_PREFIX}${slug}-${String(targetPubkey).slice(0, 8)}-${String(signerPubkey).slice(0, 8)}`;
}

function tagValue(event, name) {
  const tags = event && Array.isArray(event.tags) ? event.tags : [];
  const t = tags.find((x) => Array.isArray(x) && x[0] === name);
  return t ? t[1] : null;
}

/** A tagging's polarity, the way the reads take it: absent is apply (1); a non-number is apply. */
function readPolarity(event) {
  const raw = tagValue(event, 'polarity');
  if (raw == null) return 1;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 1;
}

/** ≥ 0.5 applies, ≤ −0.5 disputes, the open interval between is reserved and counts as neither. */
function polarityBucket(polarity) {
  if (polarity >= 0.5) return 'apply';
  if (polarity <= -0.5) return 'dispute';
  return 'neutral';
}

/** Is this event a tagging of a pubkey (a kind 39999 whose d starts with the tagging prefix)? */
function isTagging(event) {
  const d = tagValue(event, 'd');
  return !!event && event.kind === 39999 && typeof d === 'string' && d.startsWith(TAGGING_D_PREFIX);
}

/** Who signs a required tagging and whom it tags, for one person and their assistant. */
function signerAndTarget(entry, { personPubkey, assistantPubkey }) {
  return entry.signer === 'assistant'
    ? { signerPubkey: assistantPubkey, targetPubkey: personPubkey }
    : { signerPubkey: personPubkey, targetPubkey: assistantPubkey };
}

module.exports = {
  TAGGING_D_PREFIX,
  REQUIRED_TAGGINGS,
  OFFERED_TAGGINGS,
  definitionAddress,
  taggingDTag,
  readPolarity,
  polarityBucket,
  isTagging,
  signerAndTarget,
};
