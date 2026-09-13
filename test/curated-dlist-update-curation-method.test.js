/**
 * curated-dlist-update #4: the curation method panel shows my method, a cutoff, and each candidate's verdict.
 *
 * Story: engineering-team/stories/curated-dlist-update/4-curation-method-panel.md
 * ADR:   engineering-team/decisions/curated-dlist-update/0004-curation-method-and-verdicts.md
 *
 * Four classes (house pattern; ESM behavioral import per test/my-curated-dlists-headers.test.js):
 *   U (behavioral) — the shared rule, ui/src/utils/dlistScore.js (new): classifyReaction, reactionsByItem,
 *                    scoreItem, qualifies. A characterization table taken from Simple Lists' inline rule as it
 *                    stands before the move (ui/src/pages/lists/DListItems.jsx :32–40, :199–214, :248–347, :852 at
 *                    502badc4), and a seeded differential check against a frozen verbatim copy of that rule
 *                    (SIMPLE_LISTS below). Then the curation util's new exports (ui/src/utils/treasureMap.js):
 *                    VOTES_LIMIT, lookupItemVotes (fakes for both sources), weightsState, candidateVerdicts, and
 *                    the cutoff helpers. FAIL now: none of it exists.
 *   S (structure)  — Simple Lists calls the shared rule and keeps no copy of it; the util takes it from the same
 *                    module; the detail page's cutoff and summary; the panel's lines and link; the items section's
 *                    verdicts, on my own lists only; the two new hooks; nothing written. User-facing phrases are
 *                    pinned as literals, on whitespace-flattened source. FAIL now.
 *   D (docs)       — my-curated-dlists ADR 0003's superseded-in-part note (ADR §8). FAIL now.
 *   R (sentinel)   — Simple Lists' controls, Ratings Source and publish; Trust Determination's settings, only
 *                    read. PASS before and after.
 *
 * Re-aimed in its own suite: test/my-curated-dlists-items.test.js S3's title (the method panel is no longer text
 * only; its assertions still hold).
 *
 * Not covered here: the rendered page in a browser and the real reads — the Implementer's local check with the
 * fetch stub (ADR note 8). Nor a relay that /api/relay/external answers as "success, no events" because it could
 * not be reached (nostr-tools' querySync, OPEN.md row 245's root cause): on the client that is indistinguishable
 * from "no votes" or "nobody ranked". The test plan records it.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const UI = path.join(ROOT, 'ui/src');
const SCORE = path.join(UI, 'utils/dlistScore.js');
const UTIL = path.join(UI, 'utils/treasureMap.js');
const SIMPLE = path.join(UI, 'pages/lists/DListItems.jsx');
const DETAIL = path.join(UI, 'pages/grapevine/CuratedDListDetail.jsx');
const ITEMS = path.join(UI, 'pages/grapevine/CuratedDListItems.jsx');
const VOTES_HOOK = path.join(UI, 'hooks/useItemVotes.js');
const CUTOFF_HOOK = path.join(UI, 'hooks/useCurationCutoff.js');
const TRUST = path.join(UI, 'context/TrustContext.jsx');
const WEIGHTS_HOOK = path.join(UI, 'hooks/useTrustWeights.js');
const MCD_ADR_3 = path.join(ROOT, 'engineering-team/decisions/done/my-curated-dlists/0003-items-method-and-update.md');

const A = 'a'.repeat(64);                     // an item's author
const B = 'b'.repeat(64);                     // voters
const C = 'c'.repeat(64);
const D = 'd'.repeat(64);
const E = 'e'.repeat(64);
const X = '1'.repeat(64);                     // item ids
const Y = '2'.repeat(64);
const RELAY = 'wss://dcosl.brainstorm.world';
const SHARED = `39998:${'0123456789abcdef'.repeat(4)}:dog-breed`;
const APOS = "(?:'|’|&apos;|&#39;)";          // an apostrophe as JSX may spell it
const QUOT = '(?:"|“|”|&quot;|&ldquo;|&rdquo;)';

function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
async function loadEsm(absPath) { try { return await import(pathToFileURL(absPath).href); } catch { return null; } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function rel(p) { return path.relative(ROOT, p); }
const flat = (s) => s.replace(/\s+/g, ' ');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Deep equality that ignores key order and reads undefined as null (the breakdown table shows both as "—"). */
function canon(v) {
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) return v.map(canon);
  if (typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]));
  if (typeof v === 'number' && Object.is(v, -0)) return 0;
  return v;
}
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const brief = (v) => { const s = JSON.stringify(v); return s && s.length > 500 ? `${s.slice(0, 500)}…` : s; };
async function scoreFn(name) {
  const mod = await loadEsm(SCORE);
  assert(mod, 'ui/src/utils/dlistScore.js must exist and load in Node (ADR 0004 §1: a new pure, zero-import module)');
  assert(typeof mod[name] === 'function', `ui/src/utils/dlistScore.js must export ${name} (ADR 0004 §1)`);
  return mod[name];
}
async function utilMod() {
  const mod = await loadEsm(UTIL);
  assert(mod && typeof mod.classifyEntry === 'function',
    'ui/src/utils/treasureMap.js must load and export classifyEntry (its import of ./dlistScore.js must resolve in Node)');
  return mod;
}
async function fn(name) {
  const mod = await utilMod();
  assert(typeof mod[name] === 'function', `ui/src/utils/treasureMap.js must export ${name} (ADR 0004 §2–§5)`);
  return mod[name];
}
function src(p) {
  const s = safeRead(p);
  assert(s.length > 0, `${rel(p)} must exist (ADR 0004 §Implementation notes)`);
  return s;
}
/** The first `<Name …/>` element in a JSX source, whatever its line breaks. */
function element(s, name) {
  const m = s.match(new RegExp(`<${name}\\b[\\s\\S]*?\\/>`));
  return m ? m[0] : '';
}
/** A top-level function's text, from its declaration to the next top-level declaration. */
function declaration(s, name) {
  const start = s.search(new RegExp(`(?:^|\\n)(?:export\\s+)?(?:default\\s+)?function\\s+${name}\\b`));
  if (start < 0) return '';
  const rest = s.slice(start + 1);
  const next = rest.search(/\n(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|const|let|class)\s/);
  return s.slice(start, next >= 0 ? start + 1 + next : undefined);
}

/* ── SIMPLE_LISTS: Simple Lists' rule, frozen ───────────────────────────────────
 * A verbatim copy of ui/src/pages/lists/DListItems.jsx at 502badc4 — isUpvote / isDownvote (:32–40), the
 * reactionsPerItem memo (:199–214), the trustScores memo (:248–347) and the qualifying filter (:852) — wrapped as
 * plain functions. It is the reference the shared module is held to (AC-3, AC-5: Simple Lists computes exactly as
 * before). Change it only when the rule itself changes on purpose, together with the U3 table.
 */
const SIMPLE_LISTS = (() => {
  function isUpvote(content) {
    const c = (content || '').trim();
    return c === '+' || c === '👍' || c === '🤙';
  }

  function isDownvote(content) {
    const c = (content || '').trim();
    return c === '-' || c === '👎';
  }

  // Build reactions-per-item map: { itemId: [{ pubkey, type, id }] }
  function reactionsPerItem(reactions, itemIds) {
    const map = {};
    for (const id of itemIds) map[id] = [];
    for (const ev of reactions) {
      const eTag = ev.tags?.find(t => t[0] === 'e');
      const targetId = eTag?.[1];
      if (targetId && map[targetId]) {
        let type = 'other';
        if (isUpvote(ev.content)) type = 'upvote';
        else if (isDownvote(ev.content)) type = 'downvote';
        map[targetId].push({ pubkey: ev.pubkey, type, id: ev.id, content: ev.content });
      }
    }
    return map;
  }

  // Compute trust-weighted score for each item
  function trustScores(items, reactionsPerItem, trustWeights) {
    const scores = {};
    for (const item of items) {
      const itemAuthor = item.pubkey;
      const itemReactions = reactionsPerItem[item.id] || [];
      const authorTW = trustWeights[itemAuthor];

      // Check if the item author has any kind 7 reaction on this item
      const authorReaction = itemReactions.find(r => r.pubkey === itemAuthor);
      const authorSelfDownvoted = authorReaction?.type === 'downvote';
      const authorHasExplicitUpvote = authorReaction?.type === 'upvote';

      // Build the breakdown
      const breakdown = [];
      let score = 0;

      // 1. Implicit author upvote
      if (authorTW != null) {
        if (authorSelfDownvoted) {
          // Author downvoted their own item → cancels implicit upvote → net 0
          breakdown.push({
            pubkey: itemAuthor,
            role: 'author',
            type: 'implicit-upvote-cancelled',
            weight: authorTW,
            contribution: 0,
            note: 'Implicit upvote cancelled by author\'s kind 7 downvote',
          });
        } else {
          // Normal implicit upvote
          breakdown.push({
            pubkey: itemAuthor,
            role: 'author',
            type: 'implicit-upvote',
            weight: authorTW,
            contribution: authorTW,
            note: authorHasExplicitUpvote
              ? 'Implicit upvote (explicit kind 7 + ignored as duplicate)'
              : 'Implicit upvote (authored the item)',
          });
          score += authorTW;
        }
      } else {
        breakdown.push({
          pubkey: itemAuthor,
          role: 'author',
          type: 'implicit-upvote',
          weight: null,
          contribution: null,
          note: 'Trust weight unknown',
        });
      }

      // 2. Process each reaction from OTHER authors
      for (const r of itemReactions) {
        if (r.pubkey === itemAuthor) {
          // Already handled above — skip explicit reactions from item author
          if (authorSelfDownvoted) {
            breakdown.push({
              pubkey: r.pubkey,
              role: 'author',
              type: 'explicit-downvote',
              weight: authorTW,
              contribution: 0,
              note: 'Author\'s explicit downvote (cancels implicit upvote)',
            });
          }
          // If author has explicit upvote, it was already noted above
          continue;
        }

        const tw = trustWeights[r.pubkey];
        if (tw != null) {
          const contrib = r.type === 'upvote' ? tw : r.type === 'downvote' ? -tw : 0;
          score += contrib;
          breakdown.push({
            pubkey: r.pubkey,
            role: 'reactor',
            type: r.type,
            weight: tw,
            contribution: contrib,
            note: null,
          });
        } else {
          breakdown.push({
            pubkey: r.pubkey,
            role: 'reactor',
            type: r.type,
            weight: null,
            contribution: null,
            note: 'Trust weight unknown',
          });
        }
      }

      scores[item.id] = { score, breakdown };
    }
    return scores;
  }

  // The Generate Trusted List panel's qualifying filter (:837–854, the scoring half)
  function qualified(items, trustScores, cutoff) {
    return items
      .map(item => ({ id: item.id, score: trustScores[item.id]?.score ?? null }))
      .filter(item => item.score != null && item.score >= cutoff);
  }

  return { isUpvote, isDownvote, reactionsPerItem, trustScores, qualified };
})();

/** A deterministic PRNG, so the differential check replays the same cases on every run. */
function mulberry32(seed) {
  return function next() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Two items, up to seven kind-7 votes (first e aimed at either item or elsewhere), and a weight per person. */
function generateCases(count, seed) {
  const rnd = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const PEOPLE = [A, B, C, D, E];
  const CONTENTS = ['+', '-', '👍', '👎', '🤙', ' + ', '-\n', '❤️', '', '+1', null];
  const WEIGHTS = [undefined, null, 0, 0.25, 0.5, 1, 1.75, 3];
  const FOREIGN = '3'.repeat(64);
  const cases = [];
  let n = 0;
  for (let i = 0; i < count; i++) {
    const items = [X, Y].map((id) => ({ id, pubkey: pick(PEOPLE) }));
    const events = [];
    const k = Math.floor(rnd() * 8);
    for (let j = 0; j < k; j++) {
      const target = pick([X, Y, X, Y, FOREIGN]);
      const roll = rnd();
      const tags = roll < 0.2 ? [['p', A], ['e', target]] : roll < 0.3 ? [['e', FOREIGN], ['e', target]] : [['e', target, RELAY]];
      events.push({ id: `v${i}-${++n}`, kind: 7, pubkey: pick(PEOPLE), content: pick(CONTENTS), created_at: 1, tags });
    }
    const weights = {};
    for (const pk of PEOPLE) { const w = pick(WEIGHTS); if (w !== undefined) weights[pk] = w; }
    cases.push({ items, events, weights, cutoff: pick([0, 0.5, 1, 2, 2.5, -1]) });
  }
  return cases;
}

const tests = [];
function test(name, f) { tests.push({ name, fn: f }); }

/* ── U: the shared rule (dlistScore.js) ───────────────────── */

test('U1: classifyReaction — "+", 👍 and 🤙 are upvotes, "-" and 👎 downvotes, after trimming; anything else is "other" (as Simple Lists classifies)', async () => {
  const classifyReaction = await scoreFn('classifyReaction');
  const UP = ['+', '👍', '🤙', ' + ', '\n👍\t'];
  const DOWN = ['-', '👎', ' - '];
  const OTHER = ['', '++', '+1', '👍👍', '👍🏻', '❤️', '−', 'like', null, undefined];
  for (const [list, want] of [[UP, 'upvote'], [DOWN, 'downvote'], [OTHER, 'other']]) {
    for (const c of list) {
      const self = SIMPLE_LISTS.isUpvote(c) ? 'upvote' : SIMPLE_LISTS.isDownvote(c) ? 'downvote' : 'other';
      assert(self === want, `table self-check: Simple Lists reads ${JSON.stringify(c)} as ${self}, the table says ${want}`);
      const got = classifyReaction(c);
      assert(got === want, `ADR §1: classifyReaction(${JSON.stringify(c)}) → "${want}", as Simple Lists' isUpvote/isDownvote; got ${JSON.stringify(got)}`);
    }
  }
  for (const g of [42, {}, [], true]) {
    let out;
    try { out = classifyReaction(g); } catch (e) { throw new Error(`ADR §1: never throws — threw on ${JSON.stringify(g)}: ${e.message}`); }
    assert(out === 'other', `ADR §1: a non-string content is "other"; got ${JSON.stringify(out)} for ${JSON.stringify(g)}`);
  }
});

test('U2: reactionsByItem — each reaction credited to its first e tag, only for the given ids, in order, as { pubkey, type, id, content }; never throws — a first e naming an inherited property (it crashes Simple Lists\' inline copy today) is dropped', async () => {
  const reactionsByItem = await scoreFn('reactionsByItem');
  const ev = (id, pubkey, content, tags) => ({ id, kind: 7, pubkey, content, created_at: 1, tags });
  const events = [
    ev('r1', B, '+', [['e', X], ['p', A]]),
    ev('r2', C, ' - ', [['e', Y, RELAY], ['e', X]]),      // first e is Y
    ev('r3', D, '❤️', [['e', X, RELAY, 'root']]),
    ev('r4', E, '+', [['p', A]]),                          // no e at all
    ev('r5', B, '+', [['e', '9'.repeat(64)], ['e', X]]),   // first e is not a given id: dropped, not credited to X
    ev('r6', C, '👎', [['e']]),                            // an e with no value
  ];
  const map = reactionsByItem(events, [X, Y]);
  const self = SIMPLE_LISTS.reactionsPerItem(events, [X, Y]);
  assert(same(map, self), `ADR §1: the same map as Simple Lists' reactionsPerItem — want ${brief(self)}, got ${brief(map)}`);
  assert(same(Object.keys(map || {}).sort(), [X, Y].sort()), `ADR §1: one key per given id; got ${brief(Object.keys(map || {}))}`);
  assert(same(map[X], [{ pubkey: B, type: 'upvote', id: 'r1', content: '+' }, { pubkey: D, type: 'other', id: 'r3', content: '❤️' }]),
    `ADR §1: X gets r1 and r3, in order, with the raw content; got ${brief(map[X])}`);
  assert(same(map[Y], [{ pubkey: C, type: 'downvote', id: 'r2', content: ' - ' }]), `ADR §1: a reaction goes to its FIRST e only (r2 → Y); got ${brief(map[Y])}`);
  assert(same(reactionsByItem([], [X]), { [X]: [] }), 'ADR §1: an id with no reactions maps to []');
  for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    let out;
    try { out = reactionsByItem([ev('rz', B, '+', [['e', name], ['e', X]])], [X]); } catch (e) {
      throw new Error(`ADR §1 (never throws; only the given ids): a reaction whose first e is "${name}" threw — ${e.message}`);
    }
    assert(out && Array.isArray(out[X]) && out[X].length === 0 && !Object.prototype.hasOwnProperty.call(out, name),
      `ADR §1: a first e of "${name}" is not a given id — dropped, and not credited to X; got ${brief(out)}`);
  }
  for (const g of [[undefined, undefined], [null, [X]], [[null, 42, {}, { tags: 'x' }, { tags: [null, ['e']] }], [X]], ['x', 'y']]) {
    let out;
    try { out = reactionsByItem(...g); } catch (e) { throw new Error(`ADR §1: never throws — threw on ${brief(g)}: ${e.message}`); }
    assert(out && typeof out === 'object' && !Array.isArray(out), `ADR §1: garbage still gives a map; got ${brief(out)} for ${brief(g)}`);
  }
});

// Reactions as reactionsByItem gives them, built directly so U3 stands on its own.
let rseq = 0;
const up = (pubkey, content = '+') => ({ pubkey, type: 'upvote', id: `u${++rseq}`, content });
const down = (pubkey, content = '-') => ({ pubkey, type: 'downvote', id: `d${++rseq}`, content });
const other = (pubkey, content = '❤️') => ({ pubkey, type: 'other', id: `o${++rseq}`, content });
const NOTE = {
  authored: 'Implicit upvote (authored the item)',
  duplicate: 'Implicit upvote (explicit kind 7 + ignored as duplicate)',
  cancelled: "Implicit upvote cancelled by author's kind 7 downvote",
  explicitDown: "Author's explicit downvote (cancels implicit upvote)",
  unknown: 'Trust weight unknown',
};
const entry = (pubkey, role, type, weight, contribution, note = null) => ({ pubkey, role, type, weight, contribution, note });

test('U3: scoreItem — the characterization table: Simple Lists\' { score, breakdown } for the same author, votes and weights, notes and quirks included', async () => {
  const scoreItem = await scoreFn('scoreItem');
  const TABLE = [
    ['T1 no votes; the author\'s implicit upvote at the author\'s weight', [], { [A]: 0.5 },
      { score: 0.5, breakdown: [entry(A, 'author', 'implicit-upvote', 0.5, 0.5, NOTE.authored)] }],
    ['T2 no votes; the author\'s weight unknown (null) — counts for nothing', [], { [A]: null },
      { score: 0, breakdown: [entry(A, 'author', 'implicit-upvote', null, null, NOTE.unknown)] }],
    ['T3 no votes; the author missing from the weights — the same as null', [], {},
      { score: 0, breakdown: [entry(A, 'author', 'implicit-upvote', null, null, NOTE.unknown)] }],
    ['T4 others add their weight up, subtract it down; "other" adds 0', [up(B), down(C), other(D)], { [A]: 1, [B]: 1, [C]: 0.5, [D]: 1 },
      { score: 1.5, breakdown: [entry(A, 'author', 'implicit-upvote', 1, 1, NOTE.authored), entry(B, 'reactor', 'upvote', 1, 1),
        entry(C, 'reactor', 'downvote', 0.5, -0.5), entry(D, 'reactor', 'other', 1, 0)] }],
    ['T5 the author\'s first reaction is a downvote: the implicit upvote cancelled to 0, with a zero row for it', [down(A), up(B)], { [A]: 1, [B]: 1 },
      { score: 1, breakdown: [entry(A, 'author', 'implicit-upvote-cancelled', 1, 0, NOTE.cancelled), entry(A, 'author', 'explicit-downvote', 1, 0, NOTE.explicitDown),
        entry(B, 'reactor', 'upvote', 1, 1)] }],
    ['T6 the author\'s explicit + is a duplicate of the implicit upvote', [up(A)], { [A]: 0.8 },
      { score: 0.8, breakdown: [entry(A, 'author', 'implicit-upvote', 0.8, 0.8, NOTE.duplicate)] }],
    ['T7 the author\'s + then -: the first reaction decides, so nothing is cancelled', [up(A), down(A)], { [A]: 0.8 },
      { score: 0.8, breakdown: [entry(A, 'author', 'implicit-upvote', 0.8, 0.8, NOTE.duplicate)] }],
    ['T8 the author\'s - then 👍: cancelled, and EVERY reaction of the author gets a zero "explicit-downvote" row', [down(A), up(A, '👍')], { [A]: 0.8 },
      { score: 0, breakdown: [entry(A, 'author', 'implicit-upvote-cancelled', 0.8, 0, NOTE.cancelled), entry(A, 'author', 'explicit-downvote', 0.8, 0, NOTE.explicitDown),
        entry(A, 'author', 'explicit-downvote', 0.8, 0, NOTE.explicitDown)] }],
    ['T9 the author\'s downvote with the author\'s weight unknown: the "unknown" row, then a zero row with no weight', [down(A), up(B)], { [A]: null, [B]: 1 },
      { score: 1, breakdown: [entry(A, 'author', 'implicit-upvote', null, null, NOTE.unknown), entry(A, 'author', 'explicit-downvote', null, 0, NOTE.explicitDown),
        entry(B, 'reactor', 'upvote', 1, 1)] }],
    ['T10 a voter with an unknown weight counts for nothing; a weight of 0 counts 0', [up(B), down(C, '👎')], { [A]: 1, [B]: null, [C]: 0 },
      { score: 1, breakdown: [entry(A, 'author', 'implicit-upvote', 1, 1, NOTE.authored), entry(B, 'reactor', 'upvote', null, null, NOTE.unknown),
        entry(C, 'reactor', 'downvote', 0, 0)] }],
    ['T11 one voter, two reactions with different ids: counted twice (duplicates are removed by event id only)', [up(B), up(B, '🤙')], { [A]: 0.5, [B]: 0.75 },
      { score: 2, breakdown: [entry(A, 'author', 'implicit-upvote', 0.5, 0.5, NOTE.authored), entry(B, 'reactor', 'upvote', 0.75, 0.75),
        entry(B, 'reactor', 'upvote', 0.75, 0.75)] }],
  ];
  for (const [name, reactions, weights, want] of TABLE) {
    const self = SIMPLE_LISTS.trustScores([{ id: X, pubkey: A }], { [X]: reactions }, weights)[X];
    assert(same(self, want), `table self-check (${name}): Simple Lists computes ${brief(self)}`);
    const got = scoreItem(A, reactions, weights);
    assert(same(got, want), `ADR §1 / AC-3 — ${name}: want ${brief(want)}, got ${brief(got)}`);
  }
  for (const g of [[undefined, undefined, undefined], [A, null, null], [A, [null, 42], { [A]: 1 }], [A, 'x', 'y']]) {
    let out;
    try { out = scoreItem(...g); } catch (e) { throw new Error(`ADR §1: never throws — threw on ${brief(g)}: ${e.message}`); }
    assert(out && typeof out.score === 'number' && Array.isArray(out.breakdown), `ADR §1: garbage still gives { score, breakdown }; got ${brief(out)} for ${brief(g)}`);
  }
});

test('U4: qualifies — score != null && score >= cutoff: inclusive at the cutoff; a null score never qualifies, whatever the cutoff', async () => {
  const qualifies = await scoreFn('qualifies');
  const TABLE = [[2, 2, true], [2.5, 2, true], [1.999, 2, false], [0, 0, true], [-0.5, -1, true], [-1, 0, false],
    [null, 2, false], [null, -1, false], [undefined, 2, false], [NaN, 2, false]];
  for (const [score, cutoff, want] of TABLE) {
    const self = score != null && score >= cutoff;
    assert(self === want, `table self-check: Simple Lists' filter reads (${score}, ${cutoff}) as ${self}`);
    let got;
    try { got = qualifies(score, cutoff); } catch (e) { throw new Error(`ADR §1: never throws — threw on (${score}, ${cutoff}): ${e.message}`); }
    assert(got === want, `ADR §1 / AC-3: qualifies(${score}, ${cutoff}) → ${want}; got ${JSON.stringify(got)}`);
  }
});

test('U5: AC-3 / AC-5 — over 500 seeded cases, the shared rule credits, scores and qualifies exactly as Simple Lists did before the move (the frozen copy above)', async () => {
  const reactionsByItem = await scoreFn('reactionsByItem');
  const scoreItem = await scoreFn('scoreItem');
  const qualifies = await scoreFn('qualifies');
  const cases = generateCases(500, 20260912);
  for (const [i, c] of cases.entries()) {
    const ids = c.items.map((it) => it.id);
    const wantMap = SIMPLE_LISTS.reactionsPerItem(c.events, ids);
    const want = SIMPLE_LISTS.trustScores(c.items, wantMap, c.weights);
    const wantQualified = new Set(SIMPLE_LISTS.qualified(c.items, want, c.cutoff).map((q) => q.id));
    const gotMap = reactionsByItem(c.events, ids);
    assert(same(gotMap, wantMap), `case ${i}: reactionsByItem differs from Simple Lists' reactionsPerItem — want ${brief(wantMap)}, got ${brief(gotMap)}`);
    for (const it of c.items) {
      const got = scoreItem(it.pubkey, gotMap[it.id] || [], c.weights);
      assert(same(got, want[it.id]), `case ${i}, item ${it.id.slice(0, 4)}…: scoreItem differs from Simple Lists' trustScores — want ${brief(want[it.id])}, got ${brief(got)}`);
      assert(qualifies(got.score, c.cutoff) === wantQualified.has(it.id), `case ${i}: qualifies(${got.score}, ${c.cutoff}) differs from Simple Lists' filter`);
    }
  }
});

/* ── U: the curation util (treasureMap.js) ─────────────────── */

const vote = (id, pubkey, target, content = '+', kind = 7) => ({ id, kind, pubkey, content, created_at: 5, tags: [['e', target], ['p', A]] });

test('U6: lookupItemVotes — one filter, { kinds: [7], "#e": ids, limit: VOTES_LIMIT = 5000 }, to this instance\'s strfry and to the community relay; kind-7 events merged by id, local first, each vote once; the local cap reported', async () => {
  const mod = await utilMod();
  assert(mod.VOTES_LIMIT === 5000, `ADR §2: VOTES_LIMIT = 5000; got ${JSON.stringify(mod.VOTES_LIMIT)}`);
  const lookupItemVotes = await fn('lookupItemVotes');
  const v1 = vote('v1', B, X); const v2 = vote('v2', C, Y, '-'); const noise = vote('n1', D, X, 'hello', 1); const v4 = vote('v4', D, X);
  const calls = [];
  const res = await lookupItemVotes([X, Y], {
    scanLocal: async (f) => { calls.push(['local', f]); return { events: [v1, v2, noise], count: 3, total: 3, truncated: false, limit: 5000 }; },
    fetchRelay: async (f, url) => { calls.push(['relay', f, url]); return { success: true, events: [{ ...v2 }, v4] }; },
  }, RELAY);
  const want = { kinds: [7], '#e': [X, Y], limit: 5000 };
  const local = calls.filter((c) => c[0] === 'local'); const relay = calls.filter((c) => c[0] === 'relay');
  assert(local.length === 1 && same(local[0][1], want), `ADR §2: one local read with ${JSON.stringify(want)}; got ${brief(local)}`);
  assert(relay.length === 1 && same(relay[0][1], want) && relay[0][2] === RELAY, `ADR §2: the same filter, once, on the community relay; got ${brief(relay)}`);
  const ids = (res && Array.isArray(res.events) ? res.events : []).map((e) => e.id);
  assert(same(ids, ['v1', 'v2', 'v4']), `AC-4 / ADR §2: kind-7 events only, each vote once, local first then the relay's additions; got ${brief(ids)}`);
  assert(res.local === 'ok' && res.relay === 'ok' && res.truncated === false, `ADR §2: both sources ok, not truncated; got ${brief({ local: res.local, relay: res.relay, truncated: res.truncated })}`);
  const capped = await lookupItemVotes([X], { scanLocal: async () => ({ events: [v1], truncated: true, total: 7000 }), fetchRelay: async () => ({ success: true, events: [] }) }, RELAY);
  assert(capped && capped.truncated === true, `ADR §2 / AC-4: a capped local read is reported — an incomplete read; got ${brief(capped)}`);
});

test('U7: lookupItemVotes — a failed source is marked failed (the other still counts), an unsuccessful answer is a failure, a non-ws relay is skipped, no ids asks nothing, and it never rejects', async () => {
  const lookupItemVotes = await fn('lookupItemVotes');
  const v1 = vote('v1', B, X); const v2 = vote('v2', C, X);
  const okLocal = async () => ({ events: [v1], truncated: false, total: 1 });
  let r = await lookupItemVotes([X], { scanLocal: async () => { throw new Error('strfry down'); }, fetchRelay: async () => ({ success: true, events: [v2] }) }, RELAY);
  assert(r.local === 'failed' && r.relay === 'ok' && same(r.events.map((e) => e.id), ['v2']), `AC-4 / ADR §2: local failed, the relay's votes still returned; got ${brief(r)}`);
  r = await lookupItemVotes([X], { scanLocal: okLocal, fetchRelay: async () => { throw new Error('offline'); } }, RELAY);
  assert(r.local === 'ok' && r.relay === 'failed' && same(r.events.map((e) => e.id), ['v1']), `AC-4 / ADR §2: the relay failed, local votes still returned; got ${brief(r)}`);
  r = await lookupItemVotes([X], { scanLocal: okLocal, fetchRelay: async () => ({ success: false, events: [], error: 'Timeout' }) }, RELAY);
  assert(r.relay === 'failed', `AC-4 / ADR §2: an unsuccessful relay answer is a failure, never "no votes"; got ${brief(r)}`);
  for (const hint of ['https://not-a-relay.example', '', null, undefined]) {
    let asked = false;
    r = await lookupItemVotes([X], { scanLocal: okLocal, fetchRelay: async () => { asked = true; return { success: true, events: [] }; } }, hint);
    assert(r.relay === 'skipped' && !asked, `ADR §2: a relay that is not ws/wss (${JSON.stringify(hint)}) is skipped, not fetched; got ${brief(r)}`);
  }
  let both;
  try { both = await lookupItemVotes([X], { scanLocal: async () => { throw new Error('x'); }, fetchRelay: async () => { throw new Error('y'); } }, RELAY); } catch (e) {
    throw new Error(`ADR §2: never rejects — rejected with ${e.message}`);
  }
  assert(both.local === 'failed' && both.relay === 'failed' && both.events.length === 0, `AC-4: both failed → nothing counted; got ${brief(both)}`);
  let bare;
  try { bare = await lookupItemVotes([X], undefined, RELAY); } catch (e) { throw new Error(`ADR §2: never rejects — rejected with no readers: ${e.message}`); }
  assert(bare && bare.local === 'failed' && bare.relay !== 'ok', `AC-4: a missing reader is a failed read, never "no votes"; got ${brief(bare)}`);
  for (const none of [[], null, undefined]) {
    let asked = false;
    const spy = { scanLocal: async () => { asked = true; return { events: [] }; }, fetchRelay: async () => { asked = true; return { success: true, events: [] }; } };
    const out = await lookupItemVotes(none, spy, RELAY);
    assert(out && Array.isArray(out.events) && out.events.length === 0 && out.local !== 'failed' && out.relay !== 'failed' && !asked,
      `no ids (${JSON.stringify(none)}) → no read (an empty "#e" filter could match every vote), no events, nothing failed; got ${brief(out)} (asked: ${asked})`);
  }
});

test('U8: weightsState — failed when the weights read failed; ready once every pubkey has its own key (a null is a real "unknown"); otherwise checking — never ready before the first answer or without a point of view', async () => {
  const weightsState = await fn('weightsState');
  const ws = (over) => weightsState({ weights: {}, loading: false, error: null, pubkeys: [A, B], ...over });
  const CASES = [
    [{ error: 'No TA Treasure Map found for PoV.' }, 'failed', 'a whole-read failure (useTrustWeights sets error)'],
    [{ error: 'boom', loading: true, weights: { [A]: 1, [B]: 1 } }, 'failed', 'an error comes first — before loading and present keys (ADR §3 order)'],
    [{ loading: true, weights: { [A]: 1, [B]: null } }, 'checking', 'still loading'],
    [{ weights: { [A]: 0.5, [B]: null } }, 'ready', 'every pubkey has its own key; a null is a legitimate unknown'],
    [{ weights: { [A]: 1, [B]: 1 } }, 'ready', 'every pubkey weighed'],
    [{ weights: { [A]: 0.5 } }, 'checking', 'a pubkey not answered yet'],
    [{ weights: {} }, 'checking', 'before the hook\'s first answer, or with no point of view (it answers {})'],
    [{ weights: Object.create({ [A]: 1, [B]: 1 }) }, 'checking', 'inherited keys are not answers — own keys only'],
    [{ pubkeys: [], weights: {} }, 'ready', 'nothing to weigh'],
  ];
  for (const [over, want, why] of CASES) {
    const got = ws(over);
    assert(got === want, `ADR §3: ${why} → "${want}"; got ${JSON.stringify(got)}`);
  }
  for (const g of [undefined, null, {}, { weights: null, pubkeys: [A] }, { weights: { [A]: 1 }, pubkeys: 'x' }]) {
    let out;
    try { out = weightsState(g); } catch (e) { throw new Error(`ADR §3: never throws — threw on ${brief(g)}: ${e.message}`); }
    assert(['checking', 'ready', 'failed'].includes(out), `ADR §3: one of the three states; got ${JSON.stringify(out)} for ${brief(g)}`);
  }
  assert(ws({ weights: null, pubkeys: [A] }) === 'checking', 'ADR §3: no weights yet, a pubkey to weigh → checking');
});

// Candidates are the shared items shown as candidates: events, each also carrying its routeId — the fixture satisfies
// both readings of the ADR (read candidate.routeId, or compute itemRouteId from the event).
const K1 = '4'.repeat(64); const K2 = '5'.repeat(64); const K3 = '6'.repeat(64);
const cand = (id, pubkey, d) => ({ id, kind: 39999, pubkey, created_at: 10, content: '', tags: [['d', d], ['z', SHARED], ['name', d]], routeId: `39999:${pubkey}:${d}` });
const CANDS = [cand(K1, A, 'akita'), cand(K2, B, 'beagle'), cand(K3, C, 'corgi')];
// Trust Everyone: everyone weighs 1. akita = 1 + D's up = 2; beagle = 1; corgi = 1 + D's up − E's down = 1.
const VOTES_OK = { events: [vote('w1', D, K1, '+'), vote('w2', D, K3, '👍'), vote('w3', E, K3, '-')], local: 'ok', relay: 'ok', truncated: false };
const WEIGHTS_READY = { state: 'ready', values: { [A]: 1, [B]: 1, [C]: 1, [D]: 1, [E]: 1 }, error: null };
const WEIGHTS_FAILED = { state: 'failed', values: { [A]: null, [B]: null, [C]: null, [D]: null, [E]: null }, error: 'No TA Treasure Map found for PoV.' };
async function verdicts(over) {
  const candidateVerdicts = await fn('candidateVerdicts');
  return candidateVerdicts({ candidates: CANDS, votes: VOTES_OK, weights: WEIGHTS_READY, cutoff: 2, ...over });
}
const each = (out, cands = CANDS) => cands.map((k) => (out && out.byRouteId ? out.byRouteId[k.routeId] : undefined));

test('U9: candidateVerdicts — "checking" while the votes or the weights are still pending, for every candidate and the summary (before any "couldn\'t check"); garbage never throws', async () => {
  for (const [over, why] of [
    [{ votes: null }, 'the votes not read yet'],
    [{ weights: { state: 'checking', values: {}, error: null } }, 'the weights still checking'],
    [{ votes: null, weights: WEIGHTS_FAILED }, 'the votes pending, even with the weights failed (ADR §4 order: checking first)'],
    [{ votes: { ...VOTES_OK, local: 'failed' }, weights: { state: 'checking', values: {}, error: null } }, 'the weights pending, even with a source failed'],
  ]) {
    const out = await verdicts(over);
    const vs = each(out);
    assert(vs.every((v) => v && v.verdict === 'checking'), `ADR §4: ${why} → every candidate "checking"; got ${brief(vs)}`);
    assert(out.summary && out.summary.state === 'checking' && out.summary.total === 3, `ADR §4: ${why} → summary checking, total 3; got ${brief(out.summary)}`);
  }
  const candidateVerdicts = await fn('candidateVerdicts');
  for (const g of [undefined, {}, { candidates: null, votes: null, weights: null, cutoff: 2 }, { candidates: [null, {}, 7], votes: VOTES_OK, weights: WEIGHTS_READY, cutoff: 2 }]) {
    let out;
    try { out = candidateVerdicts(g); } catch (e) { throw new Error(`never throws (it runs on every render) — threw on ${brief(g)}: ${e.message}`); }
    assert(out && typeof out.byRouteId === 'object' && out.summary && typeof out.summary.state === 'string', `garbage still gives { byRouteId, summary }; got ${brief(out)} for ${brief(g)}`);
  }
});

test('U10: candidateVerdicts — a failed or incomplete read is "couldn\'t check" for every candidate, naming what couldn\'t be read, and the summary is incomplete — never "skipped"', async () => {
  const CASES = [
    [{ votes: { ...VOTES_OK, local: 'failed' } }, [new RegExp(`this instance${APOS}s strfry`)], 'this instance\'s strfry failed'],
    [{ votes: { ...VOTES_OK, relay: 'failed' } }, [/community relay/], 'the community relay failed'],
    [{ votes: { ...VOTES_OK, local: 'failed', relay: 'failed' } }, [/strfry/, /community relay/], 'both sources failed — both named'],
    [{ votes: { ...VOTES_OK, truncated: true } }, [/more votes than one read returns/], 'the local read was capped'],
    [{ weights: WEIGHTS_FAILED }, [/No TA Treasure Map found for PoV\./], 'the weights failed — their error is the reason'],
  ];
  for (const [over, reasons, why] of CASES) {
    const out = await verdicts(over);
    const vs = each(out);
    assert(vs.every((v) => v && v.verdict === 'unchecked'), `AC-4 / ADR §4: ${why} → every candidate "unchecked", none "skipped" or "qualifies"; got ${brief(vs.map((v) => v && v.verdict))}`);
    for (const re of reasons) {
      assert(vs.every((v) => typeof v.reason === 'string' && re.test(v.reason)), `AC-4 / ADR §4: ${why} → each candidate's reason names it (${re}); got ${brief(vs.map((v) => v.reason))}`);
      assert(out.summary && typeof out.summary.reason === 'string' && re.test(out.summary.reason), `AC-4 / ADR §4: ${why} → the summary's reason names it (${re}); got ${brief(out.summary)}`);
    }
    assert(out.summary.state === 'incomplete' && out.summary.total === 3, `AC-4: ${why} → the summary says the verdicts are incomplete; got ${brief(out.summary)}`);
  }
});

test('U11: candidateVerdicts — each candidate scored by the shared rule and judged against the cutoff (inclusive), equal to what Simple Lists computes; "N of M" in the summary', async () => {
  const reactionsByItem = await scoreFn('reactionsByItem');
  const scoreItem = await scoreFn('scoreItem');
  const qualifies = await scoreFn('qualifies');
  for (const [cutoff, wantNames] of [[2, ['akita']], [1, ['akita', 'beagle', 'corgi']], [2.0001, []], [0, ['akita', 'beagle', 'corgi']]]) {
    const out = await verdicts({ cutoff });
    const oracle = SIMPLE_LISTS.trustScores(CANDS, SIMPLE_LISTS.reactionsPerItem(VOTES_OK.events, CANDS.map((k) => k.id)), WEIGHTS_READY.values);
    const oracleIn = new Set(SIMPLE_LISTS.qualified(CANDS, oracle, cutoff).map((q) => q.id));
    for (const k of CANDS) {
      const v = out.byRouteId && out.byRouteId[k.routeId];
      const shared = scoreItem(k.pubkey, reactionsByItem(VOTES_OK.events, [k.id])[k.id], WEIGHTS_READY.values);
      assert(v && same({ score: v.score, breakdown: v.breakdown }, shared), `AC-3 / ADR §4: ${k.routeId}'s score and breakdown are the shared rule's; want ${brief(shared)}, got ${brief(v)}`);
      assert(same(shared, oracle[k.id]), `AC-3: the shared rule agrees with Simple Lists for ${k.routeId}`);
      const want = qualifies(shared.score, cutoff) ? 'qualifies' : 'skipped';
      assert(v.verdict === want && (want === 'qualifies') === oracleIn.has(k.id), `AC-3 / ADR §4: ${k.routeId} at cutoff ${cutoff} → "${want}", as Simple Lists' panel decides; got ${JSON.stringify(v.verdict)}`);
      assert((v.verdict === 'qualifies') === wantNames.includes(k.tags[0][1]), `AC-2: at cutoff ${cutoff}, ${wantNames.length} qualify (${wantNames.join(', ') || 'none'}); ${k.tags[0][1]} is ${v.verdict}`);
    }
    assert(out.summary && out.summary.state === 'complete' && out.summary.qualifying === wantNames.length && out.summary.total === 3,
      `AC-2 / ADR §4: the summary — ${wantNames.length} of 3 qualify at cutoff ${cutoff}; got ${brief(out.summary)}`);
  }
});

test('U12: candidateVerdicts — votes matched by the candidate\'s current event id (an edited 39999 original\'s earlier votes don\'t count); the author\'s first reaction follows the merged order; no vote is credited to another candidate', async () => {
  const OLD = '7'.repeat(64);
  const edited = cand(K1, A, 'akita');
  const ok = { local: 'ok', relay: 'ok', truncated: false };
  let out = await verdicts({ candidates: [edited], votes: { events: [vote('o1', D, OLD, '+'), vote('n1', E, K1, '+')], ...ok } });
  let v = out.byRouteId && out.byRouteId[edited.routeId];
  assert(v && v.score === 2 && v.breakdown.some((b) => b.pubkey === E) && !v.breakdown.some((b) => b.pubkey === D),
    `AC-3 / gate decision 2: only the current version's votes count (E's, not D's on the old id); got ${brief(v)}`);
  out = await verdicts({ candidates: [edited], votes: { events: [vote('a1', A, K1, '-'), vote('a2', A, K1, '+')], ...ok } });
  v = out.byRouteId[edited.routeId];
  assert(v && v.score === 0 && v.breakdown[0].type === 'implicit-upvote-cancelled', `ADR §4: the author's first reaction (a downvote) cancels; got ${brief(v)}`);
  out = await verdicts({ candidates: [edited], votes: { events: [vote('a2', A, K1, '+'), vote('a1', A, K1, '-')], ...ok } });
  v = out.byRouteId[edited.routeId];
  assert(v && v.score === 1 && v.breakdown[0].type === 'implicit-upvote', `ADR §4: in the other order the first reaction is the +, so nothing is cancelled; got ${brief(v)}`);
  out = await verdicts({ votes: { events: [vote('x1', D, K2, '+'), { ...vote('x2', E, K3, '+'), tags: [['e', K3], ['e', K2]] }], ...ok } });
  const [akita, beagle, corgi] = each(out);
  assert(akita.score === 1 && beagle.score === 2 && corgi.score === 2, `ADR §1 / §4: each vote counts for its first e only; got ${brief([akita.score, beagle.score, corgi.score])}`);
});

test('U13: the cutoff helpers — CUTOFF_DEFAULT = 2; one storage key per list; a stored value reads back as its number (0 included), anything missing or invalid as 2', async () => {
  const mod = await utilMod();
  assert(mod.CUTOFF_DEFAULT === 2, `ADR §5 / gate decision 1: CUTOFF_DEFAULT = 2; got ${JSON.stringify(mod.CUTOFF_DEFAULT)}`);
  const key = await fn('cutoffStorageKey');
  const read = await fn('readStoredCutoff');
  const MY = `39998:${A}:dog-breed`;
  assert(key(MY) === `tapestry_curation_cutoff:${MY}`, `ADR §5: cutoffStorageKey(coord) → "tapestry_curation_cutoff:<coord>"; got ${JSON.stringify(key(MY))}`);
  assert(key(`39998:${A}:cats`) !== key(MY), 'gate decision 1: remembered per list — one key per curated list');
  for (const [raw, want] of [['3', 3], ['0.5', 0.5], ['2', 2], ['0', 0], ['-1', -1]]) {
    assert(read(raw) === want, `ADR §5: a stored ${JSON.stringify(raw)} reads back as ${want}${raw === '0' ? ' — a cutoff of 0 is a real choice, not "missing"' : ''}; got ${JSON.stringify(read(raw))}`);
  }
  for (const raw of [null, undefined, '', 'abc', 'NaN', {}]) {
    let got;
    try { got = read(raw); } catch (e) { throw new Error(`ADR §5: never throws — threw on ${JSON.stringify(raw)}: ${e.message}`); }
    assert(got === 2, `ADR §5: missing or invalid (${JSON.stringify(raw)}) → the default 2; got ${JSON.stringify(got)}`);
  }
});

/* ── S: structure ──────────────────────────────────────────── */

test('S1: dlistScore.js is pure and zero-import — no reads, no storage, no DOM — and names Simple Lists as its first consumer', () => {
  const s = src(SCORE);
  assert(!/^\s*import\b/m.test(s) && !/\brequire\(/.test(s), 'ADR §1: zero-import (Node suites load it directly)');
  assert(!/\bfetch\(|localStorage|sessionStorage|\bwindow\.|\bdocument\./.test(s), 'ADR §1: pure — no fetch, no storage, no DOM');
  assert(/DListItems/.test(s), 'ADR note 1: a comment points to DListItems.jsx as its first consumer');
});

test('S2: Simple Lists calls the shared rule and keeps no copy — the import, the three calls, the inline classifiers and scoring notes gone', () => {
  const s = src(SIMPLE);
  const imp = (s.match(/import\s*\{([^}]*)\}\s*from\s*['"]\.\.\/\.\.\/utils\/dlistScore(?:\.js)?['"]/) || [])[1] || '';
  assert(['reactionsByItem', 'scoreItem', 'qualifies'].every((n) => new RegExp(`\\b${n}\\b`).test(imp)),
    `ADR note 2: import { reactionsByItem, scoreItem, qualifies } from '../../utils/dlistScore'; got {${imp}}`);
  assert(!/function\s+isUpvote\b/.test(s) && !/function\s+isDownvote\b/.test(s), 'ADR note 2: the inline isUpvote / isDownvote are removed');
  for (const note of ['Implicit upvote (authored the item)', 'Implicit upvote (explicit kind 7 + ignored as duplicate)', 'Implicit upvote cancelled by author',
    'explicit downvote (cancels implicit upvote)', 'Trust weight unknown']) {
    assert(!s.includes(note), `ADR §1: "${note}" now lives only in dlistScore.js — Simple Lists keeps no copy of the rule`);
  }
  assert(/reactionsByItem\(\s*reactions\s*,\s*itemIds\s*\)/.test(s), 'ADR note 2: reactionsPerItem is reactionsByItem(reactions, itemIds)');
  assert(/scoreItem\(\s*item\.pubkey\s*,/.test(s), 'ADR note 2: the trustScores memo maps items through scoreItem(item.pubkey, …)');
  assert(/\.filter\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*qualifies\(\s*\1\.score\s*,\s*cutoff\s*\)\s*\)/.test(s), 'ADR note 2: qualifiedItems filters with qualifies(item.score, cutoff)');
});

test('S3: the curation util takes the rule from the same module — import from \'./dlistScore.js\' — and keeps no vote classifier or scoring note of its own', () => {
  const s = src(UTIL);
  for (const n of ['reactionsByItem', 'scoreItem', 'qualifies']) {
    assert(new RegExp(`import\\s*\\{[^}]*\\b${n}\\b[^}]*\\}\\s*from\\s*['"]\\.\\/dlistScore\\.js['"]`).test(s),
      `ADR note 3: import { ${n}, … } from './dlistScore.js' (the .js extension keeps Node suites resolving it)`);
  }
  assert(!/['"](?:👍|🤙|👎)['"]/.test(s) && !/Trust weight unknown/.test(s), 'ADR §1: the rule has one owner — no copy in treasureMap.js');
});

test('S4: the detail page — the cutoff hook and the summary state before the early return; my own list\'s coordinate or null; the panel and the items section get cutoff and the summary', () => {
  const s = src(DETAIL);
  assert(/import\s+useCurationCutoff\s+from\s*['"]\.\.\/\.\.\/hooks\/useCurationCutoff['"]/.test(s), 'ADR note 5: import useCurationCutoff from \'../../hooks/useCurationCutoff\'');
  assert(/import\s*\{[^}]*\buseState\b[^}]*\}\s*from\s*['"]react['"]/.test(s), 'ADR §6: useState, for the verdict summary');
  const early = s.search(/if\s*\(\s*!open\s*\)/);
  const hook = s.search(/useCurationCutoff\(/);
  const state = s.search(/useState\(/);
  assert(early > 0 && hook > 0 && hook < early, 'ADR §6 / the rules of hooks: useCurationCutoff(…) runs before the early return');
  assert(state > 0 && state < early, 'ADR §6: the summary state is declared before the early return');
  const arg = (s.match(/useCurationCutoff\(([^;]*?)\)\s*;/) || [])[1] || '';
  assert(/\bcoord\b/.test(arg) && /\bnull\b/.test(arg) && (/readOnly/.test(arg) || /['"]ok['"]/.test(arg)),
    `ADR §6: my own list's coordinate, null otherwise (a read-only list touches no storage); got useCurationCutoff(${arg})`);
  const panel = element(s, 'CurationMethodPanel');
  assert(/\bcutoff=\{/.test(panel) && /\bonCutoffChange=\{/.test(panel) && /\bsummary=\{/.test(panel), `ADR §6: <CurationMethodPanel cutoff onCutoffChange summary />; got ${panel || '(none)'}`);
  const items = element(s, 'ItemsSection');
  assert(/\bcutoff=\{/.test(items) && /\bonVerdictSummary=\{/.test(items), `ADR §6: <ItemsSection … cutoff onVerdictSummary />; got ${items || '(none)'}`);
  assert(new RegExp(`The curation method is set where this list${APOS}s assistant lives\\.`).test(flat(s)), 'AC-5 / story 3: a read-only list still shows its one line, not the panel');
});

test('S5: the panel — my Scoring Method (with the Trusted List\'s name), the point of view, the link to Trust Determination, the cutoff input, the rule, the browser-only line, and the summary; the placeholder gone; nothing set on Trust Determination', () => {
  const s = src(ITEMS); const f = flat(s);
  const sig = (s.match(/export\s+function\s+CurationMethodPanel\s*\(\s*\{([^}]*)\}/) || [])[1] || '';
  assert(['cutoff', 'onCutoffChange', 'summary'].every((p) => new RegExp(`\\b${p}\\b`).test(sig)), `ADR §7: CurationMethodPanel({ cutoff, onCutoffChange, summary }); got {${sig}}`);
  const fromTrust = (n) => new RegExp(`import\\s*\\{[^}]*\\b${n}\\b[^}]*\\}\\s*from\\s*['"]\\.\\.\\/\\.\\.\\/context\\/TrustContext['"]`).test(s);
  assert(fromTrust('useTrust') && fromTrust('SCORING_METHODS') && /useTrust\(\)/.test(s), 'AC-1 / ADR §7: the method and point of view from useTrust() and SCORING_METHODS');
  assert(/Scoring Method:/.test(f), 'AC-1 / ADR §7: "Scoring Method: <label>"');
  assert(/trustedListId/.test(s) && /['"]trusted-list['"]/.test(s), 'AC-1 / ADR §7: for the Trusted List method, the chosen list is named');
  assert(/import\s+useProfiles\s+from\s*['"]\.\.\/\.\.\/hooks\/useProfiles['"]/.test(s) && /useProfiles\(/.test(s) && /Point of view:/.test(f),
    'AC-1 / ADR §7: "Point of view: <name> · <short pubkey>" (useProfiles)');
  assert(/['"`]\/tapestry\/grapevine\/trust-determination['"`]/.test(s) && /<Link\b/.test(s) && /Change them on Trust Determination →/.test(f),
    'AC-1 / ADR §7: "Change them on Trust Determination →", linking to /tapestry/grapevine/trust-determination');
  assert(/Cutoff \(≥\)/.test(f) && /type=["']number["']/.test(s) && /step=(?:["']0\.1["']|\{\s*0\.1\s*\})/.test(s), 'AC-1 / ADR §5, §7: "Cutoff (≥)", a number input, step 0.1');
  assert(/onCutoffChange(?:\?\.)?\(\s*parseFloat\([^)]*\)\s*\|\|\s*0\s*\)/.test(s), 'ADR §5: the input parses as Simple Lists\' does — onCutoffChange(parseFloat(v) || 0)');
  assert(new RegExp(`A candidate qualifies when its score reaches the cutoff: its author${APOS}s implicit upvote plus the trust-weighted upvotes, minus the trust-weighted downvotes\\.`).test(f),
    'ADR §7: the rule in one sentence, exact');
  assert(/These apply in this browser and are not written onto the list\./.test(f), 'AC-1 / ADR §7: the browser-only line, exact');
  assert(/⏳ Checking…/.test(f) && /candidates qualify/.test(f) && /\.qualifying\b/.test(s), 'AC-2 / ADR §7: the summary — "⏳ Checking…" and "N of M candidates qualify"');
  assert(new RegExp(`Verdicts incomplete — couldn${APOS}t check`).test(f), 'AC-4 / ADR §7: "Verdicts incomplete — couldn\'t check <reason>"');
  assert(new RegExp(`Turn on ${QUOT}Also show candidates to copy${QUOT} to see which qualify\\.`).test(f), 'ADR §7: the hint while candidates are off, exact');
  assert(!new RegExp(`The curation method isn${APOS}t built yet`).test(f) && !/It will set how your assistant decides/.test(f), 'AC-1: the placeholder text is gone');
  assert(!/\b(?:setScoringMethod|setPovPubkey|setTrustedListId|resetToOwner)\b/.test(s), 'AC-5: Trust Determination is only read — no setter is called here');
});

test('S6: the items section — cutoff and onVerdictSummary; votes via useItemVotes at the community relay, weights via useTrustWeights, weightsState and candidateVerdicts; the Verdict cell and its reason; my own lists only', () => {
  const s = src(ITEMS); const f = flat(s);
  const sig = (s.match(/export\s+function\s+ItemsSection\s*\(\s*\{([^}]*)\}/) || [])[1] || '';
  assert(/\bcutoff\b/.test(sig) && /\bonVerdictSummary\b/.test(sig), `ADR §7: ItemsSection({ …, cutoff, onVerdictSummary }); got {${sig}}`);
  assert(/import\s+useItemVotes\s+from\s*['"]\.\.\/\.\.\/hooks\/useItemVotes['"]/.test(s) && /useItemVotes\([^;]*,\s*communityRelay\s*\)/.test(s),
    'AC-4 / ADR §7: the candidates\' votes via useItemVotes(…, communityRelay)');
  assert(/import\s+useTrustWeights\s+from\s*['"]\.\.\/\.\.\/hooks\/useTrustWeights['"]/.test(s) && /useTrustWeights\(/.test(s), 'ADR §3: the weights via useTrustWeights, unchanged');
  const fromUtil = (n) => new RegExp(`import\\s*\\{[^}]*\\b${n}\\b[^}]*\\}\\s*from\\s*['"]\\.\\.\\/\\.\\.\\/utils\\/treasureMap['"]`).test(s);
  assert(fromUtil('weightsState') && fromUtil('candidateVerdicts') && /weightsState\(/.test(s), 'ADR §3–§4: weightsState and candidateVerdicts from the util');
  assert(/candidateVerdicts\(\s*\{[\s\S]{0,400}?\bcutoff\b/.test(s), 'AC-3 / ADR §4: candidateVerdicts({ …, cutoff }) — a cutoff edit re-judges at once');
  assert(/onVerdictSummary/.test(declaration(s, 'ItemsSection')) && /state:\s*['"]hidden['"]/.test(s), 'ADR §7: the summary is reported up — { state: \'hidden\' } while candidates are off');
  for (const text of ['✓ qualifies ·', '✗ skipped ·', '⏳ checking…']) assert(f.includes(text), `AC-2 / ADR §7: the Verdict cell's "${text}"`);
  assert(new RegExp(`⚠️ couldn${APOS}t check`).test(f), 'AC-4 / ADR §7: "⚠️ couldn\'t check" — never "doesn\'t qualify"');
  for (const h of ['Verdict', 'Voter', 'Vote', 'Weight', 'Contribution', 'Note']) assert(new RegExp(`['">]\\s*${h}\\s*['"<]`).test(s), `AC-2 / ADR §7: a "${h}" heading`);
  // My own lists only: the verdict path decides from `curator`, beyond the label and reason choices story 3 made.
  const body = declaration(s, 'ItemsSection');
  const gates = body.split(/[;\n]/).filter((st) => /curator\s*(?:===|!==)\s*['"](?:mine|other)['"]/.test(st) && !/FROM_LABEL|UNAVAILABLE_REASON|\blabels\b|\breasons\b/.test(st));
  assert(gates.length >= 1, 'AC-5 / ADR §7: a read-only list gets no verdicts and no reads — ItemsSection gates the verdict path on curator');
});

test('S7: the two hooks — useItemVotes binds lookupItemVotes as useListItems binds lookupListItems; useCurationCutoff keeps the number per list, every storage access guarded', () => {
  const v = src(VOTES_HOOK);
  assert(/export\s+default\s+function\s+useItemVotes\s*\(/.test(v), 'ADR §2: export default function useItemVotes(ids, relay)');
  assert(/import\s*\{[^}]*\bqueryRelayBounded\b[^}]*\}\s*from\s*['"]\.\.\/api\/relay['"]/.test(v) && /import\s*\{[^}]*\blookupItemVotes\b[^}]*\}\s*from\s*['"]\.\.\/utils\/treasureMap['"]/.test(v),
    'ADR §2: imports queryRelayBounded and lookupItemVotes');
  assert(/lookupItemVotes\([\s\S]{0,200}?scanLocal:\s*queryRelayBounded/.test(v) && /\/api\/relay\/external/.test(v),
    'ADR §2: lookupItemVotes bound to the bounded scan and the relay endpoint');
  assert(/\.join\(/.test(v), 'ADR §2: keyed on the ids and the relay (a joined key), not the array\'s identity');
  const c = src(CUTOFF_HOOK);
  assert(/export\s+default\s+function\s+useCurationCutoff\s*\(/.test(c), 'ADR §5: export default function useCurationCutoff(listCoord)');
  for (const n of ['CUTOFF_DEFAULT', 'cutoffStorageKey', 'readStoredCutoff']) {
    assert(new RegExp(`import\\s*\\{[^}]*\\b${n}\\b[^}]*\\}\\s*from\\s*['"]\\.\\.\\/utils\\/treasureMap['"]`).test(c), `ADR §5: ${n} from the util`);
  }
  assert(/try\s*\{[^}]*localStorage\.getItem\(/.test(c) && /try\s*\{[^}]*localStorage\.setItem\(/.test(c), 'ADR §5: every storage access is wrapped in try/catch (storage may be unavailable)');
  assert(/!\s*(?:listCoord|coord)\b|\b(?:listCoord|coord)\s*(?:\?|&&)/.test(c), 'ADR §5: with no coordinate (not my own list) it keeps the default and never touches storage');
});

test('S8: nothing is written — the items module, the two hooks and the shared rule sign and publish nothing and carry no identity literal; Update list stays disabled', () => {
  for (const f of [ITEMS, VOTES_HOOK, CUTOFF_HOOK, SCORE]) {
    const s = src(f);
    assert(!/\/api\/strfry\/publish|method:\s*['"]POST['"]|signEvent|window\.nostr|publishOrThrow|publishEverywhere|publishToRelays/.test(s), `AC-5: ${rel(f)} writes nothing`);
    assert(!/taPubkey/.test(s) && !/[0-9a-fA-F]{64}/.test(s), `OPEN.md row 188 / CLAUDE.md: ${rel(f)} carries no taPubkey and no 64-hex literal`);
  }
  assert(/<button\b[^>]*\bdisabled\b[^>]*>\s*Update list\s*</.test(src(ITEMS)), 'AC-5: Update list stays disabled (story 5)');
});

/* ── D: the superseded-in-part note (ADR §8) ──────────────── */

test('D1: my-curated-dlists ADR 0003 carries a Status parenthetical and a one-line note citing curated-dlist-update ADR 0004 by short name (the method panel is no longer a placeholder)', () => {
  const s = src(MCD_ADR_3);
  const status = (s.match(/^\*\*Status:\*\*[^\n]*/m) || [''])[0];
  assert(/`curated-dlist-update` ADR 0004/.test(status), `ADR §8: the Status line's parenthetical cites \`curated-dlist-update\` ADR 0004; got ${JSON.stringify(status)}`);
  const note = (s.match(/^> \*\*Superseded in part \(\d{4}-\d{2}-\d{2}\):\*\*[^\n]*`curated-dlist-update` ADR 0004[^\n]*/m) || [''])[0];
  assert(note, 'ADR §8: a one-line "> **Superseded in part (<date>):** … — `curated-dlist-update` ADR 0004" note');
  assert(/method/i.test(note), `ADR §8: the note says what changed — the curation method panel; got ${JSON.stringify(note)}`);
  assert(!/decisions\/curated-dlist-update\/0004/.test(s), 'ADR §8: cited by short name, not by path');
});

/* ── R: sentinels (pass before and after) ──────────────────── */

test('R1: Simple Lists keeps its controls, Ratings Source, cutoff and publish (AC-5)', () => {
  const s = src(SIMPLE); const f = flat(s);
  for (const [text, what] of [['📡 Ratings Source', 'the Ratings Source selector'], ['Local strfry', 'its local option'], ['🔄 Fetch Ratings', 'the fetch button'],
    ['Cutoff Threshold (≥)', 'the cutoff'], ['📜 Generate Trusted List', 'the panel'], ['Include trust scores in tags', 'the scores checkbox'],
    ['Tag Type', 'the tag type'], ['Trust Score Breakdown', 'the breakdown table'], ['Total Trust Score', 'its total']]) {
    assert(f.includes(text), `AC-5: Simple Lists keeps ${what} ("${text}")`);
  }
  assert(/queryRelay\(\s*\{\s*kinds:\s*\[7\],\s*'#e':\s*\[id\]\s*\}\s*\)/.test(s), 'AC-5: local ratings are still read per item');
  assert(/\/api\/reactions\/external\?eventId=/.test(s), 'AC-5: a relay set is still read through /api/reactions/external');
  assert(/seen\.has\(e\.id\)/.test(s), 'AC-5: reactions are still de-duplicated by event id only');
  assert(/const \[cutoff, setCutoff\] = useState\(2\)/.test(s) && /parseFloat\(e\.target\.value\)\s*\|\|\s*0/.test(s) && /step="0\.1"/.test(s),
    'AC-5: the cutoff defaults to 2, parses as parseFloat(v) || 0, step 0.1');
  assert(/\/api\/trusted-list\/publish/.test(s), 'AC-5: its publish is unchanged');
  for (const label of ['👤 implicit +', '👤 implicit + (cancelled)', '👎 author −', '👍 +', '👎 −', '🔹 other']) assert(s.includes(label), `AC-5: the breakdown's "${label}" label`);
});

test('R2: Trust Determination\'s settings are only read — TrustContext and useTrustWeights keep their contract (AC-5)', () => {
  const t = src(TRUST);
  assert(/const STORAGE_KEY = 'tapestry_trust_method'/.test(t), 'AC-5: the selection is still this browser\'s, under tapestry_trust_method');
  for (const [id, label] of [['trusted-assertions-rank', 'Trusted Assertions (rank)'], ['follow-list', 'Follow List'], ['trusted-list', 'Trusted List'], ['trust-everyone', 'Trust Everyone']]) {
    assert(new RegExp(`id:\\s*'${esc(id)}',\\s*label:\\s*'${esc(label)}'`).test(t), `AC-5: SCORING_METHODS keeps ${id} — "${label}"`);
  }
  assert(/export function useTrust\b/.test(t) && /export \{ SCORING_METHODS \}/.test(t) && /export function TrustProvider\b/.test(t), 'AC-5: useTrust, SCORING_METHODS and TrustProvider are still exported');
  const w = src(WEIGHTS_HOOK);
  assert(/export default function useTrustWeights\(pubkeys\)/.test(w), 'ADR §3: useTrustWeights(pubkeys), unchanged');
  assert(/\}, \[pubkeys, povPubkey, scoringMethod, trustedListId\]\);/.test(w), 'ADR §3: its effect is keyed on the pubkeys array (why callers memoize it)');
  assert(/return \{ weights, loading, error, povPubkey, scoringMethod \};/.test(w), 'ADR §3: it returns { weights, loading, error, povPubkey, scoringMethod }');
});

async function run() {
  let pass = 0;
  let fail = 0;
  const failures = [];
  for (const t of tests) {
    try {
      await t.fn();
      pass++;
      console.log(`  ✅ ${t.name}`);
    } catch (e) {
      fail++;
      failures.push({ name: t.name, error: e.message });
      console.log(`  ❌ ${t.name}\n      ${e.message}`);
    }
  }
  console.log(`curated-dlist-update-curation-method: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures, skipped: 0 };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
