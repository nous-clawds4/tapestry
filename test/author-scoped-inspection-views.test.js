/**
 * author-scoped-inspection #2–#4: author-scoped views on Active b-tags.
 *
 * Stories: engineering-team/stories/author-scoped-inspection/2-every-author-on-active-b-tags.md
 *          engineering-team/stories/author-scoped-inspection/3-narrow-by-person-and-by-author-type.md
 *          engineering-team/stories/author-scoped-inspection/4-mark-self-declaration-rows.md
 * ADR:     engineering-team/decisions/author-scoped-inspection/0002-author-scoped-views-on-active-b-tags.md
 *
 *   P1..P8 — the pure scope rules in ui/src/utils/authorScope.js, loaded by dynamic import
 *            (the idiom test/add-node-as-element-restore.test.js:48 uses for ui/src/utils modules).
 *   S1..S10 — structure the ADR's Implementation notes require, read off source. The pages are JSX
 *            and cannot be imported without a transform, so behaviour lives in the Playwright spec;
 *            what S pins is what a browser cannot see — that the two new DataTable/TagDetailPanel
 *            branches are STRICTLY opt-in for the other 24 callers, and that the CSS rules are
 *            ordered deliberately rather than incidentally.
 *   R1..R5 — facts these stories must NOT change. PASS before and after. An R failure means the
 *            change went further than the stories asked.
 *
 * EXPECTED NOW (pre-implementation): P1–P8 and S1–S10 FAIL; R1–R5 PASS.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const UI = path.join(ROOT, 'ui/src');
const SCOPE_JS = path.join(UI, 'utils/authorScope.js');
const B_PAGE = path.join(UI, 'pages/shared-concepts/ActiveBTags.jsx');
const Z_PAGE = path.join(UI, 'pages/shared-concepts/ActiveZTags.jsx');
const DATATABLE = path.join(UI, 'components/DataTable.jsx');
const PANEL = path.join(UI, 'components/TagDetailPanel.jsx');
const AVATAR = path.join(UI, 'components/Avatar.jsx');
const AUTHORCELL = path.join(UI, 'components/AuthorCell.jsx');
const ROSTER_CTX = path.join(UI, 'context/AssistantRosterContext.jsx');
const APP_JSX = path.join(UI, 'App.jsx');
const STYLES = path.join(UI, 'styles.css');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function rel(p) { return path.relative(ROOT, p); }
function src(p) {
  const s = safeRead(p);
  assert(s.length > 0, `${rel(p)} must exist`);
  return s;
}
const flat = (s) => s.replace(/\s+/g, ' ');
function code(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

async function loadEsm(absPath) {
  try { return await import(pathToFileURL(absPath).href); } catch { return null; }
}
let _scope;
async function scope() {
  if (_scope === undefined) _scope = await loadEsm(SCOPE_JS);
  assert(_scope, `ADR 0002 §Implementation: ${rel(SCOPE_JS)} must exist as a pure ESM module (no React, no fetch)`);
  return _scope;
}

// A roster shaped as ADR 0001 defines it.
const OWNER = '1'.repeat(64);
const OWNER_TA = '2'.repeat(64);
const CUST = '3'.repeat(64);
const CUST_TA = '4'.repeat(64);
const ADMIN_NO_TA = '5'.repeat(64);
const STRANGER = '9'.repeat(64);

const ROSTER = [
  { accountPubkey: OWNER, assistantPubkey: OWNER_TA, role: 'owner', displayName: 'Owner' },
  { accountPubkey: CUST, assistantPubkey: CUST_TA, role: 'customer', displayName: 'Customer' },
  { accountPubkey: ADMIN_NO_TA, assistantPubkey: null, role: 'admin', displayName: 'Admin' },
];

// ── P — the pure scope rules ──────────────────────────────────────────────────

test('P1: authorScope exports the four rules the page composes', async () => {
  const m = await scope();
  for (const fn of ['classifyAuthor', 'personPubkeys', 'matchesScope', 'assistantPubkeys']) {
    assert(typeof m[fn] === 'function',
      `ADR 0002 §Implementation: ui/src/utils/authorScope.js must export ${fn}`);
  }
});

test('P2: an assistant this instance controls classifies as assistant', async () => {
  const { classifyAuthor } = await scope();
  for (const pk of [OWNER_TA, CUST_TA]) {
    assert(classifyAuthor(pk, ROSTER) === 'assistant',
      `story 3 AC-5: ${pk.slice(0, 4)}… is an assistant this instance controls and must classify as 'assistant' — got '${classifyAuthor(pk, ROSTER)}'`);
  }
});

test('P3: an account those assistants belong to classifies as person', async () => {
  const { classifyAuthor } = await scope();
  for (const pk of [OWNER, CUST, ADMIN_NO_TA]) {
    assert(classifyAuthor(pk, ROSTER) === 'person',
      `story 3 AC-5: ${pk.slice(0, 4)}… holds an account on this instance and must classify as 'person' — got '${classifyAuthor(pk, ROSTER)}'. An admin with no assistant provisioned is still a person.`);
  }
});

test('P4: anybody else classifies as external', async () => {
  const { classifyAuthor } = await scope();
  assert(classifyAuthor(STRANGER, ROSTER) === 'external',
    "story 3 AC-5: an author this instance neither controls nor hosts must classify as 'external' — this is the class that makes federation evidence findable");
  assert(classifyAuthor(STRANGER, []) === 'external',
    'an empty roster must not turn everyone into a person — with nothing known, every author is external');
});

test('P5: a person carries their own account and their assistant', async () => {
  const { personPubkeys } = await scope();
  const pair = personPubkeys(ROSTER, OWNER);
  assert(Array.isArray(pair) && pair.includes(OWNER) && pair.includes(OWNER_TA) && pair.length === 2,
    `story 3 AC-1: selecting a person must match BOTH their account and their assistant — got ${JSON.stringify(pair)}`);
});

test('P6: a person with no assistant carries only their account', async () => {
  const { personPubkeys } = await scope();
  const pair = personPubkeys(ROSTER, ADMIN_NO_TA);
  assert(Array.isArray(pair) && pair.length === 1 && pair[0] === ADMIN_NO_TA,
    `story 3 AC-3: an account with no assistant provisioned must contribute only itself — a null assistant must never become a matchable author — got ${JSON.stringify(pair)}`);
});

test('P7: the two selectors compose by intersection, and their no-op values are no-ops', async () => {
  const { matchesScope } = await scope();
  const all = { person: null, authorType: 'anyone' };
  for (const pk of [OWNER, OWNER_TA, CUST, STRANGER]) {
    assert(matchesScope(pk, all, ROSTER) === true,
      `story 3 AC-4: person:null + authorType:'anyone' must apply no narrowing at all — ${pk.slice(0, 4)}… was excluded`);
  }
  assert(matchesScope(OWNER_TA, { person: OWNER, authorType: 'assistants' }, ROSTER) === true,
    "story 3 §Vocabulary: Mine + Assistants is 'just what my assistant filed' — the owner's assistant must match");
  assert(matchesScope(OWNER, { person: OWNER, authorType: 'assistants' }, ROSTER) === false,
    "story 3 §Vocabulary: Mine + Assistants must EXCLUDE the person's own account-signed events");
  assert(matchesScope(OWNER, { person: OWNER, authorType: 'people' }, ROSTER) === true,
    "story 3 §Vocabulary: Mine + People is 'just what I signed myself'");
  assert(matchesScope(OWNER_TA, { person: OWNER, authorType: 'people' }, ROSTER) === false,
    'story 3 §Vocabulary: Mine + People must exclude the assistant');
  assert(matchesScope(STRANGER, { person: null, authorType: 'everyone-else' }, ROSTER) === true,
    'story 3 §Vocabulary: Everyone + Everyone else is everything that came from outside this instance');
  assert(matchesScope(OWNER_TA, { person: null, authorType: 'everyone-else' }, ROSTER) === false,
    "story 3 AC-5: 'everyone else' must exclude assistants this instance controls");
});

test('P8: an impossible combination matches nothing rather than silently widening', async () => {
  const { matchesScope } = await scope();
  for (const pk of [OWNER, OWNER_TA, CUST, CUST_TA, STRANGER]) {
    assert(matchesScope(pk, { person: OWNER, authorType: 'everyone-else' }, ROSTER) === false,
      `story 3 AC-6: one person + 'everyone else' selects nothing — it must return false for every author, never fall back to an unfiltered view (${pk.slice(0, 4)}… matched)`);
  }
});

// ── S — structure the ADR requires ────────────────────────────────────────────

test('S1: Active b-tags no longer narrows the scan to one author', () => {
  const s = flat(code(src(B_PAGE)));
  const call = s.match(/queryRelay\(\{[^}]*\}\)/);
  assert(call, 'ActiveBTags must still call queryRelay with an object filter');
  assert(!/authors\s*:/.test(call[0]),
    `story 2 AC-1 / ADR 0002 §Context fact 1: the scan must drop its authors filter so every b-tag event the relay holds is listed — still found ${call[0]}`);
  assert(/kinds\s*:/.test(call[0]),
    'story 2 §Out of scope: the kind bound stays — only the author narrowing goes');
});

test('S2: the page no longer waits on the owner assistant before it can render', () => {
  const s = flat(code(src(B_PAGE)));
  assert(!/if\s*\(\s*!taPubkey\s*\)\s*return/.test(s),
    'ADR 0002 §Implementation: the `if (!taPubkey) return` guard goes with the authors filter — the page must render without resolving the owner assistant first (story 3 AC-2 renders signed out)');
});

test('S3: self-declaration is decided by the shared b-value rule, not an inline comparison', () => {
  const s = flat(code(src(B_PAGE)));
  assert(/dispositionOf/.test(s),
    'ADR 0002 §Context fact 2: story 4 must decide self-declaration with dispositionOf from ui/src/utils/bDisposition.js — the rule already has one home and must not be re-derived inline');
  assert(/selfDeclared/.test(s),
    'ADR 0002 §Implementation: the row must carry selfDeclared');
});

test('S4: the table gains an author column for the LOCAL event, distinguishable from the shared one', () => {
  const s = flat(code(src(B_PAGE)));
  assert(/author \(local\)/.test(s),
    "story 2 AC-2: the table needs an 'author (local)' column naming who signed the event that carries the b-tag");
  assert(/author \(shared\)/.test(s),
    "story 2 AC-2: the existing 'author (shared)' column must stay, labelled so the two cannot be confused");
  const local = s.indexOf('author (local)');
  const sharedName = s.indexOf("'name (shared)'") >= 0 ? s.indexOf("'name (shared)'") : s.indexOf('name (shared)');
  assert(local >= 0 && sharedName >= 0 && local < sharedName,
    "ADR 0002 §Implementation: 'author (local)' is inserted BEFORE 'name (shared)', so the local pair reads together");
});

test('S5: the page description no longer claims the list is locally-authored', () => {
  const s = flat(src(B_PAGE));
  assert(!/locally-authored/.test(s),
    'story 2 AC-4: the subtitle still says "locally-authored nostr events" — it is no longer true and must be rewritten');
});

test('S6: DataTable gains rowClassName and it is strictly opt-in', () => {
  const s = src(DATATABLE);
  const c = flat(code(s));
  assert(/rowClassName/.test(c),
    'ADR 0002 §Implementation: DataTable must accept an optional rowClassName(row) prop');
  assert(/rowClassName\s*[,}=)]/.test(c) && /function DataTable\(\{[^}]*rowClassName/.test(c),
    'ADR 0002 §Implementation: rowClassName belongs in the destructured props, like filterKeys and renderExpanded');
  assert(!/function DataTable\(\{[^}]*rowClassName\s*=\s*[^,}]*[,}]/.test(c) || /rowClassName\s*[,}]/.test(c),
    'rowClassName must default to undefined, not to a function that changes output for existing callers');
  // Strict opt-in: the class expression must still yield today's value when the prop is absent.
  assert(/rowClassName\?\.|rowClassName\s*&&|rowClassName\s*\?/.test(c),
    'ADR 0002 §Decision: omit the prop and the rendered class must be byte-identical for the other 24 callers — guard the call');
  assert(/clickable/.test(c),
    "R: the existing 'clickable' class must survive alongside the new one");
  assert(/rowClassName/.test(s.slice(0, s.indexOf('export default'))),
    'ADR 0002 §Implementation: document rowClassName in the JSDoc block alongside filterKeys and renderExpanded');
});

test('S7: TagDetailPanel gains an optional note rendered beside the copy control', () => {
  const c = flat(code(src(PANEL)));
  assert(/\bnote\b/.test(c),
    'ADR 0002 §Implementation: TagDetailPanel must accept an optional `note` prop');
  assert(/TagDetailPanel\(\{[^}]*\bnote\b/.test(c),
    'ADR 0002 §Implementation: `note` belongs in the destructured props');
  const copyAt = c.indexOf('CopyButton');
  const noteAt = c.lastIndexOf('note');
  assert(copyAt >= 0 && noteAt > copyAt,
    'story 4 AC-3: the note renders immediately to the RIGHT of the control that copies the b-tag — after <CopyButton> in the same flex row');
});

test('S8: the self-declaration row rules are ordered after the hover rule, deliberately', () => {
  const s = src(STYLES);
  const hoverAt = s.indexOf('.data-table tbody tr:hover');
  const restAt = s.indexOf('.data-table tbody tr.row-self-declared {');
  const hoverRuleAt = s.indexOf('.data-table tbody tr.row-self-declared:hover');
  assert(hoverAt >= 0, 'the base .data-table tbody tr:hover rule must still exist');
  assert(restAt > hoverAt,
    'ADR 0002 §Implementation / story 4 AC-5: .row-self-declared must be defined AFTER .data-table tbody tr:hover, or the hover background silently wins and the mark disappears under the pointer');
  assert(hoverRuleAt > hoverAt,
    'story 4 AC-5: a .row-self-declared:hover rule is required — without it the row keeps its tint but loses the table\'s hover feedback');
  for (const v of ['--row-self-declared', '--row-self-declared-hover']) {
    assert(s.includes(v), `ADR 0002 §Implementation: ${v} must be defined in :root beside the existing palette`);
  }
  assert(/\.row-self-declared\s+td:first-child\s*\{[^}]*inset/.test(flat(s)),
    'ADR 0002 §Implementation: an inset left rule on the first cell, which hover cannot touch (a <tr> border does not render under border-collapse: collapse)');
});

test('S9: the roster reaches Avatar and AuthorCell through a context, not through props', () => {
  assert(fs.existsSync(ROSTER_CTX),
    `ADR 0002 §Implementation: ${rel(ROSTER_CTX)} must exist — Avatar sits three levels inside DataTable's render, which is why this is a context and not prop-threading (Option C, rejected)`);
  const app = flat(code(src(APP_JSX)));
  assert(/AssistantRosterProvider/.test(app),
    'ADR 0002 §Implementation: mount AssistantRosterProvider in ui/src/App.jsx, inside AuthProvider');
  const av = flat(code(src(AVATAR)));
  assert(/useAssistantRoster/.test(av),
    "ADR 0002 §Context fact 5: Avatar's badge must widen from 'is the owner's TA' to 'is an assistant this instance controls' — otherwise exactly one assistant in the column is badged and the rest read as ordinary users");
  assert(/taPubkey/.test(av),
    "ADR 0002 §Implementation: keep the taPubkey fast path so the owner's assistant is still badged before the roster resolves");
  const ac = flat(code(src(AUTHORCELL)));
  assert(/useAssistantRoster/.test(ac),
    "ADR 0002 §Implementation: AuthorCell's unnamed fallback must read 'Tapestry Assistant' for any roster assistant, not only the owner's");
});

test('S10: the panel note reads "self-declaration", and the rejected wording appears nowhere', () => {
  const b = src(B_PAGE);
  assert(/\*\s*self-declaration/.test(b),
    'story 4 AC-3: the note must read exactly "* self-declaration" (the term carriesSelfPointer and Community Offerings already use)');
  for (const p of [B_PAGE, PANEL, DATATABLE, STYLES]) {
    assert(!/self-referencing/.test(safeRead(p)),
      `ADR 0002 §Decision: "* self-referencing" was an earlier draft's wording, corrected by the owner at the story gate — it must not appear in ${rel(p)}`);
  }
});

// ── R — sentinels (pass before AND after) ─────────────────────────────────────

test('R1: the b-tag-deferred sentinel is still skipped at row-build time', () => {
  const s = flat(code(src(B_PAGE)));
  assert(/SENTINEL/.test(s) && /from\s+['"][^'"]*utils\/bDisposition['"]/.test(s),
    'story 2 AC-3: widening the author set changes nothing about which b values count — ActiveBTags must keep importing SENTINEL from utils/bDisposition');
  assert(/!==\s*SENTINEL/.test(s),
    'story 2 AC-3: the row-build loop must keep skipping the reserved sentinel (ADR shared-concepts-adoption/0001)');
});

test('R2: Active b-tags still makes exactly one local scan', () => {
  const n = (code(src(B_PAGE)).match(/queryRelay\(/g) || []).length;
  assert(n === 1,
    `ADR 0002 §Decision: the narrowing is a VIEW over one fetch — Option B (refetch per selection) was rejected, so ActiveBTags must still make exactly 1 queryRelay call, found ${n}`);
});

test('R3: the community-relay target lookup is untouched', () => {
  const s = flat(code(src(B_PAGE)));
  assert(/COMMUNITY_RELAYS/.test(s) && /fetchFromRelays/.test(s),
    'story 2 §Out of scope: the b-tag target lookup that fills name (shared) / author (shared) must be unchanged');
  assert(/A_TAG_RE/.test(s) && /EVENT_ID_RE/.test(s),
    'ADR 0002 §Context fact 6: the two merged filters (a-tag coordinates, event ids) stay as they are');
});

test('R4: Active z-tags is not touched by this book', () => {
  const s = flat(code(src(Z_PAGE)));
  assert(!/authorScope|useAssistantRoster|row-self-declared/.test(s),
    'epic §Out of scope: Active z-tags adopts the new props in a later book — it must not change here');
  assert(/showSelfFiled/.test(s),
    "R: ActiveZTags' self-filed toggle must be untouched");
});

test('R5: the private-key accessor keeps its shape for the signing paths', () => {
  const s = code(safeRead(path.join(ROOT, 'src/utils/assistantKeys.js')));
  assert(/getAssistantKeys/.test(s) && /getOwnerAssistantKeys/.test(s) && /getOwnerAssistantPubkey/.test(s),
    'ADR 0001 §Consequences: the new narrowed sibling is ADDITIVE — getAssistantKeys, getOwnerAssistantKeys and getOwnerAssistantPubkey keep their signatures and their existing signing call sites');
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
  console.log(`author-scoped-inspection-views: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures, skipped: 0 };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
