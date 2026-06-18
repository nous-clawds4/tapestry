/**
 * Shared note enrichment — turns raw kind-1 events into the enriched feed/note item
 * shape every read path serves, so the logic (and future improvements) live in ONE
 * place. The live feed uses it today; the profile "latest note" and per-user notes
 * read paths are expected to use it next. Read paths differ only in how they SELECT
 * the raw events; they all run this same enrichment to produce the same item shape:
 *
 *     { id, pubkey, createdAt, content,
 *       author:   { displayName, avatar },              // from local kind-0
 *       mentions: { <pubkey>: <displayName> } }          // resolved nostr:npub/nprofile refs
 *
 * Constraints (mirror the feed read path's contract):
 *  - LOCAL only: author + mention profiles come from the injected local kind-0 scan,
 *    never an external relay fetch.
 *  - One scan covers authors + mentioned pubkeys (the lookup set, bounded — see cap).
 *  - Display names are self-asserted kind-0 metadata, NOT point-of-view-dependent, so
 *    this enrichment is global. POV-DEPENDENT decorations (e.g. "is this mentioned/
 *    replied-to author in *my* WoT?") must take the POV/source as a parameter and
 *    compute per-view — do not bake a global answer into this shape.
 *
 * Pure but for the injected `scanStrfry` seam: `enrichNotes(notes, scanStrfry)`.
 */

// nip19 (for decoding NIP-21 mention references) loaded the lazy, path-tolerant way the
// rest of the codebase uses: the container's absolute path first, then a bare require
// (which resolves in test/CI and from brainstorm's node_modules). If neither loads,
// mention resolution simply no-ops — it never breaks a read path.
const NOSTR_TOOLS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools';

// Upper bound on pubkeys passed to a single local kind-0 scan (authors + mentions).
// Authors are bounded by the read path's own cap; this bounds the mention set so a note
// stuffed with thousands of refs can't push the `strfry scan` argument past the OS
// arg-length limit. Excess mentions simply keep their npub fallback in the UI.
const PROFILE_LOOKUP_CAP = 1000;

let _nip19;
function loadNip19() {
  if (_nip19 !== undefined) return _nip19;
  try { _nip19 = require(NOSTR_TOOLS_PATH).nip19; }
  catch {
    try { _nip19 = require('nostr-tools').nip19; }
    catch { _nip19 = null; }
  }
  return _nip19;
}

// The pubkeys referenced by `nostr:npub…` / `nostr:nprofile…` mentions in a note's
// text (NIP-21). Undecodable refs are skipped; nsec/event refs are never matched.
function extractMentionPubkeys(content) {
  if (typeof content !== 'string' || content.length === 0) return [];
  const nip19 = loadNip19();
  if (!nip19) return [];
  const re = /nostr:((?:npub|nprofile)1[02-9ac-hj-np-z]+)/g;
  const out = [];
  let m;
  while ((m = re.exec(content)) !== null) {
    try {
      const dec = nip19.decode(m[1]);
      if (dec.type === 'npub' && dec.data) out.push(dec.data);
      else if (dec.type === 'nprofile' && dec.data && dec.data.pubkey) out.push(dec.data.pubkey);
    } catch { /* undecodable ref → skip */ }
  }
  return out;
}

/**
 * Enrich raw kind-1 events with author display name + avatar and resolved mention
 * display names, all from LOCAL kind-0 profile data only (via the injected scanStrfry).
 * Missing author profile ⇒ { displayName: null, avatar: null }. `mentions` includes
 * only refs we can resolve locally (the UI falls back to a truncated npub otherwise).
 *
 * @param {Array} notes - raw kind-1 events ({ id, pubkey, created_at, content })
 * @param {Function} scanStrfry - local strfry scan: (filter) => events[]
 * @returns {Promise<Array>} enriched items (see module header for the shape)
 */
async function enrichNotes(notes, scanStrfry) {
  const mentionsByNote = notes.map(n => extractMentionPubkeys(n.content));
  // Authors are always looked up; mentioned pubkeys fill the rest up to
  // PROFILE_LOOKUP_CAP so a ref-stuffed note can't overflow the local scan argument.
  const authorPubkeys = [...new Set(notes.map(n => n.pubkey))];
  const mentionedPubkeys = [...new Set(mentionsByNote.flat())].filter(pk => !authorPubkeys.includes(pk));
  const lookup = [...authorPubkeys, ...mentionedPubkeys].slice(0, PROFILE_LOOKUP_CAP);
  const profiles = new Map();
  if (lookup.length > 0) {
    let events = [];
    try {
      events = (await scanStrfry({ kinds: [0], authors: lookup })) || [];
    } catch { events = []; }
    for (const ev of events) {
      if (!ev || ev.kind !== 0) continue;
      const prev = profiles.get(ev.pubkey);
      if (prev && prev.created_at >= ev.created_at) continue;
      let parsed = {};
      try { parsed = JSON.parse(ev.content) || {}; } catch { parsed = {}; }
      profiles.set(ev.pubkey, {
        created_at: ev.created_at,
        displayName: parsed.display_name || parsed.name || null,
        avatar: parsed.picture || null,
      });
    }
  }
  return notes.map((n, i) => {
    const p = profiles.get(n.pubkey);
    const mentions = {};
    for (const pk of mentionsByNote[i]) {
      const mp = profiles.get(pk);
      if (mp && mp.displayName) mentions[pk] = mp.displayName;
    }
    return {
      id: n.id,
      pubkey: n.pubkey,
      createdAt: n.created_at,
      content: n.content,
      author: {
        displayName: p ? p.displayName : null,
        avatar: p ? p.avatar : null,
      },
      mentions,
    };
  });
}

module.exports = { enrichNotes, extractMentionPubkeys, PROFILE_LOOKUP_CAP };
