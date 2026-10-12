'use strict';
/**
 * assistant-duties-settings #1: the Assistant Duties tab — the duties every Assistant on this instance offers, kept in
 * the instance settings and edited by the Owner or an Admin.
 *
 * Story: engineering-team/stories/assistant-duties-settings/1-the-assistant-duties-tab.md
 * ADR:   engineering-team/decisions/assistant-duties-settings/0001-the-offered-duties-live-in-the-instance-settings.md
 * Plan:  engineering-team/stories/assistant-duties-settings/1-the-assistant-duties-tab.test-plan.md
 * Words, routes and defaults: test/helpers/assistantDutiesFixtures.js. Browser half:
 * tests/brainstorm/assistant-duties-settings.spec.js. Re-aimed elsewhere (the offer is the list, the same for every
 * Assistant; "current" counts order; the page's two sentences): test/assistant-duty-menu-check.test.js,
 * test/assistant-duty-menu-publish.test.js (W14), test/assistant-self-map-check.test.js (AD1–AD3) and
 * test/assistant-duty-menu-page.test.js, through test/helpers/dutyMenuFixtures.js.
 *
 * Classes (all stack-free):
 *   L — the one rule, in src/lib/duty-menu: dutyKeyOf/keptKey (readers' rule, one copy), isPublicRelayUrl,
 *       validateDutyList (strict, codes), readDutyList (lenient), instanceRelayFor, buildOffer over a list.
 *                                                                                         [AC-2, AC-3, AC-4, AC-6]
 *   D — the defaults and the settings file: defaults.json's six; saved, survives a restart, empty persists, reset.
 *       Run in child processes with a temp TAPESTRY_SETTINGS_PATH (fixed when src/config/settings.js loads), so
 *       nothing under /var/lib is touched and no other suite's settings module is disturbed.                  [AC-2, AC-5]
 *   R — the routes, src/api/settings/assistantDutiesApi.js, over injected settings functions; and the generic
 *       PUT /api/settings, which runs the same rule (no backdoor), in a child process.                  [AC-1, AC-3, AC-4]
 *   A — access: the route table's three entries and their registration behind requireOwner. (Every table entry is
 *       walked for owner, admin and stranger by test/admin-action-sweep-access.test.js.)                        [AC-1]
 *   O — the offer's inputs, src/api/assistant/dutyMenu.js resolveOfferInputs: the list, no customer lookup, hand-edited
 *       entries dropped, typed relays and This instance's relay by category.                              [AC-5, AC-6]
 *   T — the tab: its pure ESM module (words, refusalLine, moveDuty/addDuty/removeDuty/setRelay) loaded in Node, and
 *       source sentinels on the component, the Settings page and the router.                        [AC-1 … AC-4]
 *   S — the records: BIBLE, the two earlier ADRs, duty-menus.md's implementation line, no list left in code. [AC-5]
 *
 * Fixed here where the ADR leaves a detail open (test plan § Points the ADR leaves open):
 *   - readDutyList answers { duties, dropped } (the ADR names `duties` and "the count dropped").
 *   - An entry's `relay` that is absent, null or undefined is This instance's relay; the cleaned entry then has no
 *     `relay` field. Any other value is a typed relay (`''` included, so it is bad-relay).
 *   - validateDutyList's refusal for a list that is not an array has index null.
 *   - The routes module exports createAssistantDutiesHandlers(deps) → { get, put, reset }; the routes answer
 *     { success: true, duties } and refuse with 400 { success: false, code, index }; a throwing store answers 500
 *     { success: false }.
 *   - The tab's helpers never change the list they are given.
 *
 * Everything FAILS against the current code: the library has none of the rule's functions, buildOffer ignores a list,
 * defaults.json has no assistantDuties, the routes, the tab and its words do not exist, and the generic PUT stores any
 * assistantDuties unchecked.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { pathToFileURL } = require('url');
const AD = require('./helpers/assistantDutiesFixtures');
const DM = require('./helpers/dutyMenuFixtures');

const REPO = path.resolve(__dirname, '..');
const LIB = path.join(REPO, 'src/lib/duty-menu/index.js');
const DEFAULTS = path.join(REPO, 'src/config/defaults.json');
const SETTINGS_MOD = path.join(REPO, 'src/config/settings.js');
const API_MOD = path.join(REPO, 'src/api/settings/assistantDutiesApi.js');
const SETTINGS_API = path.join(REPO, 'src/api/settings/settingsApi.js');
const API_INDEX = path.join(REPO, 'src/api/index.js');
const ROUTE_TABLE = path.join(REPO, 'src/middleware/routeAccess.js');
const DUTY_MODULE = path.join(REPO, 'src/api/assistant/dutyMenu.js');
const PROFILE_DEFAULTS = path.join(REPO, 'src/api/assistant/profileDefaults.js');
const COPY_MOD = path.join(REPO, 'ui/src/pages/settings/assistantDutiesCopy.js');
const TAB_JSX = path.join(REPO, 'ui/src/pages/settings/AssistantDuties.jsx');
const SETTINGS_PAGE = path.join(REPO, 'ui/src/pages/settings/Index.jsx');
const APP = path.join(REPO, 'ui/src/App.jsx');
const DUTY_MENU_COPY = path.join(REPO, 'ui/src/pages/assistant/dutyMenuCopy.js');
const BIBLE = path.join(REPO, 'BIBLE.md');
const OLD_ADR = path.join(REPO, 'engineering-team/decisions/done/assistant-duty-menu/0001-a-duty-menu-check-beside-the-others.md');
const SELF_MAP_ADR = path.join(REPO, 'engineering-team/decisions/assistant-self-map/0001-a-self-map-check-from-what-has-landed.md');
const DUTY_MENUS_SPEC = path.join(REPO, 'protocols/drafts/duty-menus.md');
const NL = String.fromCharCode(10);

const OWN = DM.OWN; // 'wss://tapestry.example/relay'
const OWN_CONFIGURED = 'wss://Tapestry.Example/relay/';
const DLIST = 'wss://dlist.example';
const TYPED = 'wss://typed.example';
const VIEWER = 'd1'.repeat(32);

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);

/** Source with comments removed (block comments become blank lines, so line numbers stay true). */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .split(NL)
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}

function load(abs, what) {
  if (!fs.existsSync(abs)) throw new Error(`${rel(abs)} does not exist. ${what}`);
  delete require.cache[require.resolve(abs)];
  return require(abs);
}
const libModule = () => load(LIB, 'It is the Duty Menu library.');
function need(mod, name, file, why) {
  assert(typeof mod[name] === 'function', `${file} must export ${name}() (${why || 'ADR assistant-duties-settings/0001 sub-decision 2'}).`);
  return mod[name];
}
async function esm(absPath, what) {
  assert(fs.existsSync(absPath), `${rel(absPath)} does not exist. ${what}`);
  try { return await import(`${pathToFileURL(absPath).href}?t=${Date.now()}`); } catch (err) { throw new Error(`${rel(absPath)} must load in Node as ESM: ${err.message}`); }
}

/** Run `script` in a child Node process from the repo root with `env` added; its last stdout line is JSON. */
function inChild(script, env = {}) {
  const r = spawnSync(process.execPath, ['-e', script], { cwd: REPO, env: { ...process.env, ...env }, encoding: 'utf8', timeout: 30000 });
  const lines = String(r.stdout || '').trim().split(NL).filter(Boolean);
  const last = lines[lines.length - 1];
  try { return JSON.parse(last); } catch { throw new Error(`the child did not answer JSON (status ${r.status}): ${String(r.stderr || r.stdout).slice(0, 600)}`); }
}
/** A fresh temp directory holding settings.json (written when `overrides` is given). */
function tempSettings(overrides) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assistant-duties-'));
  const file = path.join(dir, 'settings.json');
  if (overrides !== undefined) fs.writeFileSync(file, JSON.stringify(overrides, null, 2));
  return { dir, file, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
const keysOf = (list) => (Array.isArray(list) ? list.map((d) => d && d.key) : list);
const sixKeys = AD.DEFAULT_DUTIES.map((d) => d.key);

/* ───────────────────────── L — the one rule (ADR sub-decision 2, 3) ───────────────────────── */

test('L1: the library exports the rule — keptKey, dutyKeyOf, isPublicRelayUrl, validateDutyList, readDutyList, instanceRelayFor — and MAX_DUTIES 200 and MAX_KEY_LENGTH 512; it no longer exports OFFER_KEYS (ADR sub-decision 2; AC-5 "no longer fixed in code")', () => {
  const lib = libModule();
  const wrong = [];
  for (const name of ['keptKey', 'dutyKeyOf', 'isPublicRelayUrl', 'validateDutyList', 'readDutyList', 'instanceRelayFor']) if (typeof lib[name] !== 'function') wrong.push(`no ${name}()`);
  if (lib.MAX_DUTIES !== AD.MAX_DUTIES) wrong.push(`MAX_DUTIES: want ${AD.MAX_DUTIES}, got ${show(lib.MAX_DUTIES)}`);
  if (lib.MAX_KEY_LENGTH !== AD.MAX_KEY_LENGTH) wrong.push(`MAX_KEY_LENGTH: want ${AD.MAX_KEY_LENGTH}, got ${show(lib.MAX_KEY_LENGTH)}`);
  if (Object.prototype.hasOwnProperty.call(lib, 'OFFER_KEYS')) wrong.push('OFFER_KEYS is still exported');
  assert(wrong.length === 0, wrong.join('; '));
});

test('L2: dutyKeyOf keeps a key readers keep, in the form they normalize it to, trimmed — and refuses (null) anything readers drop, a key over 512 characters, and a non-string (AC-3; duty-menus.md § 5.3)', () => {
  const dutyKeyOf = need(libModule(), 'dutyKeyOf', 'src/lib/duty-menu');
  const kept = [
    ['30382', '30382'], [' 30392 ', '30392'], ['30382:rank::', '30382:rank'], ['3038x:tag:', '3038x:tag'], ['3039x', '3039x'],
    ['39998:dlist-header', '39998'], ['39999:my-list', '39999:my-list'], ['39998', '39998'], ['*', '*'], ['30023', '30023'],
  ];
  const refused = ['', '   ', 'abc', '3038', '303820', '3038X', '39998:', '39999:', 'naddr1qqxnzd3cxqmrzv3exgmr2wfeqgsxu', `39999:${'a'.repeat(AD.MAX_KEY_LENGTH)}`, null, undefined, 30382, {}, ['30382']];
  const wrong = [];
  for (const [input, want] of kept) { const got = dutyKeyOf(input); if (got !== want) wrong.push(`${show(input)}: want ${show(want)}, got ${show(got)}`); }
  for (const input of refused) { const got = dutyKeyOf(input); if (got !== null) wrong.push(`${show(input)} must be refused (null), got ${show(got)}`); }
  const atLimit = `39999:${'a'.repeat(AD.MAX_KEY_LENGTH - 6)}`;
  if (dutyKeyOf(atLimit) !== atLimit) wrong.push('a key of exactly 512 characters is kept');
  assert(wrong.length === 0, wrong.join('; '));
});

test('L3: one rule — for every key in a battery, keptKey and dutyKeyOf (on the trimmed key) answer exactly what readMenuRows keeps for a duty row with that key, or null when it drops the row (ADR sub-decision 2: "a saved key and a read key cannot drift")', () => {
  const lib = libModule();
  const keptKey = need(lib, 'keptKey', 'src/lib/duty-menu');
  const dutyKeyOf = need(lib, 'dutyKeyOf', 'src/lib/duty-menu');
  const battery = ['30382', '30382:rank', '30382:rank::', '3038x', '3038x:tag:', '3039x:tag:dog::', '30392', '30399', '30023', '*', '*:', '*::',
    '39998', '39998:', '39998:dlist-header', '39998:my-list', '39999', '39999:', '39999:my-list', '39999::', '39999:a:b:', 'x', '3038', '3038x9', '30382x', ':30382', 'naddr1abc'];
  const wrong = [];
  for (const k of battery) {
    const rows = lib.readMenuRows({ tags: [['duty', k, 'wss://reader.example']] });
    const want = rows.length === 1 ? rows[0].key : null;
    if (keptKey(k) !== want) wrong.push(`keptKey(${show(k)}): readers keep ${show(want)}, got ${show(keptKey(k))}`);
    if (dutyKeyOf(k) !== want) wrong.push(`dutyKeyOf(${show(k)}): readers keep ${show(want)}, got ${show(dutyKeyOf(k))}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('L4: isPublicRelayUrl is the public-host rule on a relay\'s hostname — public names and addresses pass; localhost, loopback, private and link-local addresses, .local and dotless names fail — and it agrees with profileDefaults.isPublicHost over the set (ADR sub-decision 2; AC-3 "a relay others cannot reach")', () => {
  const isPublicRelayUrl = need(libModule(), 'isPublicRelayUrl', 'src/lib/duty-menu');
  const { isPublicHost } = load(PROFILE_DEFAULTS, 'It holds the public-host rule.');
  const pub = ['wss://relay.damus.io', 'wss://nip85.brainstorm.world/relay', 'ws://8.8.8.8:7777', 'wss://[2606:4700::1111]', 'WSS://Typed.Example/'];
  const priv = ['ws://localhost:7777', 'ws://127.0.0.1:7777', 'ws://10.0.0.5', 'ws://192.168.1.20/relay', 'wss://169.254.1.1', 'wss://box.local', 'wss://intranet', 'wss://[::1]', 'ws://172.16.0.9'];
  const wrong = [];
  for (const u of pub) if (isPublicRelayUrl(u) !== true) wrong.push(`${u} is public`);
  for (const u of priv) if (isPublicRelayUrl(u) !== false) wrong.push(`${u} is not public`);
  for (const u of [...pub, ...priv]) {
    const host = new URL(u.toLowerCase()).hostname;
    if (isPublicRelayUrl(u) !== isPublicHost(host)) wrong.push(`${u}: disagrees with isPublicHost(${host})`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('L5: validateDutyList accepts a good list and answers it normalized — keys in readers\' form, typed relays in their one spelling, This instance\'s relay as no relay field, other fields dropped, order kept; the six defaults and an empty list are fine (AC-2, AC-3, AC-4)', () => {
  const validateDutyList = need(libModule(), 'validateDutyList', 'src/lib/duty-menu');
  const wrong = [];
  const six = validateDutyList(AD.copyOf(AD.DEFAULT_DUTIES));
  if (!(six && six.ok === true && show(six.duties) === show(AD.DEFAULT_DUTIES))) wrong.push(`the six: want ok with the six, got ${show(six)}`);
  const empty = validateDutyList([]);
  if (!(empty && empty.ok === true && show(empty.duties) === '[]')) wrong.push(`[]: want ok with [], got ${show(empty)}`);
  const input = [
    { key: ' 39999:my-list ' },
    { key: '30383', relay: 'wss://Typed.Example/' },
    { key: '30382:rank::', relay: null, name: 'ignored', extra: 1 },
    { key: '39998:dlist-header' },
  ];
  const want = [{ key: '39999:my-list' }, { key: '30383', relay: TYPED }, { key: '30382:rank' }, { key: '39998' }];
  const got = validateDutyList(input);
  if (!(got && got.ok === true && show(got.duties) === show(want))) wrong.push(`a mixed list: want ok with ${show(want)}, got ${show(got)}`);
  if (input[0].key !== ' 39999:my-list ') wrong.push('the input is not changed');
  assert(wrong.length === 0, wrong.join('; '));
});

test('L6: validateDutyList refuses with a code and the entry\'s index — bad-list (not an array: index null; an entry not an object), too-many (201 entries), bad-key, duplicate-key (after normalization, at the later entry), bad-relay (not ws(s)://, or empty), private-relay — and a bad key beats a bad relay in one entry (ADR sub-decision 2)', () => {
  const validateDutyList = need(libModule(), 'validateDutyList', 'src/lib/duty-menu');
  const many = Array.from({ length: AD.MAX_DUTIES + 1 }, (_, i) => ({ key: `39999:list-${i}` }));
  const cases = [
    ['not an array', { key: '30382' }, 'bad-list', null],
    ['null', null, 'bad-list', null],
    ['an entry that is a string', [{ key: '30382' }, '30392'], 'bad-list', 1],
    ['an entry that is null', [null], 'bad-list', 0],
    ['201 entries', many, 'too-many', null],
    ['a bad key', [{ key: '30382' }, { key: '30392' }, { key: 'not a key' }], 'bad-key', 2],
    ['a missing key', [{ relay: TYPED }], 'bad-key', 0],
    ['39998:', [{ key: '39998:' }], 'bad-key', 0],
    ['a duplicate after normalization', [{ key: '30382:rank' }, { key: '30392' }, { key: '30382:rank::' }], 'duplicate-key', 2],
    ['an https relay', [{ key: '30382', relay: 'https://typed.example' }], 'bad-relay', 0],
    ['an empty relay', [{ key: '30382', relay: '' }], 'bad-relay', 0],
    ['a relay that is not a string', [{ key: '30382', relay: 7 }], 'bad-relay', 0],
    ['a localhost relay', [{ key: '30382' }, { key: '30392', relay: 'ws://localhost:7777' }], 'private-relay', 1],
    ['a private IP relay', [{ key: '30382', relay: 'ws://10.0.0.5' }], 'private-relay', 0],
    ['a .local relay', [{ key: '30382', relay: 'wss://box.local' }], 'private-relay', 0],
    ['a bad key and a bad relay in one entry', [{ key: 'nope', relay: 'https://x.example' }], 'bad-key', 0],
  ];
  const wrong = [];
  for (const [label, input, code, index] of cases) {
    let got;
    try { got = validateDutyList(input); } catch (err) { wrong.push(`${label}: threw ${err.message}`); continue; }
    if (!got || got.ok !== false || got.code !== code || got.index !== index) wrong.push(`${label}: want { ok: false, code: ${code}, index: ${show(index)} }, got ${show(got)}`);
    else if (got.duties !== undefined) wrong.push(`${label}: a refusal carries no duties`);
  }
  const atMax = validateDutyList(many.slice(0, AD.MAX_DUTIES));
  if (!(atMax && atMax.ok === true && atMax.duties.length === AD.MAX_DUTIES)) wrong.push(`exactly 200 entries are fine, got ${show(atMax && { ok: atMax.ok, code: atMax.code })}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('L7: readDutyList (for reads) drops what validateDutyList would refuse instead of refusing — bad entries, private and malformed relays, later duplicates — keeps the rest normalized and in order, and counts the drops; anything but an array is an empty list (ADR sub-decision 2; AC-5 "a hand edit can\'t put a bad row on a menu")', () => {
  const readDutyList = need(libModule(), 'readDutyList', 'src/lib/duty-menu');
  const wrong = [];
  const input = [
    { key: '30382' }, { key: 'bad key' }, { key: '30382::' }, 'junk', null,
    { key: '30392', relay: 'ws://10.0.0.1' }, { key: '39999', relay: 'wss://X.example/' }, { key: '30393', relay: 'ftp://x.example' },
    { key: ' 3039x:tag: ' },
  ];
  const got = readDutyList(input);
  const want = [{ key: '30382' }, { key: '39999', relay: 'wss://x.example' }, { key: '3039x:tag' }];
  if (!got || show(got.duties) !== show(want)) wrong.push(`duties: want ${show(want)}, got ${show(got && got.duties)}`);
  if (!got || got.dropped !== 6) wrong.push(`dropped: want 6, got ${show(got && got.dropped)}`);
  for (const notList of [undefined, null, {}, 'x', 7]) {
    const r = readDutyList(notList);
    if (!r || show(r.duties) !== '[]') wrong.push(`${show(notList)}: want no duties, got ${show(r)}`);
  }
  const six = readDutyList(AD.copyOf(AD.DEFAULT_DUTIES));
  if (!six || show(six.duties) !== show(AD.DEFAULT_DUTIES) || six.dropped !== 0) wrong.push(`the six read back as they are, none dropped: ${show(six)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('L8: instanceRelayFor gives This instance\'s relay by category — a 39998 or 39999 slot: ownRelay, else dlistRelay; any other key: ownRelay or null — each in its one spelling (ADR sub-decision 3)', () => {
  const instanceRelayFor = need(libModule(), 'instanceRelayFor', 'src/lib/duty-menu');
  const both = { ownRelay: OWN_CONFIGURED, dlistRelay: 'wss://Dlist.Example/' };
  const noOwn = { ownRelay: null, dlistRelay: 'wss://Dlist.Example/' };
  const none = { ownRelay: null, dlistRelay: null };
  const cases = [
    ['30382', both, OWN], ['30392', both, OWN], ['39998', both, OWN], ['39999:my-list', both, OWN], ['*', both, OWN], ['3038x:tag', both, OWN], ['30023', both, OWN],
    ['39998', noOwn, DLIST], ['39999', noOwn, DLIST], ['39999:my-list', noOwn, DLIST],
    ['30382', noOwn, null], ['30392', noOwn, null], ['*', noOwn, null], ['30023', noOwn, null],
    ['39998', none, null], ['30382', none, null],
  ];
  const wrong = [];
  for (const [key, inputs, want] of cases) { const got = instanceRelayFor(key, inputs); if (got !== want) wrong.push(`${key} with ${show(inputs)}: want ${show(want)}, got ${show(got)}`); }
  assert(wrong.length === 0, wrong.join('; '));
});

test('L9: buildOffer({ ownRelay, dlistRelay, duties }) gives one duty row per entry, in the list\'s order — a typed relay as given, else This instance\'s relay by category; an entry with no relay left out; no duties (or none given) is an empty offer, never the six (AC-5, AC-6; ADR sub-decision 3)', () => {
  const buildOffer = need(libModule(), 'buildOffer', 'src/lib/duty-menu');
  const list = [{ key: '39999:my-list' }, { key: '30383', relay: TYPED }, { key: '*' }, { key: '30023' }, { key: '39998' }];
  const cases = [
    ['a public address', { ownRelay: OWN, dlistRelay: DLIST },
      [['39999:my-list', OWN], ['30383', TYPED], ['*', OWN], ['30023', OWN], ['39998', OWN]]],
    ['no public address', { ownRelay: null, dlistRelay: DLIST },
      [['39999:my-list', DLIST], ['30383', TYPED], ['39998', DLIST]]],
    ['no relay at all', { ownRelay: null, dlistRelay: null }, [['30383', TYPED]]],
  ];
  const wrong = [];
  for (const [label, inputs, want] of cases) {
    const got = buildOffer({ ...inputs, duties: AD.copyOf(list) });
    const view = Array.isArray(got) ? got.map((r) => [r.tag, r.key, r.relay]) : got;
    const wantView = want.map(([k, r]) => ['duty', k, r]);
    if (show(view) !== show(wantView)) wrong.push(`${label}: want ${show(wantView)}, got ${show(view)}`);
  }
  for (const [label, input] of [['duties []', { ownRelay: OWN, dlistRelay: DLIST, duties: [] }], ['no duties given', { ownRelay: OWN, dlistRelay: DLIST }]]) {
    const got = buildOffer(input);
    if (show(got) !== '[]') wrong.push(`${label}: want [], got ${show(got)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── D — the defaults and the settings file (AC-2, AC-5) ───────────────────────── */

test('D1: src/config/defaults.json ships assistantDuties — the six, in order (30382, 30392, 30393, 30394, 39998, 39999), each a key with no relay (This instance\'s relay) (AC-2; ADR sub-decision 1)', () => {
  let defaults;
  try { defaults = JSON.parse(safeRead(DEFAULTS)); } catch (err) { throw new Error(`${rel(DEFAULTS)} is not JSON: ${err.message}`); }
  const got = defaults[AD.SETTINGS_KEY];
  assert(show(got) === show(AD.DEFAULT_DUTIES), `defaults.json ${AD.SETTINGS_KEY}: want ${show(AD.DEFAULT_DUTIES)}, got ${show(got)}`);
});

test('D2: kept on the server — a saved list is written to the settings file, read back after a restart (a new process), an empty list stays empty, and resetting the key brings the six back; the file holds the whole list, not a merge with the six (AC-5; ADR sub-decision 1)', () => {
  const t = tempSettings();
  const env = { TAPESTRY_SETTINGS_PATH: t.file };
  const saved = [{ key: '39999' }, { key: '30383', relay: TYPED }];
  try {
    const fresh = inChild(`const S=require('./src/config/settings');console.log(JSON.stringify(S.getSettings().assistantDuties||null))`, env);
    inChild(`const S=require('./src/config/settings');S.updateOverrides({assistantDuties:${show(saved)}});console.log('{}')`, env);
    const file = JSON.parse(safeRead(t.file) || '{}')[AD.SETTINGS_KEY];
    const restarted = inChild(`const S=require('./src/config/settings');console.log(JSON.stringify(S.getSettings().assistantDuties||null))`, env);
    inChild(`const S=require('./src/config/settings');S.updateOverrides({assistantDuties:[]});console.log('{}')`, env);
    const empty = inChild(`const S=require('./src/config/settings');console.log(JSON.stringify(S.getSettings().assistantDuties||null))`, env);
    inChild(`const S=require('./src/config/settings');S.resetOverride('assistantDuties');console.log('{}')`, env);
    const reset = inChild(`const S=require('./src/config/settings');console.log(JSON.stringify(S.getSettings().assistantDuties||null))`, env);
    const wrong = [];
    if (show(fresh) !== show(AD.DEFAULT_DUTIES)) wrong.push(`a new instance: want the six, got ${show(fresh)}`);
    if (show(file) !== show(saved)) wrong.push(`the settings file: want ${show(saved)}, got ${show(file)}`);
    if (show(restarted) !== show(saved)) wrong.push(`after a restart: want ${show(saved)}, got ${show(restarted)}`);
    if (show(empty) !== '[]') wrong.push(`an empty list stays empty: got ${show(empty)}`);
    if (show(reset) !== show(AD.DEFAULT_DUTIES)) wrong.push(`after reset: want the six, got ${show(reset)}`);
    assert(wrong.length === 0, wrong.join('; '));
  } finally { t.cleanup(); }
});

/* ───────────────────────── R — the routes (AC-1, AC-3, AC-4; ADR sub-decision 4) ───────────────────────── */

function fakeRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}
const ownerReq = (body) => ({ session: { authenticated: true, pubkey: VIEWER }, query: {}, params: {}, body });

/** A settings store with the two layers, as src/config/settings.js keeps them; every write is recorded. */
function fakeStore({ overrides = {}, throws = false } = {}) {
  const store = { defaults: { [AD.SETTINGS_KEY]: AD.copyOf(AD.DEFAULT_DUTIES), aRelays: { aDListRelays: [DLIST] } }, overrides: AD.copyOf(overrides) };
  const calls = { updateOverrides: [], resetOverride: [] };
  const boom = () => { if (throws) throw new Error('fixture: the settings file exploded'); };
  const deps = {
    getSettings: () => { boom(); return { ...AD.copyOf(store.defaults), ...AD.copyOf(store.overrides) }; },
    updateOverrides: (patch) => { boom(); calls.updateOverrides.push(AD.copyOf(patch)); Object.assign(store.overrides, AD.copyOf(patch)); return AD.copyOf(store.overrides); },
    resetOverride: (key) => { boom(); calls.resetOverride.push(key); delete store.overrides[key]; return AD.copyOf(store.overrides); },
  };
  return { store, calls, deps };
}
function handlers(deps) {
  const mod = load(API_MOD, 'ADR sub-decision 4 creates it: the three handlers, over injectable settings functions.');
  const make = need(mod, 'createAssistantDutiesHandlers', rel(API_MOD), 'ADR sub-decision 4; § Implementation notes');
  const h = make(deps);
  for (const name of ['get', 'put', 'reset']) assert(h && typeof h[name] === 'function', `createAssistantDutiesHandlers(deps) answers { get, put, reset }: no ${name}()`);
  return h;
}
async function call(fn, req) { const res = fakeRes(); const quiet = console.error; console.error = () => {}; try { await fn(req, res); } finally { console.error = quiet; } return res; }

test('R1: GET answers { success: true, duties } — the list the offer uses: the six on a new instance, a saved list as saved, and a hand-edited bad entry left out (AC-2; ADR sub-decision 4)', async () => {
  const wrong = [];
  const fresh = await call(handlers(fakeStore().deps).get, ownerReq());
  if (!(fresh.statusCode === 200 && fresh.body && fresh.body.success === true && show(fresh.body.duties) === show(AD.DEFAULT_DUTIES))) wrong.push(`new instance: got ${fresh.statusCode} ${show(fresh.body)}`);
  const savedList = [{ key: '39999' }, { key: '30383', relay: TYPED }];
  const saved = await call(handlers(fakeStore({ overrides: { [AD.SETTINGS_KEY]: savedList } }).deps).get, ownerReq());
  if (!(saved.body && show(saved.body.duties) === show(savedList))) wrong.push(`saved: want ${show(savedList)}, got ${show(saved.body)}`);
  const edited = await call(handlers(fakeStore({ overrides: { [AD.SETTINGS_KEY]: [{ key: 'oops' }, { key: '30392', relay: 'ws://10.0.0.2' }, { key: '39998' }] } }).deps).get, ownerReq());
  if (!(edited.body && show(edited.body.duties) === show([{ key: '39998' }]))) wrong.push(`hand-edited: want [{key:39998}], got ${show(edited.body)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('R2: PUT { duties } saves the whole list, normalized, under assistantDuties with one write, and answers { success: true, duties } — reorder, remove, a typed relay and an empty list alike (AC-3, AC-4)', async () => {
  const wrong = [];
  const lists = [
    ['reordered', [{ key: '39999' }, { key: '30382' }, { key: '30392' }], [{ key: '39999' }, { key: '30382' }, { key: '30392' }]],
    ['an added key with a typed relay', [...AD.copyOf(AD.DEFAULT_DUTIES), { key: ' 30383 ', relay: 'wss://Typed.Example/' }], [...AD.DEFAULT_DUTIES, { key: '30383', relay: TYPED }]],
    ['emptied', [], []],
  ];
  for (const [label, duties, want] of lists) {
    const s = fakeStore();
    const res = await call(handlers(s.deps).put, ownerReq({ duties }));
    if (!(res.statusCode === 200 && res.body && res.body.success === true && show(res.body.duties) === show(want))) wrong.push(`${label}: answer ${res.statusCode} ${show(res.body)}`);
    if (!(s.calls.updateOverrides.length === 1 && show(s.calls.updateOverrides[0]) === show({ [AD.SETTINGS_KEY]: want }))) wrong.push(`${label}: one write of { assistantDuties: ${show(want)} }, got ${show(s.calls.updateOverrides)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('R3: a refused PUT answers 400 { success: false, code, index } with the rule\'s code and writes nothing — a bad key, a duplicate, a relay that is not ws(s)://, a private relay, too many, a body with no list (AC-3 "nothing saved"; ADR sub-decision 4)', async () => {
  const many = Array.from({ length: AD.MAX_DUTIES + 1 }, (_, i) => ({ key: `39999:l${i}` }));
  const cases = [
    ['a bad key', { duties: [{ key: '30382' }, { key: 'abc' }] }, 'bad-key', 1],
    ['a duplicate', { duties: [{ key: '30382' }, { key: '30382::' }] }, 'duplicate-key', 1],
    ['an https relay', { duties: [{ key: '30382', relay: 'https://typed.example' }] }, 'bad-relay', 0],
    ['a private relay', { duties: [{ key: '30382', relay: 'ws://192.168.0.4' }] }, 'private-relay', 0],
    ['too many', { duties: many }, 'too-many', null],
    ['no list', {}, 'bad-list', null],
    ['a list that is not an array', { duties: { key: '30382' } }, 'bad-list', null],
  ];
  const wrong = [];
  for (const [label, body, code, index] of cases) {
    const s = fakeStore();
    const res = await call(handlers(s.deps).put, ownerReq(body));
    if (!(res.statusCode === 400 && res.body && res.body.success === false && res.body.code === code && res.body.index === index)) wrong.push(`${label}: want 400 { success: false, code: ${code}, index: ${show(index)} }, got ${res.statusCode} ${show(res.body)}`);
    if (s.calls.updateOverrides.length !== 0 || s.calls.resetOverride.length !== 0) wrong.push(`${label}: nothing is written, got ${show(s.calls)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('R4: reset removes the override (resetOverride("assistantDuties")) and answers { success: true, duties } with the six; nothing else is written (AC-4 "Reset to defaults"; ADR sub-decision 4)', async () => {
  const s = fakeStore({ overrides: { [AD.SETTINGS_KEY]: [{ key: '39999' }] } });
  const res = await call(handlers(s.deps).reset, ownerReq());
  const wrong = [];
  if (show(s.calls.resetOverride) !== show([AD.SETTINGS_KEY])) wrong.push(`resetOverride("assistantDuties") once, got ${show(s.calls.resetOverride)}`);
  if (s.calls.updateOverrides.length !== 0) wrong.push(`no other write, got ${show(s.calls.updateOverrides)}`);
  if (!(res.statusCode === 200 && res.body && res.body.success === true && show(res.body.duties) === show(AD.DEFAULT_DUTIES))) wrong.push(`answer: ${res.statusCode} ${show(res.body)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('R5: when the settings file fails, each route answers 500 { success: false } rather than throwing (ADR sub-decision 4)', async () => {
  const wrong = [];
  for (const name of ['get', 'put', 'reset']) {
    const s = fakeStore({ throws: true });
    let res;
    try { res = await call(handlers(s.deps)[name], ownerReq({ duties: AD.copyOf(AD.DEFAULT_DUTIES) })); } catch (err) { wrong.push(`${name} threw ${err.message}`); continue; }
    if (!(res.statusCode === 500 && res.body && res.body.success === false)) wrong.push(`${name}: want 500 { success: false }, got ${res.statusCode} ${show(res.body)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('R6: no backdoor — the generic PUT /api/settings runs the same rule on assistantDuties: a bad list answers 400 with its code and index and leaves the file alone; a good one is stored normalized; a patch without it is unchanged (AC-1 "however the request is made"; ADR sub-decision 4)', () => {
  const t = tempSettings({ [AD.SETTINGS_KEY]: [{ key: '39999' }] });
  const env = { TAPESTRY_SETTINGS_PATH: t.file };
  const script = (body) => `
    const api=require('./src/api/settings/settingsApi');
    const res={statusCode:200,body:null,status(c){this.statusCode=c;return this},json(b){this.body=b;return this}};
    api.handleUpdateSettings({session:{authenticated:true,pubkey:'${VIEWER}'},body:${show(body)}},res);
    console.log(JSON.stringify({status:res.statusCode,body:res.body}));`;
  try {
    const wrong = [];
    const bad = inChild(script({ [AD.SETTINGS_KEY]: [{ key: '30382' }, { key: 'not a key' }] }), env);
    const afterBad = JSON.parse(safeRead(t.file))[AD.SETTINGS_KEY];
    if (!(bad.status === 400 && bad.body && bad.body.success === false && bad.body.code === 'bad-key' && bad.body.index === 1)) wrong.push(`a bad key: want 400 code bad-key index 1, got ${show(bad)}`);
    if (show(afterBad) !== show([{ key: '39999' }])) wrong.push(`a refused patch leaves the file alone, got ${show(afterBad)}`);
    const priv = inChild(script({ [AD.SETTINGS_KEY]: [{ key: '30382', relay: 'ws://localhost:7777' }] }), env);
    if (!(priv.status === 400 && priv.body && priv.body.code === 'private-relay')) wrong.push(`a private relay: want 400 private-relay, got ${show(priv)}`);
    const good = inChild(script({ [AD.SETTINGS_KEY]: [{ key: ' 30382:rank:: ' }, { key: '30383', relay: 'wss://Typed.Example/' }] }), env);
    const afterGood = JSON.parse(safeRead(t.file))[AD.SETTINGS_KEY];
    const want = [{ key: '30382:rank' }, { key: '30383', relay: TYPED }];
    if (!(good.status === 200 && good.body && good.body.success === true)) wrong.push(`a good list is accepted, got ${show(good)}`);
    if (show(afterGood) !== show(want)) wrong.push(`stored normalized: want ${show(want)}, got ${show(afterGood)}`);
    const other = inChild(script({ trustedLists: { membershipMethod: 'count' } }), env);
    if (!(other.status === 200 && other.body && other.body.success === true)) wrong.push(`a patch without assistantDuties still works, got ${show(other)}`);
    assert(wrong.length === 0, wrong.join('; '));
  } finally { t.cleanup(); }
});

/* ───────────────────────── A — access (AC-1) ───────────────────────── */

test('A1: the route table opens the three routes to the owner\'s side only — GET as a read, PUT and POST …/reset as actions — and resolveRouteAccess answers owner for each (AC-1; ADR sub-decision 4)', () => {
  const { ROUTE_ACCESS, resolveRouteAccess } = load(ROUTE_TABLE, 'It is the route table.');
  const wrong = [];
  for (const { key, access, kind } of AD.TABLE) {
    const e = ROUTE_ACCESS[key];
    if (!e || e.access !== access || e.kind !== kind) wrong.push(`${key}: want { access: ${access}, kind: ${kind} }, got ${show(e)}`);
    const [method, p] = key.split(' ');
    if (resolveRouteAccess(method, p) !== 'owner') wrong.push(`resolveRouteAccess(${method}, ${p}) is owner`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('A2: src/api/index.js registers GET and PUT /api/settings/assistant-duties and POST /api/settings/assistant-duties/reset, each behind requireOwner (which admits the Owner and Admins) (AC-1; ADR sub-decision 4)', () => {
  const src = codeOnly(safeRead(API_INDEX));
  const wrong = [];
  for (const [method, p] of [['get', AD.ROUTES.list], ['put', AD.ROUTES.list], ['post', AD.ROUTES.reset]]) {
    const re = new RegExp(`app\\.${method}\\(\\s*['"]${p.replace(/[/.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\s*,\\s*requireOwner\\s*,`);
    if (!re.test(src)) wrong.push(`app.${method}('${p}', requireOwner, …)`);
  }
  assert(wrong.length === 0, `not registered behind requireOwner: ${wrong.join('; ')}`);
});

/* ───────────────────────── O — the offer's inputs (AC-5, AC-6; ADR sub-decision 3) ───────────────────────── */

function offerDeps(opts = {}) {
  const calls = { getCustomer: [], readAssistantDuties: 0, warn: [] };
  const config = { BRAINSTORM_RELAY_URL: OWN_CONFIGURED, STRFRY_DOMAIN: 'tapestry.example', BRAINSTORM_OWNER_PUBKEY: '0b'.repeat(32), ...(opts.config || {}) };
  const deps = {
    getConfigFromFile: (k, d) => (Object.prototype.hasOwnProperty.call(config, k) ? config[k] : d),
    readConfiguredRelays: () => (opts.dlist || [DLIST]).slice(),
    isLocalOnly: () => false,
    getCustomer: async (pk) => { calls.getCustomer.push(pk); return { status: 'active' }; },
    readAssistantDuties: () => { calls.readAssistantDuties += 1; return opts.duties === undefined ? AD.copyOf(AD.DEFAULT_DUTIES) : AD.copyOf(opts.duties); },
  };
  return { deps, calls };
}
async function inputsFor(opts) {
  const duty = load(DUTY_MODULE, 'It is the Duty Menu check.');
  const resolve = need(duty, 'resolveOfferInputs', rel(DUTY_MODULE));
  const { deps, calls } = offerDeps(opts);
  const warn = console.warn;
  console.warn = (...a) => { calls.warn.push(a.join(' ')); };
  let inputs;
  try { inputs = await resolve(VIEWER, deps); } finally { console.warn = warn; }
  return { inputs, calls };
}

test('O1: resolveOfferInputs answers { ownRelay, dlistRelay, duties } — duties the Assistant Duties list, read through readAssistantDuties at each call — with no `scores` and no customer lookup (AC-6 "the same whoever the Assistant belongs to"; ADR sub-decision 3)', async () => {
  const { inputs, calls } = await inputsFor({ duties: [{ key: '39999' }, { key: '30382' }] });
  const wrong = [];
  if (!inputs || show(Object.keys(inputs).sort()) !== show(['dlistRelay', 'duties', 'ownRelay'])) wrong.push(`the fields: want dlistRelay, duties, ownRelay; got ${show(inputs && Object.keys(inputs))}`);
  if (!inputs || show(inputs.duties) !== show([{ key: '39999' }, { key: '30382' }])) wrong.push(`duties: got ${show(inputs && inputs.duties)}`);
  if (!inputs || inputs.ownRelay !== OWN) wrong.push(`ownRelay in its one spelling: got ${show(inputs && inputs.ownRelay)}`);
  if (calls.readAssistantDuties !== 1) wrong.push(`readAssistantDuties read once per call, got ${calls.readAssistantDuties}`);
  if (calls.getCustomer.length !== 0) wrong.push(`no customer lookup, got ${show(calls.getCustomer)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('O2: a hand-edited list — bad keys, a private relay, a later duplicate — reaches the offer cleaned, in order, and the server logs how many entries it ignored; a list that is missing gives an empty offer, never the six (AC-5; ADR sub-decision 2 and § Implementation notes)', async () => {
  const lib = libModule();
  const wrong = [];
  const edited = await inputsFor({ duties: [{ key: '30392' }, { key: 'oops' }, { key: '30392::' }, { key: '30382', relay: 'ws://127.0.0.1' }, { key: '39998' }] });
  if (show(edited.inputs && edited.inputs.duties) !== show([{ key: '30392' }, { key: '39998' }])) wrong.push(`cleaned: got ${show(edited.inputs && edited.inputs.duties)}`);
  if (!edited.calls.warn.some((w) => /\b3\b/.test(w) && /assistantDuties/.test(w))) wrong.push(`a warning names the 3 ignored assistantDuties entries, got ${show(edited.calls.warn)}`);
  const offer = lib.buildOffer(edited.inputs || {});
  if (show((offer || []).map((r) => r.key)) !== show(['30392', '39998'])) wrong.push(`the offer: got ${show(offer)}`);
  const missing = await inputsFor({ duties: null });
  if (show(missing.inputs && missing.inputs.duties) !== '[]') wrong.push(`a missing list: want no duties, got ${show(missing.inputs && missing.inputs.duties)}`);
  if (show(lib.buildOffer(missing.inputs || {})) !== '[]') wrong.push('a missing list: an empty offer');
  const clean = await inputsFor({});
  if (clean.calls.warn.length !== 0) wrong.push(`the six log nothing, got ${show(clean.calls.warn)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('O3: through resolveOfferInputs and buildOffer, an added Concept key, a typed relay, `*` and a kind outside the three categories are offered in the list\'s order — and with no public address the Concept key moves to the DList relay, the typed relay stays, the others are left out (AC-6; ADR sub-decision 3)', async () => {
  const lib = libModule();
  const list = [{ key: '39999:my-list' }, { key: '30383', relay: 'wss://Typed.Example/' }, { key: '*' }, { key: '30023' }];
  const pub = await inputsFor({ duties: list });
  const priv = await inputsFor({ duties: list, config: { BRAINSTORM_RELAY_URL: 'ws://localhost:7777', STRFRY_DOMAIN: 'localhost' } });
  const view = (inputs) => (lib.buildOffer(inputs || {}) || []).map((r) => [r.key, r.relay]);
  const wrong = [];
  const wantPub = [['39999:my-list', OWN], ['30383', TYPED], ['*', OWN], ['30023', OWN]];
  const wantPriv = [['39999:my-list', DLIST], ['30383', TYPED]];
  if (show(view(pub.inputs)) !== show(wantPub)) wrong.push(`a public address: want ${show(wantPub)}, got ${show(view(pub.inputs))}`);
  if (show(view(priv.inputs)) !== show(wantPriv)) wrong.push(`no public address: want ${show(wantPriv)}, got ${show(view(priv.inputs))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('O4: dutyMenu.js reads the list through a readAssistantDuties dependency whose default is getSettings().assistantDuties from src/config/settings, re-read at every check (AC-5 "with no restart"; ADR sub-decision 3)', () => {
  const src = codeOnly(safeRead(DUTY_MODULE));
  const wrong = [];
  if (!/\breadAssistantDuties\s*:/.test(src)) wrong.push('no readAssistantDuties in defaultDeps()');
  if (!/config\/settings['"]\s*\)\s*\.getSettings\s*\(\s*\)\s*\.assistantDuties/.test(src)) wrong.push("its default is require('../../config/settings').getSettings().assistantDuties");
  if (!/\.readAssistantDuties\s*\(/.test(src)) wrong.push('resolveOfferInputs never calls d.readAssistantDuties()');
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── T — the tab (AC-1 … AC-4; ADR sub-decision 7) ───────────────────────── */

const copyModule = () => esm(COPY_MOD, 'ADR sub-decision 7 creates it: the tab\'s words and pure helpers (ASSISTANT_DUTIES_COPY, refusalLine, moveDuty, addDuty, removeDuty, setRelay).');
/** Every string anywhere inside a value. */
function stringsIn(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => stringsIn(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => stringsIn(x, out));
  return out;
}

test('T1: the tab\'s copy module loads in Node as ESM with no imports and holds every sentence and label of the story\'s § Copy and the ADR\'s additions, word for word — the tab label aside, which sits in TABS beside the others (T4) (§ Copy; ADR sub-decision 7)', async () => {
  const src = safeRead(COPY_MOD);
  const mod = await copyModule();
  const all = stringsIn(mod.ASSISTANT_DUTIES_COPY);
  const wrong = [];
  if (/^\s*import\b/m.test(codeOnly(src))) wrong.push('the module imports nothing, so Node suites can load it');
  if (!mod.ASSISTANT_DUTIES_COPY) wrong.push('no ASSISTANT_DUTIES_COPY export');
  const missing = [...AD.SENTENCES, ...AD.LABELS, AD.COPY.relayPlaceholder].filter((s) => !all.includes(s));
  if (missing.length) wrong.push(`missing, word for word: ${missing.map(show).join('; ')}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('T2: refusalLine turns each refusal code into its words, and anything else — another code, no code, a failed request — into "Could not save: this instance did not answer." (§ Copy; ADR sub-decision 7)', async () => {
  const mod = await copyModule();
  assert(typeof mod.refusalLine === 'function', 'no refusalLine()');
  const wrong = [];
  for (const [code, words] of Object.entries(AD.COPY.refusals)) if (mod.refusalLine(code) !== words) wrong.push(`${code}: want ${show(words)}, got ${show(mod.refusalLine(code))}`);
  for (const other of ['bad-list', 'nope', undefined, null, '']) if (mod.refusalLine(other) !== AD.COPY.requestFailed) wrong.push(`${show(other)}: want the request-failed line, got ${show(mod.refusalLine(other))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('T3: the helpers build the next list without changing the one given — moveDuty(list, from, to) moves one entry (out of range: the same entries), addDuty appends, removeDuty(list, i) removes one, setRelay(list, i, relay) sets a typed relay and setRelay(list, i, null) puts back This instance\'s relay (no relay field) (AC-3, AC-4; ADR sub-decision 7)', async () => {
  const mod = await copyModule();
  const wrong = [];
  for (const name of ['moveDuty', 'addDuty', 'removeDuty', 'setRelay']) if (typeof mod[name] !== 'function') wrong.push(`no ${name}()`);
  assert(wrong.length === 0, wrong.join('; '));
  const base = () => [{ key: '30382' }, { key: '30392' }, { key: '39998', relay: TYPED }];
  const frozen = base();
  const before = show(frozen);
  const k = (l) => keysOf(l).join(',');
  const cases = [
    ['moveDuty 0 → 2', () => mod.moveDuty(frozen, 0, 2), '30392,39998,30382'],
    ['moveDuty 2 → 0', () => mod.moveDuty(frozen, 2, 0), '39998,30382,30392'],
    ['moveDuty 1 → 1', () => mod.moveDuty(frozen, 1, 1), '30382,30392,39998'],
    ['moveDuty out of range', () => mod.moveDuty(frozen, 0, 9), '30382,30392,39998'],
    ['addDuty', () => mod.addDuty(frozen, { key: '30383', relay: TYPED }), '30382,30392,39998,30383'],
    ['removeDuty 1', () => mod.removeDuty(frozen, 1), '30382,39998'],
  ];
  for (const [label, fn, want] of cases) {
    let got;
    try { got = fn(); } catch (err) { wrong.push(`${label} threw ${err.message}`); continue; }
    if (!Array.isArray(got) || k(got) !== want) wrong.push(`${label}: want ${want}, got ${show(got)}`);
    if (got === frozen) wrong.push(`${label}: answers a new list`);
  }
  const typed = mod.setRelay(frozen, 0, TYPED);
  if (!(Array.isArray(typed) && typed[0].relay === TYPED && typed[0].key === '30382')) wrong.push(`setRelay(list, 0, typed): got ${show(typed)}`);
  const back = mod.setRelay(frozen, 2, null);
  if (!(Array.isArray(back) && back[2].key === '39998' && !Object.prototype.hasOwnProperty.call(back[2], 'relay'))) wrong.push(`setRelay(list, 2, null) leaves no relay field: got ${show(back)}`);
  if (show(frozen) !== before) wrong.push(`the list given is never changed: ${show(frozen)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('T4: the Settings page has the tab right after Assistant Profile — { key: "assistant-duties", path: "assistant-duties", label: "📋 Assistant Duties" } — renders <AssistantDuties /> for it, and imports it from ./AssistantDuties (AC-1; ADR sub-decision 7)', () => {
  const src = codeOnly(safeRead(SETTINGS_PAGE));
  const wrong = [];
  const tabs = src.match(/const\s+TABS\s*=\s*\[([\s\S]*?)\];/);
  if (!tabs) wrong.push('no TABS array');
  else {
    const entries = tabs[1].split(/\n/).filter((l) => /\bkey\s*:/.test(l));
    const iAssistant = entries.findIndex((l) => /key\s*:\s*['"]assistant['"]/.test(l));
    const iDuties = entries.findIndex((l) => /key\s*:\s*['"]assistant-duties['"]/.test(l));
    if (iDuties < 0) wrong.push('no assistant-duties entry in TABS');
    else {
      const line = entries[iDuties];
      if (!/path\s*:\s*['"]assistant-duties['"]/.test(line)) wrong.push('its path is "assistant-duties"');
      if (!line.includes(`'${AD.TAB.label}'`) && !line.includes(`"${AD.TAB.label}"`)) wrong.push(`its label is ${show(AD.TAB.label)}`);
      if (iDuties !== iAssistant + 1) wrong.push('it comes right after the assistant entry');
    }
  }
  if (!/import\s+AssistantDuties\s+from\s+['"]\.\/AssistantDuties(\.jsx)?['"]/.test(src)) wrong.push('import AssistantDuties from ./AssistantDuties');
  if (!/activeTab\s*===\s*['"]assistant-duties['"]\s*&&\s*\(?\s*<AssistantDuties\b/.test(src)) wrong.push('renders <AssistantDuties /> when the tab is active');
  assert(wrong.length === 0, wrong.join('; '));
});

test('T5: the router gives the Settings page an assistant-duties child, with the crumb Assistant Duties, before its "*" child — so /tapestry/settings/assistant-duties opens the tab and is not redirected to Relays (AC-1; ADR sub-decision 7)', () => {
  const src = codeOnly(safeRead(APP));
  const block = src.match(/path:\s*['"]settings['"],\s*element:\s*<SettingsIndex\s*\/>[\s\S]*?children:\s*\[([\s\S]*?)\]\s*,?\s*\}/);
  assert(block, 'the settings route with its children was not found in App.jsx');
  const children = block[1];
  const iDuties = children.search(/path:\s*['"]assistant-duties['"]\s*,\s*handle:\s*\{\s*crumb:\s*['"]Assistant Duties['"]\s*\}/);
  const iStar = children.search(/path:\s*['"]\*['"]/);
  assert(iDuties >= 0, "no { path: 'assistant-duties', handle: { crumb: 'Assistant Duties' } } child");
  assert(iStar < 0 || iDuties < iStar, 'the assistant-duties child comes before the * child');
});

test('T6: the component asks the server through the three routes — GET and PUT /api/settings/assistant-duties and POST …/reset — confirms reset with window.confirm, offers dragging (draggable, onDragStart, onDrop) beside Move up / Move down, names categories with the Duty Menu page\'s categoryOf, never uses the generic /api/settings save, and types none of the story\'s sentences itself (AC-3, AC-4; ADR sub-decision 7)', () => {
  const raw = safeRead(TAB_JSX);
  assert(raw, `${rel(TAB_JSX)} does not exist (ADR sub-decision 7)`);
  const src = codeOnly(raw);
  const wrong = [];
  if (!src.includes(AD.ROUTES.list)) wrong.push(`it names ${AD.ROUTES.list}`);
  if (!src.includes(AD.ROUTES.reset) && !/assistant-duties['"`]\s*\+\s*['"`]\/reset|\$\{[^}]+\}\/reset/.test(src)) wrong.push(`it names ${AD.ROUTES.reset}`);
  if (!/method\s*:\s*['"]PUT['"]/.test(src)) wrong.push('a PUT request');
  if (!/method\s*:\s*['"]POST['"]/.test(src)) wrong.push('a POST request');
  if (!/window\.confirm\s*\(/.test(src)) wrong.push('window.confirm before reset');
  for (const w of ['draggable', 'onDragStart', 'onDrop']) if (!src.includes(w)) wrong.push(w);
  if (!/import\s*\{[^}]*\bcategoryOf\b[^}]*\}\s*from\s*['"]\.\.\/assistant\/dutyMenuCopy(\.js)?['"]/.test(src)) wrong.push("categoryOf imported from '../assistant/dutyMenuCopy'");
  if (!/from\s*['"]\.\/assistantDutiesCopy(\.js)?['"]/.test(src)) wrong.push("its words imported from './assistantDutiesCopy'");
  if (/['"`]\/api\/settings['"`]/.test(src) || /\bonSave\b|\bhandleSave\b/.test(src)) wrong.push('it never uses the generic /api/settings save');
  const typed = [...AD.SENTENCES, AD.COPY.reset, AD.COPY.changeRelay, AD.COPY.dragHandle, AD.COPY.keyLabel].filter((s) => raw.includes(s));
  if (typed.length) wrong.push(`typed into the JSX instead of read from the copy module: ${typed.map(show).join('; ')}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('T7: the Duty Menu page\'s offer panel says "offers" — the copy module\'s offerExplainer and offerEmpty are the story\'s two new sentences (story § Copy; ADR sub-decision 8)', async () => {
  const mod = await esm(DUTY_MENU_COPY, 'It is the Duty Menu page\'s words.');
  const c = mod.DUTY_MENU_COPY || {};
  const wrong = [];
  if (c.offerExplainer !== DM.PAGE.offerExplainer) wrong.push(`offerExplainer: want ${show(DM.PAGE.offerExplainer)}, got ${show(c.offerExplainer)}`);
  if (c.offerEmpty !== DM.PAGE.offerEmpty) wrong.push(`offerEmpty: want ${show(DM.PAGE.offerEmpty)}, got ${show(c.offerEmpty)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── S — the records (ADR sub-decision 9) ───────────────────────── */

test('S1: no list is left in code — src/lib/duty-menu defines no OFFER_KEYS and names none of the four kinds it has no other reason to name (30382, 30392, 30393, 30394) as a literal; 39998 and 39999 stay, as the Concept slots the rule reads (AC-5 "no longer fixed in code"; ADR sub-decision 2)', () => {
  const src = codeOnly(safeRead(LIB));
  assert(src, `${rel(LIB)} is missing`);
  const literals = ['30382', '30392', '30393', '30394'].filter((k) => new RegExp(`['"\`]${k}['"\`]`).test(src));
  const wrong = [];
  if (/\bOFFER_KEYS\b/.test(src)) wrong.push('OFFER_KEYS is still defined');
  if (literals.length) wrong.push(`literal kinds: ${show(literals)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('S2: BIBLE §11 lists the three routes, its duty-menu offer text says the offer comes from the Assistant Duties settings (not "Scores for the Owner and active customers"), and §15 names assistantDuties as editable in settings.json (ADR sub-decision 9)', () => {
  const bible = safeRead(BIBLE);
  const wrong = [];
  for (const [method, p] of [['GET', AD.ROUTES.list], ['PUT', AD.ROUTES.list], ['POST', AD.ROUTES.reset]]) {
    if (!new RegExp(`\\|\\s*${method}\\s*\\|\\s*\`${p.replace(/[/.*+?^${}()|[\]\\]/g, '\\$&')}\``).test(bible)) wrong.push(`a §11 row | ${method} | \`${p}\``);
  }
  if (/Scores for the Owner and active customers/.test(bible)) wrong.push('the attention row still says "Scores for the Owner and active customers"');
  if (!/Assistant Duties/.test(bible)) wrong.push('the attention row names the Assistant Duties settings');
  if (!/assistantDuties/.test(bible)) wrong.push('§15 names assistantDuties');
  assert(wrong.length === 0, wrong.join('; '));
});

test('S3: the earlier ADRs point here — assistant-duty-menu/0001 is "Partly superseded by ADR `assistant-duties-settings/0001`", and assistant-self-map/0001 names assistant-duties-settings/0001 (ADR sub-decision 9)', () => {
  const wrong = [];
  const old = safeRead(OLD_ADR);
  const head = old.split(NL).slice(0, 8).join(NL);
  if (!/Partly superseded by ADR `assistant-duties-settings\/0001`/.test(head)) wrong.push(`${rel(OLD_ADR)}: under its Status line, "Partly superseded by ADR \`assistant-duties-settings/0001\`"`);
  if (!/assistant-duties-settings\/0001/.test(safeRead(SELF_MAP_ADR))) wrong.push(`${rel(SELF_MAP_ADR)} names assistant-duties-settings/0001`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('S4: duty-menus.md\'s implementation line says the rows are the ones the Owner lists in Assistant Duties settings, not "naming the instance\'s own relay" (ADR sub-decision 9)', () => {
  const head = safeRead(DUTY_MENUS_SPEC).split(NL).slice(0, 12).join(NL);
  const wrong = [];
  if (/with rows naming the instance's own relay/.test(head)) wrong.push('it still says "with rows naming the instance\'s own relay"');
  if (!/Assistant Duties settings/.test(head)) wrong.push('it names the Assistant Duties settings');
  assert(wrong.length === 0, wrong.join('; '));
});

async function run() {
  console.log(`${NL}=== assistant-duties-settings (assistant-duties-settings #1) ===`);
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
  console.log(`${NL}assistant-duties-settings: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

module.exports = { run };
