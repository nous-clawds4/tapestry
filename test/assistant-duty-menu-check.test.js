'use strict';
/**
 * assistant-duty-menu #1: the Duty Menu check — what this instance offers for your Assistant, the menu found for it,
 * whether the two match — and the hub's real mark for the Duty Menu card.
 *
 * Story: engineering-team/stories/assistant-duty-menu/1-the-duty-menu-page-and-its-check.md
 * ADR:   engineering-team/decisions/assistant-duty-menu/0001-a-duty-menu-check-beside-the-others.md
 * Plan:  engineering-team/stories/assistant-duty-menu/1-the-duty-menu-page-and-its-check.test-plan.md
 * Spec:  protocols/drafts/duty-menus.md §§ 4, 5, 6.1, 8.1 (read-only).
 * Page half: test/assistant-duty-menu-page.test.js. Browser half: tests/brainstorm/assistant-duty-menu.spec.js.
 * Words, constants and canned answers: test/helpers/dutyMenuFixtures.js.
 *
 * Classes (all stack-free):
 *   L — the pure library src/lib/duty-menu (CommonJS, no I/O) and src/lib/nous.js: the constants, isDutyMenu (§ 6.1),
 *       readMenuRows (§ 5), normalizeMenuKey (agreeing with the Treasure Map rule's entryOf), sameRows, buildOffer (K1).
 *                                                                                                [AC-2, AC-3, AC-4]
 *   U — src/api/assistant/attention.js + dutyMenu.js driven through the dependencies ADR 0001's Implementation notes
 *       name (scanLocal, readRelay, getConfigFromFile, readConfiguredRelays, getConfiguredPublishRelays,
 *       mapDefaultRelays, isPublicRelayHostWithin, getCustomer, now; checkDutyMenu on the handler). The real
 *       outsideOnly, lookupNewest, treasureMapRelays, lookupNewestReplaceable and isPublicHost run over those fakes.
 *                                                                                                [AC-1 … AC-4, AC-6]
 *   C — the pure ESM module ui/src/pages/assistant/actions.js, loaded in Node: the entry, CHECKED_ACTIONS, the two
 *       readings, the Done list and the counts; the Treasure Map card stays a placeholder.            [AC-4]
 *   S — source sentinels on the server: read-only, session-only, the Nous key defined once, the wiring documented.
 *                                                                                                [AC-1, AC-6]
 *
 * Everything FAILS against the current code: src/lib/duty-menu, src/lib/nous.js and src/api/assistant/dutyMenu.js do
 * not exist, the attention answer has no duty-menu key, and the Duty Menu card is an always-marked placeholder.
 *
 * ADR 0001 Amendment 1 (2026-10-11) settled the plan's open points; pinned here by L5/L6 (relays that don't normalize,
 * a not-offered row's null relay, naddr in a segment), L11 and U29 (every offer relay in its one spelling), U28 and S5
 * (local-only through the isLocalOnly seam), U30 (null relay in the answer) and S4 (openapi.yaml and BIBLE §11).
 *
 * ADR 0001 Amendment 2 (2026-10-11, before Review): the fifth § 6.1 condition (L12, U31) and at most 50 relays named
 * inside events per check (U32). The page's new none line is pinned in test/assistant-duty-menu-page.test.js (P6).
 *
 * Story 2 (assistant-duty-menu #2, ADR 0002): buildMenuTags (L13); the read is local first (AC-5, sub-decision 7):
 * U33–U35, and the lookup returns `latest` (U36) while the answer's shape stays U3's; the write-relay helpers the
 * publisher shares, with one Nous cache (U37). Re-aimed to AC-5: U15, U16, U17, U19, U20 and U31 now keep the menu off
 * this instance's relay wherever they test outside reads, so they test what they did. The route is
 * test/assistant-duty-menu-publish.test.js.
 *
 * duty-menu-public-relay #1 (Light Bug lane; the story's Design note): this instance's public relay is derived from
 * STRFRY_DOMAIN when BRAINSTORM_RELAY_URL is Docker's container-internal ws://localhost:7777 (docker/entrypoint.sh).
 * U38 (AC-1), U39 (AC-2), U40 (AC-3), U41 (AC-4).
 *
 * assistant-duties-settings #1 (ADR assistant-duties-settings/0001) re-aims the offer. It is the instance's Assistant
 * Duties list, read through a readAssistantDuties dependency (DM.DEFAULT_DUTIES unless a test says otherwise), in list
 * order, the same for every Assistant: there is no Scores condition and no customer lookup (sub-decision 3). "Current"
 * counts order (sub-decision 5). Re-aimed: offerAt/offerDiff (ordered), L8, L9, L10, L11, U6, U7, U8, U11, U23, U24.
 * The new behaviour itself is test/assistant-duties-settings.test.js.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const DM = require('./helpers/dutyMenuFixtures');
const DC = require('./helpers/dutyCardsFixtures');
const CS = require('./helpers/comingSoonFixtures');
const SM = require('./helpers/selfMapFixtures');

const REPO = path.resolve(__dirname, '..');
const LIB = path.join(REPO, 'src/lib/duty-menu/index.js');
const NOUS_MOD = path.join(REPO, 'src/lib/nous.js');
const RULE = path.join(REPO, 'src/lib/treasureMapCategories.mjs');
const ATTENTION_MODULE = path.join(REPO, 'src/api/assistant/attention.js');
const DUTY_MODULE = path.join(REPO, 'src/api/assistant/dutyMenu.js');
const ACTIONS_MOD = path.join(REPO, 'ui/src/pages/assistant/actions.js');
const NL = String.fromCharCode(10);

// Fixture keys, never live ones. NOUS is the community constant (duty-menus.md § 2), not a per-deployment key.
const VIEWER = 'e1'.repeat(32);
const ASSISTANT = 'e2'.repeat(32);
const OTHER = 'e3'.repeat(32);
const STRANGER = 'e4'.repeat(32);
const OWNER = '0b'.repeat(32);
const NOUS = DM.NOUS_PUBKEY;
const HEX = 'ab'.repeat(32);

// This instance's relay, as configured and in its one spelling (ADR 0001 sub-decision 2).
const OWN_CONFIGURED = 'wss://Tapestry.Example/relay/';
const OWN = DM.OWN;
const OWN_DOMAIN = 'tapestry.example';
// Outside relays, by where the check learns of them.
const PUB1 = 'wss://pub-one.example';            // the profile publish set (configured): where the 10002s are read
const MAPR = 'wss://maps.example';               // the server's Map relays (configured): where the Map is read
const HINT = 'wss://hint.example';               // the viewer's Map names it for the Assistant
const HINT2 = 'wss://hint-two.example';           // ditto
const OTHER_HINT = 'wss://other-hint.example';   // the viewer's Map names it for another Assistant
const A_WRITE = 'wss://a-write.example';         // the Assistant's 10002, no marker
const A_WRITE2 = 'wss://a-write-two.example';    // the Assistant's 10002, write
const A_READ = 'wss://a-read.example';           // the Assistant's 10002, read only
const NOUS_WRITE = 'wss://nous-write.example';   // Nous' 10002, write
const NOUS_READ = 'wss://nous-read.example';     // Nous' 10002, read only
const REFUSED_HINT = 'wss://refused-hint.example';
const REFUSED_A = 'wss://refused-write.example';
const REFUSED_NOUS = 'wss://refused-nous.example';
const REFUSED_HOSTS = ['refused-hint.example', 'refused-write.example', 'refused-nous.example'];
// Relay Settings' DList list: a private IP, a private-by-construction name, then the first public one.
const DLIST = 'wss://dlist.example';
const DLIST_SETTINGS = ['ws://10.0.0.5:7777', 'wss://box.local', DLIST];

const T0 = 1_760_000_000_000;

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);
const lc = (s) => String(s || '').toLowerCase();
const normUrl = (u) => String(u || '').trim().toLowerCase().replace(/\/+$/, '');

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {});
  return v;
}
const sameJson = (a, b) => show(sortKeys(a)) === show(sortKeys(b));

/** Source with comments removed (block comments become blank lines, so line numbers stay true). */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .split(NL)
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}

/** A set of rows as sorted `tag|key|relay` strings: the oracle's own order-blind comparison (AC-4). */
const rowSet = (rows) => (Array.isArray(rows) ? rows : []).map((r) => `${r && r.tag}|${r && r.key}|${r && r.tag === 'duty' ? r.relay : ''}`).sort();
const sameRowSet = (a, b) => show(rowSet(a)) === show(rowSet(b));
/** A row as read: tag, key and relay — a not-offered row's relay is null (ADR 0001 Amendment 1 item 5). */
const rowView = (rows) => (Array.isArray(rows) ? rows : []).map((r) => ({ tag: r && r.tag, key: r && r.key, relay: r ? r.relay : undefined }));

/* ───────────────────────── fixtures: events ───────────────────────── */

let idSeq = 0;
const hexId = (n) => n.toString(16).padStart(64, '0');
function ev(kind, pubkey, createdAt, tags, id) {
  idSeq += 1;
  return { id: id || hexId(4096 + idSeq), pubkey, kind, created_at: createdAt, tags, content: '', sig: '0'.repeat(128) };
}
const mapEv = (tags, createdAt = 500, author = VIEWER) => ev(DM.TREASURE_MAP_KIND, author, createdAt, tags);
const relayListEv = (author, rTags, createdAt = 400) => ev(DM.RELAY_LIST_KIND, author, createdAt, rTags);
/** A Duty Menu (duty-menus.md § 4); every part can be bent to fail one § 6.1 condition. */
function menuEv({ author = ASSISTANT, createdAt = 1000, rows = [], extra = [], d = DM.DUTY_MENU_D, p, z = [DM.DUTY_MENU_HEADER], kind = DM.DUTY_MENU_KIND, id } = {}) {
  const tags = [];
  if (d !== null) tags.push(['d', d]);
  for (const v of z) tags.push(['z', v]);
  for (const v of (p === undefined ? [author] : p)) tags.push(['p', v]);
  for (const r of rows) tags.push(Array.isArray(r) ? r.slice() : (r.tag === 'duty' ? ['duty', r.key, r.relay] : ['not-offered', r.key]));
  for (const t of extra) tags.push(t.slice());
  return ev(kind, author, createdAt, tags, id);
}
const dTagOf = (e) => ((e.tags || []).find((t) => t[0] === 'd') || [])[1];
function matching(events, filter) {
  const kinds = Array.isArray(filter && filter.kinds) ? filter.kinds : null;
  const authors = Array.isArray(filter && filter.authors) ? filter.authors.map(lc) : null;
  const ds = Array.isArray(filter && filter['#d']) ? filter['#d'] : null;
  return events.filter((e) => (!kinds || kinds.includes(e.kind)) && (!authors || authors.includes(lc(e.pubkey))) && (!ds || ds.includes(dTagOf(e))));
}
const isMenuFilter = (f) => Array.isArray(f && f.kinds) && f.kinds.includes(DM.DUTY_MENU_KIND) && Array.isArray(f['#d']) && f['#d'].includes(DM.DUTY_MENU_D);
const isNousListFilter = (f) => Array.isArray(f && f.kinds) && f.kinds.includes(DM.RELAY_LIST_KIND) && Array.isArray(f.authors) && f.authors.map(lc).includes(NOUS);
const isMapFilter = (f) => Array.isArray(f && f.kinds) && f.kinds.includes(DM.TREASURE_MAP_KIND);

/** The viewer's Map, the Assistant's relay list and Nous' relay list, all on this instance's relay. */
function baseLocal({ map = true, assistantList = true, nousList = true } = {}) {
  const out = [];
  if (map) out.push(mapEv([['30382:rank', ASSISTANT, HINT], ['39998', ASSISTANT, HINT2], ['3039x', OTHER, OTHER_HINT], ['30382:followers', ASSISTANT, REFUSED_HINT]]));
  if (assistantList) out.push(relayListEv(ASSISTANT, [['r', A_WRITE], ['r', A_WRITE2, 'write'], ['r', A_READ, 'read'], ['r', REFUSED_A]]));
  if (nousList) out.push(relayListEv(NOUS, [['r', NOUS_WRITE, 'write'], ['r', NOUS_READ, 'read'], ['r', REFUSED_NOUS, 'write']]));
  return out;
}
/** Every outside relay answers, with nothing. */
const quietRelays = () => Object.fromEntries([PUB1, MAPR, HINT, HINT2, OTHER_HINT, A_WRITE, A_WRITE2, A_READ, NOUS_WRITE, NOUS_READ, DLIST].map((u) => [u, []]));

const BASE_CONFIG = { BRAINSTORM_RELAY_URL: OWN_CONFIGURED, STRFRY_DOMAIN: OWN_DOMAIN, BRAINSTORM_OWNER_PUBKEY: OWNER, BRAINSTORM_PUBLISH_LOCAL_ONLY: 'false' };

/* ───────────────────────── the modules under test ───────────────────────── */

function load(abs, what) {
  if (!fs.existsSync(abs)) throw new Error(`${rel(abs)} does not exist. ${what}`);
  delete require.cache[require.resolve(abs)];
  return require(abs);
}
const libModule = () => load(LIB, 'ADR 0001 sub-decision 1 creates it: the pure Duty Menu library (DUTY_MENU_KIND, DUTY_MENU_D, DUTY_MENU_HEADER, isDutyMenu, readMenuRows, normalizeMenuKey, sameRows, buildOffer).');
const nousModule = () => load(NOUS_MOD, 'ADR 0001 sub-decision 1 creates it: the one definition of Nous\' key, NOUS_PUBKEY.');
function need(mod, name, file) {
  assert(typeof mod[name] === 'function', `${file} must export ${name}() (ADR 0001 sub-decision 1 / § Implementation notes).`);
  return mod[name];
}

/**
 * The handler, with attention.js and dutyMenu.js loaded afresh: dutyMenu.js holds the Nous cache at module level
 * (ADR 0001 § Implementation notes), so a fresh load starts each test with an empty cache. A session reuses one load.
 */
function freshModules() {
  if (!fs.existsSync(DUTY_MODULE)) {
    throw new Error(`${rel(DUTY_MODULE)} does not exist. ADR 0001 § Implementation notes creates it: checkDutyMenu, resolveOfferInputs, lookupPublishedMenu, evaluateDutyMenu, DUTY_MENU_CHECK_FAILED.`);
  }
  for (const p of [ATTENTION_MODULE, DUTY_MODULE]) delete require.cache[require.resolve(p)];
  const attention = require(ATTENTION_MODULE);
  const duty = require(DUTY_MODULE);
  need(duty, 'checkDutyMenu', rel(DUTY_MODULE));
  return { handle: need(attention, 'handleAssistantAttention', rel(ATTENTION_MODULE)), duty };
}

function hostOf(x) {
  const s = String(x || '');
  try { return new URL(s.includes('://') ? s : `wss://${s}`).hostname.toLowerCase().replace(/^\[|\]$/g, ''); } catch { return lc(s); }
}

/**
 * The injected dependencies, under the names ADR 0001 gives them. Every one RECORDS its calls.
 *   assistant  — getAssistantPubkeyFor's answer: default ASSISTANT; null = no assistant here.
 *   local      — the events this instance's relay holds (default baseLocal()), or 'reject'.
 *   rejectScan — (filter) => true to make that one local scan fail.
 *   relays     — { [url]: events | 'unreachable' | 'hang' | { raw: events } }; an unlisted relay is unreachable.
 *                Keyed by the relay's lower-cased spelling without a trailing slash.
 *   config     — getConfigFromFile's values over BASE_CONFIG. settings — readConfiguredRelays' lists by category.
 *   customer   — getCustomer's answer: null (not a customer), { status }, or 'throw'. Since assistant-duties-settings #1
 *                the offer never asks it; it stays so a test can show that.
 *   duties     — readAssistantDuties' answer (default DM.DEFAULT_DUTIES), or (n) => the answer at its n-th call.
 *   refused    — hosts isPublicRelayHostWithin refuses. clock — { t }: what now() answers.
 *   localOnly  — local-only publish mode, set every way the server may read it (see answer()).
 *   localOnlySeam — overrides only the isLocalOnly seam, so the seam can disagree with env and config (Amendment 1 item 2).
 *   checkDutyMenu — replaces the check on the handler (a spy, or a throw).
 */
function fakes(opts = {}) {
  const calls = { scanLocal: [], readRelay: [], guard: [], getCustomer: [], checkDutyMenu: [], readAssistantDuties: 0 };
  const local = opts.local !== undefined ? opts.local : baseLocal();
  const rawRelays = opts.relays !== undefined ? opts.relays : quietRelays();
  const relays = Object.fromEntries(Object.entries(rawRelays).map(([u, v]) => [normUrl(u), v]));
  const config = { ...BASE_CONFIG, BRAINSTORM_PUBLISH_LOCAL_ONLY: opts.localOnly ? 'true' : 'false', ...(opts.config || {}) };
  const settings = opts.settings || { aDListRelays: DLIST_SETTINGS };
  const refused = new Set(opts.refused || REFUSED_HOSTS);
  const clock = opts.clock || { t: T0 };
  const deps = {
    getAssistantPubkeyFor: async () => (opts.assistant === undefined ? ASSISTANT : opts.assistant),
    scanLocal: async (filter) => {
      calls.scanLocal.push(filter);
      if (local === 'reject' || (typeof opts.rejectScan === 'function' && opts.rejectScan(filter))) throw new Error('fixture: strfry scan failed');
      return matching(local, filter);
    },
    readRelay: async (url, filter) => {
      calls.readRelay.push({ url: normUrl(url), filter });
      const held = relays[normUrl(url)];
      if (held === 'hang') return new Promise(() => {});
      if (held && Array.isArray(held.raw)) return { status: 'ok', events: held.raw.slice(), error: null };
      if (!Array.isArray(held)) return { status: 'unreachable', events: [], error: 'fixture: unreachable' };
      return { status: 'ok', events: matching(held, filter), error: null };
    },
    getConfigFromFile: (key, dflt) => (Object.prototype.hasOwnProperty.call(config, key) ? config[key] : dflt),
    readConfiguredRelays: (categories) => (Array.isArray(categories) ? categories : []).flatMap((c) => settings[c] || []),
    getConfiguredPublishRelays: () => (opts.publish || [PUB1, OWN_CONFIGURED]).slice(),
    mapDefaultRelays: () => (opts.mapRelays || [MAPR, OWN_CONFIGURED]).slice(),
    isPublicRelayHostWithin: async (hostOrUrl) => { const host = hostOf(hostOrUrl); calls.guard.push(host); return !refused.has(host); },
    getCustomer: async (pubkey) => {
      calls.getCustomer.push(pubkey);
      if (opts.customer === 'throw') throw new Error('fixture: the customer store exploded');
      return opts.customer || null;
    },
    now: () => clock.t,
    // assistant-duties-settings #1 (ADR 0001 sub-decision 3): the Assistant Duties list, as getSettings() would answer
    // it. A copy each time, so nothing the server does to it can bend the fixture. `duties` may be a function of the
    // call count, to change the list between two answers of one running server.
    readAssistantDuties: () => {
      calls.readAssistantDuties += 1;
      const raw = typeof opts.duties === 'function' ? opts.duties(calls.readAssistantDuties) : (opts.duties !== undefined ? opts.duties : DM.DEFAULT_DUTIES);
      return raw === undefined ? undefined : JSON.parse(JSON.stringify(raw));
    },
    isLocalOnly: () => (opts.localOnlySeam !== undefined ? Boolean(opts.localOnlySeam) : Boolean(opts.localOnly)),
    // The other checks, stubbed: this suite is about the Duty Menu (the other suites drive the real ones).
    checkOutboxRelays: async () => ({ finished: true, done: true, pending: false, reason: null, source: 'local', createdAt: 1, outbox: ['wss://fixture.example'], inboxOnlyCount: 0, suggestions: [] }),
    checkProfile: async () => ({ finished: true, done: true, pending: false, items: [] }),
    checkTrustedContent: async () => ({}),
    // Re-aimed by assistant-self-map #1 (ADR 0001 sub-decision 8): the self-Map check joins the answer; stubbed so this
    // suite's reads stay the Duty Menu's (test/assistant-self-map-check.test.js drives the real one).
    checkSelfMap: async () => SM.ANSWERS.DONE,
  };
  if (opts.checkDutyMenu) {
    deps.checkDutyMenu = async (input, d) => { calls.checkDutyMenu.push(input); return opts.checkDutyMenu(input, d); };
  }
  return { deps, calls };
}
function fakeRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}
const signedInReq = (pubkey = VIEWER, extra = {}) => ({ session: { authenticated: true, pubkey }, query: {}, ...extra });

/**
 * One GET /api/assistant/attention. Local-only publish mode is set in the config, on isLocalOnly and in
 * process.env.BRAINSTORM_PUBLISH_LOCAL_ONLY (restored after): the ADR names no seam for it, so whichever way the server
 * reads it, it reads the fixture's value.
 */
async function answer(opts = {}, req = signedInReq(), session = null) {
  const { handle } = session || freshModules();
  const { deps, calls } = fakes(opts);
  const res = fakeRes();
  const had = Object.prototype.hasOwnProperty.call(process.env, 'BRAINSTORM_PUBLISH_LOCAL_ONLY');
  const before = process.env.BRAINSTORM_PUBLISH_LOCAL_ONLY;
  process.env.BRAINSTORM_PUBLISH_LOCAL_ONLY = opts.localOnly ? 'true' : 'false';
  const log = console.error; const warn = console.warn;
  if (opts.quiet) { console.error = () => {}; console.warn = () => {}; }
  try {
    await handle(req, res, deps);
  } finally {
    console.error = log; console.warn = warn;
    if (had) process.env.BRAINSTORM_PUBLISH_LOCAL_ONLY = before; else delete process.env.BRAINSTORM_PUBLISH_LOCAL_ONLY;
  }
  const action = res.body && res.body.actions ? res.body.actions[DM.KEY] : undefined;
  return {
    res, body: res.body, action, calls,
    menuScans: calls.scanLocal.filter(isMenuFilter),
    menuReads: calls.readRelay.filter((c) => isMenuFilter(c.filter)),
    nousLookups: calls.scanLocal.filter(isNousListFilter).length + calls.readRelay.filter((c) => isNousListFilter(c.filter)).length,
  };
}
const readUrls = (got) => got.menuReads.map((c) => c.url);
const offerOf = (got) => (got.action && Array.isArray(got.action.offer) ? got.action.offer : null);

async function within(promise, ms) {
  let timer;
  const hung = new Promise((resolve) => { timer = setTimeout(() => resolve('HUNG'), ms); });
  try { return await Promise.race([promise, hung]); } finally { clearTimeout(timer); }
}

async function esm(absPath, what) {
  assert(fs.existsSync(absPath), `${rel(absPath)} does not exist. ${what}`);
  try { return await import(pathToFileURL(absPath).href); } catch (err) { throw new Error(`${rel(absPath)} must load in Node as ESM: ${err.message}`); }
}
const actionsModule = () => esm(ACTIONS_MOD, 'It holds ASSISTANT_ACTIONS, CHECKED_ACTIONS and assistantAttention.');
const ruleModule = () => esm(RULE, 'It is the Treasure Map\'s category rule (entryOf, appliesTo).');

/** The offer's oracle for this suite's default world (ADR assistant-duties-settings/0001 sub-decision 3; R1). */
const offerAt = (ownRelay, { dlistRelay = null, duties } = {}) => DM.expectedOffer({ ownRelay, dlistRelay, ...(duties ? { duties } : {}) });
/** Report an offer against the oracle, in order: the offer is the list's order (ADR assistant-duties-settings/0001). */
function offerDiff(label, got, want) {
  if (!Array.isArray(got)) return [`${label}: no offer array, got ${show(got)}`];
  return show(rowView(got)) === show(rowView(want)) ? [] : [`${label}: want ${show(want)}, got ${show(got)}`];
}

/* ───────────────────────── L — the library ───────────────────────── */

test('L1: the library exists, is CommonJS with no I/O, and exports the constants and the five functions; DUTY_MENU_KIND 39999, DUTY_MENU_D "duty-menu", DUTY_MENU_HEADER "39998:<Nous>:duty-menu" (ADR 0001 sub-decision 1; duty-menus.md §§ 3–4)', () => {
  const lib = libModule();
  const wrong = [];
  for (const name of ['isDutyMenu', 'readMenuRows', 'normalizeMenuKey', 'sameRows', 'buildOffer']) if (typeof lib[name] !== 'function') wrong.push(`no ${name}()`);
  if (lib.DUTY_MENU_KIND !== DM.DUTY_MENU_KIND) wrong.push(`DUTY_MENU_KIND: want ${DM.DUTY_MENU_KIND}, got ${show(lib.DUTY_MENU_KIND)}`);
  if (lib.DUTY_MENU_D !== DM.DUTY_MENU_D) wrong.push(`DUTY_MENU_D: want ${show(DM.DUTY_MENU_D)}, got ${show(lib.DUTY_MENU_D)}`);
  if (lib.DUTY_MENU_HEADER !== DM.DUTY_MENU_HEADER) wrong.push(`DUTY_MENU_HEADER: want ${show(DM.DUTY_MENU_HEADER)}, got ${show(lib.DUTY_MENU_HEADER)}`);
  const src = codeOnly(safeRead(LIB));
  if (/^\s*import\b/m.test(src) || /\bexport\s+(default|const|function)\b/.test(src)) wrong.push('the library is CommonJS (story 2 and the server require it)');
  const io = [...src.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]).filter((m) => /^(node:)?(fs|child_process|net|dns|http|https|ws|tls|dgram)$/.test(m) || /utils\/config|setup\/status|relaySource/.test(m));
  if (io.length) wrong.push(`no I/O: it requires ${show(io)}`);
  if (/process\.env/.test(src)) wrong.push('no I/O: it reads process.env');
  assert(wrong.length === 0, wrong.join('; '));
});

test('L2: src/lib/nous.js is the one definition of Nous\' key — NOUS_PUBKEY is the § 2 constant — and the library\'s header names it (ADR 0001 sub-decision 1; § Implementation notes)', () => {
  const nous = nousModule();
  assert(nous.NOUS_PUBKEY === NOUS, `NOUS_PUBKEY: want ${show(NOUS)}, got ${show(nous.NOUS_PUBKEY)}`);
  const lib = libModule();
  assert(lib.DUTY_MENU_HEADER === `39998:${nous.NOUS_PUBKEY}:duty-menu`, `DUTY_MENU_HEADER is built from NOUS_PUBKEY, got ${show(lib.DUTY_MENU_HEADER)}`);
});

test('L3: isDutyMenu accepts a conforming menu — with other z tags, name, description, json, a storefront and a not-offered row, or with no rows at all — and compares the author lower-cased (§ 6.1; ADR 0001 sub-decision 1)', () => {
  const isDutyMenu = need(libModule(), 'isDutyMenu', 'src/lib/duty-menu');
  const wrong = [];
  const full = menuEv({
    rows: [['duty', '30382', OWN], ['not-offered', '30385']],
    z: [`39998:${OTHER}:my-dictionary-copy`, DM.DUTY_MENU_HEADER],
    extra: [['name', "Fixture's Assistant"], ['description', 'fixture'], ['json', '{"dutyMenu":{}}'], ['storefront', `39999:${ASSISTANT}:duty-menu`]],
  });
  if (isDutyMenu(full, ASSISTANT) !== true) wrong.push('a full menu, with a second z first');
  if (isDutyMenu(menuEv({ rows: [] }), ASSISTANT) !== true) wrong.push('an empty menu (duty is recommended, not required: § 3, § 11)');
  if (isDutyMenu(menuEv({ rows: [] }), ASSISTANT.toUpperCase()) !== true) wrong.push('the author given in upper case');
  assert(wrong.length === 0, `want true: ${wrong.join('; ')}`);
});

test('L4: isDutyMenu refuses an event that fails any one § 6.1 condition alone — not kind 39999; d not duty-menu or missing; no p, two p, or a p naming another key; no z, or a z naming another header — and garbage (§ 6.1)', () => {
  const isDutyMenu = need(libModule(), 'isDutyMenu', 'src/lib/duty-menu');
  const rows = [['duty', '30382', OWN]];
  const cases = [
    ['kind 39998', menuEv({ rows, kind: 39998 })],
    ['kind 30000', menuEv({ rows, kind: 30000 })],
    ['d "duty-menus"', menuEv({ rows, d: 'duty-menus' })],
    ['no d', menuEv({ rows, d: null })],
    ['no p', menuEv({ rows, p: [] })],
    ['two p, both the author', menuEv({ rows, p: [ASSISTANT, ASSISTANT] })],
    ['two p, the author and another', menuEv({ rows, p: [ASSISTANT, OTHER] })],
    ['one p naming another key (a nomination, § 6.1)', menuEv({ rows, p: [OTHER] })],
    ['no z', menuEv({ rows, z: [] })],
    ['a z naming a dictionary copy, never Nous\' header (§ 3)', menuEv({ rows, z: [`39998:${OTHER}:duty-menu`] })],
    ['a z naming Nous\' other header', menuEv({ rows, z: [`39998:${NOUS}:duty-menus`] })],
  ];
  const wrong = cases.filter(([, e]) => isDutyMenu(e, ASSISTANT) !== false).map(([label]) => label);
  const control = menuEv({ rows });
  if (isDutyMenu(control, ASSISTANT) !== true) wrong.push('the control (every condition met) must pass, or the refusals prove nothing');
  for (const junk of [null, undefined, {}, { kind: 39999 }, 'x']) {
    let got; try { got = isDutyMenu(junk, ASSISTANT); } catch (err) { got = `threw ${err.message}`; }
    if (got !== false) wrong.push(`${show(junk)} → ${show(got)}`);
  }
  assert(wrong.length === 0, `want false: ${wrong.join('; ')}`);
});

test('L5: readMenuRows keeps duty and not-offered rows in order and normalizes them — trailing empty segments dropped, except in Concept keys (taken verbatim); 39998:dlist-header read as 39998; an naddr segment as written; relays in their one spelling, a not-offered row\'s relay null; other tags ignored (§§ 5.1–5.3; ADR 0001 sub-decisions 1, 5; Amendment 1 items 5, 6)', () => {
  const readMenuRows = need(libModule(), 'readMenuRows', 'src/lib/duty-menu');
  const event = menuEv({
    rows: [
      ['duty', '30382', 'wss://Scores.Example/'],
      ['duty', '3038x:tag:', 'wss://scores.example'],
      ['not-offered', '30385'],
      ['duty', '30392:tag::', 'wss://lists.example'],
      ['duty', '3039x:tag::T', 'wss://lists.example'],
      ['duty', '39998:dlist-header', 'wss://concepts.example'],
      ['duty', '39999:my-list:', 'wss://concepts.example'],
      ['duty', '30382:rank::', 'wss://scores.example'],
      ['duty', '*', 'WSS://All.Example'],
      ['duty', '3039x:tag:naddr1qqDutyMenuFixture', 'wss://lists.example'],
    ],
    extra: [['name', 'x'], ['json', '{}'], ['storefront', `39999:${ASSISTANT}:duty-menu`], ['r', 'wss://r.example']],
  });
  const want = [
    { tag: 'duty', key: '30382', relay: 'wss://scores.example' },
    { tag: 'duty', key: '3038x:tag', relay: 'wss://scores.example' },
    { tag: 'not-offered', key: '30385', relay: null },
    { tag: 'duty', key: '30392:tag', relay: 'wss://lists.example' },
    { tag: 'duty', key: '3039x:tag::T', relay: 'wss://lists.example' },
    { tag: 'duty', key: '39998', relay: 'wss://concepts.example' },
    { tag: 'duty', key: '39999:my-list:', relay: 'wss://concepts.example' },
    { tag: 'duty', key: '30382:rank', relay: 'wss://scores.example' },
    { tag: 'duty', key: '*', relay: 'wss://all.example' },
    { tag: 'duty', key: '3039x:tag:naddr1qqDutyMenuFixture', relay: 'wss://lists.example' },
  ];
  const got = readMenuRows(event);
  assert(sameJson(rowView(got), want), `want ${show(want)}, got ${show(got)}`);
});

test('L6: readMenuRows drops a duty row with a missing or empty relay or one that is not a ws:// or wss:// address, a key whose kind slot does not parse (a bare naddr included), and the keys 39998: and 39999:; after the drops the first row per normalized key wins, whatever its tag (§§ 5.1, 5.3; ADR 0001 sub-decisions 1, 5; Amendment 1 items 4, 6)', () => {
  const readMenuRows = need(libModule(), 'readMenuRows', 'src/lib/duty-menu');
  const R = (n) => `wss://r${n}.example`;
  const event = menuEv({
    rows: [
      ['duty', '30382'], ['duty', '30382', ''],                         // no relay, an empty relay: dropped
      ['duty', '30382', 'https://web.example'], ['duty', '30382', 'not a relay'], ['duty', '30382', 42], // not ws:// or wss://: dropped (Amendment 1 item 4)
      ['duty', '30382', R(2)],                                          // the first 30382 row left: kept
      ['duty', '303821', R(9)], ['duty', 'abc', R(9)], ['duty', '3040x', R(9)], ['duty', '', R(9)], ['duty'], // unparseable
      ['duty', '39998:', R(9)], ['duty', '39999:', R(9)], ['not-offered', '39999:'], ['not-offered', 'nope'], // ignored keys
      ['duty', 'naddr1qqDutyMenuFixture', R(9)],                       // an naddr in the kind slot does not parse (Amendment 1 item 6)
      ['duty', '39998', R(3)],                                          // the first 39998 left: kept
      ['not-offered', '30385'], ['duty', '30385', R(4)],                // a not-offered row first: it wins
      ['duty', '3039x:tag:', R(5)], ['duty', '3039x:tag', R(6)],        // the same key once normalized: the first wins
      ['duty', '39998:dlist-header', R(7)],                             // normalizes to 39998, already taken
    ],
  });
  const want = [
    { tag: 'duty', key: '30382', relay: R(2) },
    { tag: 'duty', key: '39998', relay: R(3) },
    { tag: 'not-offered', key: '30385', relay: null },
    { tag: 'duty', key: '3039x:tag', relay: R(5) },
  ];
  const got = readMenuRows(event);
  assert(sameJson(rowView(got), want), `want ${show(want)}, got ${show(got)}`);
});

test('L7: normalizeMenuKey agrees with the Treasure Map rule\'s entryOf — the same normalized key for every key a reader keeps (ADR 0001 sub-decision 1: the Phase-3 agreement test)', async () => {
  const normalizeMenuKey = need(libModule(), 'normalizeMenuKey', 'src/lib/duty-menu');
  const { entryOf } = await ruleModule();
  const keys = ['30382', '30382:rank', '30382:rank:', '30382::', '3038x', '3038x:tag:', '3039x:tag::T', '30392:tag::', '30394:pin:39998:',
    '*', '*:', '39998', '39999', '39998:dlist-header', '39999:my-list', '39999:my-list:', '39998:abc:def', '30397:dlist:x'];
  const wrong = keys.filter((k) => normalizeMenuKey(k) !== entryOf([k, HEX, '']).norm)
    .map((k) => `${show(k)}: entryOf → ${show(entryOf([k, HEX, '']).norm)}, normalizeMenuKey → ${show(normalizeMenuKey(k))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('L8, re-aimed by assistant-duties-settings #1: sameRows compares rows in order — the same tag, key and relay at every position; another order, a different relay, tag or key, or a row more or less, is not the same (ADR assistant-duties-settings/0001 sub-decision 5; it was order-blind under assistant-duty-menu #1 AC-4)', () => {
  const sameRows = need(libModule(), 'sameRows', 'src/lib/duty-menu');
  const a = [{ tag: 'duty', key: '30382', relay: OWN }, { tag: 'duty', key: '30392', relay: OWN }, { tag: 'duty', key: '39998', relay: DLIST }];
  const wrong = [];
  if (sameRows(a, a.slice()) !== true) wrong.push('the same rows in the same order are the same');
  if (sameRows(a, a.map((r) => ({ ...r }))) !== true) wrong.push('equal rows that are other objects are the same');
  if (sameRows([], []) !== true) wrong.push('two empty menus are the same');
  const differs = [
    ['the same rows in another order', a.slice().reverse()],
    ['two rows swapped', [a[1], a[0], a[2]]],
    ['a relay', [a[0], a[1], { ...a[2], relay: OWN }]],
    ['a tag', [a[0], a[1], { tag: 'not-offered', key: '39998', relay: DLIST }]],
    ['a key', [a[0], a[1], { ...a[2], key: '39999' }]],
    ['a row more', [...a, { tag: 'duty', key: '39999', relay: DLIST }]],
    ['a row less', a.slice(0, 2)],
    ['empty against rows', []],
  ];
  for (const [label, b] of differs) if (sameRows(a, b) !== false || sameRows(b, a) !== false) wrong.push(`${label} must not be the same`);
  assert(wrong.length === 0, `wrong answer for: ${wrong.join('; ')}`);
});

test('L9, re-aimed by assistant-duties-settings #1: buildOffer({ ownRelay, dlistRelay, duties }) over the six defaults gives one row per duty in list order — 30382 and the three List kinds at ownRelay, 39998 and 39999 at ownRelay else dlistRelay, a row with no relay left out — and a `scores` input changes nothing (ADR assistant-duties-settings/0001 sub-decision 3)', () => {
  const buildOffer = need(libModule(), 'buildOffer', 'src/lib/duty-menu');
  const wrong = [];
  for (const ownRelay of [OWN, null]) {
    for (const dlistRelay of [DLIST, null]) {
      const want = DM.expectedOffer({ ownRelay, dlistRelay });
      for (const extra of [{}, { scores: false }, { scores: true }]) {
        const input = { ownRelay, dlistRelay, duties: DM.DEFAULT_DUTIES.map((d) => ({ ...d })), ...extra };
        let got;
        try { got = buildOffer(input); } catch (err) { wrong.push(`${show(input)} threw ${err.message}`); continue; }
        wrong.push(...offerDiff(show({ ownRelay, dlistRelay, ...extra }), got, want));
      }
    }
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('L10, re-aimed by assistant-duties-settings #1: the offer the six defaults give is valid on its own — duty rows only, one per key, never an empty relay, never 39998: or 39999:; each key a kind the Treasure Map rule puts in exactly one category (AC-2 of assistant-duty-menu #1, "Valid on its own")', async () => {
  const buildOffer = need(libModule(), 'buildOffer', 'src/lib/duty-menu');
  const { entryOf, appliesTo } = await ruleModule();
  const wrong = [];
  for (const ownRelay of [OWN, null]) {
    for (const dlistRelay of [DLIST, null]) {
      const input = { ownRelay, dlistRelay, duties: DM.DEFAULT_DUTIES.map((d) => ({ ...d })) };
      const rows = buildOffer(input);
      const label = show({ ownRelay, dlistRelay });
      if (!Array.isArray(rows)) { wrong.push(`${label}: not an array`); continue; }
      if (rows.some((r) => r.tag !== 'duty')) wrong.push(`${label}: a not-offered row`);
      if (new Set(rows.map((r) => r.key)).size !== rows.length) wrong.push(`${label}: two rows share a key`);
      if (rows.some((r) => typeof r.relay !== 'string' || r.relay === '')) wrong.push(`${label}: an empty relay`);
      if (rows.some((r) => /:$/.test(r.key))) wrong.push(`${label}: a trailing-colon key`);
      for (const r of rows) {
        const cats = ['scores', 'lists', 'concepts'].filter((c) => appliesTo(c, entryOf([r.key, HEX, r.relay])));
        if (cats.length !== 1) wrong.push(`${label}: ${r.key} falls in ${show(cats)}`);
      }
    }
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('L11: buildOffer gives every relay in its one spelling — ownRelay and dlistRelay pass through normalizeRelayUrl (ADR 0001 Amendment 1 item 3; re-aimed by assistant-duties-settings #1: the six defaults passed as duties)', () => {
  const buildOffer = need(libModule(), 'buildOffer', 'src/lib/duty-menu');
  const duties = () => DM.DEFAULT_DUTIES.map((d) => ({ ...d }));
  const wrong = [];
  const own = buildOffer({ ownRelay: OWN_CONFIGURED, dlistRelay: 'wss://Dcosl.example/', duties: duties() });
  wrong.push(...offerDiff('ownRelay spelled wss://Tapestry.Example/relay/', own, DM.expectedOffer({ ownRelay: OWN })));
  const dlist = buildOffer({ ownRelay: null, dlistRelay: 'wss://Dcosl.example/', duties: duties() });
  wrong.push(...offerDiff('dlistRelay spelled wss://Dcosl.example/', dlist, DM.expectedOffer({ dlistRelay: 'wss://dcosl.example' })));
  assert(wrong.length === 0, wrong.join('; '));
});

test('L12: isDutyMenu refuses an otherwise conforming menu that carries ["z", "list"], or a z naming a concept-header (39998:<64 hex>:concept-header, Nous\' or anyone\'s); other z tags still pass (ADR 0001 Amendment 2 item 1; ADR duty-menus-and-self-maps/0003 sub-decision 11)', () => {
  const isDutyMenu = need(libModule(), 'isDutyMenu', 'src/lib/duty-menu');
  const rows = [['duty', '30382', OWN]];
  const withZ = (extraZ) => menuEv({ rows, z: [DM.DUTY_MENU_HEADER, extraZ] });
  const refused = [
    ['["z", "list"]', withZ('list')],
    ['a z naming Nous\' concept-header', withZ(`39998:${NOUS}:concept-header`)],
    ['a z naming another author\'s concept-header', withZ(`39998:${OTHER}:concept-header`)],
    ['the concept-header z before Nous\' z', menuEv({ rows, z: [`39998:${OTHER}:concept-header`, DM.DUTY_MENU_HEADER] })],
  ];
  const accepted = [
    ['39998:<hex>:something-else', withZ(`39998:${OTHER}:something-else`)],
    ['a 30382 address', withZ(`30382:${OTHER}:rank`)],
    ['a kind-39999 concept-header address', withZ(`39999:${OTHER}:concept-header`)],
    ['a concept-header address without a 64-hex author', withZ('39998:not-a-pubkey:concept-header')],
    ['"lists"', withZ('lists')],
  ];
  const wrong = [];
  for (const [label, e] of refused) if (isDutyMenu(e, ASSISTANT) !== false) wrong.push(`${label}: want false (not a menu)`);
  for (const [label, e] of accepted) if (isDutyMenu(e, ASSISTANT) !== true) wrong.push(`${label}: want true (another z is allowed and ignored, § 4)`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('L13: buildMenuTags gives d, Nous\' z and p (the Assistant), then one ["duty", key, relay] per duty row of the offer in its order, and nothing else; an empty offer gives the three; the result is a menu by § 6.1 whose rows read back as the offer (story 2 AC-3; ADR 0002 sub-decision 2)', () => {
  const lib = libModule();
  const buildMenuTags = need(lib, 'buildMenuTags', 'src/lib/duty-menu');
  const offer = DM.expectedOffer({ ownRelay: OWN });
  const head = [['d', DM.DUTY_MENU_D], ['z', DM.DUTY_MENU_HEADER], ['p', ASSISTANT]];
  const wrong = [];
  const tags = buildMenuTags({ assistantPubkey: ASSISTANT, offer });
  const want = [...head, ...offer.map((r) => ['duty', r.key, r.relay])];
  if (!sameJson(tags, want)) wrong.push(`tags: want ${show(want)}, got ${show(tags)}`);
  const empty = buildMenuTags({ assistantPubkey: ASSISTANT, offer: [] });
  if (!sameJson(empty, head)) wrong.push(`empty offer: want ${show(head)}, got ${show(empty)}`);
  const withException = buildMenuTags({ assistantPubkey: ASSISTANT, offer: [offer[0], { tag: 'not-offered', key: '30385', relay: null }] });
  if (!sameJson(withException, [...head, ['duty', offer[0].key, offer[0].relay]])) wrong.push(`one duty tag per duty row only: ${show(withException)}`);
  const ev = { kind: DM.DUTY_MENU_KIND, pubkey: ASSISTANT, tags, content: '' };
  if (lib.isDutyMenu(ev, ASSISTANT) !== true) wrong.push('the tags make a menu by § 6.1');
  if (!lib.sameRows(lib.readMenuRows(ev), offer)) wrong.push(`rows read back: ${show(lib.readMenuRows(ev))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── U — the answer: whose, and its shape (AC-1) ───────────────────────── */

test('U1: without an authenticated session the answer is { success: true, signedIn: false }, and no menu, Map or customer is looked up (AC-1)', async () => {
  const got = await answer({}, { session: {}, query: { pubkey: STRANGER } });
  assert(got.res.statusCode === 200 && sameJson(got.body, { success: true, signedIn: false }), `got ${got.res.statusCode} ${show(got.body)}`);
  assert(got.menuScans.length === 0 && got.menuReads.length === 0 && got.calls.getCustomer.length === 0, `nothing is looked up: ${show({ scans: got.menuScans, reads: got.menuReads, customer: got.calls.getCustomer })}`);
});

test('U2: a signed-in viewer with no Assistant here gets actions {} — no duty-menu key, and nothing looked up (AC-1)', async () => {
  const got = await answer({ assistant: null });
  assert(got.body && got.body.hasAssistant === false && sameJson(got.body.actions, {}), `got ${show(got.body)}`);
  assert(got.menuScans.length === 0 && got.menuReads.length === 0 && got.calls.getCustomer.length === 0, 'nothing is looked up');
});

test('U3: a viewer with an Assistant gets actions["duty-menu"] with exactly offer, published, current, finished, done, pending and reason; published carries rows, createdAt, source and eventId (AC-1; ADR 0001 sub-decision 4)', async () => {
  const menu = menuEv({ rows: offerAt(OWN) });
  const got = await answer({ customer: { status: 'active' }, local: [...baseLocal(), menu] });
  const a = got.action;
  assert(a && typeof a === 'object', `no duty-menu action in ${show(got.body)}`);
  const keys = Object.keys(a).sort();
  const want = ['current', 'done', 'finished', 'offer', 'pending', 'published', 'reason'];
  assert(sameJson(keys, want), `the action's fields: want ${show(want)}, got ${show(keys)}`);
  const p = a.published;
  assert(p && sameJson(Object.keys(p).sort(), ['createdAt', 'eventId', 'rows', 'source']), `published: want { rows, createdAt, source, eventId }, got ${show(p)}`);
  assert(p.eventId === menu.id && p.createdAt === menu.created_at && p.source === 'local', `published names the menu found: ${show(p)}`);
});

test('U4: whose Assistant comes from the session — the check runs once with the session\'s viewer and Assistant whatever the query, params or body name, and only that Assistant\'s menu and that viewer\'s Map are looked up (AC-1)', async () => {
  const nosy = { query: { pubkey: STRANGER, viewer: STRANGER, assistant: OTHER, assistantPubkey: OTHER, author: OTHER }, params: { pubkey: STRANGER }, body: { assistantPubkey: OTHER } };
  const spied = await answer({ checkDutyMenu: async () => DM.ANSWERS.DONE }, signedInReq(VIEWER, nosy));
  const c = spied.calls.checkDutyMenu;
  assert(c.length === 1 && c[0] && c[0].viewer === VIEWER && c[0].assistantPubkey === ASSISTANT, `checkDutyMenu called once with { viewer: <session>, assistantPubkey: <their Assistant> }; got ${show(c)}`);
  assert(sameJson(spied.action, DM.ANSWERS.DONE), `the answer carries the check's answer, got ${show(spied.action)}`);

  const local = [...baseLocal(), menuEv({ author: OTHER, rows: [['duty', '30382', 'wss://theirs.example']] }), mapEv([['*', OTHER, 'wss://theirs.example']], 900, STRANGER)];
  const plain = await answer({ local });
  const real = await answer({ local }, signedInReq(VIEWER, nosy));
  assert(sameJson(plain.action, real.action), `the request changed the answer: ${show(plain.action)} vs ${show(real.action)}`);
  const menuAuthors = [...real.menuScans, ...real.menuReads.map((r) => r.filter)].map((f) => show(f.authors));
  assert(real.menuScans.length > 0 && menuAuthors.every((a) => a === show([ASSISTANT])), `the menu is looked up for the session's Assistant only: ${show(menuAuthors)}`);
  const mapAuthors = real.calls.scanLocal.filter(isMapFilter).map((f) => show(f.authors));
  assert(mapAuthors.length > 0 && mapAuthors.every((a) => a === show([VIEWER])), `the Map is the session viewer's: ${show(mapAuthors)}`);
});

/* ───────────────────────── U — the offer (AC-2) ───────────────────────── */

test('U5: the Owner\'s Assistant is offered Scores (30382), Lists (30392–30394) and Concepts (39998, 39999), each at this instance\'s relay in its one spelling (AC-2; ADR 0001 sub-decision 2, R1, K1)', async () => {
  const got = await answer({ config: { BRAINSTORM_OWNER_PUBKEY: VIEWER } });
  const wrong = offerDiff('the Owner', offerOf(got), offerAt(OWN));
  assert(wrong.length === 0, wrong.join('; '));
});

test('U6, re-aimed by assistant-duties-settings #1: an active customer\'s Assistant is offered exactly what the Owner\'s is — the six defaults, Scores included — and no customer is looked up to decide it (ADR assistant-duties-settings/0001 sub-decision 3; book Decision 6)', async () => {
  const got = await answer({ customer: { status: 'active', name: 'fixture' } });
  const owner = await answer({ config: { BRAINSTORM_OWNER_PUBKEY: VIEWER } });
  const wrong = offerDiff('an active customer', offerOf(got), offerAt(OWN));
  wrong.push(...offerDiff('the Owner', offerOf(owner), offerAt(OWN)));
  if (got.calls.readAssistantDuties < 1) wrong.push('the offer reads the Assistant Duties list (readAssistantDuties was never called)');
  if (got.calls.getCustomer.length !== 0) wrong.push(`no customer lookup decides the offer, got ${show(got.calls.getCustomer)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U7, re-aimed by assistant-duties-settings #1: an admin who is not a customer, an inactive customer and a pending one are offered the same six, Scores included — one list for every Assistant (book Decisions 3 and 6)', async () => {
  const wrong = [];
  for (const [label, customer] of [['not a customer', null], ['an inactive customer', { status: 'inactive' }], ['a pending customer', { status: 'pending' }]]) {
    const got = await answer({ customer });
    wrong.push(...offerDiff(label, offerOf(got), offerAt(OWN)));
    if (!(offerOf(got) || []).some((r) => r.key === '30382')) wrong.push(`${label}: the Scores row is offered`);
    if (got.calls.getCustomer.length !== 0) wrong.push(`${label}: no customer lookup, got ${show(got.calls.getCustomer)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U8, re-aimed by assistant-duties-settings #1: a customer store that throws changes nothing — it is never asked, the offer is the list and the check finishes (ADR assistant-duties-settings/0001 sub-decision 3)', async () => {
  const got = await answer({ customer: 'throw', quiet: true });
  const wrong = offerDiff('the customer store would throw', offerOf(got), offerAt(OWN));
  if (got.res.statusCode !== 200) wrong.push(`status ${got.res.statusCode}`);
  if (!got.action || got.action.reason === 'check-failed' || got.action.finished !== true) wrong.push(`the check answers, finished: ${show(got.action)}`);
  if (got.calls.getCustomer.length !== 0) wrong.push(`never asked, got ${show(got.calls.getCustomer)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U9: with no public address for this instance\'s relay (loopback, a private IP, a .local name), Scores and Lists get no row and Concepts take the first public DList relay, skipping private ones (AC-2 "Public relays only"; ADR 0001 R1, sub-decision 2)', async () => {
  const wrong = [];
  for (const url of ['ws://localhost:7777', 'ws://127.0.0.1:7777', 'ws://192.168.1.20/relay', 'wss://tapestry.local/relay']) {
    // Re-aimed by duty-menu-public-relay #1: a public STRFRY_DOMAIN now gives a public relay, so "no public address" sets a non-public one too.
    const got = await answer({ config: { BRAINSTORM_RELAY_URL: url, STRFRY_DOMAIN: 'localhost', BRAINSTORM_OWNER_PUBKEY: VIEWER } });
    wrong.push(...offerDiff(url, offerOf(got), offerAt(null, { dlistRelay: DLIST })));
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U10: local-only publishing — with no public address the offer is empty (Concepts never go to a DList relay); with one, Concepts stay at this instance\'s relay; no public DList relay at all is an empty offer too (ADR 0001 sub-decision 2)', async () => {
  const wrong = [];
  // Re-aimed by duty-menu-public-relay #1: a public STRFRY_DOMAIN now gives a public relay, so "no public address" sets a non-public one too.
  const privateOwn = { BRAINSTORM_RELAY_URL: 'ws://localhost:7777', STRFRY_DOMAIN: 'localhost', BRAINSTORM_OWNER_PUBKEY: VIEWER };
  const a = await answer({ localOnly: true, config: privateOwn });
  wrong.push(...offerDiff('local-only, no public address', offerOf(a), []));
  const b = await answer({ localOnly: true, config: { BRAINSTORM_OWNER_PUBKEY: VIEWER } });
  wrong.push(...offerDiff('local-only, a public address', offerOf(b), offerAt(OWN)));
  const c = await answer({ config: privateOwn, settings: { aDListRelays: ['ws://10.0.0.5:7777', 'wss://box.local'] } });
  wrong.push(...offerDiff('no public DList relay, no public address', offerOf(c), []));
  assert(wrong.length === 0, wrong.join('; '));
});

test('U11, re-aimed by assistant-duties-settings #1: the offer follows the settings at each check, with no restart — the relay address and the Assistant Duties list move it between answers of one running server (AC-5: "A change reaches every Duty Menu check … with no restart")', async () => {
  const session = freshModules();
  const wrong = [];
  const first = await answer({}, signedInReq(), session);
  wrong.push(...offerDiff('first', offerOf(first), offerAt(OWN)));
  const moved = await answer({ config: { BRAINSTORM_RELAY_URL: 'wss://new-home.example' } }, signedInReq(), session);
  wrong.push(...offerDiff('the relay address changed', offerOf(moved), offerAt('wss://new-home.example')));
  const shorter = [{ key: '39999' }, { key: '30392' }];
  const changed = await answer({ duties: shorter }, signedInReq(), session);
  wrong.push(...offerDiff('the list changed to 39999, 30392', offerOf(changed), offerAt(OWN, { duties: shorter })));
  const back = await answer({}, signedInReq(), session);
  wrong.push(...offerDiff('the list back to the six', offerOf(back), offerAt(OWN)));
  assert(wrong.length === 0, wrong.join('; '));
});

test('U12: the menu is looked up as § 8.1 says — one local scan, and in parallel every relay in the three places (the Map\'s hints for this Assistant, its 10002 write relays, Nous\' 10002 write relays), each once, with § 8.1\'s filter; never another Assistant\'s hint or a read-only relay (AC-3; ADR 0001 sub-decision 3)', async () => {
  const local = [
    mapEv([['30382:rank', ASSISTANT, HINT], ['39998', ASSISTANT, HINT2], ['3039x', OTHER, OTHER_HINT]]),
    relayListEv(ASSISTANT, [['r', A_WRITE], ['r', A_WRITE2, 'write'], ['r', A_READ, 'read'], ['r', 'wss://Hint.Example/', 'write']]),
    relayListEv(NOUS, [['r', NOUS_WRITE, 'write'], ['r', NOUS_READ, 'read']]),
  ];
  const got = await answer({ local });
  const want = [HINT, HINT2, A_WRITE, A_WRITE2, NOUS_WRITE].map(normUrl).sort();
  const urls = readUrls(got);
  const wrong = [];
  if (!sameJson(urls.slice().sort(), want)) wrong.push(`outside relays read: want each of ${show(want)} once, got ${show(urls)}`);
  const filters = [...got.menuScans, ...got.menuReads.map((r) => r.filter)];
  if (got.menuScans.length !== 1) wrong.push(`one local scan for the menu, got ${got.menuScans.length}`);
  if (!filters.every((f) => sameJson(f, DM.menuFilter(ASSISTANT)))) wrong.push(`§ 8.1's filter ${show(DM.menuFilter(ASSISTANT))}, got ${show(filters)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U13: this instance\'s own relay is never read as an outside relay — not when the Map, the Assistant\'s 10002 or the offer names it — and with no public address the offer\'s DList relay is read (AC-3; ADR 0001 sub-decision 3: outsideOnly)', async () => {
  const local = [
    mapEv([['30382:rank', ASSISTANT, OWN_CONFIGURED], ['39998', ASSISTANT, 'ws://localhost:7777'], ['30392', ASSISTANT, HINT]]),
    relayListEv(ASSISTANT, [['r', OWN], ['r', A_WRITE]]),
    relayListEv(NOUS, [['r', NOUS_WRITE]]),
  ];
  const wrong = [];
  const pub = await answer({ local });
  const own = readUrls(pub).filter((u) => [OWN_DOMAIN, 'localhost'].includes(hostOf(u)));
  if (own.length) wrong.push(`this instance's relay was read as outside: ${show(own)}`);
  if (pub.menuScans.length !== 1 || !readUrls(pub).includes(normUrl(HINT))) wrong.push(`the local scan and the other relays still run: ${show(readUrls(pub))}`);
  // Re-aimed by duty-menu-public-relay #1: a public STRFRY_DOMAIN now gives a public relay, so "no public address" sets a non-public one too.
  // There this instance is localhost alone, and tapestry.example an outside relay like any other.
  const priv = await answer({ local, config: { BRAINSTORM_RELAY_URL: 'ws://localhost:7777', STRFRY_DOMAIN: 'localhost' } });
  if (!readUrls(priv).includes(normUrl(DLIST))) wrong.push(`the offer's DList relay is asked: ${show(readUrls(priv))}`);
  if (readUrls(priv).some((u) => hostOf(u) === 'localhost')) wrong.push(`own relay read: ${show(readUrls(priv))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U14: a relay named inside an event is read only when isPublicRelayHostWithin accepts its host — a refused hint, Assistant write relay or Nous write relay is never read, an accepted one is; a configured relay (the offer\'s DList relay) is read whatever that guard would say (AC-3; ADR 0001 sub-decision 3)', async () => {
  // Re-aimed by duty-menu-public-relay #1: a public STRFRY_DOMAIN now gives a public relay, so "no public address" sets a non-public one too.
  const got = await answer({ config: { BRAINSTORM_RELAY_URL: 'ws://localhost:7777', STRFRY_DOMAIN: 'localhost' }, refused: [...REFUSED_HOSTS, hostOf(DLIST)] });
  const urls = readUrls(got);
  const wrong = [];
  const refusedRead = urls.filter((u) => REFUSED_HOSTS.includes(hostOf(u)));
  if (refusedRead.length) wrong.push(`refused relays were read: ${show(refusedRead)}`);
  for (const u of [HINT, A_WRITE, NOUS_WRITE]) if (!urls.includes(normUrl(u))) wrong.push(`the accepted ${u} is read`);
  if (!urls.includes(normUrl(DLIST))) wrong.push(`the configured DList relay is read without the guard, got ${show(urls)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

// Re-aimed by assistant-duty-menu #2 (AC-5): with a version here the outside relays are not asked, so "the latest across
// every answer" is tested where it still applies — this instance's relay holding none.
test('U15: with no version on this instance\'s relay, the latest version across the outside answers counts (source relay); a newer one here counts and is from local; on a created_at tie the lowest id wins (AC-3; story 2 AC-5; § 8.1; NIP-01)', async () => {
  const fresh = offerAt(OWN);
  const stale = DM.STALE_ROWS.filter((r) => r.key !== '30382');
  const older = menuEv({ createdAt: 1000, rows: fresh });
  const newer = menuEv({ createdAt: 2000, rows: stale });
  const wrong = [];
  const a = await answer({ local: baseLocal(), relays: { ...quietRelays(), [HINT]: [older], [HINT2]: [newer] } });
  if (!(a.action && a.action.published && a.action.published.eventId === newer.id && a.action.published.source === 'relay')) wrong.push(`two outside versions: want the newer ${newer.id} from a relay, got ${show(a.action && a.action.published)}`);
  if (a.menuScans.length !== 1) wrong.push('the local scan still runs');
  const b = await answer({ local: [...baseLocal(), newer], relays: { ...quietRelays(), [HINT]: [older] } });
  if (!(b.action && b.action.published && b.action.published.eventId === newer.id && b.action.published.source === 'local')) wrong.push(`local newer: want ${newer.id} from local, got ${show(b.action && b.action.published)}`);
  const low = menuEv({ createdAt: 3000, rows: fresh, id: '0'.repeat(63) + '1' });
  const high = menuEv({ createdAt: 3000, rows: stale, id: 'f'.repeat(64) });
  const c = await answer({ local: baseLocal(), relays: { ...quietRelays(), [HINT]: [high], [A_WRITE]: [low] } });
  if (!(c.action && c.action.published && c.action.published.eventId === low.id)) wrong.push(`tie: want the lowest id ${low.id}, got ${show(c.action && c.action.published)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

// Re-aimed by assistant-duty-menu #2 (AC-5): the older valid version sits on an outside relay, not here, so the newer
// invalid one is still read beside it. U34 pins the same rule on this instance's relay.
test('U16: if the latest version is not a menu by § 6.1, the Assistant has none — even when an older version is one; the check is finished and needs attention (AC-3; § 8.1)', async () => {
  const valid = menuEv({ createdAt: 1000, rows: offerAt(OWN) });
  const wrong = [];
  for (const [label, bad] of [
    ['no Nous z', menuEv({ createdAt: 2000, rows: offerAt(OWN), z: [] })],
    ['two p', menuEv({ createdAt: 2000, rows: offerAt(OWN), p: [ASSISTANT, OTHER] })],
  ]) {
    const got = await answer({ local: baseLocal(), relays: { ...quietRelays(), [HINT]: [valid], [HINT2]: [bad] } });
    const a = got.action || {};
    if (!(a.finished === true && a.published === null && a.current === false && a.done === false && a.pending === true)) wrong.push(`${label}: want finished, published null, not current, pending; got ${show(a)}`);
  }
  const control = await answer({ local: [...baseLocal(), valid] });
  if (!(control.action && control.action.published && control.action.published.eventId === valid.id)) wrong.push(`control: the older valid menu alone is found, got ${show(control.action)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U17: only the Assistant\'s own menus count — a relay that hands back another author\'s newer menu, or another kind, is ignored (AC-3; ADR 0001 sub-decision 3)', async () => {
  const mine = menuEv({ createdAt: 1000, rows: offerAt(OWN) });
  const theirs = menuEv({ author: OTHER, createdAt: 9000, rows: [['duty', '30382', 'wss://theirs.example']] });
  const otherKind = { ...menuEv({ createdAt: 9500, rows: [] }), kind: 30000 };
  // Re-aimed by assistant-duty-menu #2 (AC-5): the Assistant's own menu is on an outside relay, so the sloppy relay is read.
  const got = await answer({ local: baseLocal(), relays: { ...quietRelays(), [A_WRITE]: [mine], [HINT]: { raw: [theirs, otherKind] } } });
  const p = got.action && got.action.published;
  assert(p && p.eventId === mine.id && got.action.current === true, `want the Assistant's own menu ${mine.id}, current; got ${show(got.action)}`);
});

test('U18: finished when the local scan succeeded or at least one relay answered; otherwise unfinished with reason no-relay-answered, every flag false, current null — and still carrying the offer (AC-3; AC-2; ADR 0001 sub-decisions 2–4)', async () => {
  const menuScanFails = (f) => isMenuFilter(f);
  const wrong = [];
  const a = await answer({ relays: {} });
  if (!(a.action && a.action.finished === true && a.action.reason === null && a.action.published === null && a.action.pending === true)) wrong.push(`local scan ok, no relay answered: want finished with no menu, got ${show(a.action)}`);
  const b = await answer({ rejectScan: menuScanFails, relays: { [A_WRITE]: [] } });
  if (!(b.action && b.action.finished === true && b.action.published === null)) wrong.push(`local scan failed, one relay answered: want finished, got ${show(b.action)}`);
  const c = await answer({ rejectScan: menuScanFails, relays: {}, customer: { status: 'active' } });
  const want = { finished: false, done: false, pending: false, reason: 'no-relay-answered', published: null, current: null };
  const shaped = c.action && { finished: c.action.finished, done: c.action.done, pending: c.action.pending, reason: c.action.reason, published: c.action.published, current: c.action.current };
  if (!sameJson(shaped, want)) wrong.push(`nothing answered: want ${show(want)}, got ${show(c.action)}`);
  wrong.push(...offerDiff('unfinished still carries the offer', offerOf(c), offerAt(OWN)));
  assert(wrong.length === 0, wrong.join('; '));
});

// Re-aimed by assistant-duty-menu #2 (AC-5): no version here, so the outside relays are asked and one of them hangs.
test('U19: a relay that never answers is skipped at the relay budget (8 s) — the answer arrives, finished, with the menu the others found (AC-3; ADR 0001 sub-decision 3)', async () => {
  const menu = menuEv({ createdAt: 1000, rows: offerAt(OWN) });
  const started = Date.now();
  const got = await within(answer({ local: baseLocal(), relays: { ...quietRelays(), [HINT]: 'hang', [HINT2]: [menu] } }), DM.RELAY_BUDGET_MS + 3000);
  assert(got !== 'HUNG', `the answer must arrive within the relay budget, not hang (waited ${Date.now() - started} ms)`);
  assert(got.action && got.action.finished === true && got.action.done === true && got.action.published && got.action.published.source === 'relay', `finished and done with the menu another relay found: ${show(got.action)}`);
});

// Re-aimed by assistant-duty-menu #2 (AC-5): no version here, so the hint round runs; the menu is on the Assistant's relay.
test('U20: a hint lookup that fails only shrinks the lookup — with the Map unreadable, the Assistant\'s and Nous\' write relays are still asked, and the menu found there counts (ADR 0001 sub-decision 3)', async () => {
  const menu = menuEv({ createdAt: 1000, rows: offerAt(OWN) });
  const got = await answer({ local: baseLocal(), rejectScan: isMapFilter, relays: { ...quietRelays(), [MAPR]: 'unreachable', [A_WRITE]: [menu] } });
  const urls = readUrls(got);
  const wrong = [];
  for (const u of [A_WRITE, NOUS_WRITE]) if (!urls.includes(normUrl(u))) wrong.push(`${u} is still asked`);
  if (urls.includes(normUrl(HINT))) wrong.push('no Map, no hints');
  if (!(got.action && got.action.done === true)) wrong.push(`the menu found on the Assistant's relay counts: ${show(got.action)}`);
  assert(wrong.length === 0, `${wrong.join('; ')} (read ${show(urls)})`);
});

test('U21: a found Nous relay list is remembered for an hour — a second answer within the hour does not look it up again but still asks its relays; after the hour it is looked up again (AC-3; ADR 0001 sub-decision 3; § 8.1 "can be cached")', async () => {
  const session = freshModules();
  const clock = { t: T0 };
  const wrong = [];
  const first = await answer({ clock }, signedInReq(), session);
  if (first.nousLookups < 1) wrong.push(`the first answer looks Nous' list up, got ${first.nousLookups} lookups`);
  clock.t = T0 + 1000;
  const second = await answer({ clock }, signedInReq(), session);
  if (second.nousLookups !== 0) wrong.push(`within the hour: no lookup, got ${second.nousLookups}`);
  if (!readUrls(second).includes(normUrl(NOUS_WRITE))) wrong.push(`within the hour Nous' write relay is still asked, got ${show(readUrls(second))}`);
  clock.t = T0 + DM.NOUS_CACHE_MS + 1000;
  const third = await answer({ clock }, signedInReq(), session);
  if (third.nousLookups < 1) wrong.push(`after the hour: looked up again, got ${third.nousLookups}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U22: a Nous relay list that was not found is never remembered — the next answer, a second later, looks it up again (ADR 0001 sub-decision 3)', async () => {
  const session = freshModules();
  const clock = { t: T0 };
  const local = baseLocal({ nousList: false });
  const first = await answer({ clock, local }, signedInReq(), session);
  clock.t = T0 + 1000;
  const second = await answer({ clock, local }, signedInReq(), session);
  assert(first.nousLookups >= 1 && second.nousLookups >= 1, `a miss is looked up every time: first ${first.nousLookups}, second ${second.nousLookups}`);
});

/* ───────────────────────── U — current, done, pending (AC-4) ───────────────────────── */

test('U23, re-aimed by assistant-duties-settings #1: current and done — a menu with the offer\'s rows in the offer\'s order, written in other spellings (39998:dlist-header, the relay\'s case and slash), with a name, description, json and another z, is current; done, not pending (AC-4; § 5.3; ADR assistant-duties-settings/0001 sub-decision 5)', async () => {
  const offer = offerAt(OWN);
  const rows = offer.map((r) => (r.key === '39998' ? ['duty', '39998:dlist-header', OWN_CONFIGURED] : ['duty', r.key, r.relay]));
  const menu = menuEv({ createdAt: 1234, rows, z: [`39998:${OTHER}:elsewhere`, DM.DUTY_MENU_HEADER], extra: [['name', 'n'], ['description', 'd'], ['json', '{"dutyMenu":{"30382":{"interval":"PT6H"}}}']] });
  const got = await answer({ customer: { status: 'active' }, local: [...baseLocal(), menu] });
  const a = got.action || {};
  const wrong = [];
  if (!(a.finished === true && a.current === true && a.done === true && a.pending === false && a.reason === null)) wrong.push(`want finished, current, done, not pending; got ${show(a)}`);
  if (!(a.published && show(rowView(a.published.rows)) === show(rowView(offer)))) wrong.push(`published rows, normalized and in order: want ${show(offer)}, got ${show(a.published && a.published.rows)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U24: out of date — a different relay, a row missing, a row more, a not-offered row more, or (since assistant-duties-settings #1) the same rows in another order makes the menu not current: not done, pending (AC-4; ADR assistant-duties-settings/0001 sub-decision 5)', async () => {
  const offer = offerAt(OWN);
  const variants = [
    ['a different relay', offer.map((r) => (r.key === '30392' ? { ...r, relay: 'wss://elsewhere.example' } : r))],
    ['a row missing', offer.filter((r) => r.key !== '39999')],
    // A key the offer lacks: since assistant-duties-settings #1 the six include 30382, so a second 30382 would only be a
    // duplicate readers merge away (§ 5.3), not a row more.
    ['a row more', [...offer, { tag: 'duty', key: '30383', relay: OWN }]],
    ['a not-offered row more', [...offer, { tag: 'not-offered', key: '30385' }]],
    // assistant-duties-settings #1 (ADR 0001 sub-decision 5): order counts.
    ['the same rows in another order', offer.slice().reverse()],
    ['two rows swapped', [offer[1], offer[0], ...offer.slice(2)]],
  ];
  const wrong = [];
  for (const [label, rows] of variants) {
    const got = await answer({ local: [...baseLocal(), menuEv({ rows })] });
    const a = got.action || {};
    if (!(a.finished === true && a.published && a.current === false && a.done === false && a.pending === true)) wrong.push(`${label}: got ${show(a)}`);
  }
  const control = await answer({ local: [...baseLocal(), menuEv({ rows: offer })] });
  if (!(control.action && control.action.current === true)) wrong.push(`control: the offer's own rows are current, got ${show(control.action)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U25: no menu found anywhere — finished, published null, not current, not done, pending (AC-4)', async () => {
  const got = await answer({});
  const a = got.action || {};
  assert(a.finished === true && a.published === null && a.current === false && a.done === false && a.pending === true, `got ${show(a)}`);
  assert(got.menuScans.length === 1 && got.menuReads.length > 0, 'the lookup ran: the local scan and the outside relays');
});

test('U26: an empty offer — an empty published menu is current and done; no menu at all is pending, not done (the owner\'s answer 3(b)); a menu that still has rows is out of date (AC-4; ADR 0001 sub-decision 4)', async () => {
  // Re-aimed by duty-menu-public-relay #1: a public STRFRY_DOMAIN now gives a public relay, so "no public address" sets a non-public one too.
  const emptyOffer = { BRAINSTORM_RELAY_URL: 'ws://localhost:7777', STRFRY_DOMAIN: 'localhost' };
  const settings = { aDListRelays: [] };
  const wrong = [];
  const a = await answer({ config: emptyOffer, settings, local: [...baseLocal(), menuEv({ rows: [] })] });
  if (!(a.action && sameJson(a.action.offer, []) && a.action.current === true && a.action.done === true && a.action.pending === false)) wrong.push(`empty offer, empty menu: want current and done, got ${show(a.action)}`);
  const b = await answer({ config: emptyOffer, settings });
  if (!(b.action && sameJson(b.action.offer, []) && b.action.published === null && b.action.done === false && b.action.pending === true)) wrong.push(`empty offer, no menu: want pending, not done, got ${show(b.action)}`);
  const c = await answer({ config: emptyOffer, settings, local: [...baseLocal(), menuEv({ rows: [['duty', '39998', DLIST]] })] });
  if (!(c.action && c.action.current === false && c.action.pending === true)) wrong.push(`empty offer, a menu with rows: want out of date, got ${show(c.action)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U27: a duty-menu check that throws does not take the other answers with it — 200, identification-tags and outbox-relays answered, and the duty-menu action is the check-failed answer (ADR 0001 sub-decisions 4, 7)', async () => {
  const got = await answer({ quiet: true, checkDutyMenu: async () => { throw new Error('fixture: the duty-menu check exploded'); } });
  const actions = (got.body && got.body.actions) || {};
  const wrong = [];
  if (got.res.statusCode !== 200 || !got.body || got.body.success !== true) wrong.push(`want 200 success, got ${got.res.statusCode} ${show(got.body)}`);
  if (!actions['identification-tags'] || !actions['outbox-relays']) wrong.push('the other actions still answer');
  if (got.calls.checkDutyMenu.length !== 1) wrong.push(`the check ran once, got ${got.calls.checkDutyMenu.length}`);
  if (!sameJson(got.action, DM.ANSWERS.CHECK_FAILED)) wrong.push(`want ${show(DM.ANSWERS.CHECK_FAILED)}, got ${show(got.action)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── U — ADR 0001 Amendment 1 ───────────────────────── */

test('U28: local-only mode is read through the isLocalOnly seam — injected true leaves Concepts off the DList relay though the environment and config say false; injected false keeps them there though both say true (ADR 0001 Amendment 1 item 2)', async () => {
  // Re-aimed by duty-menu-public-relay #1: a public STRFRY_DOMAIN now gives a public relay, so "no public address" sets a non-public one too.
  const privateOwn = { BRAINSTORM_RELAY_URL: 'ws://localhost:7777', STRFRY_DOMAIN: 'localhost' };
  const wrong = [];
  const on = await answer({ localOnly: false, localOnlySeam: true, config: privateOwn });
  wrong.push(...offerDiff('seam true, env and config false', offerOf(on), []));
  const off = await answer({ localOnly: true, localOnlySeam: false, config: privateOwn });
  wrong.push(...offerDiff('seam false, env and config true', offerOf(off), offerAt(null, { dlistRelay: DLIST })));
  assert(wrong.length === 0, wrong.join('; '));
});

test('U29: a DList relay spelled wss://Dcosl.example/ in Relay Settings is offered as wss://dcosl.example, and a menu written with that spelling is current — done (ADR 0001 Amendment 1 item 3; AC-4)', async () => {
  const dcosl = 'wss://dcosl.example';
  // Re-aimed by duty-menu-public-relay #1: a public STRFRY_DOMAIN now gives a public relay, so "no public address" sets a non-public one too.
  const opts = { config: { BRAINSTORM_RELAY_URL: 'ws://localhost:7777', STRFRY_DOMAIN: 'localhost' }, settings: { aDListRelays: ['wss://Dcosl.example/'] } };
  const want = offerAt(null, { dlistRelay: dcosl });
  const wrong = [];
  const none = await answer(opts);
  wrong.push(...offerDiff('the offer', offerOf(none), want));
  const menu = menuEv({ rows: [['duty', '39998', dcosl], ['duty', '39999', dcosl]] });
  const got = await answer({ ...opts, local: [...baseLocal(), menu] });
  if (!(got.action && got.action.current === true && got.action.done === true)) wrong.push(`the menu with the normalized spelling is current and done: ${show(got.action)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U30: in the answer, a published not-offered row carries relay null, and every duty row a relay string (ADR 0001 Amendment 1 items 4, 5)', async () => {
  const menu = menuEv({ rows: [...offerAt(OWN), ['not-offered', '30385'], ['duty', '30383', 'https://web.example']] });
  const got = await answer({ local: [...baseLocal(), menu] });
  const rows = got.action && got.action.published ? got.action.published.rows : null;
  const wrong = [];
  if (!Array.isArray(rows)) wrong.push(`no published rows: ${show(got.action)}`);
  else {
    const no = rows.filter((r) => r.tag === 'not-offered');
    if (!sameJson(no, [{ tag: 'not-offered', key: '30385', relay: null }])) wrong.push(`the not-offered row: want relay null, got ${show(no)}`);
    if (rows.some((r) => r.tag === 'duty' && (typeof r.relay !== 'string' || !/^wss?:\/\//.test(r.relay)))) wrong.push(`a duty row without a ws:// or wss:// relay: ${show(rows)}`);
    if (rows.some((r) => r.key === '30383')) wrong.push('the https:// row is dropped');
  }
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── U — ADR 0001 Amendment 2 ───────────────────────── */

test('U31: when the newest version carries ["z", "list"] or a concept-header z, the Assistant has no menu — published null, pending — though an older conforming version exists (ADR 0001 Amendment 2 item 1; § 8.1)', async () => {
  const older = menuEv({ createdAt: 1000, rows: offerAt(OWN) });
  const wrong = [];
  for (const [label, z] of [['["z", "list"]', 'list'], ['a concept-header z', `39998:${OTHER}:concept-header`]]) {
    const newer = menuEv({ createdAt: 2000, rows: offerAt(OWN), z: [DM.DUTY_MENU_HEADER, z] });
    // Re-aimed by assistant-duty-menu #2 (AC-5): the older version sits outside too, so both are read.
    const got = await answer({ local: baseLocal(), relays: { ...quietRelays(), [HINT2]: [older], [HINT]: [newer] } });
    const a = got.action || {};
    if (!(a.finished === true && a.published === null && a.current === false && a.done === false && a.pending === true)) wrong.push(`${label}: want finished, published null, pending; got ${show(a)}`);
  }
  const control = await answer({ local: [...baseLocal(), older] });
  if (!(control.action && control.action.published && control.action.published.eventId === older.id && control.action.done === true)) wrong.push(`control: the older menu alone is found and done, got ${show(control.action)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U32: at most 50 relays named inside events are guarded and read per check — the first 50 after normalizing, outsideOnly and de-duplication, in § 8.1\'s order (Map hints, the Assistant\'s write relays, Nous\'); the offer\'s configured relay is read on top (ADR 0001 Amendment 2 item 2)', async () => {
  const H = Array.from({ length: 40 }, (_, i) => `wss://hint-${i}.example`);
  const A = Array.from({ length: 20 }, (_, i) => `wss://write-${i}.example`);
  const N = Array.from({ length: 15 }, (_, i) => `wss://nous-${i}.example`);
  // Duplicates and this instance's own relay, none of which may take a place among the 50.
  // Re-aimed by duty-menu-public-relay #1: with no public address this instance is localhost alone (STRFRY_DOMAIN below).
  const mapTags = [['30382:rank', ASSISTANT, 'ws://localhost:7777'], ...H.map((u) => ['30382:rank', ASSISTANT, u]), ['39998', ASSISTANT, 'wss://Hint-5.example/']];
  const aTags = [['r', H[3]], ...A.map((u) => ['r', u])];
  const nTags = [...N.slice(0, 10).map((u) => ['r', u, 'write']), ...A.slice(0, 5).map((u) => ['r', u, 'write'])];
  const local = [mapEv(mapTags), relayListEv(ASSISTANT, aTags), relayListEv(NOUS, nTags)];
  const distinct = [...H, ...A, ...N.slice(0, 10)];
  assert(distinct.length === 70, `fixture: 70 distinct relays named in events, got ${distinct.length}`);
  const first50 = distinct.slice(0, DM.MAX_EVENT_RELAYS);
  const relays = Object.fromEntries([...distinct, DLIST].map((u) => [u, []]));
  const got = await answer({ local, relays, config: { BRAINSTORM_RELAY_URL: 'ws://localhost:7777', STRFRY_DOMAIN: 'localhost' } });
  const guarded = [...new Set(got.calls.guard)];
  const read = readUrls(got);
  const wrong = [];
  if (got.calls.guard.length > DM.MAX_EVENT_RELAYS) wrong.push(`isPublicRelayHostWithin was asked ${got.calls.guard.length} times, want at most ${DM.MAX_EVENT_RELAYS}`);
  const want50 = first50.map(hostOf);
  const extra = guarded.filter((h) => !want50.includes(h));
  const unasked = want50.filter((h) => !guarded.includes(h));
  if (extra.length || unasked.length) wrong.push(`the guard is asked about exactly the first 50: ${extra.length} beyond them (e.g. ${show(extra.slice(0, 3))}), ${unasked.length} of them not asked (e.g. ${show(unasked.slice(0, 3))})`);
  const eventRead = read.filter((u) => u !== normUrl(DLIST));
  if (eventRead.length > DM.MAX_EVENT_RELAYS) wrong.push(`${eventRead.length} event-named relays read, want at most ${DM.MAX_EVENT_RELAYS}`);
  const missing = first50.filter((u) => !read.includes(normUrl(u)));
  if (missing.length) wrong.push(`the first 50 are really read: missing ${show(missing.slice(0, 5))}${missing.length > 5 ? ` and ${missing.length - 5} more` : ''}`);
  const beyond = distinct.slice(DM.MAX_EVENT_RELAYS).filter((u) => read.includes(normUrl(u)));
  if (beyond.length) wrong.push(`relays past the 50th were read: ${show(beyond.slice(0, 5))}${beyond.length > 5 ? ` and ${beyond.length - 5} more` : ''}`);
  if (!read.includes(normUrl(DLIST))) wrong.push('the offer\'s configured DList relay is read on top of the 50');
  if (read.some((u) => hostOf(u) === 'localhost')) wrong.push('this instance\'s own relay is never read');
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── U — story 2: this instance's relay first (AC-5; ADR 0002 sub-decision 7) ───────────────────────── */

test('U33: when this instance\'s relay holds any version of the Assistant\'s menu, the newest there counts — even with a newer one outside — and nothing else runs: no Map or relay-list lookup, no DNS check, no outside read (story 2 AC-5; ADR 0002 R-A)', async () => {
  const older = menuEv({ createdAt: 1000, rows: offerAt(OWN) });
  const newestHere = menuEv({ createdAt: 1500, rows: offerAt(OWN) });
  const newerOutside = menuEv({ createdAt: 9000, rows: [['duty', '30392', 'wss://elsewhere.example']] });
  const got = await answer({ local: [...baseLocal(), older, newestHere], relays: { ...quietRelays(), [HINT]: [newerOutside], [A_WRITE]: [newerOutside] } });
  const a = got.action || {};
  const wrong = [];
  if (!(a.finished === true && a.published && a.published.eventId === newestHere.id && a.published.source === 'local' && a.done === true)) wrong.push(`the newest here counts, done: ${show(a)}`);
  if (got.menuScans.length < 1) wrong.push('the local scan ran');
  const other = got.calls.scanLocal.filter((f) => !isMenuFilter(f) && Array.isArray(f.kinds) && (f.kinds.includes(DM.TREASURE_MAP_KIND) || f.kinds.includes(DM.RELAY_LIST_KIND)));
  if (other.length) wrong.push(`no hint lookup: scanned ${show(other)}`);
  const outside = got.calls.readRelay.map((c) => c.url);
  if (outside.length) wrong.push(`no outside read at all: read ${show(outside)}`);
  if (got.calls.guard.length) wrong.push(`no DNS check: ${show(got.calls.guard)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U34: a newest version here that is not a menu by § 6.1 means the Assistant has none — even when an older version here is one — still with no outside read (story 2 AC-5: "as before")', async () => {
  const valid = menuEv({ createdAt: 1000, rows: offerAt(OWN) });
  const bad = menuEv({ createdAt: 2000, rows: offerAt(OWN), z: [] });
  const got = await answer({ local: [...baseLocal(), valid, bad], relays: { ...quietRelays(), [HINT]: [valid] } });
  const a = got.action || {};
  const wrong = [];
  if (!(a.finished === true && a.published === null && a.pending === true)) wrong.push(`want finished, no menu, pending: ${show(a)}`);
  if (got.calls.readRelay.length) wrong.push(`no outside read: ${show(got.calls.readRelay.map((c) => c.url))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U35: with no version here, or a failed local scan, story 1\'s two rounds run — the Map and both relay lists are read, the outside relays asked, and the newest found counts; "finished" keeps its meaning (story 2 AC-5)', async () => {
  const outside = menuEv({ createdAt: 1000, rows: offerAt(OWN) });
  const wrong = [];
  const none = await answer({ local: baseLocal(), relays: { ...quietRelays(), [HINT]: [outside] } });
  if (!(none.action && none.action.published && none.action.published.eventId === outside.id && none.action.published.source === 'relay')) wrong.push(`none here: the outside menu counts: ${show(none.action)}`);
  if (!none.calls.scanLocal.some(isMapFilter) || !readUrls(none).includes(normUrl(HINT))) wrong.push('none here: the hint round and the outside reads ran');
  const failed = await answer({ local: baseLocal(), rejectScan: isMenuFilter, relays: { ...quietRelays(), [A_WRITE]: [outside] } });
  if (!(failed.action && failed.action.finished === true && failed.action.published && failed.action.published.eventId === outside.id)) wrong.push(`a failed local scan: the rounds run and a relay's answer finishes the check: ${show(failed.action)}`);
  const nothing = await answer({ local: baseLocal(), rejectScan: isMenuFilter, relays: {} });
  if (!(nothing.action && nothing.action.finished === false && nothing.action.reason === 'no-relay-answered')) wrong.push(`a failed scan and no relay: unfinished, no-relay-answered: ${show(nothing.action)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U36: lookupPublishedMenu returns `latest`, the newest version found whatever its validity, beside `published` — the one here, an invalid one, one found outside, or none; the attention answer\'s shape is unchanged (U3) (ADR 0002 sub-decisions 4, 7)', async () => {
  const { duty } = freshModules();
  const look = need(duty, 'lookupPublishedMenu', rel(DUTY_MODULE));
  const run = (opts) => look({ assistantPubkey: ASSISTANT, viewer: VIEWER, offer: [] }, fakes(opts).deps);
  const valid = menuEv({ createdAt: 1000, rows: offerAt(OWN) });
  const bad = menuEv({ createdAt: 2000, rows: offerAt(OWN), z: [] });
  const outside = menuEv({ createdAt: 3000, rows: offerAt(OWN) });
  const wrong = [];
  const here = await run({ local: [...baseLocal(), valid] });
  if (!(here && here.latest && here.latest.id === valid.id && here.published && here.published.eventId === valid.id)) wrong.push(`here: ${show(here && { latest: here.latest && here.latest.id, published: here.published })}`);
  const invalid = await run({ local: [...baseLocal(), valid, bad] });
  if (!(invalid && invalid.latest && invalid.latest.id === bad.id && invalid.published === null)) wrong.push(`invalid newest: want latest ${bad.id} and published null, got ${show(invalid && { latest: invalid.latest && invalid.latest.id, published: invalid.published })}`);
  const out = await run({ local: baseLocal(), relays: { ...quietRelays(), [HINT]: [outside] } });
  if (!(out && out.latest && out.latest.id === outside.id)) wrong.push(`outside: want latest ${outside.id}, got ${show(out && out.latest && out.latest.id)}`);
  const nothing = await run({ local: baseLocal() });
  if (!(nothing && nothing.finished === true && !nothing.latest && nothing.published === null)) wrong.push(`none: want no latest, got ${show(nothing)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('U37: dutyMenu.js exports the publisher\'s write-relay helpers — assistantWriteRelays gives the Assistant\'s write relays (no read-only ones), and nousWriteRelays shares the check\'s one Nous cache: after a check found Nous\' list, it answers within the hour with no lookup (ADR 0002 § Implementation notes)', async () => {
  const session = freshModules();
  const { duty } = session;
  const assistantWriteRelays = need(duty, 'assistantWriteRelays', rel(DUTY_MODULE));
  const nousWriteRelays = need(duty, 'nousWriteRelays', rel(DUTY_MODULE));
  const clock = { t: T0 };
  await answer({ clock }, signedInReq(), session);
  clock.t = T0 + 1000;
  const { deps, calls } = fakes({ clock });
  const full = { ...deps, outsideOnly: (urls, d) => require('../src/api/setup/status').outsideOnly(urls, d || full), lookupNewestReplaceable: (input, d) => require('../src/api/assistant/attention').lookupNewestReplaceable(input, d || full) };
  const wrong = [];
  const aw = (await assistantWriteRelays({ assistantPubkey: ASSISTANT }, full)).map(normUrl);
  for (const u of [A_WRITE, A_WRITE2]) if (!aw.includes(normUrl(u))) wrong.push(`assistantWriteRelays has ${u}`);
  if (aw.includes(normUrl(A_READ))) wrong.push('assistantWriteRelays leaves out a read-only relay');
  const before = calls.scanLocal.filter(isNousListFilter).length + calls.readRelay.filter((c) => isNousListFilter(c.filter)).length;
  const nw = (await nousWriteRelays([PUB1], full)).map(normUrl);
  const after = calls.scanLocal.filter(isNousListFilter).length + calls.readRelay.filter((c) => isNousListFilter(c.filter)).length;
  if (!nw.includes(normUrl(NOUS_WRITE)) || nw.includes(normUrl(NOUS_READ))) wrong.push(`nousWriteRelays: want Nous' write relays, got ${show(nw)}`);
  if (after !== before) wrong.push('within the hour of the check, nousWriteRelays looked Nous\' list up again: the cache is not shared');
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── U — duty-menu-public-relay #1: the instance's public relay address ───────────────────────── */
// Story: engineering-team/stories/duty-menu-public-relay/1-the-instances-public-relay-address.md (Design note: the
// helper instanceRelayUrl in src/api/assistant/profileDefaults.js). On Docker deployments BRAINSTORM_RELAY_URL is the
// container-internal ws://localhost:7777 (docker/entrypoint.sh's RELAY_URL default); ws://tapestry:80/relay is another
// internal address no stranger can reach.

const DOCKER_RELAY = 'ws://localhost:7777';
const OTHER_INTERNAL_RELAY = 'ws://tapestry:80/relay';
const PUBLIC_DOMAIN = 'staging.example.org';
const DERIVED = 'wss://staging.example.org/relay';

test('U38: on Docker — BRAINSTORM_RELAY_URL ws://localhost:7777 (docker/entrypoint.sh), or another internal address such as ws://tapestry:80/relay, beside a public STRFRY_DOMAIN — the offer names wss://<domain>/relay for Scores (when the viewer gets them), Lists and Concepts, in its one spelling; a DList setting naming the same address adds no row (duty-menu-public-relay AC-1)', async () => {
  const wrong = [];
  const owner = await answer({ config: { BRAINSTORM_RELAY_URL: DOCKER_RELAY, STRFRY_DOMAIN: PUBLIC_DOMAIN, BRAINSTORM_OWNER_PUBKEY: VIEWER } });
  wrong.push(...offerDiff('the Owner', offerOf(owner), offerAt(DERIVED)));
  const internal = await answer({ config: { BRAINSTORM_RELAY_URL: OTHER_INTERNAL_RELAY, STRFRY_DOMAIN: PUBLIC_DOMAIN, BRAINSTORM_OWNER_PUBKEY: VIEWER } });
  wrong.push(...offerDiff('the Owner, beside ws://tapestry:80/relay', offerOf(internal), offerAt(DERIVED)));
  const guest = await answer({ config: { BRAINSTORM_RELAY_URL: DOCKER_RELAY, STRFRY_DOMAIN: 'Staging.Example.ORG' } });
  wrong.push(...offerDiff('a viewer who is not a customer (the six since assistant-duties-settings #1), the domain written in capitals', offerOf(guest), offerAt(DERIVED)));
  const same = await answer({ config: { BRAINSTORM_RELAY_URL: DOCKER_RELAY, STRFRY_DOMAIN: PUBLIC_DOMAIN }, settings: { aDListRelays: ['wss://Staging.Example.org/relay/', DLIST] } });
  wrong.push(...offerDiff('the DList setting names the same address', offerOf(same), offerAt(DERIVED)));
  assert(wrong.length === 0, wrong.join('; '));
});

test('U39: a public BRAINSTORM_RELAY_URL still wins, in its one spelling, whatever STRFRY_DOMAIN says (duty-menu-public-relay AC-2)', async () => {
  const got = await answer({ config: { BRAINSTORM_RELAY_URL: 'wss://Relay.Example.org/', STRFRY_DOMAIN: PUBLIC_DOMAIN, BRAINSTORM_OWNER_PUBKEY: VIEWER } });
  const wrong = offerDiff('a public relay URL beside another domain', offerOf(got), offerAt('wss://relay.example.org'));
  assert(wrong.length === 0, wrong.join('; '));
});

test('U40: no public address at all — the Docker relay URL beside a STRFRY_DOMAIN that is localhost:7777, a private IP, a name with no dot, localhost or not set — no Scores or Lists, and Concepts at the DList relay, as before (duty-menu-public-relay AC-3)', async () => {
  const wrong = [];
  for (const domain of ['localhost:7777', '10.0.0.5', 'tapestry', 'localhost', '', undefined]) {
    const got = await answer({ config: { BRAINSTORM_RELAY_URL: DOCKER_RELAY, STRFRY_DOMAIN: domain, BRAINSTORM_OWNER_PUBKEY: VIEWER } });
    wrong.push(...offerDiff(`STRFRY_DOMAIN ${show(domain)}`, offerOf(got), offerAt(null, { dlistRelay: DLIST })));
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('U41: the derived address is still this instance — on Docker it is never read as an outside relay, whether the offer, a Map hint or the Assistant\'s relay list names it (in another case or with a slash; a trailing-dot domain in its own spelling), while the other hinted relays are read (duty-menu-public-relay AC-4)', async () => {
  // outsideOnly (unchanged by this story) compares hosts as STRFRY_DOMAIN writes them, so a trailing-dot domain's
  // relay is named here with its dot.
  const localFor = (host) => [
    mapEv([['30382:rank', ASSISTANT, `wss://${host.toUpperCase()}/relay/`], ['39998', ASSISTANT, HINT]]),
    relayListEv(ASSISTANT, [['r', `wss://${host}/relay`], ['r', A_WRITE]]),
    relayListEv(NOUS, [['r', NOUS_WRITE, 'write']]),
  ];
  const wrong = [];
  for (const domain of [PUBLIC_DOMAIN, 'staging.example.org.']) {
    const got = await answer({ local: localFor(domain), config: { BRAINSTORM_RELAY_URL: DOCKER_RELAY, STRFRY_DOMAIN: domain } });
    const urls = readUrls(got);
    const own = urls.filter((u) => ['staging.example.org', 'staging.example.org.', 'localhost'].includes(hostOf(u)));
    if (own.length) wrong.push(`STRFRY_DOMAIN ${show(domain)}: this instance's relay was read as outside: ${show(own)}`);
    for (const u of [HINT, A_WRITE, NOUS_WRITE]) if (!urls.includes(normUrl(u))) wrong.push(`STRFRY_DOMAIN ${show(domain)}: the control ${u} is read`);
    if (got.menuScans.length !== 1) wrong.push(`STRFRY_DOMAIN ${show(domain)}: this instance's relay is scanned locally, once (got ${got.menuScans.length})`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── C — the hub's data module ───────────────────────── */

const USER = { pubkey: 'cc'.repeat(32), classification: 'customer', assistantPubkey: 'c1'.repeat(32) };
const answered = (actions) => ({ answered: true, hasAssistant: true, actions });
/** Every checked action done but the duty menu, which is `dutyMenu` (or absent). */
function withOthersDone(mod, dutyMenu) {
  const actions = {};
  for (const k of mod.CHECKED_ACTIONS || []) if (k !== DM.KEY) actions[k] = { finished: true, done: true, pending: false };
  if (dutyMenu !== undefined) actions[DM.KEY] = dutyMenu;
  return answered(actions);
}

test('C1: the Duty Menu entry keeps its title, address, section and description, and its page now has the ADR\'s alert criteria and no planning notes (AC-4; ADR 0001 sub-decision 6)', async () => {
  const mod = await actionsModule();
  const entry = (mod.ASSISTANT_ACTIONS || []).find((a) => a && a.key === DM.KEY);
  assert(entry, `no ${DM.KEY} action`);
  const card = DC.CARDS.find((c) => c.key === DM.KEY);
  const text = (entry.description || []).map((p) => (typeof p === 'string' ? p : p.text)).join('');
  const wrong = [];
  for (const k of ['section', 'path', 'title']) if (entry[k] !== card[k]) wrong.push(`${k}: want ${show(card[k])}, got ${show(entry[k])}`);
  if (entry.path !== DM.PATH) wrong.push(`path: want ${DM.PATH}`);
  if (text !== card.text) wrong.push(`description: want ${show(card.text)}, got ${show(text)}`);
  if (entry.alertCriteria !== DM.ALERT_CRITERIA) wrong.push(`alertCriteria: want ${show(DM.ALERT_CRITERIA)}, got ${show(entry.alertCriteria)}`);
  if ((entry.planningNotes ?? null) !== DM.PLANNING_NOTES) wrong.push(`planningNotes: want null, got ${show(entry.planningNotes)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('C2: CHECKED_ACTIONS gains duty-menu right after outbox-relays, in ASSISTANT_ACTIONS order; the Treasure Map card follows it since assistant-self-map #1 (AC-4; ADR 0001 sub-decision 6)', async () => {
  const mod = await actionsModule();
  const checked = Array.isArray(mod.CHECKED_ACTIONS) ? mod.CHECKED_ACTIONS : [];
  const keys = (mod.ASSISTANT_ACTIONS || []).map((a) => a.key);
  const wrong = [];
  const at = checked.indexOf(DM.KEY);
  if (at < 0) wrong.push(`${DM.KEY} is not checked`);
  else if (checked[at - 1] !== DM.CHECKED_AFTER) wrong.push(`right after ${DM.CHECKED_AFTER}, got after ${show(checked[at - 1])}`);
  if (!sameJson(checked, keys.filter((k) => checked.includes(k)))) wrong.push('in ASSISTANT_ACTIONS order');
  // Re-aimed by assistant-self-map #1 (its ADR 0001 sub-decision 9): the Treasure Map card is checked, right after this one.
  if (at >= 0 && checked[at + 1] !== SM.KEY) wrong.push(`${SM.KEY} right after ${DM.KEY}, got ${show(checked[at + 1])}`);
  assert(wrong.length === 0, `CHECKED_ACTIONS ${show(checked)}: ${wrong.join('; ')}`);
});

test('C3: the two readings for the Duty Menu — done: unmarked, in Done, not counted; pending (no menu, out of date, empty offer and no menu): marked and counted; unfinished, check-failed, missing, not answered or checking: marked, never counted; the count line is the marks (AC-4)', async () => {
  const mod = await actionsModule();
  const all = (mod.ASSISTANT_ACTIONS || []).map((a) => a.key);
  // The placeholders once the Duty Menu is checked: every action without a check, the Duty Menu aside. Re-aimed by
  // assistant-coming-soon #1 (AC-2): less the five that say Coming soon, which are never counted.
  const placeholders = all.filter((k) => !(mod.CHECKED_ACTIONS || []).includes(k) && k !== DM.KEY && !CS.KEYS.includes(k)).length;
  const cases = [
    ['done', withOthersDone(mod, DM.ANSWERS.DONE), 'done'],
    ['done, empty offer and empty menu', withOthersDone(mod, DM.ANSWERS.EMPTY_DONE), 'done'],
    ['pending: none published', withOthersDone(mod, DM.ANSWERS.NONE), 'counted'],
    ['pending: out of date', withOthersDone(mod, DM.ANSWERS.STALE), 'counted'],
    ['pending: empty offer, no menu', withOthersDone(mod, DM.ANSWERS.EMPTY_NONE), 'counted'],
    ['unfinished', withOthersDone(mod, DM.ANSWERS.UNFINISHED), 'marked'],
    ['check-failed', withOthersDone(mod, DM.ANSWERS.CHECK_FAILED), 'marked'],
    ['no duty-menu key', withOthersDone(mod, undefined), 'marked'],
    ['not answered', { answered: false, actions: {} }, 'marked'],
    ['checking', { phase: 'checking', answered: false, actions: {} }, 'marked'],
  ];
  const wrong = [];
  for (const [label, att, state] of cases) {
    const got = mod.assistantAttention(USER, att);
    const marked = got.needsAttention.includes(DM.KEY);
    const isDone = Array.isArray(got.done) && got.done.includes(DM.KEY);
    const othersPending = Object.entries(att.answered ? att.actions : {}).filter(([k, v]) => k !== DM.KEY && v && v.pending === true).length;
    const counted = got.alertCount - placeholders - othersPending;
    if (marked !== (state !== 'done')) wrong.push(`${label}: marked want ${state !== 'done'}, got ${marked}`);
    if (isDone !== (state === 'done')) wrong.push(`${label}: in Done want ${state === 'done'}, got ${isDone}`);
    if (counted !== (state === 'counted' ? 1 : 0)) wrong.push(`${label}: counted in the Alert want ${state === 'counted'}, got ${counted} (alertCount ${got.alertCount}, placeholders ${placeholders})`);
    if (got.count !== got.needsAttention.length) wrong.push(`${label}: the count line counts the marks`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('C4, re-aimed by assistant-self-map #1: beside a Duty Menu that is Done, Your Assistant\'s Treasure Map card is read by its own answer — none: marked, not counted; done: Done; pending: marked and counted — and the Duty Menu stays Done throughout (AC-4)', async () => {
  const mod = await actionsModule();
  const wrong = [];
  const read = (claim) => {
    const att = withOthersDone(mod, DM.ANSWERS.DONE);
    if (claim === null) delete att.actions[SM.KEY]; else att.actions[SM.KEY] = claim;
    return mod.assistantAttention(USER, att);
  };
  const none = read(null);
  const done = read({ finished: true, done: true, pending: false });
  const pending = read({ finished: true, done: false, pending: true });
  for (const [label, got] of [['no answer', none], ['done', done], ['pending', pending]]) {
    if (!(got.done || []).includes(DM.KEY)) wrong.push(`${label}: the Duty Menu beside it is Done (the path ran)`);
  }
  if (!none.needsAttention.includes(SM.KEY) || none.alertCount !== 0) wrong.push(`no answer: marked, not counted; got ${show({ needsAttention: none.needsAttention, alertCount: none.alertCount })}`);
  if (done.needsAttention.includes(SM.KEY) || !(done.done || []).includes(SM.KEY)) wrong.push('done: unmarked and Done');
  if (!pending.needsAttention.includes(SM.KEY) || pending.alertCount !== 1) wrong.push(`pending: marked and counted once; got ${show({ needsAttention: pending.needsAttention, alertCount: pending.alertCount })}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('C5: the hub\'s count line and the Alert drop by one for a viewer whose Duty Menu is done — with every check done they count the placeholders only (AC-4; ADR 0001 § Consequences)', async () => {
  const mod = await actionsModule();
  const done = mod.assistantAttention(USER, withOthersDone(mod, DM.ANSWERS.DONE));
  const pending = mod.assistantAttention(USER, withOthersDone(mod, DM.ANSWERS.NONE));
  // Re-aimed by assistant-coming-soon #1 (AC-2): the counted placeholders, less the five that say Coming soon.
  const placeholders = DC.ALL_KEYS.filter((k) => !DC.CHECKED.includes(k) && !CS.KEYS.includes(k));
  const wrong = [];
  if (!sameJson(done.needsAttention, placeholders)) wrong.push(`all done: the marks are the placeholders ${show(placeholders)}, got ${show(done.needsAttention)}`);
  if (done.count !== placeholders.length || done.alertCount !== placeholders.length) wrong.push(`all done: count and Alert ${placeholders.length}, got ${done.count} / ${done.alertCount}`);
  if (pending.count !== done.count + 1 || pending.alertCount !== done.alertCount + 1) wrong.push(`a pending Duty Menu adds one to each: ${done.count}/${done.alertCount} → ${pending.count}/${pending.alertCount}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('C6: a visitor, or a signed-in viewer with no Assistant here, sees no mark, no Done and nothing counted, whatever the Duty Menu answer says (AC-4)', async () => {
  const mod = await actionsModule();
  const NONE = { hasAssistant: false, needsAttention: [], done: [], count: 0, alertCount: 0 };
  const wrong = [];
  for (const [label, user] of [['visitor', null], ['no assistant', { pubkey: 'ee'.repeat(32), classification: 'guest', assistantPubkey: null }]]) {
    for (const dm of [DM.ANSWERS.DONE, DM.ANSWERS.NONE]) {
      const got = mod.assistantAttention(user, withOthersDone(mod, dm));
      const shaped = got && { hasAssistant: got.hasAssistant, needsAttention: got.needsAttention, done: got.done, count: got.count, alertCount: got.alertCount };
      if (!sameJson(shaped, NONE)) wrong.push(`${label}: ${show(shaped)}`);
    }
  }
  const control = mod.assistantAttention(USER, withOthersDone(mod, DM.ANSWERS.NONE));
  if (!control.needsAttention.includes(DM.KEY)) wrong.push('control: a viewer with an Assistant sees the mark');
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── S — server sentinels ───────────────────────── */

test('S1: the duty-menu check is read-only and session-only — nothing imported into strfry, signed, published or written, and no request parameter read (AC-6; AC-1)', () => {
  const src = codeOnly(safeRead(DUTY_MODULE));
  assert(src, `${rel(DUTY_MODULE)} does not exist`);
  const forbidden = [/importEvent|importToLocalRelay|strfry\s+import/, /finalizeEvent|signEvent|getAssistantKeys|getPrivateKey|nsec/, /publishToRelays|publishEvent|\.publish\s*\(/,
    /updateSetting|writeFile|appendFile|setConfig/, /\breq\.(query|params|body)\b/];
  const hits = forbidden.filter((re) => re.test(src)).map(String);
  assert(hits.length === 0, `the check must not write or read the request: ${hits.join(', ')}`);
  assert(/\bcheckDutyMenu\b/.test(src) && /module\.exports/.test(src), 'and it exists: it exports checkDutyMenu');
});

test('S2: Nous\' key is written once — in src/lib/nous.js — and the library and the check take it from there (ADR 0001 sub-decision 1: "the one definition of Nous\' key")', () => {
  const nousSrc = codeOnly(safeRead(NOUS_MOD));
  assert(nousSrc.includes(NOUS), `${rel(NOUS_MOD)} ${nousSrc ? 'does not hold Nous\' key' : 'does not exist'}: ADR 0001 sub-decision 1 makes it the one place the key is written`);
  const wrong = [];
  for (const file of [LIB, DUTY_MODULE]) {
    const src = codeOnly(safeRead(file));
    if (!src) wrong.push(`${rel(file)} does not exist`);
    else if (src.includes(NOUS)) wrong.push(`${rel(file)} retypes Nous' key instead of requiring src/lib/nous`);
  }
  if (!/require\s*\(\s*['"][./]*nous(\.js)?['"]\s*\)/.test(codeOnly(safeRead(LIB)))) wrong.push('the library requires ../nous');
  assert(wrong.length === 0, wrong.join('; '));
});

test('S3: attention.js runs the duty-menu check as a fifth side-by-side check — a checkDutyMenu dependency, the key DUTY_MENU = "duty-menu" beside the others — and its header comment documents it (ADR 0001 sub-decision 7)', () => {
  const raw = safeRead(ATTENTION_MODULE);
  const src = codeOnly(raw);
  const wrong = [];
  if (!/\bcheckDutyMenu\b/.test(src)) wrong.push('no checkDutyMenu dependency');
  if (!/\bDUTY_MENU\s*=\s*['"]duty-menu['"]/.test(src)) wrong.push('no DUTY_MENU = "duty-menu" key constant');
  if (!/Promise\.allSettled\s*\(/.test(src)) wrong.push('the checks still run side by side (Promise.allSettled)');
  const header = (raw.match(/^\/\*\*[\s\S]*?\*\//) || [''])[0];
  if (!/duty-menu|Duty Menu/.test(header)) wrong.push('the header comment documents the duty-menu check');
  assert(wrong.length === 0, wrong.join('; '));
});

test('S4: the OpenAPI document and BIBLE §11 describe the duty-menu action of GET /api/assistant/attention — its offer, published and current fields and the no-relay-answered reason (ADR 0001 Amendment 1 item 7)', () => {
  const openapi = safeRead(path.join(REPO, 'src/api/openapi.yaml'));
  const at = openapi.indexOf('/api/assistant/attention:');
  const block = at >= 0 ? openapi.slice(at, openapi.indexOf(NL + '  /api/', at + 10)) : '';
  const wrong = [];
  if (!block) wrong.push('openapi.yaml has no /api/assistant/attention block');
  if (!/duty-menu/.test(block)) wrong.push('the block names the duty-menu action');
  for (const field of ['offer', 'published', 'current']) if (!new RegExp(`^\\s+${field}:`, 'm').test(block)) wrong.push(`the block's schema has the ${field} field`);
  if (!/no-relay-answered/.test(block)) wrong.push('the block names the no-relay-answered reason');
  const bibleRow = safeRead(path.join(REPO, 'BIBLE.md')).split(NL).find((l) => l.includes('`/api/assistant/attention`')) || '';
  if (!/duty-menu|Duty Menu/.test(bibleRow)) wrong.push('BIBLE §11: the /api/assistant/attention row names the duty-menu check');
  assert(wrong.length === 0, wrong.join('; '));
});

test('S5: the check reads local-only mode through an isLocalOnly dependency whose default is the house reader, isPublishLocalOnly (ADR 0001 Amendment 1 item 2)', () => {
  const src = codeOnly(safeRead(DUTY_MODULE));
  assert(src, `${rel(DUTY_MODULE)} does not exist`);
  const wrong = [];
  if (!/\bisLocalOnly\s*:/.test(src)) wrong.push('no isLocalOnly dependency in defaultDeps()');
  if (!/\bisPublishLocalOnly\s*\(/.test(src)) wrong.push('its default does not call isPublishLocalOnly()');
  if (!/\.isLocalOnly\s*\(/.test(src)) wrong.push('the check never calls d.isLocalOnly()');
  assert(wrong.length === 0, wrong.join('; '));
});

async function run() {
  console.log(`${NL}=== assistant-duty-menu-check (assistant-duty-menu #1) ===`);
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
      else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}assistant-duty-menu-check: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

module.exports = { run };
