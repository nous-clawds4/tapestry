/**
 * Tests for Story 5 (epic: event-tagging) — the client publish path.
 *
 * Story: engineering-team/stories/event-tagging/5-event-tagging-write-path.md
 * ADR:   engineering-team/decisions/event-tagging/0005-event-tagging-write-path.md
 *
 * The risky logic — the 1/2/3-publish sequence decision, sign-all-then-publish,
 * ordered stop-on-failure, deterministic header pick, dual-z passthrough — lives
 * in a PURE orchestrator `applyEventTagging({ ...inputs, deps })` in the Story-1
 * core (`src/lib/event-tagging`), with signing / transport / discovery / clock
 * INJECTED. That makes every AC deterministically testable in-process with fake
 * deps — no browser, no relay, no signer (ADR Option A + E).
 *
 * Two layers:
 *   1. Orchestrator unit tests (the meat) — drive `applyEventTagging` with fakes.
 *   2. Source-contract — the core exports the orchestrator and stays pure; the
 *      thin UI hook consumes the core (no inlined wire shape), signs via NIP-07,
 *      publishes through the GUARDED `publishOrThrow`, and composes z-namespaces
 *      from the canonical literal + the RUNTIME TA (never a foreign hardcode).
 *
 * Intentionally failing until the orchestrator + hook land (red phase). The core
 * is require()d LAZILY inside each test so loading this suite cannot crash the
 * require phase of test/test.js. Hand-rolled in the project's existing style.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const CORE_REQUIRE = '../src/lib/event-tagging';
const CORE_DIR = path.join(REPO_ROOT, 'src/lib/event-tagging');

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function load() {
  try { return require(CORE_REQUIRE); }
  catch (e) { throw new Error(`event-tagging core not loadable (require('${CORE_REQUIRE}') failed: ${e.message})`); }
}

// ─── fixtures (fixed, fake-but-valid 64-hex) ───
const TA      = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833'; // canonical namespace (ADR-0015 lineage)
const LOCAL   = '5555555555555555555555555555555555555555555555555555555555555555'; // local (runtime) namespace
const JACK    = '1111111111111111111111111111111111111111111111111111111111111111'; // existing tag-element / header author
const ALICE   = '2222222222222222222222222222222222222222222222222222222222222222'; // asserter (current user)
const CHARLIE = '3333333333333333333333333333333333333333333333333333333333333333'; // a second header author
const NOTE_ID = '4444444444444444444444444444444444444444444444444444444444444444'; // kind-1 note id (target)
const ADDR_TARGET = `39999:${CHARLIE}:some-addressable-thing`;                       // addressable target coord

const NEW_NAME = 'Awesome Tag';
const NEW_SLUG = 'awesome-tag';
const EXISTING_SLUG = 'existing-tag';

// ─── tag helpers over signed/built events ───
function tagsOf(ev) { return (ev && ev.tags) || []; }
function tagVal(ev, name) { const t = tagsOf(ev).find((x) => x[0] === name); return t ? t[1] : null; }
function dOf(ev) { return tagVal(ev, 'd'); }
function zTags(ev) { return tagsOf(ev).filter((x) => x[0] === 'z').map((x) => x[1]); }
function hasZ(ev, val) { return zTags(ev).includes(val); }
function descriptorZ(ev) {
  return zTags(ev).find((z) => /^39999:[0-9a-f]{64}:tagging:.+-tagging$/.test(z)) || null;
}
function isAssertion(ev) { return ev.kind === 39999 && /^event-tag-/.test(dOf(ev) || ''); }
function isHeader(ev) { return ev.kind === 39999 && /^tagging:.+-tagging$/.test(dOf(ev) || ''); }
function isTagElement(ev) {
  return ev.kind === 39999 && !isAssertion(ev) && !isHeader(ev);
}

/**
 * Build a fake dep-set. Records sign order, publish order, findHeaders calls.
 * The fake signer stamps a deterministic id derived from the event's d-tag so
 * tests can map published ids back to roles. publish succeeds by default; pass
 * `failPublishAt` (1-based index into publish order) or `failSignAt` to simulate
 * failure. `headers` seeds findHeaders' return value.
 */
function makeDeps({ headers = [], failPublishAt = 0, failSignAt = 0 } = {}) {
  const rec = { signed: [], published: [], findHeadersCalls: [] };
  let signN = 0;
  let pubN = 0;
  const deps = {
    findHeaders: async (q) => { rec.findHeadersCalls.push(q); return headers; },
    sign: async (unsigned) => {
      signN += 1;
      if (failSignAt && signN === failSignAt) throw new Error(`signer rejected (fake) at sign #${signN}`);
      const ev = { ...unsigned, id: `ID(${dOf(unsigned)})`, sig: 'fakesig' };
      rec.signed.push(ev);
      return ev;
    },
    publish: async (ev) => {
      pubN += 1;
      if (failPublishAt && pubN === failPublishAt) throw new Error(`publish failed (fake) at publish #${pubN}`);
      rec.published.push(ev);
      return { local: { success: true }, external: { successes: [] } };
    },
    now: () => 1700000000,
  };
  return { deps, rec };
}

function baseArgs(overrides = {}) {
  return {
    target: { id: NOTE_ID },
    polarity: 1,
    asserterPubkey: ALICE,
    taPubkeys: [TA, LOCAL],
    ...overrides,
  };
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ─────────────────────────── Orchestrator: sequences ─────────────────────────── */

// AC-1: existing header → 1 publish (the assertion only)
t("sequence 'a' (existing header): exactly ONE assertion published; descriptor z = the existing header coord; polarity 1", async () => {
  const c = load();
  const { deps, rec } = makeDeps({ headers: [{ author: JACK }] });
  const out = await c.applyEventTagging(baseArgs({ tagInput: { authorPubkey: JACK, slug: EXISTING_SLUG }, deps }));

  assert(out.sequence === 'a', `expected sequence 'a' (existing header → 1 publish), got '${out.sequence}'`);
  assert(rec.published.length === 1, `existing header must publish exactly 1 event, published ${rec.published.length}`);
  const ev = rec.published[0];
  assert(isAssertion(ev), `the single publish must be the assertion, got d='${dOf(ev)}'`);
  assert(tagVal(ev, 'e') === NOTE_ID, `assertion must reference the note via e, got ${JSON.stringify(tagVal(ev, 'e'))}`);
  assert(descriptorZ(ev) === c.taggingHeaderAddr(JACK, EXISTING_SLUG),
    `descriptor z must be the EXISTING header coord ${c.taggingHeaderAddr(JACK, EXISTING_SLUG)}, got ${descriptorZ(ev)}`);
  assert(tagVal(ev, 'polarity') === '1', `apply must carry polarity "1", got ${JSON.stringify(tagVal(ev, 'polarity'))}`);
  assert(out.published.length === 1 && !out.failedAt, 'published[] length 1 and no failedAt on success');
});

// AC-1 (dispute): same address, flipped polarity
t("sequence 'a' dispute: polarity -1 at the SAME deterministic address as the apply", async () => {
  const c = load();
  const apply = await c.applyEventTagging(baseArgs({
    tagInput: { authorPubkey: JACK, slug: EXISTING_SLUG }, polarity: 1, deps: makeDeps({ headers: [{ author: JACK }] }).deps,
  }));
  const dispDeps = makeDeps({ headers: [{ author: JACK }] });
  const dispute = await c.applyEventTagging(baseArgs({
    tagInput: { authorPubkey: JACK, slug: EXISTING_SLUG }, polarity: -1, deps: dispDeps.deps,
  }));
  const ev = dispDeps.rec.published[0];
  assert(tagVal(ev, 'polarity') === '-1', `dispute must carry polarity "-1", got ${JSON.stringify(tagVal(ev, 'polarity'))}`);
  assert(apply.published[0].address === dispute.published[0].address,
    `apply and dispute must land at the SAME address (latest-wins), got ${apply.published[0].address} vs ${dispute.published[0].address}`);
});

// AC-2: tag exists, no header → 2 publishes, header THEN assertion
t("sequence 'b' (tag exists, no header): publishes header THEN assertion, in order; assertion refs the just-built header", async () => {
  const c = load();
  const { deps, rec } = makeDeps({ headers: [] });
  const out = await c.applyEventTagging(baseArgs({ tagInput: { authorPubkey: JACK, slug: EXISTING_SLUG }, deps }));

  assert(out.sequence === 'b', `expected sequence 'b' (tag exists, no header → 2 publishes), got '${out.sequence}'`);
  assert(rec.published.length === 2, `must publish exactly 2 events, published ${rec.published.length}`);
  const [first, second] = rec.published;
  assert(isHeader(first), `publish #1 must be the tagging header, got d='${dOf(first)}'`);
  assert(isAssertion(second), `publish #2 must be the assertion, got d='${dOf(second)}'`);
  // The header is minted by the asserter; its `a` references the tag-element coord (author = the tag author JACK).
  assert(tagVal(first, 'a') === c.tagElementAddr(JACK, EXISTING_SLUG),
    `header.a must reference the tag-element coord ${c.tagElementAddr(JACK, EXISTING_SLUG)}, got ${tagVal(first, 'a')}`);
  // The assertion references the header just minted by the asserter (ALICE).
  assert(descriptorZ(second) === c.taggingHeaderAddr(ALICE, EXISTING_SLUG),
    `assertion descriptor z must reference the newly-minted header coord ${c.taggingHeaderAddr(ALICE, EXISTING_SLUG)}, got ${descriptorZ(second)}`);
});

// AC-3: brand-new tag → 3 publishes, tag-element THEN header THEN assertion
t("sequence 'c' (brand-new tag): publishes tag-element, header, assertion in dependency order; each refs the prior", async () => {
  const c = load();
  const { deps, rec } = makeDeps();
  const out = await c.applyEventTagging(baseArgs({ tagInput: { name: NEW_NAME, description: 'marks awesome things' }, deps }));

  assert(out.sequence === 'c', `expected sequence 'c' (brand-new tag → 3 publishes), got '${out.sequence}'`);
  assert(rec.published.length === 3, `must publish exactly 3 events, published ${rec.published.length}`);
  const [el, header, assertion] = rec.published;
  assert(isTagElement(el), `publish #1 must be the tag-element, got d='${dOf(el)}'`);
  assert(isHeader(header), `publish #2 must be the header, got d='${dOf(header)}'`);
  assert(isAssertion(assertion), `publish #3 must be the assertion, got d='${dOf(assertion)}'`);
  assert(dOf(el) === NEW_SLUG, `tag-element d must be the slug '${NEW_SLUG}', got '${dOf(el)}'`);
  // new tag is authored by the asserter → tag-element + header + descriptor all under ALICE.
  assert(tagVal(header, 'a') === c.tagElementAddr(ALICE, NEW_SLUG),
    `header.a must reference the just-built tag-element coord ${c.tagElementAddr(ALICE, NEW_SLUG)}, got ${tagVal(header, 'a')}`);
  assert(descriptorZ(assertion) === c.taggingHeaderAddr(ALICE, NEW_SLUG),
    `assertion descriptor z must reference the just-built header coord ${c.taggingHeaderAddr(ALICE, NEW_SLUG)}, got ${descriptorZ(assertion)}`);
});

// AC-4: sequence is DISCOVERED, not assumed
t('sequence is chosen by discovery: SAME existing tagInput → 1 publish when a header exists, 2 when none', async () => {
  const c = load();
  const tagInput = { authorPubkey: JACK, slug: EXISTING_SLUG };

  const withHeader = makeDeps({ headers: [{ author: JACK }] });
  const a = await c.applyEventTagging(baseArgs({ tagInput, deps: withHeader.deps }));
  assert(a.sequence === 'a' && withHeader.rec.published.length === 1,
    `header present → sequence 'a' / 1 publish; got ${a.sequence} / ${withHeader.rec.published.length}`);
  assert(withHeader.rec.findHeadersCalls.length === 1, 'existing tag must consult findHeaders to discover the header');

  const noHeader = makeDeps({ headers: [] });
  const b = await c.applyEventTagging(baseArgs({ tagInput, deps: noHeader.deps }));
  assert(b.sequence === 'b' && noHeader.rec.published.length === 2,
    `header absent → sequence 'b' / 2 publishes; got ${b.sequence} / ${noHeader.rec.published.length}`);
});

t("brand-new tag does NOT consult findHeaders (a new tag definitionally has no header)", async () => {
  const c = load();
  const { deps, rec } = makeDeps();
  await c.applyEventTagging(baseArgs({ tagInput: { name: NEW_NAME, description: '' }, deps }));
  assert(rec.findHeadersCalls.length === 0,
    `a brand-new tag must not read headers-for-tag, findHeaders called ${rec.findHeadersCalls.length}×`);
});

/* ─────────────────── Orchestrator: sign-all-then-publish & failure ─────────────────── */

// AC-7 / sign timing: a signer rejection publishes NOTHING
t('sign-all-then-publish: a signer rejection mid-plan publishes nothing (clean abort)', async () => {
  const c = load();
  const { deps, rec } = makeDeps({ failSignAt: 2 }); // reject the 2nd of 3 signs (new tag)
  let threw = false;
  try { await c.applyEventTagging(baseArgs({ tagInput: { name: NEW_NAME, description: '' }, deps })); }
  catch { threw = true; }
  assert(threw, 'a signer rejection must surface as a throw');
  // The orchestrator must reach signing (sign-all phase) BEFORE any publish:
  // sign #1 lands, sign #2 rejects → exactly the first event is signed, none published.
  assert(rec.signed.length === 1, `sign-all must reach the signer before aborting (expected 1 signed before the rejection, got ${rec.signed.length})`);
  assert(rec.published.length === 0, `nothing may be published if signing aborts, published ${rec.published.length}`);
});

// AC-5: ordered publish, stop on first failure → only the reusable prefix lands
t('ordered publish stops on first failure: dependents are NOT attempted; failedAt is returned with the landed prefix', async () => {
  const c = load();
  const { deps, rec } = makeDeps({ failPublishAt: 2 }); // header publish fails (new tag: el ok, header fails)
  const out = await c.applyEventTagging(baseArgs({ tagInput: { name: NEW_NAME, description: '' }, deps }));

  assert(rec.published.length === 1 && isTagElement(rec.published[0]),
    `only the tag-element (reusable orphan) may land before the failure, landed ${rec.published.length}`);
  assert(out.failedAt && out.failedAt.kind === 39999, `failedAt must name the failed event, got ${JSON.stringify(out.failedAt)}`);
  assert(out.published.length === 1, `published[] reports only what landed, got ${out.published.length}`);
  // The unverifiable state (assertion without its header) must be UNREACHABLE.
  const landedAssertionWithoutHeader = out.published.some((p) => /^event-tag-/.test((p.address || '').split(':')[2] || ''));
  assert(!landedAssertionWithoutHeader, 'an assertion must never land when its header did not — only reusable leftovers are allowed');
});

// AC-5 (retry tail): replaceable coordinates → a re-run overwrites, never duplicates
t('retry is safe: a full re-run lands at identical (replaceable) coordinates — no duplicate of an already-published prefix', async () => {
  const c = load();
  const run1 = makeDeps();
  const r1 = await c.applyEventTagging(baseArgs({ tagInput: { name: NEW_NAME, description: '' }, deps: run1.deps }));
  const run2 = makeDeps();
  const r2 = await c.applyEventTagging(baseArgs({ tagInput: { name: NEW_NAME, description: '' }, deps: run2.deps }));
  const addrs1 = r1.published.map((p) => p.address);
  const addrs2 = r2.published.map((p) => p.address);
  assert(JSON.stringify(addrs1) === JSON.stringify(addrs2),
    `re-running must reuse identical addresses (replaceable, latest-wins), got ${JSON.stringify(addrs1)} vs ${JSON.stringify(addrs2)}`);
});

/* ─────────────────── Orchestrator: federation, replaceability, guards ─────────────────── */

// AC-8: dual-z on EVERY built event
t('dual-z federation: tag-element, header, and assertion each carry BOTH the canonical and local concept-z', async () => {
  const c = load();
  const { deps, rec } = makeDeps();
  await c.applyEventTagging(baseArgs({ tagInput: { name: NEW_NAME, description: '' }, deps }));
  const [el, header, assertion] = rec.published;
  assert(hasZ(el, c.conceptTag(TA)) && hasZ(el, c.conceptTag(LOCAL)), 'tag-element must carry canonical + local `tag` concept-z');
  assert(hasZ(header, c.conceptTaggingWithSpecificTag(TA)) && hasZ(header, c.conceptTaggingWithSpecificTag(LOCAL)),
    'header must carry canonical + local `tagging-with-specific-tag` concept-z');
  assert(hasZ(assertion, c.conceptNostrEventTag(TA)) && hasZ(assertion, c.conceptNostrEventTag(LOCAL)),
    'assertion must carry canonical + local `nostr-event-tag` concept-z');
});

// AC-9: replaceability — apply↔dispute share the deterministic assertion d
t('replaceability: re-apply and apply↔dispute reuse the SAME deterministic assertion d (no duplicate)', async () => {
  const c = load();
  const mk = (polarity) => {
    const d = makeDeps({ headers: [{ author: JACK }] });
    return { d, p: c.applyEventTagging(baseArgs({ tagInput: { authorPubkey: JACK, slug: EXISTING_SLUG }, polarity, deps: d.deps })) };
  };
  const apply1 = mk(1); await apply1.p;
  const apply2 = mk(1); await apply2.p;
  const dispute = mk(-1); await dispute.p;
  const dApply1 = dOf(apply1.d.rec.published[0]);
  const dApply2 = dOf(apply2.d.rec.published[0]);
  const dDispute = dOf(dispute.d.rec.published[0]);
  assert(dApply1 === dApply2, `re-apply must reuse the same d, got ${dApply1} vs ${dApply2}`);
  assert(dApply1 === dDispute, `flip apply↔dispute must reuse the same d (latest-wins), got ${dApply1} vs ${dDispute}`);
});

// AC-10: malformed input is refused BEFORE any publish or sign
t('malformed input throws before any publish AND before any sign (no orphan events)', async () => {
  const c = load();
  // A genuine validation throw — NOT a "function missing" red-phase artifact.
  const isValidationError = (e) => e && /pubkey|hex|target|polarity|coordinate|malformed/i.test(e.message || '');

  // malformed asserter
  let d1 = makeDeps(); let err1 = null;
  try { await c.applyEventTagging(baseArgs({ tagInput: { authorPubkey: JACK, slug: EXISTING_SLUG }, asserterPubkey: 'not-hex', deps: d1.deps })); }
  catch (e) { err1 = e; }
  assert(isValidationError(err1), `malformed asserterPubkey must throw a validation error, got ${err1 && err1.message}`);
  assert(d1.rec.signed.length === 0 && d1.rec.published.length === 0, 'no sign and no publish may occur on a malformed asserter');

  // malformed target (neither id nor address)
  let d2 = makeDeps({ headers: [{ author: JACK }] }); let err2 = null;
  try { await c.applyEventTagging(baseArgs({ tagInput: { authorPubkey: JACK, slug: EXISTING_SLUG }, target: {}, deps: d2.deps })); }
  catch (e) { err2 = e; }
  assert(isValidationError(err2), `a target that is neither {id} nor {address} must throw a validation error, got ${err2 && err2.message}`);
  assert(d2.rec.published.length === 0, 'no publish may occur on a malformed target');
});

// pickHeader (ADR): deterministic choice when several headers exist
t('pickHeader: prefers a header under the canonical authority; otherwise tie-breaks by author ascending', async () => {
  const c = load();
  // canonical preference: ALICE + canonical TA both have headers → choose the canonical-authored one.
  const canon = makeDeps({ headers: [{ author: ALICE }, { author: TA }] });
  await c.applyEventTagging(baseArgs({ tagInput: { authorPubkey: JACK, slug: EXISTING_SLUG }, deps: canon.deps }));
  assert(descriptorZ(canon.rec.published[0]) === c.taggingHeaderAddr(TA, EXISTING_SLUG),
    `must prefer the canonical-authority header (${c.taggingHeaderAddr(TA, EXISTING_SLUG)}), got ${descriptorZ(canon.rec.published[0])}`);

  // no canonical header → ascending author (JACK 1111… < CHARLIE 3333…).
  const tie = makeDeps({ headers: [{ author: CHARLIE }, { author: JACK }] });
  await c.applyEventTagging(baseArgs({ tagInput: { authorPubkey: JACK, slug: EXISTING_SLUG }, deps: tie.deps }));
  assert(descriptorZ(tie.rec.published[0]) === c.taggingHeaderAddr(JACK, EXISTING_SLUG),
    `tie-break must pick the lexicographically-smallest author (${c.taggingHeaderAddr(JACK, EXISTING_SLUG)}), got ${descriptorZ(tie.rec.published[0])}`);
});

// Edge: addressable target flows to the `a` tag on the assertion
t('addressable target ({address}): the assertion references it via a, not e', async () => {
  const c = load();
  const { deps, rec } = makeDeps({ headers: [{ author: JACK }] });
  await c.applyEventTagging(baseArgs({ tagInput: { authorPubkey: JACK, slug: EXISTING_SLUG }, target: { address: ADDR_TARGET }, deps }));
  const ev = rec.published[0];
  assert(tagVal(ev, 'a') === ADDR_TARGET, `addressable target must land in a, got ${JSON.stringify(tagVal(ev, 'a'))}`);
  assert(tagVal(ev, 'e') === null, 'addressable target must NOT emit an e tag');
});

// Return shape: published[] entries are { kind, address, id }
t('return shape: published[] entries carry {kind, address, id}; id round-trips from the signer', async () => {
  const c = load();
  const { deps } = makeDeps();
  const out = await c.applyEventTagging(baseArgs({ tagInput: { name: NEW_NAME, description: '' }, deps }));
  assert(Array.isArray(out.published) && out.published.length === 3, 'published[] must list all 3 landed events');
  for (const p of out.published) {
    assert(p.kind === 39999, `each published entry must report kind 39999, got ${p.kind}`);
    assert(typeof p.address === 'string' && p.address.startsWith('39999:'), `each entry must report an addressable coord, got ${JSON.stringify(p.address)}`);
    assert(typeof p.id === 'string' && p.id.length > 0, `each entry must report the signed id, got ${JSON.stringify(p.id)}`);
  }
});

/* ──────────────────────────────── Source-contract ──────────────────────────────── */

t('source: the core exports applyEventTagging', () => {
  const c = load();
  assert(typeof c.applyEventTagging === 'function', 'src/lib/event-tagging must export applyEventTagging()');
});

t('source: the orchestrator stays pure (no signer/transport/clock literals in the core)', () => {
  if (!fs.existsSync(CORE_DIR)) throw new Error('src/lib/event-tagging/ does not exist');
  const banned = ['Date.now', 'PUBLISH_RELAYS', 'window.nostr', 'publishEverywhere', 'SimplePool', 'fetch(', 'wss:'];
  for (const f of fs.readdirSync(CORE_DIR).filter((x) => x.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(CORE_DIR, f), 'utf-8');
    for (const bad of banned) assert(!src.includes(bad), `${f} must not reference "${bad}" — deps are injected, not embedded`);
  }
});

t('source: the thin UI hook consumes the core (no inlined wire shape), signs via NIP-07, and publishes through the GUARDED publishOrThrow', () => {
  const candidates = [
    path.join(REPO_ROOT, 'ui/src/hooks/useEventTagging.js'),
    path.join(REPO_ROOT, 'ui/src/utils/publishEventTag.js'),
  ];
  const hookPath = candidates.find((p) => fs.existsSync(p));
  assert(hookPath, `expected the write-path hook/util at one of: ${candidates.map((p) => path.relative(REPO_ROOT, p)).join(' | ')}`);
  const src = fs.readFileSync(hookPath, 'utf-8');

  assert(/applyEventTagging/.test(src), 'hook must call the core orchestrator applyEventTagging');
  assert(/event-tagging|@tapestry\/event-tagging/.test(src), 'hook must import the single-source core (alias or path), not re-inline the wire shape');
  assert(!/kind:\s*39999/.test(src), 'hook must NOT inline the kind-39999 wire shape — it delegates to the core (no drift)');
  assert(/publishOrThrow/.test(src), 'hook must publish through the guarded publishOrThrow (Story-2 local-only guard inherited)');
  assert(/window\.nostr/.test(src), 'hook must sign via the NIP-07 browser signer');
  assert(/No NIP-07|window\.nostr/.test(src), 'hook must raise a clear error when no signer is available');
});

t('source: the hook composes z-namespaces from the canonical literal + the RUNTIME TA — never a foreign hardcode', () => {
  const candidates = [
    path.join(REPO_ROOT, 'ui/src/hooks/useEventTagging.js'),
    path.join(REPO_ROOT, 'ui/src/utils/publishEventTag.js'),
  ];
  const hookPath = candidates.find((p) => fs.existsSync(p));
  assert(hookPath, 'write-path hook/util must exist (see previous test)');
  const src = fs.readFileSync(hookPath, 'utf-8');

  assert(/useConfig|taPubkey/.test(src), 'hook must source the LOCAL TA from runtime config (useConfig().taPubkey), not a literal');
  // Any 64-hex literal other than the sanctioned canonical (ADR-0015 lineage) is a forbidden hardcode.
  const hexLiterals = (src.match(/[0-9a-f]{64}/g) || []).filter((h) => h !== TA);
  assert(hexLiterals.length === 0, `hook must not hardcode any TA pubkey other than the canonical literal; found ${JSON.stringify(hexLiterals)}`);
});

async function run() {
  console.log('\n--- event-tagging write-path tests (epic event-tagging, Story 5) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\nevent-tagging-write-path: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
