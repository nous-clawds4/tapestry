/**
 * Who owns an Assistant, for GUM₂ (the owner's rule of 2026-10-02): a person owns an Assistant when
 * they tagged it My Brainstorm Assistant or My Tapestry Assistant — by exactly the rule My Assistants
 * reads a viewer's own list with (myAssistantRows: the newest stance per tag and profile, not
 * retracted, an apply) — or when it is their Assistant on this instance's roster.
 *
 * `ownersFromTaggings` is pure; `resolveOwners` reads this instance's relay (the owner's decision: no
 * cross-instance read) and the roster, and is what the Dictionary read calls.
 */

'use strict';

const { myAssistantRows } = require('../assistant/myAssistants');

const CHUNK = 400;

/**
 * Map assistant pubkey → [owner pubkeys], from kind-39999 nostr-user-tag taggings, the kind-5
 * deletions their signers published, and the roster ([{ accountPubkey, assistantPubkey }]).
 * Every tagger is read as a viewer of their own list, so only their own stances count for them.
 */
function ownersFromTaggings({ taggings, deletions, roster } = {}) {
  const owners = new Map();
  const add = (assistant, owner) => {
    if (!assistant || !owner || assistant === owner) return;
    if (!owners.has(assistant)) owners.set(assistant, []);
    if (!owners.get(assistant).includes(owner)) owners.get(assistant).push(owner);
  };
  const byTagger = new Map();
  for (const ev of Array.isArray(taggings) ? taggings : []) {
    if (!ev || typeof ev.pubkey !== 'string') continue;
    if (!byTagger.has(ev.pubkey)) byTagger.set(ev.pubkey, []);
    byTagger.get(ev.pubkey).push(ev);
  }
  for (const [viewer, events] of byTagger) {
    const dels = (Array.isArray(deletions) ? deletions : []).filter((d) => d && d.pubkey === viewer);
    for (const row of myAssistantRows({ viewer, local: null, taggings: events, deletions: dels })) {
      if (row.tags.length > 0) add(row.pubkey, viewer);
    }
  }
  for (const r of Array.isArray(roster) ? roster : []) add(r && r.assistantPubkey, r && r.accountPubkey);
  return owners;
}

/**
 * The owners of `pubkeys`, read from this instance's strfry: the taggings that name them (`#p`, the
 * canonical nostr-user-tag z), their signers' deletions of those taggings, and the roster.
 * deps: { scan(filter, project) → events, zTag() → the z value, roster() → [{ accountPubkey, assistantPubkey }] }.
 */
async function resolveOwners(pubkeys, deps) {
  const list = [...new Set((Array.isArray(pubkeys) ? pubkeys : []).filter((p) => /^[0-9a-f]{64}$/.test(p || '')))];
  if (!list.length) return new Map();
  const full = (ev) => ({ id: ev.id, kind: ev.kind, pubkey: ev.pubkey, created_at: ev.created_at, tags: ev.tags || [] });
  // In parts: strfry takes a filter as one command-line argument, which Linux caps at 128 KiB.
  const scanIn = async (key, values, filter) => {
    const out = [];
    for (let i = 0; i < values.length; i += CHUNK) out.push(...await deps.scan({ ...filter, [key]: values.slice(i, i + CHUNK) }, full));
    return out;
  };
  const taggings = await scanIn('#p', list, { kinds: [39999], '#z': [deps.zTag()] });
  const ids = taggings.map((ev) => ev.id);
  const addresses = [...new Set(taggings.map((ev) => {
    const d = (ev.tags || []).find((t) => t && t[0] === 'd')?.[1];
    return typeof d === 'string' ? `39999:${ev.pubkey}:${d}` : null;
  }).filter(Boolean))];
  const taggers = [...new Set(taggings.map((ev) => ev.pubkey))];
  const deletions = [];
  for (let i = 0; i < taggers.length; i += CHUNK) {
    const authors = taggers.slice(i, i + CHUNK);
    deletions.push(...await scanIn('#e', ids.filter((id, k) => authors.includes(taggings[k].pubkey)), { kinds: [5], authors }));
    deletions.push(...await scanIn('#a', addresses.filter((a) => authors.includes(a.split(':')[1])), { kinds: [5], authors }));
  }
  let roster = [];
  try { roster = await deps.roster(); } catch { roster = []; }
  return ownersFromTaggings({ taggings, deletions, roster });
}

module.exports = { ownersFromTaggings, resolveOwners };
