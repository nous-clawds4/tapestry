/**
 * Tag applicability — the two human-readable, pubkey-free z-hints a newly-created
 * tag-element carries to record its creation context (tag-applicability Story 1 / ADR
 * tag-applicability/0001).
 *
 * These are the LOWEST rung of the z-tag ladder (DList-NIP permitted): plain literals
 * with NO pubkey — do NOT compose them from the TA pubkey. Defined ONCE here and consumed
 * by BOTH the note flow (builders.js / apply.js, same package) and the profile flow
 * (ui/src/hooks/useProfileTags.js, via the @tapestry/event-tagging alias), so the wire
 * convention has a single source of truth (the geo:lon/long/lng lesson).
 *
 * They are HINTS — the author's optional statement of intent — never a gate. Every existing
 * reader must treat a tag-element carrying them identically to one without (they match no
 * concept-handle pattern, so they are inert by construction).
 *
 * A future graduation to a-tag handles is anticipated and will be bridged by a pointer-typed
 * b-tag — out of scope here.
 */

const TAG_FOR_NOSTR_PUBKEY_Z = 'tag-for-nostr-pubkey';
const TAG_FOR_NOSTR_EVENT_Z = 'tag-for-nostr-event';

module.exports = { TAG_FOR_NOSTR_PUBKEY_Z, TAG_FOR_NOSTR_EVENT_Z };
