/**
 * Brain-first tapestry authoring — the post-import publish hook.
 * ADR:   engineering-team/decisions/tapestries/0007-brain-first-authoring-publish-hook.md
 * Story: engineering-team/stories/tapestries/7-brain-first-tapestry-authoring.md
 *
 * "The instance learns the letters it mails" (BIBLE §30): when the shared
 * publish endpoint accepts one of the instance's OWN tapestry letters
 * (kind-39999, z-tagged to this instance's tapestry concept, authored by the
 * TA or the owner), the brain learns it in the same request — import the
 * event node + tag nodes, label it a ListItem, place it under the tapestry
 * concept's superset, stamp a tapestryKey (assigned once — BIBLE §29), and
 * derive the LMDB doc FROM the brain (derivation, never a co-equal authored
 * copy).
 *
 * Deliberately scoped (ADR 0007): third-party letters keep publishing
 * permissionlessly (ADR security-auth-exposure/0002) and are NOT imported
 * here — that is the stage-2 general ingest's lane (OPEN.md #136), which
 * owns provenance. Failures REPORT, never throw: by the time this runs the
 * letter is already accepted by strfry and cannot be unsent, so a brain-write
 * error must not turn a successful publish into a failed response.
 */
const crypto = require('crypto');
const { runCypher, writeCypher } = require('../../lib/neo4j-driver');
const { importEventDirect } = require('../normalize/helpers');
const { deriveByKey } = require('../../lib/tapestry-derive');
const store = require('../../lib/tapestry-store');
const { getOwnerAssistantPubkey } = require('../../utils/assistantKeys');
const { getOwnerPubkey } = require('../../utils/config');

/**
 * Pure guard: is this letter one of the instance's own tapestry elements?
 * Dependency-injected keys keep the allow-list unit-testable without the
 * stack; maybeBrainWriteTapestry supplies the runtime-resolved values
 * (never hardcode the TA or owner pubkey — CLAUDE.md).
 */
function isOwnedTapestryEvent(event, { taPubkey, ownerPubkey } = {}) {
  if (!event || event.kind !== 39999 || !taPubkey) return false;
  const tags = Array.isArray(event.tags) ? event.tags : [];
  const z = tags.find((t) => Array.isArray(t) && t[0] === 'z');
  if (!z || z[1] !== `39998:${taPubkey}:tapestry`) return false;
  if (typeof event.pubkey !== 'string' || event.pubkey.length === 0) return false;
  return event.pubkey === taPubkey || (!!ownerPubkey && event.pubkey === ownerPubkey);
}

/**
 * Post-import hook. Returns null when the event is not one of the instance's
 * own tapestry letters (the common case — every non-tapestry publish), else
 * a report object: { success, uuid, tapestryKey, derived } on success,
 * { success: false, uuid, error } on an internal failure.
 */
async function maybeBrainWriteTapestry(signedEvent) {
  let uuid = null;
  try {
    const taPubkey = getOwnerAssistantPubkey();
    const ownerPubkey = getOwnerPubkey();
    if (!isOwnedTapestryEvent(signedEvent, { taPubkey, ownerPubkey })) return null;

    const dTag = (signedEvent.tags || []).find((t) => t[0] === 'd')?.[1];
    if (!dTag) return null; // no coordinate → not an addressable element

    uuid = `39999:${signedEvent.pubkey}:${dTag}`;

    // 1. Brain node + tag nodes (MERGE by uuid; refreshes HAS_TAG on republish).
    await importEventDirect(signedEvent, uuid);

    // 2. ListItem label + slug (word.slug, else tapestry.slug — mirrors
    //    normalize's create-element labeling).
    let parsed = {};
    try {
      parsed = JSON.parse((signedEvent.tags || []).find((t) => t[0] === 'json')?.[1] || '{}');
    } catch { /* unparseable json → label without a slug */ }
    const slug = (parsed && (parsed.word?.slug || parsed.tapestry?.slug)) || null;
    if (slug) {
      await writeCypher('MATCH (e:NostrEvent {uuid: $uuid}) SET e:ListItem, e.slug = $slug', { uuid, slug });
    } else {
      await writeCypher('MATCH (e:NostrEvent {uuid: $uuid}) SET e:ListItem', { uuid });
    }

    // 3. Explicit placement under the tapestry concept's superset (idempotent).
    //    Prune-safe: firmware's transitive-reduction only deletes a direct
    //    superset edge when a longer class-thread path exists; tapestry has
    //    no subsets.
    await writeCypher(`
      MATCH (h:ListHeader {uuid: $handle})-[:IS_THE_CONCEPT_FOR]->(sup)
      MATCH (e:NostrEvent {uuid: $uuid})
      MERGE (sup)-[:HAS_ELEMENT]->(e)
    `, { handle: `39998:${taPubkey}:tapestry`, uuid });

    // 4. tapestryKey — assigned once, never changed (BIBLE §29).
    await writeCypher(
      'MATCH (e:NostrEvent {uuid: $uuid}) SET e.tapestryKey = coalesce(e.tapestryKey, $fresh)',
      { uuid, fresh: crypto.randomUUID() }
    );
    const keyRows = await runCypher('MATCH (e:NostrEvent {uuid: $uuid}) RETURN e.tapestryKey AS key', { uuid });
    const tapestryKey = (keyRows[0] && keyRows[0].key) || null;
    if (!tapestryKey) throw new Error('tapestryKey did not stick on the element node');

    // 5. Derive the LMDB doc FROM the brain (ListItem → generic word deriver;
    //    preserves authored tapestry/graph, adds word + graphContext).
    //    Invalidate the cached doc first: the deriver's base prefers an
    //    existing LMDB entry over the node's json tag, so a republish would
    //    otherwise re-derive from its own stale output. This caller KNOWS the
    //    content just changed — clearing the entry makes the deriver fall back
    //    to the brain's fresh json tag (derivation stays brain-sourced, §29).
    await store.remove(tapestryKey);
    const derived = await deriveByKey(tapestryKey);

    return { success: true, uuid, tapestryKey, derived: !!derived };
  } catch (error) {
    console.error('tapestryBrainWrite failed (publish already accepted):', error.message);
    return { success: false, uuid, error: error.message };
  }
}

module.exports = { maybeBrainWriteTapestry, isOwnedTapestryEvent };
