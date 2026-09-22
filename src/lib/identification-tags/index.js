'use strict';
/**
 * Identification tags — the four taggings that make the handshake between a person and their Tapestry Assistant
 * (assistant-identification-tags #1, ADR 0001 sub-decisions 1–3):
 *
 *   you on your Assistant:   My Tapestry Assistant, My Agent
 *   your Assistant on you:   My Tapestry Owner, My Human
 *
 * Pure, dependency-free CommonJS, on purpose: the server checks from it (src/api/assistant/attention.js), the UI
 * imports it through the Vite alias @tapestry/identification-tags, and the Node runner loads it as it is.
 *
 * CANONICAL_TAG_AUTHOR is the OWNER'S OWN KEY — the npub BIBLE §20 lists for wds4/straycat — naming the four
 * well-known tag definitions the owner publishes once, so every Tapestry instance and every outside reader looks
 * for the same four addresses (Discovery decision 5, product-team/discoveries/assistant-identification-tags.md).
 * It is a publishing convention, never a read filter, never a signer, and NOT a Tapestry Assistant pubkey: the
 * per-deployment TA is resolved at runtime everywhere (CLAUDE.md house rule), and this constant is never used as an
 * authors: filter, in a concept handle, or to sign anything. A tagging of a same-named tag by any other author counts
 * as present all the same (principle 2: publication is permissionless; trust is filtered at read time).
 */

const CANONICAL_TAG_AUTHOR = 'e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f';

/** Every tagging's d tag starts with this (protocols/drafts/tags.md § Taggings; ui/src/utils/publishProfileTag.js). */
const TAGGING_D_PREFIX = 'profile-tag-';

/** The canonical address of a required tag's definition: 39999:<the owner's key>:<slug>. */
function canonicalTagAddress(slug) {
  return `39999:${CANONICAL_TAG_AUTHOR}:${slug}`;
}

/**
 * The required taggings, in order — one list, the same on every instance, shipped with the app (Discovery
 * decision 7). `signer` is who signs the tagging; `target` whom it tags. Adding a tagging later is one entry (and,
 * if needed, its canonical tag).
 */
const REQUIRED_TAGGINGS = Object.freeze([
  { key: 'my-tapestry-assistant', name: 'My Tapestry Assistant', slug: 'my-tapestry-assistant', signer: 'person', target: 'assistant' },
  { key: 'my-agent', name: 'My Agent', slug: 'my-agent', signer: 'person', target: 'assistant' },
  { key: 'my-tapestry-owner', name: 'My Tapestry Owner', slug: 'my-tapestry-owner', signer: 'assistant', target: 'person' },
  { key: 'my-human', name: 'My Human', slug: 'my-human', signer: 'assistant', target: 'person' },
].map((entry) => Object.freeze({ ...entry, address: canonicalTagAddress(entry.slug) })));

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
  CANONICAL_TAG_AUTHOR,
  TAGGING_D_PREFIX,
  REQUIRED_TAGGINGS,
  canonicalTagAddress,
  taggingDTag,
  readPolarity,
  polarityBucket,
  isTagging,
  signerAndTarget,
};
