/**
 * Adoption queue — the server-assembled read for the whole adoption loop
 * (ADRs shared-concepts-adoption/0002 + 0003).
 *
 * GET /api/adoption-queue  (public read, the sibling-instrument posture)
 *   → { success,
 *       nominations, declined,                  — F1: theirs to adopt (byte-compatible)
 *       publishCandidates, deferredInUse }      — F2: mine to publish (additive)
 *
 * Assembly: streaming strfry scans with slim per-event projections (the #500
 * corpus-scale fix — memory follows the projection, never the corpus), piped
 * through the pure arithmetic cores (src/lib/adoptionQueue.js). My headers are
 * classified at THIS seam via bValueForms.dispositionOf (the b-semantics
 * single owner), so the cores stay zero-require. The endpoint never writes.
 */

'use strict';

const { getOwnerAssistantPubkey } = require('../../utils/assistantKeys');
const { strfryScanStream } = require('../concept/bDisposition');
const { computeQueue, computePublishCandidates, bestName } = require('../../lib/adoptionQueue');
const { computeDictionary, computeConceptDictionary, trustedItems, itemCarrier, recognitionByConcept } = require('../../lib/trustedDictionary');
const { resolveOwners, parts: scanParts } = require('./assistantOwners');
const { classifyBValue, dispositionOf } = require('../../lib/bValueForms');
const { runCypher } = require('../../lib/neo4j-driver');
const { getConfigFromFile } = require('../../utils/config');
const { getManifest } = require('../normalize/firmware');

const REGISTRY_SLUG = 'shared-concept';
const LEDGER_SLUG = 'adoption-disposition';
const DICTIONARY_SNAPSHOT_SLUG = 'trusted-dictionary-snapshot';

const keepTags = (ev, names) => (ev.tags || []).filter((t) => t && names.includes(t[0]));

async function handleAdoptionQueue(req, res) {
  try {
    const taPubkey = getOwnerAssistantPubkey();
    if (!taPubkey) {
      return res.status(500).json({ success: false, error: 'TA pubkey unavailable' });
    }

    // 1. All local kind-39998 headers, projected slim — BOTH populations
    //    (ADR 0003: the TA-authored ones, once discarded, are F2's input).
    const allHeaders = await strfryScanStream({ kinds: [39998] }, (ev) => ({
      kind: ev.kind, pubkey: ev.pubkey, created_at: ev.created_at, id: ev.id,
      tags: keepTags(ev, ['d', 'names', 'name', 'b']),
    }));
    const foreignHeaders = [];
    const mineNewest = new Map(); // d-tag → newest slim header
    for (const ev of allHeaders) {
      if (ev.pubkey !== taPubkey) { foreignHeaders.push(ev); continue; }
      const d = ev.tags.find((t) => t[0] === 'd')?.[1];
      if (d == null) continue;
      const prev = mineNewest.get(d);
      if (!prev || (ev.created_at || 0) > (prev.created_at || 0)) mineNewest.set(d, ev);
    }

    const foreignCoords = [];
    for (const ev of foreignHeaders) {
      const d = ev.tags.find((t) => t[0] === 'd')?.[1];
      if (d != null) foreignCoords.push(`${ev.kind}:${ev.pubkey}:${d}`);
    }

    // Classification at the seam (ADR 0003): my headers → {coord, name, bState}.
    const myHeaders = [];
    const myCoords = [];
    for (const [d, ev] of mineNewest) {
      const coord = `39998:${taPubkey}:${d}`;
      const bValues = ev.tags.filter((t) => t[0] === 'b').map((t) => t[1]);
      const disp = dispositionOf(bValues, coord);
      const bState = (disp.wired || disp.selfDeclared) ? 'real' : (disp.deferred ? 'deferred' : 'none');
      myHeaders.push({ coord, name: bestName(ev), bState });
      myCoords.push(coord);
    }

    // 2–6. Union #z carriers; my b-values (S2a); foreign #b affiliations on my
    //      coords; registry; ledger.
    const zScanCoords = [...foreignCoords, ...myCoords];
    const [zCarriers, myBTargetArrays, bCarriers, registryRecords, dispositionRecords] = await Promise.all([
      zScanCoords.length
        ? strfryScanStream({ '#z': zScanCoords }, (ev) => {
          const z = keepTags(ev, ['z']);
          return z.length ? { pubkey: ev.pubkey, id: ev.id, tags: z } : null;
        })
        : Promise.resolve([]),
      strfryScanStream({ authors: [taPubkey], kinds: [39998, 39999] }, (ev) => {
        const bs = (ev.tags || []).filter((t) => t && t[0] === 'b' && typeof t[1] === 'string' && t[1]).map((t) => t[1]);
        return bs.length ? bs : null;
      }),
      myCoords.length
        ? strfryScanStream({ '#b': myCoords }, (ev) => {
          const bs = keepTags(ev, ['b']);
          return bs.length ? { pubkey: ev.pubkey, id: ev.id, tags: bs } : null;
        })
        : Promise.resolve([]),
      strfryScanStream({ kinds: [39999], '#z': [`39998:${taPubkey}:${REGISTRY_SLUG}`] }, (ev) => ({
        pubkey: ev.pubkey, created_at: ev.created_at, tags: keepTags(ev, ['json']),
      })),
      strfryScanStream({ kinds: [39999], '#z': [`39998:${taPubkey}:${LEDGER_SLUG}`] }, (ev) => ({
        pubkey: ev.pubkey, created_at: ev.created_at, tags: keepTags(ev, ['json']),
      })),
    ]);

    const myBTargets = myBTargetArrays.flat();

    const adopt = computeQueue({ foreignHeaders, zCarriers, myBTargets, registryRecords, dispositionRecords, taPubkey });
    const publish = computePublishCandidates({ myHeaders, zCarriers, bCarriers, taPubkey });

    return res.json({
      success: true,
      ...adopt,
      publishCandidates: publish.candidates,
      deferredInUse: publish.deferredInUse,
    });
  } catch (error) {
    console.error('adoption-queue error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Firmware concept headers, for the Dictionary's Firmware marker: this
 * instance's own header for every concept in the active firmware manifest,
 * plus the manifest's community-reference headers. Classified here, at the
 * seam, like isMine and bState. A missing or unreadable manifest marks
 * nothing rather than failing the read.
 */
function firmwareCoords(taPubkey) {
  const coords = new Set();
  try {
    for (const c of getManifest().concepts || []) {
      if (c && typeof c.slug === 'string' && c.slug) coords.add(`39998:${taPubkey}:${c.slug}`);
      const ref = c && c.communityReference && c.communityReference.headerATag;
      if (typeof ref === 'string' && ref) coords.add(ref);
    }
  } catch { /* no manifest → no firmware markers */ }
  return coords;
}

/** A header tag's value at `idx`, or null (the adoption module's slim-projection idiom). */
const tagAt = (ev, name, idx = 1) => {
  const t = (ev.tags || []).find((x) => x && x[0] === name);
  return t && typeof t[idx] === 'string' && t[idx].trim() !== '' ? t[idx] : null;
};

/**
 * The qualifying set for some carrier authors, from the requested point of
 * view: the Neo4j seam both dictionary reads share (ADR 0005). House reads
 * NostrUser.influence. Personalized reads the observer's
 * NostrUserWotMetricsCard rows, and falls back to house, disclosed, when this
 * instance holds no cards for the observer.
 */
async function resolveQualifying({ wotPov, userPubkey, authors, cutoff }) {
  const wantPersonalized = wotPov === 'user' && typeof userPubkey === 'string' && /^[0-9a-f]{64}$/.test(userPubkey);
  let branch = 'house';
  let fellBackToHouse = false;
  let observer = null;
  let qualifying = new Set();
  let influence = new Map(); // the qualifying set's influence (0–1), for GUM₂
  if (wantPersonalized) {
    // Availability probe: personalized scoring exists only for observers this
    // instance holds metrics cards for (W12's stance) — else house, disclosed.
    const probe = await runCypher(
      'MATCH (c:NostrUserWotMetricsCard {observer_pubkey: $observer}) RETURN count(c) AS n',
      { observer: userPubkey },
    );
    if (probe.length && Number(probe[0].n) > 0) {
      branch = 'personalized';
      observer = userPubkey;
    } else {
      fellBackToHouse = true; // requested own POV; this instance has no cards for it
    }
  }
  if (authors.length) {
    const rows = branch === 'personalized'
      ? await runCypher(
        'MATCH (c:NostrUserWotMetricsCard {observer_pubkey: $observer}) WHERE c.observee_pubkey IN $authors AND c.influence > $cutoff RETURN c.observee_pubkey AS pubkey, c.influence AS influence',
        { observer: userPubkey, authors, cutoff },
      )
      : await runCypher(
        'MATCH (u:NostrUser) WHERE u.pubkey IN $authors AND u.influence > $cutoff RETURN u.pubkey AS pubkey, u.influence AS influence',
        { authors, cutoff },
      );
    qualifying = new Set(rows.map((r) => r.pubkey));
    influence = new Map(rows.map((r) => [r.pubkey, Number(r.influence)]));
  }
  return { qualifying, influence, branch, observer, fellBackToHouse };
}

/**
 * The trusted dictionary (ADR shared-concepts-adoption/0005) — S3b with a
 * minimum-trusted-users threshold, computed at read time from the active POV.
 *
 * The qualifying set resolves against Neo4j at THIS seam (house:
 * NostrUser.influence; personalized: the observer's NostrUserWotMetricsCard
 * rows — main-pubkey identity, deliberately NOT the Meili suffix world, W13);
 * the arithmetic stays in the pure core (src/lib/trustedDictionary.js).
 * Shared by the GET below and the snapshot mint in src/api/normalize
 * (which recomputes server-side — a client-posted member list is never
 * trusted).
 */
async function assembleTrustedDictionary({ wotPov, userPubkey } = {}) {
  const taPubkey = getOwnerAssistantPubkey();
  if (!taPubkey) throw new Error('TA pubkey unavailable');

  const cutoff = parseFloat(getConfigFromFile('VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF', 0.01));
  const threshold = parseInt(getConfigFromFile('TRUSTED_DICTIONARY_MIN_USERS', 2), 10);

  // Both header populations, slim, newest per coordinate (defensive against
  // replaceable-version residue — the handleAdoptionQueue idiom).
  const allHeaders = await strfryScanStream({ kinds: [39998] }, (ev) => ({
    kind: ev.kind, pubkey: ev.pubkey, created_at: ev.created_at,
    tags: keepTags(ev, ['d', 'names', 'name', 'b', 'description']),
  }));
  const newest = new Map(); // coord → slim header
  for (const ev of allHeaders) {
    const d = ev.tags.find((t) => t[0] === 'd')?.[1];
    if (d == null) continue;
    const coord = `${ev.kind}:${ev.pubkey}:${d}`;
    const prev = newest.get(coord);
    if (!prev || (ev.created_at || 0) > (prev.created_at || 0)) newest.set(coord, ev);
  }
  const firmware = firmwareCoords(taPubkey);
  const headers = [];
  for (const [coord, ev] of newest) {
    const isMine = ev.pubkey === taPubkey;
    let bState = 'none';
    if (isMine) {
      const bValues = ev.tags.filter((t) => t[0] === 'b').map((t) => t[1]);
      const disp = dispositionOf(bValues, coord);
      bState = (disp.wired || disp.selfDeclared) ? 'real' : (disp.deferred ? 'deferred' : 'none');
    }
    headers.push({
      coord,
      name: bestName(ev),
      plural: tagAt(ev, 'names', 2),
      description: tagAt(ev, 'description'),
      author: ev.pubkey,
      isMine,
      isFirmware: firmware.has(coord),
      bState,
    });
  }

  const coords = headers.map((h) => h.coord);
  const zCarriers = coords.length
    ? await strfryScanStream({ '#z': coords }, (ev) => {
      const z = keepTags(ev, ['z']);
      return z.length ? { pubkey: ev.pubkey, id: ev.id, tags: z } : null;
    })
    : [];

  // Distinct carrier authors → the bounded qualifying-set query. The
  // per-header exclusions (own author, the TA) live in the core; including
  // them here is harmless.
  const authors = [...new Set(zCarriers.map((ev) => ev.pubkey))].filter((p) => p && p !== taPubkey);
  const { qualifying, branch, observer, fellBackToHouse } = await resolveQualifying({ wotPov, userPubkey, authors, cutoff });

  const { entries, metric } = computeDictionary({ headers, zCarriers, qualifying, threshold, taPubkey });

  return {
    entries,
    metric,
    cutoff,
    threshold,
    taPubkey,
    pov: {
      branch,
      observer,
      fellBackToHouse,
      cutoff,
      threshold,
      computedAt: new Date().toISOString(),
    },
  };
}

async function handleTrustedDictionary(req, res) {
  try {
    const { wotPov, userPubkey } = req.query || {};
    const out = await assembleTrustedDictionary({ wotPov, userPubkey });

    // The dated ledger of published snapshots (slim strip; newest first).
    const snapshots = (await strfryScanStream(
      { kinds: [39999], '#z': [`39998:${out.taPubkey}:${DICTIONARY_SNAPSHOT_SLUG}`] },
      (ev) => {
        const jsonTag = (ev.tags || []).find((t) => t[0] === 'json');
        let sec = null;
        if (jsonTag && typeof jsonTag[1] === 'string') {
          try { sec = JSON.parse(jsonTag[1]).trustedDictionarySnapshot || null; } catch { sec = null; }
        }
        return {
          id: ev.id,
          created_at: ev.created_at,
          computedAt: sec ? sec.computedAt || null : null,
          memberCount: sec && Number.isFinite(sec.memberCount) ? sec.memberCount : null,
          pov: sec && sec.pov ? sec.pov.branch || null : null,
        };
      },
    )).sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

    // `metric` names the General Usage Metric every entry's `gum` carries
    // ("gum1" in version 1), so GUM₂ / GUM₃ can arrive without a new shape.
    return res.json({ success: true, metric: out.metric, entries: out.entries, snapshots, pov: out.pov });
  } catch (error) {
    console.error('trusted-dictionary error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Dictionary › Concepts: one person's dictionary (the owner's correction of
 * 2026-09-29, recorded in docs/DICTIONARY_PAGE_HANDOFF.md). Its rows are
 * exactly what Active b-tags lists under "Mine": the person's concept headers
 * (signed by their account, or by the assistant this instance issued them)
 * that carry a real b-tag, wired to a shared concept or self-declared as one.
 * The sentinel and malformed b values make no row (bValueForms, W16). The page
 * resolves the person as Active b-tags does and sends their pubkeys as
 * `authors`, so the two lists share one definition of "Mine".
 *
 * The trusted dictionary above is not this list. In the design it is the
 * rule an Assistant will use to decide what to clone into a dictionary, so
 * here it only scores rows: each carries GUM₁ of the shared concept it points
 * to, from the same point of view. The arithmetic stays in the pure core.
 */
async function assembleConceptDictionary({ authors, wotPov, userPubkey } = {}) {
  const taPubkey = getOwnerAssistantPubkey();
  if (!taPubkey) throw new Error('TA pubkey unavailable');

  const cutoff = parseFloat(getConfigFromFile('VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF', 0.01));
  const threshold = parseInt(getConfigFromFile('TRUSTED_DICTIONARY_MIN_USERS', 2), 10);

  const events = await strfryScanStream({ kinds: [39998], authors }, (ev) => ({
    kind: ev.kind, pubkey: ev.pubkey, created_at: ev.created_at,
    tags: keepTags(ev, ['d', 'names', 'name', 'b', 'description']),
  }));
  const newest = new Map(); // coord → slim header
  for (const ev of events) {
    const d = ev.tags.find((t) => t[0] === 'd')?.[1];
    if (d == null) continue;
    const coord = `${ev.kind}:${ev.pubkey}:${d}`;
    const prev = newest.get(coord);
    if (!prev || (ev.created_at || 0) > (prev.created_at || 0)) newest.set(coord, ev);
  }

  const firmware = firmwareCoords(taPubkey);
  const rows = [];
  for (const [coord, ev] of newest) {
    const bValues = ev.tags.filter((t) => t[0] === 'b').map((t) => t[1]);
    const disp = dispositionOf(bValues, coord);
    if (!disp.wired && !disp.selfDeclared) continue; // no real b: not in the dictionary
    const targets = [...new Set(bValues.filter((v) => v !== coord
      && (classifyBValue(v) === 'a-tag' || classifyBValue(v) === 'event-id')))];
    rows.push({
      coord,
      name: bestName(ev),
      plural: tagAt(ev, 'names', 2),
      description: tagAt(ev, 'description'),
      author: ev.pubkey,
      selfDeclared: disp.selfDeclared,
      targets,
      // Scored by the shared concepts it points to by coordinate (an event-id b
      // locates an event, not a concept anything is filed under), and by itself
      // when it is one.
      scoreCoords: [...(disp.selfDeclared ? [coord] : []), ...targets.filter((v) => classifyBValue(v) === 'a-tag')],
      // Firmware: the row is a firmware concept, or points at one.
      isFirmware: firmware.has(coord) || targets.some((v) => firmware.has(v)),
      // The row's own header is one a firmware reinstall rebuilds (the edit page warns of it).
      firmwareHeader: firmware.has(coord),
    });
  }

  const coords = [...new Set(rows.flatMap((r) => [r.coord, ...r.scoreCoords]))];
  const zCarriers = coords.length
    ? await strfryScanStream({ '#z': coords }, (ev) => {
      const z = keepTags(ev, ['z']);
      return z.length ? { pubkey: ev.pubkey, id: ev.id, tags: z } : null;
    })
    : [];
  const zAuthors = [...new Set(zCarriers.map((ev) => ev.pubkey))].filter((p) => p && p !== taPubkey);

  // GUM₂'s inputs (recognitionByConcept): the headers that b-point at each concept these rows are
  // scored for, and who owns their signers. A failure here leaves GUM₂ out rather than the dictionary.
  let gum2Inputs = null;
  try {
    gum2Inputs = await recognitionInputs({ rows, authors });
  } catch (err) {
    console.error('concept-dictionary: GUM₂ inputs unavailable:', err && err.message ? err.message : err);
  }

  // One trust read for both metrics: GUM₁'s filers and GUM₂'s recognizers.
  const asked = [...new Set([...zAuthors, ...(gum2Inputs ? gum2Inputs.candidates : [])])];
  const { qualifying, influence, branch, observer, fellBackToHouse } = await resolveQualifying({ wotPov, userPubkey, authors: asked, cutoff });

  const recognition = gum2Inputs
    ? recognitionByConcept({ ...gum2Inputs, influence })
    : null;
  const { entries, metric } = computeConceptDictionary({ rows, zCarriers, qualifying, taPubkey, recognition });

  return {
    entries,
    metric,
    pov: { branch, observer, fellBackToHouse, cutoff, threshold, computedAt: new Date().toISOString() },
  };
}

/** GUM₂'s real reads: this instance's strfry, the canonical nostr-user-tag z, and the roster. */
function recognitionDeps() {
  return {
    scan: strfryScanStream,
    zTag: () => require('../profile-tags').NOSTR_USER_TAG_Z_TAG,
    // Not admins: this read is public, and the admin list is the owner's to read (ADR author-scoped-inspection/0001).
    roster: () => require('../../utils/assistantKeys').listInstanceAssistants({ includeAdmins: false }),
  };
}


/**
 * What GUM₂ needs, read from this instance's relay: the newest kind-39998 headers whose `b` points
 * at a concept the rows are scored for, the owners of their signers (assistantOwners), the reader to
 * leave out, and every recognizer whose trust must be read. `deps` are the reads (tests pass fakes):
 * { scan(filter, project), zTag(), roster() }.
 */
async function recognitionInputs({ rows, authors }, deps = recognitionDeps()) {
  const sharedCoords = [...new Set(rows.flatMap((r) => r.scoreCoords))];
  if (!sharedCoords.length) return { sharedCoords, pointers: [], ownersOf: new Map(), exclude: authors, candidates: [] };
  const found = [];
  // In parts by count and bytes: strfry takes a filter as one command-line argument (assistantOwners parts).
  for (const part of scanParts(sharedCoords)) {
    found.push(...await deps.scan({ kinds: [39998], '#b': part }, (ev) => ({
      kind: ev.kind, pubkey: ev.pubkey, created_at: ev.created_at, tags: keepTags(ev, ['d', 'b']),
    })));
  }
  const newest = new Map();
  for (const ev of found) {
    const d = ev.tags.find((t) => t[0] === 'd')?.[1];
    if (d == null) continue;
    const coord = `${ev.kind}:${ev.pubkey}:${d}`;
    const prev = newest.get(coord);
    if (!prev || (ev.created_at || 0) > (prev.created_at || 0)) newest.set(coord, ev);
  }
  const pointers = [...newest].map(([coord, ev]) => ({ coord, pubkey: ev.pubkey, b: ev.tags.filter((t) => t[0] === 'b').map((t) => t[1]) }));
  const signers = [...new Set(pointers.map((p) => p.pubkey))];
  const conceptAuthors = sharedCoords.map((c) => String(c).split(':')[1]);
  const ownersOf = await resolveOwners([...signers, ...conceptAuthors, ...authors], deps);
  // As recognitionByConcept reads it: a pubkey stands for itself and whoever owns it.
  const ownersList = (pk) => [pk, ...((ownersOf.get(pk) || []).filter((x) => x !== pk))];
  const exclude = [...new Set(authors.flatMap((a) => [a, ...ownersList(a)]))];
  const candidates = [...new Set(pointers.flatMap((p) => ownersList(p.pubkey)))];
  return { sharedCoords, pointers, ownersOf, exclude, candidates };
}

/** `authors`: one person, as one or two hex pubkeys (their account, then their assistant if any). */
function parseAuthors(raw) {
  if (typeof raw !== 'string') return null; // ?authors[]=… arrives as an array
  const list = [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];
  if (list.length < 1 || list.length > 2 || !list.every((p) => /^[0-9a-f]{64}$/.test(p))) return null;
  return list;
}

async function handleConceptDictionary(req, res) {
  try {
    const authors = parseAuthors(req.query && req.query.authors);
    if (!authors) {
      return res.status(400).json({
        success: false,
        error: 'authors must be one or two comma-separated hex pubkeys: a person’s account, and their assistant when they have one',
      });
    }
    const { wotPov, userPubkey } = req.query || {};
    const out = await assembleConceptDictionary({ authors, wotPov, userPubkey });
    return res.json({ success: true, metric: out.metric, authors, entries: out.entries, pov: out.pov });
  } catch (error) {
    console.error('concept-dictionary error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

const COORD = /^\d+:[0-9a-f]{64}:.+$/;

/**
 * One Dictionary entry's Items: what is z-filed under the entry's own header
 * (`coord`) and the shared concept it points to (`shared`, optional), kept
 * when the filer is trusted from the active point of view or is the reader
 * (`authors`, as the dictionary read takes them). The rule is trustedItems in
 * src/lib/trustedDictionary.js; the trusted set resolves here, as GUM₁'s does.
 */
async function assembleConceptItems({ coord, shared, authors, wotPov, userPubkey } = {}) {
  const cutoff = parseFloat(getConfigFromFile('VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF', 0.01));
  const coords = [...new Set([coord, shared].filter(Boolean))];
  // Each carrier keeps the tags trustedItems reads, and its description and property tags, bounded.
  const zCarriers = await strfryScanStream({ '#z': coords }, (ev) => itemCarrier(ev));
  const own = new Set(authors);
  const filers = [...new Set(zCarriers.map((ev) => ev.pubkey))].filter((p) => p && !own.has(p));
  const { qualifying, branch, observer, fellBackToHouse } = await resolveQualifying({ wotPov, userPubkey, authors: filers, cutoff });
  const out = trustedItems({ zCarriers, coords, qualifying, own: authors });
  return { ...out, pov: { branch, observer, fellBackToHouse, cutoff, computedAt: new Date().toISOString() } };
}

async function handleConceptItems(req, res) {
  try {
    const { coord, shared, wotPov, userPubkey } = req.query || {};
    const authors = parseAuthors(req.query && req.query.authors);
    if (typeof coord !== 'string' || !COORD.test(coord) || (shared != null && (typeof shared !== 'string' || !COORD.test(shared)))) {
      return res.status(400).json({ success: false, error: 'coord (and shared, when given) must be concept coordinates: kind:pubkey:d' });
    }
    if (!authors) {
      return res.status(400).json({
        success: false,
        error: 'authors must be one or two comma-separated hex pubkeys: a person’s account, and their assistant when they have one',
      });
    }
    const out = await assembleConceptItems({ coord, shared, authors, wotPov, userPubkey });
    return res.json({ success: true, ...out });
  } catch (error) {
    console.error('concept-items error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * The twin picker's population (story #7): MY WIREABLE concepts — graph
 * concept headers ∩ has a kind-39998 event. The graph is the identity source
 * (BIBLE §30); the event requirement exists because Adopt appends a
 * pointer-b to the twin's EVENT and republishes it. Same-uuid graph
 * duplicates collapse in the aggregation; event-only wire addresses
 * (orphans, fixtures) never appear.
 */
async function handleAdoptionTwins(req, res) {
  try {
    const taPubkey = getOwnerAssistantPubkey();
    if (!taPubkey) {
      return res.status(500).json({ success: false, error: 'TA pubkey unavailable' });
    }
    const prefix = `39998:${taPubkey}:`;

    const rows = await runCypher(
      `MATCH (h:NostrEvent)
       WHERE (h:ListHeader OR h:ClassThreadHeader OR h:ConceptHeader)
         AND h.uuid STARTS WITH $prefix
       WITH h.uuid AS uuid, collect(h.name)[0] AS name
       RETURN uuid, name`,
      { prefix },
    );

    const eventCoords = new Set(await strfryScanStream(
      { kinds: [39998], authors: [taPubkey] },
      (ev) => {
        const d = (ev.tags || []).find((t) => t && t[0] === 'd')?.[1];
        return d == null ? null : `39998:${ev.pubkey}:${d}`;
      },
    ));

    const twins = rows
      .filter((r) => r.uuid && eventCoords.has(r.uuid))
      .map((r) => ({ handle: r.uuid, name: r.name || r.uuid.slice(prefix.length) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.json({ success: true, twins });
  } catch (error) {
    console.error('adoption-twins error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/dictionaries/concepts/firmware?coord=… — is this header one a firmware reinstall rebuilds?
 * Decided from the address (firmwareCoords), so the edit page can warn for any header, a Dictionary row
 * or not. A public read: the firmware manifest is the instance's own published firmware.
 */
function handleConceptFirmware(req, res) {
  const coord = typeof req.query.coord === 'string' ? req.query.coord : '';
  if (!/^39998:[0-9a-f]{64}:.+$/.test(coord)) {
    return res.status(400).json({ success: false, error: "coord must be a list header's address (39998:pubkey:d-tag)" });
  }
  const taPubkey = getOwnerAssistantPubkey();
  return res.json({ success: true, coord, firmware: Boolean(taPubkey) && firmwareCoords(taPubkey).has(coord) });
}

function registerAdoptionRoutes(app) {
  app.get('/api/adoption-queue', handleAdoptionQueue);
  app.get('/api/trusted-dictionary', handleTrustedDictionary);
  app.get('/api/dictionaries/concepts', handleConceptDictionary);
  app.get('/api/dictionaries/concepts/items', handleConceptItems);
  app.get('/api/dictionaries/concepts/firmware', handleConceptFirmware);
  app.get('/api/adoption-twins', handleAdoptionTwins);
  // Create New Concept, signed by the caller's own Assistant (./newConcept.js).
  require('./newConcept').register(app);
  // Edit a concept: a new version of a header the caller's own Assistant wrote (./editConcept.js).
  require('./editConcept').register(app);
  // Re-Sync a concept from the shared concept it is wired to (./resyncConcept.js).
  require('./resyncConcept').register(app);
}

module.exports = {
  registerAdoptionRoutes, assembleTrustedDictionary, assembleConceptDictionary, assembleConceptItems, recognitionInputs,
  firmwareCoords, handleConceptFirmware,
};
