/**
 * Story dlist-item-tagging #5 — Pins and Trusted Lists for tagged items (kind-30394).
 *
 * Story: engineering-team/stories/dlist-item-tagging/5-pins-and-trusted-lists-for-items.md
 *        (§ Rulings 2026-09-17 override the older Design note: one failure policy for every TL
 *        kind — a failed publish KEEPS its d-tag on the cycle roster; AC-5 is the Pinned tab only;
 *        applicability lists stay outside the `z` convention.)
 * ADR:   engineering-team/decisions/dlist-item-tagging/0003-item-trusted-lists-implementation.md
 *        (supersedes the Design note where they differ), wire shape from 0002.
 * Plan:  engineering-team/test-plans/dlist-item-tagging/5-pins-and-trusted-lists-for-items.md
 *
 * TEST LEVELS
 *  - U*  : EXECUTE the new pure/injected units — the `pins.js`/`handles.js`/`builders.js` composers,
 *          `runOneItemPin` through injected deps ({ lookupTag, aggregateNotesTagged, publishTL }),
 *          `ensureTagTLHeader`, and `retractStaleTLs` over a fixture relay. No live strfry/meili.
 *  - S*  : source sentinels (exports, wiring, client surfaces, no-TA-literal rule).
 *  - R*  : regression sentinels — the 30392/30393 runners and the explicitly out-of-radius files.
 *  - FS* : firmware fixture checks — FILESYSTEM ONLY. This suite never triggers a reinstall
 *          (binding tester note, ADR 0003 §4); the live seeding proof belongs to the reviewer's
 *          post-reinstall run.
 *
 * TEST SEAMS this plan pins (binding on the Implementer, documented in the plan):
 *  1. `runOneItemPin(pinEvent, options)` honors the house `options.deps || options` shape and
 *     additionally accepts `deps.ensureTagTLHeader` (an override for the lazy header helper), so the
 *     header path can be exercised without a relay.
 *  2. `ensureTagTLHeader({ tag }, deps)` accepts injected `deps.strfryScan` / `deps.publishHeader`
 *     (aliases `scan` / `publish` are also accepted by these tests).
 *  3. `retractStaleTLs(currentDTags, { kind, dPrefix, deps })` accepts the same injected pair.
 *
 * ALL U/S/FS handles FAIL pre-implementation. Requires nothing of the running stack.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const REFRESH_PATH = path.join(REPO, 'src/api/trustedList/refreshPinnedTags.js');
const SDK_PATH = path.join(REPO, 'src/lib/event-tagging');
const PINS_SRC = path.join(REPO, 'src/lib/event-tagging/pins.js');
const HANDLES_SRC = path.join(REPO, 'src/lib/event-tagging/handles.js');
const BUILDERS_SRC = path.join(REPO, 'src/lib/event-tagging/builders.js');
const PROFILE_TAGS_SRC = path.join(REPO, 'src/api/profile-tags/index.js');
const TL_INDEX_SRC = path.join(REPO, 'src/api/trustedList/index.js');
const APPLICABILITY_SRC = path.join(REPO, 'src/api/trustedList/refreshApplicabilityLists.js');
const PINS_PAGE_SRC = path.join(REPO, 'ui/src/pages/Pins.jsx');
const DIALOG_SRC = path.join(REPO, 'ui/src/components/CurationMethodDialog.jsx');
const PANEL_SRC = path.join(REPO, 'ui/src/components/PinnedListPanel.jsx');
const PUBLISH_PIN_SRC = path.join(REPO, 'ui/src/utils/publishTagPin.js');
const CONCEPTS_DIR = path.join(REPO, 'firmware/versions/v1.0.0/concepts');
const FW_MANIFEST = path.join(REPO, 'firmware/versions/v1.0.0/manifest.json');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
/** Guarded dynamic require — a missing/throwing module must REPORT a failure, never crash the run. */
function safeRequire(p) { try { return require(p); } catch { return null; } }
function loadRefresh() { return safeRequire(REFRESH_PATH); }
function loadSdk() { return safeRequire(SDK_PATH); }

// ── fixtures ────────────────────────────────────────────────────────────────
const HEX = (c) => c.repeat(64);
const TA = HEX('f');             // runtime TA pubkey stand-in — never a literal from any deployment
const OBSERVER = HEX('a');
const OBSERVER2 = HEX('d');
const TAGAUTHOR = HEX('b');
const TAG_EVENT_ID = HEX('c');
const SLUG = 'white-hat';
const ITEM_AUTHOR = HEX('e');
const ADDR = (n) => `39999:${ITEM_AUTHOR}:item-${n}`;
const TAG_ELEMENT_ADDR = `39999:${TAGAUTHOR}:${SLUG}`;
const CONCEPT_TL_Z = `39998:${TA}:trusted-list`;
const PERTAG_TL_Z = `39999:${TA}:tl:${SLUG}-tls`;

function makeItemPin({ observer = OBSERVER, targetTypes = ['item'], noteMethod = 'notes:net-endorsed', contextSlug } = {}) {
  const cm = { method: 'nip85:rank', observer, cutoff: 1, noteMethod };
  if (targetTypes !== undefined) cm.targetTypes = targetTypes;
  const tags = [['e', TAG_EVENT_ID], ['curation-method', JSON.stringify(cm)]];
  if (contextSlug) tags.push(['z', `39998:${TA}:${contextSlug}`]);
  return { id: 'pin-' + observer.slice(0, 6), kind: 39999, pubkey: observer, created_at: 1, tags, content: '{}' };
}

/** Address-keyed member (kind-30394 eligible). */
function item(address, applications, disputes, createdAt) { return { address, applications, disputes, createdAt, mine: false }; }
/** Id-keyed member (a locally-resolved non-addressable DList item — NOT `a`-eligible). */
function idItem(id, applications, disputes, createdAt) { return { id, applications, disputes, createdAt, mine: false }; }
function manyItems(n) { return Array.from({ length: n }, (_, i) => item(ADDR(i), 1, 0, n - i)); }

function makeDeps({
  fullItemMembers = [], itemTotal, scanTruncated = false, tag, publishThrows = false,
  headerResult = { status: 'exists', addr: PERTAG_TL_Z },
} = {}) {
  const publishCalls = [];
  const headerCalls = [];
  const ensure = async (args) => { headerCalls.push(args); return headerResult; };
  const deps = {
    lookupTag: async () => tag || { eventId: TAG_EVENT_ID, slug: SLUG, name: 'White Hat', authorPubkey: TAGAUTHOR },
    aggregateNotesTagged: async () => ({
      members: [], fullMembers: [], total: 0,
      itemMembers: fullItemMembers.slice(0, 50),
      fullItemMembers,
      itemTotal: itemTotal ?? fullItemMembers.length,
      itemTruncated: scanTruncated,
      scanTruncated,
    }),
    publishTL: async (args) => {
      publishCalls.push(args);
      if (publishThrows) throw new Error('relay refused the event');
      return { event: { id: 'tl-1' }, uuid: `30394:x:${args.dTag}` };
    },
    // seam 1 — the header helper is injectable so the runner can be exercised relay-free
    ensureTagTLHeader: ensure,
    ensureHeader: ensure,
  };
  return { deps, publishCalls, headerCalls };
}

async function runItem(mod, pin, scenario) {
  assert(mod && typeof mod.runOneItemPin === 'function',
    'refreshPinnedTags.js must export runOneItemPin(pinEvent, {deps}) — absent pre-implementation (ADR 0003 §1).');
  const { deps, publishCalls, headerCalls } = makeDeps(scenario || {});
  const r = await mod.runOneItemPin(pin, { deps, ...deps });
  return { r, publishCalls, headerCalls };
}
function aValues(call) { return (call.items || []).filter((i) => i.tag === 'a').map((i) => i.value); }
function extra(call, name) { return (call.extraTags || []).find((t) => t[0] === name); }
function zValues(call) { return (call.extraTags || []).filter((t) => t[0] === 'z').map((t) => t[1]); }

// ===========================================================================
// U — composers (pure)
// ===========================================================================

test('U1: itemTlDTag composes tl-pin-items-<obs8>-<tagAuthor8>-<slug> for a neutral pin', () => {
  const sdk = loadSdk();
  assert(sdk && typeof sdk.itemTlDTag === 'function', 'event-tagging SDK must export itemTlDTag (pins.js).');
  const d = sdk.itemTlDTag({ observer: OBSERVER, tagAuthorPubkey: TAGAUTHOR, tagSlug: SLUG });
  assert(d === `tl-pin-items-${OBSERVER.slice(0, 8)}-${TAGAUTHOR.slice(0, 8)}-${SLUG}`,
    `neutral item d-tag must be tl-pin-items-<obs8>-<author8>-<slug>; got ${d}`);
});

test('U2 (E7): itemTlDTag appends the context variant suffix and tolerates a dashed slug', () => {
  const sdk = loadSdk();
  assert(sdk && typeof sdk.itemTlDTag === 'function', 'event-tagging SDK must export itemTlDTag (pins.js).');
  const d = sdk.itemTlDTag({ observer: OBSERVER, tagAuthorPubkey: TAGAUTHOR, tagSlug: 'multi-word-slug', contextSlug: 'lfo' });
  assert(d === `tl-pin-items-${OBSERVER.slice(0, 8)}-${TAGAUTHOR.slice(0, 8)}-multi-word-slug-in-lfo`,
    `contextual item d-tag must carry pinVariantKey's -in-<context> suffix after a dashed slug; got ${d}`);
});

test('U3: trustedListZTags returns exactly the ADR-0002 pair, composed from the runtime TA', () => {
  const sdk = loadSdk();
  assert(sdk && typeof sdk.trustedListZTags === 'function', 'event-tagging SDK must export trustedListZTags (pins.js).');
  const z = sdk.trustedListZTags({ taPubkey: TA, tagSlug: SLUG });
  assert(Array.isArray(z) && z.length === 2, `trustedListZTags must return exactly two z tags; got ${JSON.stringify(z)}`);
  assert(z.every((t) => t[0] === 'z'), 'both entries must be z tags.');
  const vals = z.map((t) => t[1]);
  assert(vals.includes(CONCEPT_TL_Z), `must include the concept z ${CONCEPT_TL_Z}; got ${JSON.stringify(vals)}`);
  assert(vals.includes(PERTAG_TL_Z), `must include the per-tag TL-header z ${PERTAG_TL_Z}; got ${JSON.stringify(vals)}`);
});

test('U4: handles.js exports conceptTrustedList / conceptTrustedListForTag / tlHeaderDTag / tlHeaderAddr, all TA-parameterized', () => {
  const sdk = loadSdk();
  for (const fn of ['conceptTrustedList', 'conceptTrustedListForTag', 'tlHeaderDTag', 'tlHeaderAddr']) {
    assert(sdk && typeof sdk[fn] === 'function', `event-tagging SDK must export ${fn} (handles.js).`);
  }
  assert(sdk.conceptTrustedList(TA) === `39998:${TA}:trusted-list`, 'conceptTrustedList must be 39998:<TA>:trusted-list.');
  assert(sdk.conceptTrustedListForTag(TA) === `39998:${TA}:trusted-list-for-tag`,
    'conceptTrustedListForTag must be 39998:<TA>:trusted-list-for-tag.');
  assert(sdk.tlHeaderDTag(SLUG) === `tl:${SLUG}-tls`, 'tlHeaderDTag must be tl:<slug>-tls.');
  assert(sdk.tlHeaderAddr(TA, SLUG) === PERTAG_TL_Z, 'tlHeaderAddr must be 39999:<TA>:tl:<slug>-tls.');
});

test('U5: buildTLHeader returns an unsigned kind-39999 header — d, z type header, a → the tag element', () => {
  const sdk = loadSdk();
  assert(sdk && typeof sdk.buildTLHeader === 'function', 'event-tagging SDK must export buildTLHeader (builders.js).');
  const ev = sdk.buildTLHeader({
    tagAuthorPubkey: TAGAUTHOR, slug: SLUG,
    names: ['Trusted List for White Hat', 'Trusted Lists for White Hat'],
    description: 'Trusted Lists derived from the White Hat tag.',
    taPubkeys: [TA],
  });
  assert(ev && ev.kind === 39999, `the per-tag TL header must be kind-39999; got ${ev && ev.kind}`);
  const tag = (n) => (ev.tags || []).find((t) => t[0] === n);
  assert(tag('d') && tag('d')[1] === `tl:${SLUG}-tls`, 'header d must be tl:<slug>-tls.');
  const zs = (ev.tags || []).filter((t) => t[0] === 'z').map((t) => t[1]);
  assert(zs.includes(`39998:${TA}:trusted-list-for-tag`), `header must z-stamp the type header; got ${JSON.stringify(zs)}`);
  assert(tag('a') && tag('a')[1] === TAG_ELEMENT_ADDR, 'header a must point at the tag element 39999:<tagAuthor>:<slug>.');
  assert(tag('names') && tag('description'), 'header must carry names + description tags.');
  assert(ev.content === '', 'header content must be empty (the rule lives in tags).');
});

// ===========================================================================
// U — runOneItemPin behavior (executed with injected deps)
// ===========================================================================

test('U6 (AC-1): an item-targeting pin publishes a kind-30394 TL whose members are the items a-coordinates', async () => {
  const mod = loadRefresh();
  const { r, publishCalls } = await runItem(mod, makeItemPin(), { fullItemMembers: [item(ADDR(1), 3, 0, 100), item(ADDR(2), 2, 0, 200)] });
  assert(publishCalls.length === 1, `expected exactly one item-TL publish; got ${publishCalls.length}.`);
  const c = publishCalls[0];
  assert(c.kind === 30394, `item TL must be kind-30394 (addressable members); got ${c.kind}.`);
  assert((c.items || []).every((i) => i.tag === 'a'), 'item-TL members must all be a-tags.');
  const as = aValues(c);
  assert(as.includes(ADDR(1)) && as.includes(ADDR(2)), `members must be the tagged items addresses; got ${JSON.stringify(as)}.`);
  assert(r && r.status === 'ok' && r.memberCount === 2, `runOneItemPin must return {status:"ok", memberCount:2}; got ${JSON.stringify(r)}.`);
});

test('U7 (AC-1): d-tag, metric, title and the observer / source-tag / curation-method / p discipline', async () => {
  const mod = loadRefresh();
  const { publishCalls } = await runItem(mod, makeItemPin(), { fullItemMembers: [item(ADDR(1), 1, 0, 1)] });
  const c = publishCalls[0];
  assert(c.dTag === `tl-pin-items-${OBSERVER.slice(0, 8)}-${TAGAUTHOR.slice(0, 8)}-${SLUG}`,
    `d-tag must be tl-pin-items-<obs8>-<author8>-<slug>; got ${c.dTag}.`);
  assert(c.metric === 'pinned-tag-items', `metric must be "pinned-tag-items"; got ${c.metric}.`);
  assert(c.title === 'White Hat', `title must be the tag name; got ${c.title}.`);
  assert(extra(c, 'observer') && extra(c, 'observer')[1] === OBSERVER, 'must carry an observer extraTag.');
  const src = extra(c, 'source-tag');
  assert(src && src[1] === TAG_EVENT_ID && src[2] === TAGAUTHOR && src[3] === SLUG,
    `source-tag must carry <tagEventId> <author> <slug>; got ${JSON.stringify(src)}.`);
  assert(extra(c, 'curation-method') && extra(c, 'curation-method')[1] === 'notes:net-endorsed',
    'must carry the curation-method extraTag.');
  assert(extra(c, 'p') && extra(c, 'p')[1] === OBSERVER,
    'must carry ["p", observer] — p is a NON-member letter on a 30394, so #p stays an unambiguous observer axis.');
});

test('U8 (E1): no a-tag is the tag element itself, and no e-tag back-ref is emitted', async () => {
  const mod = loadRefresh();
  const { publishCalls } = await runItem(mod, makeItemPin(), { fullItemMembers: [item(ADDR(1), 1, 0, 1)] });
  const c = publishCalls[0];
  const allA = [...aValues(c), ...(c.extraTags || []).filter((t) => t[0] === 'a').map((t) => t[1])];
  assert(!allA.includes(TAG_ELEMENT_ADDR),
    'on a 30394 `a` IS the member letter — the tag element coordinate must never appear as an a-tag (it would be read as a curated item).');
  assert(allA.every((v) => v.startsWith(`39999:${ITEM_AUTHOR}:`)), `every a-tag must be a member address; got ${JSON.stringify(allA)}.`);
  assert(!(c.extraTags || []).some((t) => t[0] === 'e'),
    'the withdrawn ["e", tag.eventId] substitute must not be emitted (ADR 0002 Option D).');
});

test('U9 (AC-2 / E3): a pin with no targetTypes reads as the pre-existing default and publishes NO item TL', async () => {
  const mod = loadRefresh();
  const { r, publishCalls } = await runItem(mod, makeItemPin({ targetTypes: undefined }), { fullItemMembers: [item(ADDR(1), 1, 0, 1)] });
  assert(publishCalls.length === 0, 'an absent targetTypes must read as ["profile","note"] — no silent item inclusion.');
  assert(r && r.status === 'skipped', `must return {status:"skipped"}; got ${JSON.stringify(r)}.`);
});

test('U10 (AC-2): a profile+note pin publishes no item TL; a pin listing "item" does', async () => {
  const mod = loadRefresh();
  const off = await runItem(mod, makeItemPin({ targetTypes: ['profile', 'note'] }), { fullItemMembers: [item(ADDR(1), 1, 0, 1)] });
  assert(off.publishCalls.length === 0, 'a pin whose targetTypes omit "item" must not publish an item TL.');
  assert(off.r.status === 'skipped', `omitting "item" must be a skip, not an error; got ${JSON.stringify(off.r)}.`);
  const on = await runItem(mod, makeItemPin({ targetTypes: ['profile', 'note', 'item'] }), { fullItemMembers: [item(ADDR(1), 1, 0, 1)] });
  assert(on.publishCalls.length === 1, 'a pin listing "item" must publish an item TL.');
});

test('U11 (AC-6): an empty curated set publishes nothing at all (no empty 30394)', async () => {
  const mod = loadRefresh();
  const { r, publishCalls } = await runItem(mod, makeItemPin(), { fullItemMembers: [] });
  assert(publishCalls.length === 0, 'no trusted item taggings ⇒ no publish (AC-6: never an empty 30394).');
  assert(r && r.status === 'skipped', `must return {status:"skipped"}; got ${JSON.stringify(r)}.`);
});

test('U12 (E4): every candidate net-disputed ⇒ curated set empty ⇒ still nothing published', async () => {
  const mod = loadRefresh();
  const { publishCalls } = await runItem(mod, makeItemPin(), { fullItemMembers: [item(ADDR(1), 0, 3, 1), item(ADDR(2), 1, 2, 2)] });
  assert(publishCalls.length === 0, 'a fully-disputed candidate set curates to empty and must not publish.');
});

test('U13 (address filter, ADR 0003 §1.7): id-keyed fullItemMembers entries never become members', async () => {
  const mod = loadRefresh();
  const { publishCalls } = await runItem(mod, makeItemPin(), {
    fullItemMembers: [item(ADDR(1), 2, 0, 10), idItem(HEX('9'), 5, 0, 20), item(ADDR(2), 2, 0, 30)],
  });
  const as = aValues(publishCalls[0]);
  assert(as.length === 2 && as.includes(ADDR(1)) && as.includes(ADDR(2)),
    `an id-keyed member carries no coordinate and cannot be an a-member; got ${JSON.stringify(as)}.`);
  assert(!as.some((v) => v === HEX('9')), 'a bare event id must never be published as an a-coordinate.');
});

test('U14 (E5): whatever coordinate kinds the aggregation admits are signed — this story adds no type filter', async () => {
  const mod = loadRefresh();
  const longForm = `30023:${ITEM_AUTHOR}:an-article`;
  const { publishCalls } = await runItem(mod, makeItemPin(), { fullItemMembers: [item(ADDR(1), 1, 0, 1), item(longForm, 1, 0, 2)] });
  const as = aValues(publishCalls[0]);
  assert(as.includes(longForm),
    'the item TL consumes story 4s filtered set verbatim — it must not add a second, divergent type filter.');
});

test('U15: members are curated by the pin noteMethod (net-endorsed drops net-disputed; most-applied orders)', async () => {
  const mod = loadRefresh();
  const members = [item(ADDR(1), 3, 0, 100), item(ADDR(2), 1, 5, 200), item(ADDR(3), 2, 0, 50)];
  const ne = await runItem(mod, makeItemPin({ noteMethod: 'notes:net-endorsed' }), { fullItemMembers: members });
  const neA = aValues(ne.publishCalls[0]);
  assert(neA.includes(ADDR(1)) && neA.includes(ADDR(3)) && !neA.includes(ADDR(2)),
    `net-endorsed must drop the net-disputed address; got ${JSON.stringify(neA)}.`);
  const ma = await runItem(mod, makeItemPin({ noteMethod: 'notes:most-applied' }), { fullItemMembers: members });
  const maA = aValues(ma.publishCalls[0]);
  assert(maA[0] === ADDR(1) && maA.includes(ADDR(2)),
    `most-applied must keep all, ordered by applications desc; got ${JSON.stringify(maA)}.`);
});

test('U16 (E6): ITEM_TL_MEMBER_CAP is 500; beyond it publish the cap and signal ["truncated", total]', async () => {
  const mod = loadRefresh();
  assert(mod && mod.ITEM_TL_MEMBER_CAP === 500,
    `refreshPinnedTags must export ITEM_TL_MEMBER_CAP = 500 (half NOTE_TL_MEMBER_CAP; coordinates are ~2x a 64-hex id); got ${mod && mod.ITEM_TL_MEMBER_CAP}.`);
  const total = 560;
  const { publishCalls } = await runItem(mod, makeItemPin(), { fullItemMembers: manyItems(total), itemTotal: total });
  const c = publishCalls[0];
  assert(aValues(c).length === 500, `beyond the ceiling exactly ITEM_TL_MEMBER_CAP members are published; got ${aValues(c).length}.`);
  const t = extra(c, 'truncated');
  assert(t && t[1] === String(total), `overflow must be SIGNALED as ["truncated","${total}"]; got ${JSON.stringify(t)}.`);
  const body = JSON.parse(c.content || '{}');
  assert(body.partial === true && body.total === total, 'content must carry {partial:true, total} when the list is partial.');
});

test('U17 (E6): a truncated scan marks the TL partial; a complete under-cap set carries NO truncated tag', async () => {
  const mod = loadRefresh();
  const trunc = await runItem(mod, makeItemPin(), { fullItemMembers: manyItems(10), scanTruncated: true, itemTotal: 999 });
  const t = extra(trunc.publishCalls[0], 'truncated');
  assert(t && t[1] === '999', `a truncated scan must publish ["truncated","999"]; got ${JSON.stringify(t)}.`);
  const complete = await runItem(mod, makeItemPin(), { fullItemMembers: manyItems(7), itemTotal: 7 });
  assert(aValues(complete.publishCalls[0]).length === 7, 'a complete 7-item set publishes all 7.');
  assert(!extra(complete.publishCalls[0], 'truncated'),
    'ABSENCE of the truncated tag means complete — a wrongly-present tag is as harmful as a wrongly-absent one.');
  const body = JSON.parse(complete.publishCalls[0].content || '{}');
  assert(!body.partial, 'a complete list must not set content.partial.');
});

test('U18 (z set): a neutral item TL carries exactly the two Trusted-List z tags (set membership, not order)', async () => {
  const mod = loadRefresh();
  const { publishCalls } = await runItem(mod, makeItemPin(), { fullItemMembers: [item(ADDR(1), 1, 0, 1)] });
  const zs = zValues(publishCalls[0]);
  assert(zs.length === 2, `a neutral TL must carry exactly two z tags; got ${JSON.stringify(zs)}.`);
  assert(new Set(zs).has(CONCEPT_TL_Z) && new Set(zs).has(PERTAG_TL_Z),
    `the pair must be the concept z + the per-tag TL-header z; got ${JSON.stringify(zs)}.`);
});

test('U19 (z set): a contextual item TL adds the context handle as a third z — order is not asserted', async () => {
  const mod = loadRefresh();
  const { publishCalls } = await runItem(mod, makeItemPin({ contextSlug: 'lfo' }), { fullItemMembers: [item(ADDR(1), 1, 0, 1)] });
  const zs = new Set(zValues(publishCalls[0]));
  assert(zs.size === 3, `a contextual TL must carry three z tags; got ${JSON.stringify([...zs])}.`);
  assert(zs.has(CONCEPT_TL_Z) && zs.has(PERTAG_TL_Z), 'the TL pair must still be present on a contextual list.');
  assert([...zs].some((v) => v.endsWith(':lfo')), `the context concept handle must be the third z; got ${JSON.stringify([...zs])}.`);
  assert(publishCalls[0].dTag.endsWith('-in-lfo'), 'a contextual item TL gets its own d-tag identity.');
});

test('U20 (F1): when the TL header cannot be minted, the list still publishes — without the per-tag z only', async () => {
  const mod = loadRefresh();
  const { r, publishCalls } = await runItem(mod, makeItemPin(), {
    fullItemMembers: [item(ADDR(1), 1, 0, 1)],
    headerResult: { status: 'error', errorReason: 'relay down' },
  });
  assert(publishCalls.length === 1, 'F1: a header failure must NEVER abort the TL publish (F2 would let the sweep retract a live list).');
  assert(r.status === 'ok', `the TL publish still succeeds; got ${JSON.stringify(r)}.`);
  const zs = zValues(publishCalls[0]);
  assert(zs.includes(CONCEPT_TL_Z), 'the deployment-wide concept z does not depend on the header and must remain.');
  assert(!zs.includes(PERTAG_TL_Z), 'the per-tag z is a membership claim on the header — omit it when the header does not exist.');
});

test('U21: the runner ensures the per-tag TL header before publishing', async () => {
  const mod = loadRefresh();
  const { headerCalls } = await runItem(mod, makeItemPin(), { fullItemMembers: [item(ADDR(1), 1, 0, 1)] });
  assert(headerCalls.length >= 1, 'runOneItemPin must call ensureTagTLHeader({tag}) before publishTL (lazy header creation).');
  const arg = headerCalls[0] || {};
  assert(arg.tag && arg.tag.slug === SLUG, `ensureTagTLHeader must receive the resolved tag object; got ${JSON.stringify(arg)}.`);
});

test('U22 (E8): two observers pinning the same tag get distinct d-tags; neither collides', async () => {
  const mod = loadRefresh();
  const a = await runItem(mod, makeItemPin({ observer: OBSERVER }), { fullItemMembers: [item(ADDR(1), 1, 0, 1)] });
  const b = await runItem(mod, makeItemPin({ observer: OBSERVER2 }), { fullItemMembers: [item(ADDR(1), 1, 0, 1)] });
  assert(a.publishCalls[0].dTag !== b.publishCalls[0].dTag, 'each observer POV gets its own replaceable identity.');
  assert(b.publishCalls[0].dTag.startsWith(`tl-pin-items-${OBSERVER2.slice(0, 8)}-`), 'the observer prefix is the discriminator.');
});

test('U23 (E11 as ruled): a failed item publish returns {status:"error", dTag} so the d-tag can stay on the roster', async () => {
  const mod = loadRefresh();
  const { r } = await runItem(mod, makeItemPin(), { fullItemMembers: [item(ADDR(1), 1, 0, 1)], publishThrows: true });
  assert(r && r.status === 'error', `a throwing publish must return status:"error"; got ${JSON.stringify(r)}.`);
  assert(r.dTag === `tl-pin-items-${OBSERVER.slice(0, 8)}-${TAGAUTHOR.slice(0, 8)}-${SLUG}`,
    'the unified failure policy (story § Rulings 1) requires the d-tag back, so a transient error never lets the sweep retract a live list.');
});

test('U24: an unsupported curation method or a malformed observer is reported, never published', async () => {
  const mod = loadRefresh();
  const bad = { id: 'p1', kind: 39999, pubkey: OBSERVER, created_at: 1, content: '{}',
    tags: [['e', TAG_EVENT_ID], ['curation-method', JSON.stringify({ method: 'something-else', observer: OBSERVER, targetTypes: ['item'] })]] };
  const r1 = await runItem(mod, bad, { fullItemMembers: [item(ADDR(1), 1, 0, 1)] });
  assert(r1.r.status === 'unsupported' && r1.publishCalls.length === 0, 'a non-nip85:rank method is unsupported and publishes nothing.');
  const bad2 = { id: 'p2', kind: 39999, pubkey: OBSERVER, created_at: 1, content: '{}',
    tags: [['e', TAG_EVENT_ID], ['curation-method', JSON.stringify({ method: 'nip85:rank', observer: 'nope', targetTypes: ['item'] })]] };
  const r2 = await runItem(mod, bad2, { fullItemMembers: [item(ADDR(1), 1, 0, 1)] });
  assert(r2.r.status === 'error' && r2.publishCalls.length === 0, 'a malformed observer is an error and publishes nothing.');
});

// ===========================================================================
// U — ensureTagTLHeader (lazy, idempotent, memoized)
// ===========================================================================

function headerDeps({ existing = [] } = {}) {
  const scanCalls = []; const published = [];
  const scan = async (filter) => { scanCalls.push(filter); return existing; };
  const publish = async (ev) => { published.push(ev); return { id: 'hdr-1', ...ev }; };
  return {
    scanCalls, published,
    deps: { strfryScan: scan, scan, publishHeader: publish, publish, publishEvent: publish },
  };
}

test('U25: ensureTagTLHeader mints a kind-39999 header at d = tl:<slug>-tls when none exists', async () => {
  const mod = loadRefresh();
  assert(mod && typeof mod.ensureTagTLHeader === 'function',
    'refreshPinnedTags.js must export ensureTagTLHeader({tag}, deps) — absent pre-implementation (ADR 0003 §3).');
  const h = headerDeps({ existing: [] });
  const r = await mod.ensureTagTLHeader({ tag: { slug: 'mint-me', name: 'Mint Me', authorPubkey: TAGAUTHOR } }, h.deps);
  assert(r && r.status === 'created', `an absent header must be created; got ${JSON.stringify(r)}.`);
  assert(h.published.length === 1, `exactly one header publish; got ${h.published.length}.`);
  const ev = h.published[0];
  assert(ev.kind === 39999, `the TL header is kind-39999; got ${ev.kind}.`);
  const d = (ev.tags || []).find((t) => t[0] === 'd');
  assert(d && d[1] === 'tl:mint-me-tls', `header d must be tl:<slug>-tls; got ${JSON.stringify(d)}.`);
});

test('U26: ensureTagTLHeader is idempotent — an existing header is detected by scan and never republished', async () => {
  const mod = loadRefresh();
  assert(mod && typeof mod.ensureTagTLHeader === 'function', 'refreshPinnedTags.js must export ensureTagTLHeader.');
  const h = headerDeps({ existing: [{ kind: 39999, pubkey: TA, tags: [['d', 'tl:already-tls']] }] });
  const r = await mod.ensureTagTLHeader({ tag: { slug: 'already', name: 'Already', authorPubkey: TAGAUTHOR } }, h.deps);
  assert(r && r.status === 'exists', `an existing header must short-circuit as "exists"; got ${JSON.stringify(r)}.`);
  assert(h.published.length === 0, 'an existing header must never be republished.');
  const again = await mod.ensureTagTLHeader({ tag: { slug: 'already', name: 'Already', authorPubkey: TAGAUTHOR } }, h.deps);
  assert(again && again.status === 'exists' && h.published.length === 0,
    'the positive memo makes repeat calls free; still no publish.');
});

test('U27 (F1): a failing header scan/publish reports an error and never throws into the runner', async () => {
  const mod = loadRefresh();
  assert(mod && typeof mod.ensureTagTLHeader === 'function', 'refreshPinnedTags.js must export ensureTagTLHeader.');
  const boom = async () => { throw new Error('relay unreachable'); };
  const r = await mod.ensureTagTLHeader(
    { tag: { slug: 'boom', name: 'Boom', authorPubkey: TAGAUTHOR } },
    { strfryScan: boom, scan: boom, publishHeader: boom, publish: boom, publishEvent: boom },
  );
  assert(r && r.status === 'error', `a failing header path must RETURN {status:"error"}, not throw; got ${JSON.stringify(r)}.`);
});

// ===========================================================================
// U — the retraction sweep (E2, E9, AC-4)
// ===========================================================================

function tlEvent({ id, dTag, kind = 30394, retracted = false, extra: extraTags = [] }) {
  return {
    id, kind, pubkey: TA, created_at: 1,
    tags: [['d', dTag], ['title', 't'], ['metric', 'm'], ...extraTags, ...(retracted ? [['status', 'retracted']] : [])],
  };
}
function sweepDeps(events) {
  const published = [];
  const scan = async () => events;
  const publish = async (args) => { published.push(args); return { event: { id: 'r' }, uuid: 'u' }; };
  return { published, opts: { deps: { strfryScan: scan, scan, publishTL: publish, publish }, strfryScan: scan, scan, publishTL: publish, publish } };
}

test('U28 (E2): the 30394 sweep retracts only tl-pin-items- lists — the applicability lists are untouched', async () => {
  const mod = loadRefresh();
  assert(mod && typeof mod.retractStaleTLs === 'function',
    'refreshPinnedTags.js must export retractStaleTLs(currentDTags, {kind, dPrefix, deps}) so the sweep is testable.');
  const live = `tl-pin-items-${OBSERVER.slice(0, 8)}-${TAGAUTHOR.slice(0, 8)}-${SLUG}`;
  const stale = `tl-pin-items-${OBSERVER2.slice(0, 8)}-${TAGAUTHOR.slice(0, 8)}-gone`;
  const relay = [
    tlEvent({ id: 'applic-pubkey', dTag: 'tag-applicability-nostr-pubkey' }),
    tlEvent({ id: 'applic-event', dTag: 'tag-applicability-nostr-event' }),
    tlEvent({ id: 'live', dTag: live }),
    tlEvent({ id: 'stale', dTag: stale }),
  ];
  const s = sweepDeps(relay);
  await mod.retractStaleTLs([live], { kind: 30394, dPrefix: 'tl-pin-items-', ...s.opts });
  assert(s.published.length === 1,
    `exactly ONE retraction must be published; got ${s.published.length} (${JSON.stringify(s.published.map((p) => p.dTag))}) — retracting an applicability list disables the tag pickers instance-wide.`);
  assert(s.published[0].dTag === stale, `the retraction must target the stale item TL; got ${s.published[0].dTag}.`);
  assert((s.published[0].items || []).length === 0 && (s.published[0].extraTags || []).some((t) => t[0] === 'status' && t[1] === 'retracted'),
    'a retraction is an empty-membership replacement carrying ["status","retracted"].');
});

test('U29 (E9): the sweep is idempotent — an already-retracted item TL is skipped', async () => {
  const mod = loadRefresh();
  assert(mod && typeof mod.retractStaleTLs === 'function', 'refreshPinnedTags.js must export retractStaleTLs.');
  const stale = `tl-pin-items-${OBSERVER.slice(0, 8)}-${TAGAUTHOR.slice(0, 8)}-gone`;
  const s = sweepDeps([tlEvent({ id: 'stale', dTag: stale, retracted: true })]);
  await mod.retractStaleTLs([], { kind: 30394, dPrefix: 'tl-pin-items-', ...s.opts });
  assert(s.published.length === 0, 'an already-retracted slot must not be retracted a second time.');
});

test('U30 (ADR 0003 §1): a retraction carries forward the z discovery axes of the list it retracts', async () => {
  const mod = loadRefresh();
  assert(mod && typeof mod.retractStaleTLs === 'function', 'refreshPinnedTags.js must export retractStaleTLs.');
  const stale = `tl-pin-items-${OBSERVER.slice(0, 8)}-${TAGAUTHOR.slice(0, 8)}-gone`;
  const s = sweepDeps([tlEvent({ id: 'stale', dTag: stale, extra: [['z', CONCEPT_TL_Z], ['z', PERTAG_TL_Z]] })]);
  await mod.retractStaleTLs([], { kind: 30394, dPrefix: 'tl-pin-items-', ...s.opts });
  assert(s.published.length === 1, 'the stale list must be retracted.');
  const zs = (s.published[0].extraTags || []).filter((t) => t[0] === 'z').map((t) => t[1]);
  assert(zs.includes(CONCEPT_TL_Z) && zs.includes(PERTAG_TL_Z),
    `the carryOver filter must keep z tags so a #z consumer sees the list marked retracted rather than vanish; got ${JSON.stringify(zs)}.`);
});

// ===========================================================================
// S — source sentinels
// ===========================================================================

test('S1: refreshPinnedTags exports runOneItemPin, ITEM_TL_MEMBER_CAP, ensureTagTLHeader and retractStaleTLs', () => {
  const mod = loadRefresh();
  assert(mod, 'refreshPinnedTags.js must load.');
  for (const name of ['runOneItemPin', 'ensureTagTLHeader', 'retractStaleTLs']) {
    assert(typeof mod[name] === 'function', `refreshPinnedTags.js must export ${name}.`);
  }
  assert(Number.isInteger(mod.ITEM_TL_MEMBER_CAP), 'refreshPinnedTags.js must export ITEM_TL_MEMBER_CAP.');
});

test('S2 (AC-4 + Rulings 1): refreshAllPinnedTags runs the item runner, collects its d-tag unconditionally, and sweeps 30394', () => {
  const src = safeRead(REFRESH_PATH);
  assert(/async function refreshAllPinnedTags/.test(src), 'refreshAllPinnedTags must exist.');
  assert(/runOneItemPin\s*\(/.test(src), 'refreshAllPinnedTags must call runOneItemPin per pin.');
  assert(/itemTL\s*:/.test(src), 'each result row must carry an itemTL: { status, dTag, memberCount } field.');
  assert(/retractStaleTLs\s*\(\s*currentItemDTags[\s\S]{0,120}30394[\s\S]{0,80}tl-pin-items-/.test(src),
    'a third sweep must call retractStaleTLs(currentItemDTags, { kind: 30394, dPrefix: "tl-pin-items-" }).');
  assert(/if\s*\(\s*itemResult\.dTag\s*\)\s*currentItemDTags\.push/.test(src),
    'unified failure policy: a d-tag from a FAILED item publish still joins currentItemDTags (no `status === "ok"` guard).');
  assert(/if\s*\(\s*noteResult\.dTag\s*\)\s*currentNoteDTags\.push/.test(src),
    'runOneNotePin is aligned in this story: currentNoteDTags must collect the d-tag unconditionally too (story § Rulings 1).');
});

test('S3 (E10): refreshPinnedTagsForViewer runs the item runner but never retracts', () => {
  const src = safeRead(REFRESH_PATH);
  const m = src.match(/async function refreshPinnedTagsForViewer[\s\S]*?\n}\n/);
  assert(m, 'refreshPinnedTagsForViewer must exist.');
  assert(/runOneItemPin\s*\(/.test(m[0]), 'the viewer path must refresh the item TL too.');
  assert(!/retractStaleTLs/.test(m[0]), 'the single-viewer path must NOT retract (E10) — the cron sweep cleans up.');
});

test('S4: refreshOnePinnedTagById reports the item status beside the note status', () => {
  const src = safeRead(REFRESH_PATH);
  assert(/itemStatus\s*:/.test(src) && /noteStatus\s*:/.test(src),
    'refreshOnePinnedTagById must return itemStatus beside the existing noteStatus.');
});

test('S5: all three runners emit the trustedListZTags pair and ensure the header before publishing', () => {
  const src = safeRead(REFRESH_PATH);
  const uses = (src.match(/trustedListZTags\s*\(/g) || []).length;
  assert(uses >= 3, `trustedListZTags must be spread into all three runners extraTags (30392/30393/30394); found ${uses} call sites.`);
  const ensures = (src.match(/ensureTagTLHeader\s*\(/g) || []).length;
  assert(ensures >= 4, `ensureTagTLHeader must be called by all three runners (plus its definition); found ${ensures} occurrences.`);
  assert(!/pickHeader/.test(src),
    'pickHeader must NOT be imported here — ADR 0002s first amendment withdrew the header-author pick rule (a TA-authored header has no plurality).');
});

test('S6 (AC-3): the curation dialog offers items and its validation names all three target types', () => {
  const src = safeRead(DIALOG_SRC);
  assert(/includeItems/.test(src), 'CurationMethodDialog must carry an includeItems state + checkbox.');
  assert(/targetTypes\.push\(\s*'item'\s*\)/.test(src), "the build must push 'item' when items are selected.");
  assert(/Select at least one:\s*profiles,\s*notes,\s*or items\./.test(src),
    'the "select at least one" validation message must account for the new option.');
  assert(/const initTypes\s*=\s*init\.targetTypes\s*\|\|\s*\['profile',\s*'note'\]/.test(src),
    'editing a pre-existing pin must NOT silently add items — the initTypes fallback stays ["profile","note"].');
});

test('S7 (AC-2): new pins opt into items by default; the runner default stays profile+note', () => {
  const src = safeRead(PUBLISH_PIN_SRC);
  assert(/targetTypes:\s*\['profile',\s*'note',\s*'item'\]/.test(src),
    'defaultCurationMethod must return targetTypes: ["profile","note","item"] for NEW pins.');
  const refresh = safeRead(REFRESH_PATH);
  assert((refresh.match(/\['profile',\s*'note'\]/g) || []).length >= 3,
    'each runner gate keeps the byte-identical legacy default ["profile","note"] — nothing already published changes meaning.');
});

test('S8 (AC-5): the Pinned tab renders the item TL naddr, status and member count, TA from useConfig', () => {
  const src = safeRead(PANEL_SRC);
  assert(/naddr30394/.test(src), 'PinnedListPanel must compose an naddr30394 row beside naddr30392.');
  assert(/kind:\s*30394/.test(src), 'the naddr must encode kind 30394.');
  assert(/itemTlDTag/.test(src), 'the item d-tag must come from the shared itemTlDTag composer, never hand-formatted.');
  assert(/itemTlStatus/.test(src), 'the panel must render the item TL status.');
  assert(/memberCount/.test(src), 'the panel must render the item TL member count.');
  assert(/pubkey:\s*taPubkey/.test(src), 'naddrEncode must take the runtime taPubkey from useConfig() — never a literal.');
});

test('S9 (AC-5 / E12): enrichRowsWithTLStatus adds an independently guarded 30394 scan for itemTlStatus', () => {
  const src = safeRead(PROFILE_TAGS_SRC);
  assert(/itemTlStatus/.test(src), 'enrichRowsWithTLStatus must set row.itemTlStatus.');
  assert(/kinds:\s*\[\s*30394\s*\]/.test(src), 'a second batched scan over kinds [30394] must be issued.');
  assert(/itemTlDTag/.test(src), 'the item d-tag MUST be composed with itemTlDTag, not hand-formatted (feat-tags-modernization/0001 §5).');
  const region = src.slice(src.indexOf('async function enrichRowsWithTLStatus'));
  const guarded = (region.match(/try\s*{/g) || []).length;
  assert(guarded >= 2, 'the item scan must be wrapped in its OWN try — a failed 30394 scan leaves every row at "never" and still returns 200 (E12).');
});

test('S10 (no literals): no 64-hex pubkey literal enters any file this story touches', () => {
  const rx = /[0-9a-f]{64}/;
  for (const f of [REFRESH_PATH, PINS_SRC, HANDLES_SRC, BUILDERS_SRC, PANEL_SRC]) {
    assert(!rx.test(safeRead(f)), `${path.relative(REPO, f)} must contain no 64-hex literal — handles compose from the runtime TA.`);
  }
  const pt = (safeRead(PROFILE_TAGS_SRC).match(/[0-9a-f]{64}/g) || []).length;
  assert(pt === 1, `profile-tags/index.js must keep exactly its ONE ADR-0015 carve-out literal (LEGACY_Z_TAG_PUBKEY); found ${pt}.`);
});

test('S11 (story-4 prerequisite): aggregateNotesTagged already returns the uncapped fullItemMembers + itemTotal', () => {
  const src = safeRead(path.join(REPO, 'src/api/event-tags/index.js'));
  assert(/fullItemMembers/.test(src) && /itemTotal/.test(src),
    'this story CONSUMES story 4s uncapped address accessor — it must never re-slice the 50-capped itemMembers or add a second aggregation.');
  assert(/module\.exports[\s\S]*aggregateNotesTagged/.test(src), 'aggregateNotesTagged must stay exported.');
});

// ===========================================================================
// R — regression sentinels (AC-7 and the declared non-consumers)
// ===========================================================================

test('R1 (AC-7): the 30392 and 30393 runners keep their kinds, d-prefixes and metrics', () => {
  const src = safeRead(REFRESH_PATH);
  assert(/kind:\s*30392/.test(src) && /pinned-tag-membership/.test(src), 'the profile TL (30392) must be unchanged.');
  assert(/kind:\s*30393/.test(src) && /pinned-tag-notes/.test(src), 'the note TL (30393) must be unchanged.');
  assert(/tl-pin-notes-/.test(src) || /noteTlDTag/.test(src), 'the note d-prefix stays tl-pin-notes-.');
  assert(/retractStaleTLs\s*\(\s*currentDTags/.test(src) && /retractStaleTLs\s*\(\s*currentNoteDTags/.test(src),
    'the existing two sweeps must survive alongside the new third one.');
});

test('R2 (AC-7 / ADR 0002 Decision 4): 30393 keeps its legacy a + p pair through the dual-emit window', () => {
  const src = safeRead(REFRESH_PATH);
  const note = src.slice(src.indexOf('async function runOneNotePin'));
  assert(/tagElementAddr|39999:\$\{/.test(note) || /\['a',/.test(note),
    'runOneNotePin must keep its legacy ["a", 39999:<author>:<slug>] back-ref (dropping it is a separate story).');
  assert(/\['p',\s*observer\]/.test(note), 'runOneNotePin must keep ["p", observer].');
});

test('R3 (out of radius): refreshApplicabilityLists.js keeps its fixed d-tags and gains no z convention', () => {
  const src = safeRead(APPLICABILITY_SRC);
  assert(/tag-applicability-nostr-pubkey/.test(src) && /tag-applicability-nostr-event/.test(src),
    'the applicability lists keep their fixed, disjoint d-tag namespace.');
  assert(!/trustedListZTags|conceptTrustedList|tl-pin-items-/.test(src),
    'applicability lists are a picker lookup table, not a curated trust list — they stay OUTSIDE the z convention (story § Rulings 3).');
});

test('R4 (out of radius): src/api/trustedList/index.js is not edited by this story', () => {
  const src = safeRead(TL_INDEX_SRC);
  assert(/30395/.test(src), 'buildAndPublishTL already validates the 30392..30395 family.');
  assert(!/tl-pin-items-|trustedListZTags|ensureTagTLHeader/.test(src),
    'buildAndPublishTL already emits a-members for 30394 — this story needs NO edit to trustedList/index.js.');
});

test('R5 (Rulings 2): the Pins index gains no item status surface', () => {
  const src = safeRead(PINS_PAGE_SRC);
  assert(!/itemTlStatus|naddr30394/.test(src),
    'AC-5 is satisfied in the Pinned tab only; reintroducing a per-row status block on the index contradicts Story 20 / ADR 0018.');
});

// ===========================================================================
// FS — firmware fixtures (filesystem only; NEVER a live reinstall)
// ===========================================================================

for (const slug of ['trusted-list', 'trusted-list-for-tag']) {
  test(`FS1 (${slug}): concept dir ships concept-header.json + json-schema.json`, () => {
    const dir = path.join(CONCEPTS_DIR, slug);
    for (const f of ['concept-header.json', 'json-schema.json']) {
      assert(fs.existsSync(path.join(dir, f)), `missing firmware/versions/v1.0.0/concepts/${slug}/${f}`);
    }
    const ch = readJson(path.join(dir, 'concept-header.json'));
    assert(ch && ch.word && Array.isArray(ch.word.wordTypes) && ch.word.wordTypes.includes('conceptHeader'),
      `${slug}/concept-header.json must carry a word block with wordTypes including "conceptHeader".`);
    const h = ch.conceptHeader || {};
    assert(typeof h.description === 'string' && h.description.length > 20, `${slug} must carry the ADR-0002 description.`);
    for (const k of ['oNames', 'oSlugs', 'oKeys', 'oTitles', 'oLabels']) {
      assert(h[k] && h[k].singular && h[k].plural, `${slug} conceptHeader.${k} must have singular + plural.`);
    }
    assert(h.oSlugs.singular === slug, `${slug} oSlugs.singular must match the concept slug; got ${h.oSlugs.singular}.`);
  });
}

test('FS2: trusted-list-for-tag carries the a/e headerTags rule; trusted-list carries none', () => {
  const forTag = readJson(path.join(CONCEPTS_DIR, 'trusted-list-for-tag/concept-header.json'));
  assert(forTag && forTag.conceptHeader && Array.isArray(forTag.conceptHeader.headerTags),
    'trusted-list-for-tag must declare headerTags (its members point at their tag element).');
  const pairs = forTag.conceptHeader.headerTags.map((t) => `${t[0]}:${t[1]}`);
  assert(pairs.includes('recommended:a') && pairs.includes('allowed:e'),
    `trusted-list-for-tag headerTags must be [["recommended","a"],["allowed","e"]]; got ${JSON.stringify(pairs)}.`);
  const tl = readJson(path.join(CONCEPTS_DIR, 'trusted-list/concept-header.json'));
  assert(tl && tl.conceptHeader && !tl.conceptHeader.headerTags,
    'trusted-list must declare NO headerTags — its members are 3039x events, not kind-39999 items with a reference rule.');
});

test('FS3: both concepts are registered in the version manifest (discovery is manifest-driven)', () => {
  const man = readJson(FW_MANIFEST);
  assert(man && Array.isArray(man.concepts), 'firmware/versions/v1.0.0/manifest.json must list concepts[].');
  for (const slug of ['trusted-list', 'trusted-list-for-tag']) {
    const e = man.concepts.find((c) => c.slug === slug);
    assert(e, `manifest.json concepts[] must register "${slug}" — install.js iterates the manifest, it does not scan the directory.`);
    assert(e.dir === `./concepts/${slug}/`, `${slug} manifest entry needs dir "./concepts/${slug}/"; got ${e.dir}.`);
    assert(e.conceptHeader === 'concept-header.json' && e.jsonSchema === 'json-schema.json',
      `${slug} manifest entry must name both files.`);
    assert(!e.communityReference,
      `${slug} must carry NO communityReference — choosing a canonical cross-deployment namespace is out of scope (ADR 0002).`);
  }
});

test('FS4: both json-schema.json files use the permissive shape with a coreMemberOf back-pointer', () => {
  for (const slug of ['trusted-list', 'trusted-list-for-tag']) {
    const js = readJson(path.join(CONCEPTS_DIR, slug, 'json-schema.json'));
    assert(js && js.word && Array.isArray(js.word.wordTypes) && js.word.wordTypes.includes('jsonSchema'),
      `${slug}/json-schema.json must carry a word block with wordTypes including "jsonSchema".`);
    assert(js.jsonSchema, `${slug}/json-schema.json must carry a jsonSchema block.`);
    assert(JSON.stringify(js).includes('coreMemberOf'),
      `${slug}/json-schema.json must back-point at its concept header via coreMemberOf.`);
  }
});

async function run() {
  let pass = 0, fail = 0, skipped = 0;
  for (const t of tests) {
    try {
      const r = await t.fn();
      if (r === 'SKIP') { console.log(`  - ${t.name} (skipped)`); skipped++; continue; }
      console.log(`  ✓ ${t.name}`); pass++;
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      fail++;
    }
  }
  return { pass, fail, skipped };
}

module.exports = { run };
