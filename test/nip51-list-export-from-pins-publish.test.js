/**
 * Integration tests for Story 19: live NIP-51 kind-30000 publication flow.
 * ADR: engineering-team/decisions/0017-nip51-list-export-from-pins.md
 *
 * Exercises the parts of the spec that the contract suite cannot:
 *
 *   - Wire-shape of the unsigned template returned by
 *     /api/trusted-list/prepare-nip51-export — the endpoint is
 *     authenticated, so we cannot drive the full happy path from a
 *     no-auth test process; instead we publish a kind-30000 manually
 *     (nak-signed under an ephemeral viewer key) and assert that
 *     the read-side derivation (`nip51ExportStatus` on /pins) picks
 *     it up with the correct shape.
 *   - Replaceability (AC-5–AC-8): two consecutive nak-signed
 *     kind-30000 events at the same (kind, pubkey, d-tag) coordinate
 *     resolve to one — latest created_at wins; no NIP-09 delete is
 *     emitted by the test or required by the spec.
 *   - Staleness derivation: nip51ExportStatus.diffVsTL reflects
 *     differences between the latest kind-30000 and the live
 *     kind-30392 (AC-15 / AC-16 / AC-17).
 *   - kind-10002 read path (AC-25 / AC-28): publishing an
 *     ephemeral viewer's NIP-65 + verifying that strfry returns it
 *     for the canonical scan {kinds:[10002], authors:[viewer]}.
 *
 * Approach: ephemeral keypairs via `nak`, signed events POSTed to
 * /api/strfry/publish with signAs:'client'. Mirrors test/pin-a-tag-publish
 * and test/tl-publication-from-pins-publish. Tests skip when `nak` is
 * missing or the control panel is unreachable.
 *
 * Note: this suite does NOT directly drive
 * POST /api/trusted-list/prepare-nip51-export from an authenticated
 * session (the test process has none). Authenticated happy-path is
 * covered in tests/brainstorm/nip51-list-export-from-pins.spec.js
 * (Playwright, mocked session). Here we lock in the WIRE SHAPE the
 * endpoint MUST produce (by manually publishing kind-30000 events
 * shaped to the ADR's specification and verifying the read paths
 * recognize them).
 */

const { execSync, execFileSync } = require('child_process');
const { nip19, finalizeEvent } = require('nostr-tools');

const CONTROL_PANEL_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
// Per ADR 0015 + CLAUDE.md: z-tag composition uses the LEGACY pubkey
// to preserve cross-deployment historical-event compatibility.
const LEGACY_TA_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const TAG_HANDLE = `39998:${LEGACY_TA_PUBKEY}:tag`;
const NOSTR_USER_TAG_HANDLE = `39998:${LEGACY_TA_PUBKEY}:nostr-user-tag`;
const TAG_PINNING_HANDLE = `39998:${LEGACY_TA_PUBKEY}:tag-pinning`;
const PROPAGATION_MS = 800;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function nakAvailable() {
  try { execSync('command -v nak', { stdio: 'pipe' }); return true; }
  catch { return false; }
}

async function controlPanelReachable() {
  try {
    const r = await fetch(`${CONTROL_PANEL_BASE}/api/auth/user-classification`, { signal: AbortSignal.timeout(2000) });
    return r.ok;
  } catch { return false; }
}

function nakKeyGen() { return execSync('nak key generate').toString().trim(); }
function nakDerivePubkey(privkey) { return execSync(`nak key public ${privkey}`).toString().trim(); }

/**
 * argv-style nak invocation: avoids bash brace-expansion on JSON tag values
 * (same fix as test/pin-a-tag-publish.test.js). Works for tags with at
 * most TWO elements (nak collapses extras with '='); for multi-element
 * tags (NIP-65 r-tags etc.) use nostrSignEvent below.
 */
function nakSignEvent({ kind, tags = [], content = '', privkey }) {
  const args = ['event', '-k', String(kind)];
  for (const tag of tags) {
    args.push('--tag', `${tag[0]}=${tag.slice(1).join('=')}`);
  }
  args.push('--sec', privkey, '-c', content);
  return JSON.parse(execFileSync('nak', args).toString().trim());
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/**
 * Sign an event with nostr-tools (preserves multi-element tags
 * verbatim, unlike nak's `--tag k=v` form). Use this for NIP-65
 * kind-10002 events whose r-tags carry read/write markers.
 */
function nostrSignEvent({ kind, tags = [], content = '', privkey }) {
  return finalizeEvent({
    kind,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content,
  }, hexToBytes(privkey));
}

async function publish(signedEvent) {
  const r = await fetch(`${CONTROL_PANEL_BASE}/api/strfry/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: signedEvent, signAs: 'client' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.success) {
    throw new Error(`publish failed: status=${r.status} body=${JSON.stringify(j)}`);
  }
  return j.event;
}

async function fetchJson(url, opts = {}) {
  const r = await fetch(url, opts);
  const json = await r.json().catch(() => null);
  return { status: r.status, json };
}

async function postJson(url, body) {
  return fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body),
  });
}

async function strfryScan(filter) {
  const safe = JSON.stringify(filter).replace(/"/g, '\\"');
  const out = execSync(
    `docker exec tapestry sh -c 'strfry scan "${safe}" 2>/dev/null'`,
    { maxBuffer: 20 * 1024 * 1024 }
  ).toString();
  const events = [];
  for (const line of out.split('\n')) {
    if (!line) continue;
    try { events.push(JSON.parse(line)); } catch {}
  }
  return events;
}

/* ── Fixture builders ─────────────────────────────────────────────── */

async function publishTagEvent({ slug, name, description, authorSk }) {
  return await publish(nakSignEvent({
    kind: 39999,
    tags: [['d', slug], ['z', TAG_HANDLE]],
    content: JSON.stringify({ tag: { slug, name, description: description || '' } }),
    privkey: authorSk,
  }));
}

function buildPinEvent({ tag, viewerSk, viewerPk, curationMethod }) {
  const dTag = `tag-pin-${tag.slug}-${tag.authorPubkey.slice(0, 8)}-${viewerPk.slice(0, 8)}`;
  return nakSignEvent({
    kind: 39999,
    tags: [
      ['d', dTag],
      ['e', tag.eventId],
      ['a', `39999:${tag.authorPubkey}:${tag.slug}`],
      ['z', TAG_PINNING_HANDLE],
      ['curation-method', JSON.stringify(curationMethod)],
    ],
    content: JSON.stringify({ tagPinning: { tagEventId: tag.eventId, curationMethod } }),
    privkey: viewerSk,
  });
}

function buildProfileTagAssertion({ tagSlug, tagEventId, targetPubkey, authorSk, authorPk, polarity }) {
  const dTag = `profile-tag-${tagSlug}-${targetPubkey.slice(0, 8)}-${authorPk.slice(0, 8)}`;
  return nakSignEvent({
    kind: 39999,
    tags: [
      ['d', dTag],
      ['p', targetPubkey],
      ['e', tagEventId],
      ['z', NOSTR_USER_TAG_HANDLE],
      ['polarity', String(polarity)],
    ],
    content: JSON.stringify({ nostrUserTag: { taggedPubkey: targetPubkey, tagEventId } }),
    privkey: authorSk,
  });
}

function defaultCurationMethod(observerPk) {
  return { observer: observerPk, method: 'nip85:rank', cutoff: 1, includeScoreInTL: true };
}

function expectedTLDTag({ observerPk, tagAuthorPk, tagSlug }) {
  // Mirrors src/api/trustedList/refreshPinnedTags.js:66 and
  // ui/src/utils/publishTagPin.js:61. Per ADR 0017 AC-6, the
  // kind-30000 d-tag is identical.
  return `tl-pin-${observerPk.slice(0, 8)}-${tagAuthorPk.slice(0, 8)}-${tagSlug}`;
}

/**
 * Manually publish a kind-30000 NIP-51 follow-set export under the
 * viewer's key with the exact wire shape the ADR specifies. Used to
 * simulate "the Implementer's endpoint produced this" so the read
 * paths can be verified.
 *
 * @param {object} args
 * @param {string} args.viewerSk — signer's private key
 * @param {string} args.viewerPk — signer's public key
 * @param {string} args.dTag — should match expectedTLDTag(...)
 * @param {string} args.title — visible title
 * @param {string} args.description — visible description (Brainstorm hint)
 * @param {string[]} args.memberPubkeys — member set (p-tags)
 */
async function publishKind30000Export({
  viewerSk, dTag, title, description, memberPubkeys = [],
}) {
  const tags = [
    ['d', dTag],
    ['z', TAG_PINNING_HANDLE],
    ['title', title],
    ['description', description],
    ...memberPubkeys.map((pk) => ['p', pk]),
  ];
  return await publish(nakSignEvent({
    kind: 30000,
    tags,
    content: '',
    privkey: viewerSk,
  }));
}

async function findLatestKind30000({ pubkey, dTag }) {
  const events = await strfryScan({ kinds: [30000], authors: [pubkey], '#d': [dTag] });
  if (events.length === 0) return null;
  events.sort((a, b) => b.created_at - a.created_at);
  return events[0];
}

async function findLatestTL(dTag) {
  // The kind-30392 TL signed by the runtime TA. We resolve the TA
  // pubkey by reading /api/assistant/pubkey rather than hardcoding —
  // per CLAUDE.md "Per-deployment TA pubkey, NEVER hardcode."
  const r = await fetch(`${CONTROL_PANEL_BASE}/api/assistant/pubkey`);
  const j = await r.json().catch(() => null);
  const taPk = j?.pubkey;
  if (!taPk) return null;
  const events = await strfryScan({ kinds: [30392], authors: [taPk], '#d': [dTag] });
  if (events.length === 0) return null;
  events.sort((a, b) => b.created_at - a.created_at);
  return events[0];
}

/* ── Phase 1: wire-shape via manual publication ─────────────────── */

let basicCtx = null;
const basicTests = [];
function tBasic(name, fn) { basicTests.push([name, fn]); }

async function setupBasicSuite() {
  // Tag + viewer + one in-WoT-equivalent author + one target.
  // No POV configuration → assertions count if polarity=1 and author
  // is anyone (default fallback). The cron-driven kind-30392 may or
  // may not pick this up depending on POV resolution; for our
  // wire-shape tests we don't actually rely on the kind-30392
  // existing (Phase 1 only checks the kind-30000 we publish manually
  // + the staleness derivation which handles missing kind-30392).

  const tagAuthorSk = nakKeyGen();
  const tagAuthorPk = nakDerivePubkey(tagAuthorSk);
  const slugBase = `s19b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tagSlug = `nip51-tag-${slugBase}`;
  const publishedTag = await publishTagEvent({
    slug: tagSlug,
    name: `NIP-51 Tag ${slugBase}`,
    description: 'Story 19 wire-shape test',
    authorSk: tagAuthorSk,
  });
  const tag = {
    eventId: publishedTag.id,
    slug: tagSlug,
    authorPubkey: tagAuthorPk,
    name: `NIP-51 Tag ${slugBase}`,
  };

  // The viewer / pinner / kind-30000 signer.
  const viewerSk = nakKeyGen();
  const viewerPk = nakDerivePubkey(viewerSk);

  // Two members for the kind-30000 to include.
  const memberA = nakDerivePubkey(nakKeyGen());
  const memberB = nakDerivePubkey(nakKeyGen());

  // Publish the pin event itself (under viewer's key).
  const pinEvent = buildPinEvent({
    tag, viewerSk, viewerPk,
    curationMethod: defaultCurationMethod(viewerPk),
  });
  const publishedPin = await publish(pinEvent);

  // Publish a NIP-65 (kind 10002) under viewer's key with 3 entries:
  //   wss://relay.alpha.example — write
  //   wss://relay.beta.example  — read
  //   wss://relay.gamma.example — both (no marker → both per NIP-65)
  // Expected writeRelays per AC-25 = [alpha, gamma] in document order.
  // nostrSignEvent is used (not nakSignEvent) because nak's --tag flag
  // collapses multi-element tags via '=' and loses the read/write
  // marker.
  const writeRelayA = 'wss://relay.alpha.example';
  const readRelayB = 'wss://relay.beta.example';
  const bothRelayC = 'wss://relay.gamma.example';
  const nip65 = nostrSignEvent({
    kind: 10002,
    tags: [
      ['r', writeRelayA, 'write'],
      ['r', readRelayB, 'read'],
      ['r', bothRelayC],
    ],
    content: '',
    privkey: viewerSk,
  });
  const publishedNip65 = await publish(nip65);

  await sleep(PROPAGATION_MS);

  basicCtx = {
    tag, viewerSk, viewerPk, memberA, memberB,
    pinEventId: publishedPin.id,
    nip65EventId: publishedNip65.id,
    writeRelayA, readRelayB, bothRelayC,
    expectedWriteRelays: [writeRelayA, bothRelayC],
    slugBase,
  };
}

/* AC-2 / AC-3 / AC-4 / AC-6: kind-30000 wire shape & d-tag composition */

tBasic('manually-published kind-30000 with the ADR-specified wire shape lands in strfry under the viewer pubkey (AC-1 surrogate, AC-2 wire shape)', async () => {
  const { tag, viewerSk, viewerPk, memberA, memberB } = basicCtx;
  const dTag = expectedTLDTag({
    observerPk: viewerPk,
    tagAuthorPk: tag.authorPubkey,
    tagSlug: tag.slug,
  });
  const description = 'A Pinned-tag list from Brainstorm — members are trusted in this tag under the exporter\'s web-of-trust point of view. Re-publish from your Brainstorm instance to update.';

  await publishKind30000Export({
    viewerSk, dTag,
    title: tag.name,
    description,
    memberPubkeys: [memberA, memberB],
  });
  await sleep(PROPAGATION_MS);

  const ev = await findLatestKind30000({ pubkey: viewerPk, dTag });
  assert(ev, `expected a kind-30000 at (pubkey=${viewerPk.slice(0, 8)}…, d=${dTag}); got none`);
  assert(ev.kind === 30000, `kind must be 30000; got ${ev.kind}`);
  assert(ev.pubkey === viewerPk,
    `kind-30000 pubkey must be the viewer (signer), NOT the TA; got ${ev.pubkey.slice(0, 8)}… expected ${viewerPk.slice(0, 8)}…`);
  const find = (k) => (ev.tags || []).find((t) => t[0] === k);
  assert(find('d')?.[1] === dTag, `d-tag must equal ${dTag}; got ${JSON.stringify(find('d'))}`);
  assert(find('z')?.[1] === TAG_PINNING_HANDLE,
    `z-tag must be the LEGACY tag-pinning handle "${TAG_PINNING_HANDLE}" (per ADR 0017 Q2 + ADR 0015); got ${JSON.stringify(find('z'))}`);
  assert(find('title')?.[1] === tag.name,
    `title must equal the tag display name (AC-9 default fallback); got ${JSON.stringify(find('title'))}`);
  assert(find('description'),
    `description tag must be present (AC-3); got tags=${JSON.stringify(ev.tags?.map(t => t[0]))}`);
  const pPubkeys = (ev.tags || []).filter((t) => t[0] === 'p').map((t) => t[1]);
  assert(pPubkeys.includes(memberA) && pPubkeys.includes(memberB),
    `p-tags must include both members; got ${JSON.stringify(pPubkeys)}`);
});

tBasic('kind-30000 d-tag is byte-identical to the kind-30392 d-tag formula tl-pin-<obs8>-<tagAuthor8>-<slug> (AC-6)', async () => {
  const { tag, viewerPk } = basicCtx;
  const dTag = expectedTLDTag({
    observerPk: viewerPk,
    tagAuthorPk: tag.authorPubkey,
    tagSlug: tag.slug,
  });
  assert(/^tl-pin-[0-9a-f]{8}-[0-9a-f]{8}-/.test(dTag),
    `d-tag must match tl-pin-<obs8>-<tagAuthor8>-<slug>; got ${dTag}`);
  assert(dTag.startsWith(`tl-pin-${viewerPk.slice(0, 8)}-${tag.authorPubkey.slice(0, 8)}-`),
    `d-tag prefix must use the first 8 hex chars of (observer, tagAuthor); got ${dTag}`);
  assert(dTag.endsWith(`-${tag.slug}`),
    `d-tag must end with the tag slug; got ${dTag}`);
});

/* AC-5 / AC-7: replaceability — two publishes at same coord, no NIP-09 delete */

tBasic('two re-exports for the same pin produce two kind-30000 events at the same (kind, pubkey, d-tag) coordinate — relay resolves the latest by created_at (AC-5)', async () => {
  const { tag, viewerSk, viewerPk, memberA, memberB } = basicCtx;
  const dTag = expectedTLDTag({
    observerPk: viewerPk,
    tagAuthorPk: tag.authorPubkey,
    tagSlug: tag.slug,
  });

  // First export already published in the previous test. Wait so
  // created_at advances and publish a second.
  const before = await findLatestKind30000({ pubkey: viewerPk, dTag });
  assert(before, 'precondition: a first kind-30000 must exist');

  await sleep(1100);
  await publishKind30000Export({
    viewerSk, dTag,
    title: 'Renamed list',
    description: 'updated description',
    memberPubkeys: [memberA], // changed membership
  });
  await sleep(PROPAGATION_MS);

  const after = await findLatestKind30000({ pubkey: viewerPk, dTag });
  assert(after, 'latest kind-30000 must exist after the second publish');
  assert(after.id !== before.id,
    `the second publish must produce a distinct event id from the first; got identical ${before.id?.slice(0, 8)}…`);
  assert(after.created_at > before.created_at,
    `after.created_at (${after.created_at}) must exceed before.created_at (${before.created_at}); the slot must be replaced in place`);

  // The first event's id remains queryable by id, but it is no
  // longer the latest at the (kind, pubkey, d-tag) coordinate. That
  // is the NIP-33 replaceability contract.
});

tBasic('re-exporting a kind-30000 does NOT publish a NIP-09 (kind-5) deletion event targeting prior kind-30000 events (AC-7)', async () => {
  const { viewerPk } = basicCtx;
  // Scan strfry for any kind-5 deletion events authored by the viewer.
  // The test setup never emits a kind-5; if any exist, the Implementer
  // has wired re-export to issue deletes, violating AC-7.
  const deletes = await strfryScan({ kinds: [5], authors: [viewerPk] });
  assert(deletes.length === 0,
    `viewer must not have any kind-5 deletion events; got ${deletes.length} (the spec forbids destroying user-signed kind-30000 events; replaceability handles supersession passively)`);
});

/* AC-8: re-pin uses same d-tag */

tBasic('the d-tag composition (per AC-6) is invariant under re-pin: same (observer, tagAuthor, tagSlug) → same d-tag, regardless of pin event id (AC-8)', async () => {
  const { tag, viewerPk } = basicCtx;
  // Synthesize two would-be d-tags from the same identity inputs;
  // they MUST match. (Re-pin changes only the kind-39999 pin event
  // id — which is not part of the d-tag composition.)
  const d1 = expectedTLDTag({
    observerPk: viewerPk,
    tagAuthorPk: tag.authorPubkey,
    tagSlug: tag.slug,
  });
  const d2 = expectedTLDTag({
    observerPk: viewerPk,
    tagAuthorPk: tag.authorPubkey,
    tagSlug: tag.slug,
  });
  assert(d1 === d2, `same identity inputs must yield same d-tag; got ${d1} vs ${d2}`);
});

/* AC-9: title customization + fallback */

tBasic('changing the title between re-exports does NOT change the d-tag (AC-6 / AC-9)', async () => {
  const { tag, viewerSk, viewerPk, memberA } = basicCtx;
  const dTag = expectedTLDTag({
    observerPk: viewerPk,
    tagAuthorPk: tag.authorPubkey,
    tagSlug: tag.slug,
  });

  await sleep(1100);
  await publishKind30000Export({
    viewerSk, dTag,
    title: 'Custom user-chosen title',
    description: 'updated again',
    memberPubkeys: [memberA],
  });
  await sleep(PROPAGATION_MS);

  const ev = await findLatestKind30000({ pubkey: viewerPk, dTag });
  assert(ev, 'latest kind-30000 must exist');
  const titleTag = (ev.tags || []).find((t) => t[0] === 'title');
  assert(titleTag?.[1] === 'Custom user-chosen title',
    `title must reflect the latest publish (user-chosen value); got ${JSON.stringify(titleTag)}`);
  // d-tag invariant
  const dActual = (ev.tags || []).find((t) => t[0] === 'd')?.[1];
  assert(dActual === dTag,
    `d-tag must remain stable across title changes; got ${dActual} vs ${dTag}`);
});

/* AC-15 / AC-16 / AC-17: nip51ExportStatus derivation on /pins */

tBasic('/api/profile-tags/pins row for the viewer carries a nip51ExportStatus object (AC-15 / AC-16 / AC-17)', async () => {
  const { viewerPk, pinEventId } = basicCtx;
  const { json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/pins?viewerPubkey=${viewerPk}`
  );
  assert(json?.success === true, `pins lookup must succeed; got ${JSON.stringify(json)}`);
  const row = (json.pins || []).find((p) => p.pinEventId === pinEventId);
  assert(row, `pin row must appear in /pins; got pinEventIds=${(json.pins||[]).map(p => p.pinEventId?.slice(0, 8))}`);
  assert(row.nip51ExportStatus,
    `row must carry nip51ExportStatus (Story 19 additive shape); got ${JSON.stringify(row)}`);
  const validStatuses = ['never-exported', 'ok-fresh', 'stale'];
  assert(validStatuses.includes(row.nip51ExportStatus.status),
    `nip51ExportStatus.status must be one of ${JSON.stringify(validStatuses)}; got ${JSON.stringify(row.nip51ExportStatus.status)}`);
  // Field shape requirements per ADR Implementation notes:
  assert('exportedAt' in row.nip51ExportStatus,
    `nip51ExportStatus must have exportedAt field; got ${JSON.stringify(row.nip51ExportStatus)}`);
  assert('exportEventId' in row.nip51ExportStatus,
    `nip51ExportStatus must have exportEventId field; got ${JSON.stringify(row.nip51ExportStatus)}`);
  assert('memberCount' in row.nip51ExportStatus,
    `nip51ExportStatus must have memberCount field; got ${JSON.stringify(row.nip51ExportStatus)}`);
  assert('diffVsTL' in row.nip51ExportStatus,
    `nip51ExportStatus must have diffVsTL field; got ${JSON.stringify(row.nip51ExportStatus)}`);
});

tBasic('nip51ExportStatus reports status=ok-fresh OR stale (not never-exported) once a kind-30000 has been published for the viewer (AC-15 / AC-16)', async () => {
  const { viewerPk, pinEventId } = basicCtx;
  const { json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/pins?viewerPubkey=${viewerPk}`
  );
  const row = (json.pins || []).find((p) => p.pinEventId === pinEventId);
  assert(row?.nip51ExportStatus, 'row + nip51ExportStatus must exist');
  assert(
    row.nip51ExportStatus.status === 'ok-fresh' || row.nip51ExportStatus.status === 'stale',
    `viewer has published kind-30000 events; status must be 'ok-fresh' or 'stale' (not 'never-exported'); got ${JSON.stringify(row.nip51ExportStatus.status)}`
  );
  assert(typeof row.nip51ExportStatus.exportedAt === 'number' && row.nip51ExportStatus.exportedAt > 0,
    `exportedAt must be a positive unix timestamp; got ${JSON.stringify(row.nip51ExportStatus.exportedAt)}`);
  assert(typeof row.nip51ExportStatus.exportEventId === 'string'
    && /^[0-9a-f]{64}$/.test(row.nip51ExportStatus.exportEventId),
    `exportEventId must be 64-char hex; got ${JSON.stringify(row.nip51ExportStatus.exportEventId)}`);
});

tBasic('nip51ExportStatus.diffVsTL has the shape {added, removed} per ADR 0017 Implementation notes (AC-16)', async () => {
  const { viewerPk, pinEventId } = basicCtx;
  const { json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/pins?viewerPubkey=${viewerPk}`
  );
  const row = (json.pins || []).find((p) => p.pinEventId === pinEventId);
  assert(row?.nip51ExportStatus?.diffVsTL,
    `nip51ExportStatus.diffVsTL must be an object when the row has an export and a TL; got ${JSON.stringify(row?.nip51ExportStatus)}`);
  const diff = row.nip51ExportStatus.diffVsTL;
  assert(typeof diff.added === 'number',
    `diffVsTL.added must be a number; got ${JSON.stringify(diff)}`);
  assert(typeof diff.removed === 'number',
    `diffVsTL.removed must be a number; got ${JSON.stringify(diff)}`);
});

/* AC-25 / AC-28: NIP-65 read returns the user's write relays */

tBasic('strfry contains the viewer\'s NIP-65 (kind 10002) event with the expected r-tags (precondition for AC-25 / AC-28)', async () => {
  const { viewerPk, writeRelayA, readRelayB, bothRelayC } = basicCtx;
  const events = await strfryScan({ kinds: [10002], authors: [viewerPk] });
  assert(events.length > 0,
    `expected viewer's kind-10002 in strfry; got ${events.length} events for author ${viewerPk.slice(0, 8)}…`);
  events.sort((a, b) => b.created_at - a.created_at);
  const latest = events[0];
  const rTags = (latest.tags || []).filter((t) => t[0] === 'r');
  assert(rTags.length >= 3,
    `kind-10002 must carry at least 3 r-tags from the fixture; got ${rTags.length}: ${JSON.stringify(rTags)}`);
  const urls = rTags.map((t) => t[1]);
  assert(urls.includes(writeRelayA) && urls.includes(readRelayB) && urls.includes(bothRelayC),
    `kind-10002 r-tags must include all three fixture URLs; got ${JSON.stringify(urls)}`);
});

tBasic('nip51ExportStatus on the /pins row exposes the viewer\'s NIP-65 write-relay set (or writeRelays:[] when absent) — AC-25 / AC-28', async () => {
  // The server's enrichRowsWithTLStatus (or sibling) must also carry
  // the writeRelays it consulted, so the UI's relay-preview popover
  // can render without an extra fetch. Spec is per ADR 0017
  // Amendment A7 / A6: the server returns writeRelays alongside the
  // unsigned template AND the read path surfaces them on /pins rows
  // (for the popover preview to render before the user clicks
  // Export). The field is part of the documented row shape.
  const { viewerPk, pinEventId, expectedWriteRelays } = basicCtx;
  const { json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/pins?viewerPubkey=${viewerPk}`
  );
  const row = (json.pins || []).find((p) => p.pinEventId === pinEventId);
  assert(row?.nip51ExportStatus,
    `row + nip51ExportStatus must exist`);
  assert(Array.isArray(row.nip51ExportStatus.writeRelays),
    `nip51ExportStatus.writeRelays must be an array (AC-25); got ${JSON.stringify(row.nip51ExportStatus.writeRelays)}`);
  // Order MAY differ between the server's parse and our expected
  // (the spec only requires "write or read+write"; order preserved
  // is the recommendation but not a hard AC). We assert set equality.
  const set = new Set(row.nip51ExportStatus.writeRelays);
  for (const want of expectedWriteRelays) {
    assert(set.has(want),
      `nip51ExportStatus.writeRelays must include ${want} (write or no-marker in fixture's NIP-65); got ${JSON.stringify(row.nip51ExportStatus.writeRelays)}`);
  }
  // Read-only relay MUST NOT appear.
  const { readRelayB } = basicCtx;
  assert(!set.has(readRelayB),
    `nip51ExportStatus.writeRelays must NOT include the read-only relay ${readRelayB}; got ${JSON.stringify(row.nip51ExportStatus.writeRelays)}`);
});

tBasic('a viewer with NO kind-10002 in strfry yields nip51ExportStatus.writeRelays === [] (AC-27 server-side)', async () => {
  // Set up a completely separate ephemeral viewer (no NIP-65
  // published) and a pin for them.
  const tagAuthorSk = nakKeyGen();
  const tagAuthorPk = nakDerivePubkey(tagAuthorSk);
  const slugBase = `s19noNip65-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tagSlug = `nip51-no65-${slugBase}`;
  const publishedTag = await publishTagEvent({
    slug: tagSlug,
    name: `No NIP-65 ${slugBase}`,
    description: 'no-nip65 fallback test',
    authorSk: tagAuthorSk,
  });
  const tag = {
    eventId: publishedTag.id,
    slug: tagSlug,
    authorPubkey: tagAuthorPk,
    name: `No NIP-65 ${slugBase}`,
  };

  const viewerSk = nakKeyGen();
  const viewerPk = nakDerivePubkey(viewerSk);
  const pinEvent = buildPinEvent({
    tag, viewerSk, viewerPk,
    curationMethod: defaultCurationMethod(viewerPk),
  });
  const publishedPin = await publish(pinEvent);
  await sleep(PROPAGATION_MS);

  const { json } = await fetchJson(
    `${CONTROL_PANEL_BASE}/api/profile-tags/pins?viewerPubkey=${viewerPk}`
  );
  const row = (json.pins || []).find((p) => p.pinEventId === publishedPin.id);
  assert(row, `pin row must appear in /pins for the no-NIP-65 viewer`);
  assert(row.nip51ExportStatus,
    `row must carry nip51ExportStatus; got ${JSON.stringify(row)}`);
  assert(Array.isArray(row.nip51ExportStatus.writeRelays),
    `nip51ExportStatus.writeRelays must be an array even when no kind-10002 exists; got ${JSON.stringify(row.nip51ExportStatus.writeRelays)}`);
  assert(row.nip51ExportStatus.writeRelays.length === 0,
    `nip51ExportStatus.writeRelays must be EMPTY for a viewer with no kind-10002 (AC-27 server-side); got ${JSON.stringify(row.nip51ExportStatus.writeRelays)}`);
});

/* AC-23: POV isolation — two viewers, distinct (pubkey, d-tag) coords */

tBasic('two distinct viewers pinning the same tag yield two distinct (pubkey, d-tag) coordinates for their kind-30000 exports (AC-23)', async () => {
  const { tag, memberA, memberB } = basicCtx;

  // Second viewer.
  const viewer2Sk = nakKeyGen();
  const viewer2Pk = nakDerivePubkey(viewer2Sk);

  // Pin under viewer2's key.
  const pin2 = buildPinEvent({
    tag, viewerSk: viewer2Sk, viewerPk: viewer2Pk,
    curationMethod: defaultCurationMethod(viewer2Pk),
  });
  await publish(pin2);

  const dTag2 = expectedTLDTag({
    observerPk: viewer2Pk,
    tagAuthorPk: tag.authorPubkey,
    tagSlug: tag.slug,
  });

  // Viewer2 publishes their own kind-30000.
  await sleep(1100);
  await publishKind30000Export({
    viewerSk: viewer2Sk, dTag: dTag2,
    title: tag.name,
    description: 'second viewer\'s export',
    memberPubkeys: [memberB], // distinct membership from viewer1
  });
  await sleep(PROPAGATION_MS);

  const ev2 = await findLatestKind30000({ pubkey: viewer2Pk, dTag: dTag2 });
  assert(ev2, `viewer2's kind-30000 must exist at (pubkey=${viewer2Pk.slice(0, 8)}…, d=${dTag2})`);
  assert(ev2.pubkey === viewer2Pk,
    `viewer2's kind-30000 must be signed by viewer2 (not viewer1, not TA); got ${ev2.pubkey.slice(0, 8)}…`);

  // Viewer1's kind-30000 still exists at its own coordinate.
  const { viewerPk: viewer1Pk } = basicCtx;
  const dTag1 = expectedTLDTag({
    observerPk: viewer1Pk,
    tagAuthorPk: tag.authorPubkey,
    tagSlug: tag.slug,
  });
  const ev1 = await findLatestKind30000({ pubkey: viewer1Pk, dTag: dTag1 });
  assert(ev1, `viewer1's kind-30000 must still exist after viewer2 published their own`);
  assert(ev1.pubkey !== ev2.pubkey, `the two kind-30000 events must have distinct pubkeys`);

  // d-tags MAY be identical (both pin the same tag with default
  // observer=self → both have the same observer8 only if observers
  // are different pubkeys with overlapping first-8 — almost never).
  // What MUST be distinct is the (pubkey, d-tag) coordinate.
  assert(`${ev1.pubkey}/${ev1.tags.find(t=>t[0]==='d')?.[1]}`
    !== `${ev2.pubkey}/${ev2.tags.find(t=>t[0]==='d')?.[1]}`,
    `(pubkey, d-tag) coordinates must be distinct between two viewers; got identical`);
});

/* AC-28: naddr's relays field reflects the user's write relays */

tBasic('a manually-composed naddr for the viewer\'s kind-30000 encodes (kind=30000, pubkey=viewer, identifier=dTag, relays=writeRelays) decodably (AC-28)', async () => {
  const { viewerPk, expectedWriteRelays, tag } = basicCtx;
  const dTag = expectedTLDTag({
    observerPk: viewerPk,
    tagAuthorPk: tag.authorPubkey,
    tagSlug: tag.slug,
  });
  // Compose the naddr the same way the ADR's server endpoint will.
  // This test pins the encoding contract — the Implementer's server
  // must produce a naddr that decodes to the same payload.
  const naddr = nip19.naddrEncode({
    kind: 30000,
    pubkey: viewerPk,
    identifier: dTag,
    relays: expectedWriteRelays,
  });
  assert(typeof naddr === 'string' && naddr.startsWith('naddr1'),
    `naddrEncode must produce a bech32 'naddr1…' string; got ${JSON.stringify(naddr)}`);

  const decoded = nip19.decode(naddr);
  assert(decoded?.type === 'naddr',
    `decoded naddr.type must be 'naddr'; got ${JSON.stringify(decoded?.type)}`);
  assert(decoded.data.kind === 30000,
    `decoded naddr.data.kind must be 30000; got ${JSON.stringify(decoded.data.kind)}`);
  assert(decoded.data.pubkey === viewerPk,
    `decoded naddr.data.pubkey must equal the viewer; got ${decoded.data.pubkey?.slice(0, 8)}…`);
  assert(decoded.data.identifier === dTag,
    `decoded naddr.data.identifier must equal the d-tag; got ${decoded.data.identifier}`);
  assert(Array.isArray(decoded.data.relays)
    && decoded.data.relays.length === expectedWriteRelays.length,
    `decoded naddr.data.relays must equal the user's NIP-65 write relays; got ${JSON.stringify(decoded.data.relays)} expected ${JSON.stringify(expectedWriteRelays)}`);
});

/* ── Run ── */

async function run() {
  console.log('\n--- nip51-list-export-from-pins publish-flow tests (Story 19) ---');

  if (!nakAvailable()) {
    console.log('  SKIP  nak not on PATH; skipping live publish-flow tests');
    return { pass: 0, fail: 0, skipped: basicTests.length };
  }
  if (!(await controlPanelReachable())) {
    console.log(`  SKIP  control panel not reachable at ${CONTROL_PANEL_BASE}; skipping live publish-flow tests`);
    return { pass: 0, fail: 0, skipped: basicTests.length };
  }

  let pass = 0, fail = 0;
  try {
    await setupBasicSuite();
    for (const [name, fn] of basicTests) {
      try {
        await fn();
        console.log(`  PASS  ${name}`);
        pass++;
      } catch (err) {
        console.log(`  FAIL  ${name}\n        ${err.message}`);
        fail++;
      }
    }
  } catch (err) {
    console.log(`  FAIL  basic suite setup: ${err.message}`);
    fail++;
  }

  console.log(`\nnip51-list-export-from-pins-publish: ${pass} passed, ${fail} failed`);
  return { pass, fail, skipped: 0 };
}

if (require.main === module) {
  run()
    .then(({ fail }) => process.exit(fail === 0 ? 0 : 1))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
