'use strict';
/**
 * assistant-duty-cards #1: the hub's Duty Menu and Your Assistant's Treasure Map cards, as placeholders.
 *
 * Story: engineering-team/stories/assistant-duty-cards/1-duty-menu-and-treasure-map-placeholder-cards.md
 * ADR:   engineering-team/decisions/assistant-duty-cards/0001-two-placeholder-entries-in-the-one-action-list.md
 * Plan:  engineering-team/stories/assistant-duty-cards/1-duty-menu-and-treasure-map-placeholder-cards.test-plan.md
 * Browser half: the hub specs, which loop over the hub fixture's actions and so pick the two cards up —
 *   tests/brainstorm/assistant-management-page.spec.js (B1 the cards and marks, B8 the placeholder pages, the
 *   typed-in and refreshed addresses) and tests/brainstorm/assistant-alert.spec.js (the pill's count).
 * Words and shapes: test/helpers/dutyCardsFixtures.js.
 *
 * Classes (all stack-free):
 *   C — the pure ESM module ui/src/pages/assistant/actions.js, loaded in Node: the two entries, their words and
 *       placeholder content, CHECKED_ACTIONS, and assistantAttention()'s marks and counts.        [AC-1, AC-2, AC-3]
 *   W — what this runner cannot execute, by source: the generated placeholder routes in App.jsx, and the server's
 *       probe filter letting both addresses through to the app.                                    [AC-2]
 *   S — nothing else changes: the sections, the server's attention answer, the person's /treasure-map. [AC-4]
 *
 * Everything FAILS against the current code: ASSISTANT_ACTIONS has eleven entries and neither the duty-menu nor the
 * treasure-map key. Every "nothing else changes" check is paired with a check that the two entries exist, so none
 * of them passes merely because the cards are missing.
 *
 * Re-aimed 2026-10-11 by assistant-duty-menu #1 (story AC-4, ADR 0001 sub-decision 6; plan
 * engineering-team/stories/assistant-duty-menu/1-the-duty-menu-page-and-its-check.test-plan.md): the Duty Menu card is
 * built — a checked action with its own page and its own answer — so the placeholder pins (C3, C5–C7, W1, S1) now hold
 * for the card that stays one, Your Assistant's Treasure Map (D.PLACEHOLDER_KEYS), and C4 reads the new CHECKED_ACTIONS.
 * C1, C2, C8, W2 and S2 are unchanged. test/assistant-duty-menu-check.test.js pins the Duty Menu card's new behavior.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const D = require('./helpers/dutyCardsFixtures');
const X = require('./helpers/assistantManagementFixtures');
const CS = require('./helpers/comingSoonFixtures');

const REPO = path.resolve(__dirname, '..');
const ACTIONS_MOD = path.join(REPO, 'ui/src/pages/assistant/actions.js');
const MENU_MOD = path.join(REPO, 'ui/src/config/avatarMenuLinks.js');
const APP = path.join(REPO, 'ui/src/App.jsx');
const ATTENTION_API = path.join(REPO, 'src/api/assistant/attention.js');
const SITE_TRUST = path.join(REPO, 'src/utils/siteTrust.js');
const NL = String.fromCharCode(10);

// Fixture keys, never live ones.
const VIEWER = 'd1'.repeat(32);
const ASSISTANT = 'd2'.repeat(32);
const WITH_ASSISTANT = { pubkey: VIEWER, assistantPubkey: ASSISTANT };
const NO_ASSISTANT = { pubkey: VIEWER, assistantPubkey: null };

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);
const DUTY_KEYS = D.CARDS.map((c) => c.key);
// The book's cards that are still placeholders (re-aimed by assistant-duty-menu #1: the Treasure Map card only).
const PLACEHOLDER_CARDS = D.CARDS.filter((c) => D.PLACEHOLDER_KEYS.includes(c.key));

/** Source with comments removed (block comments become blank lines, so line numbers stay true). */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .split(NL)
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}

/* ───────────────────────── the modules under test ───────────────────────── */

const esmCache = new Map();
async function loadEsm(absPath, what) {
  if (!esmCache.has(absPath)) {
    let mod;
    if (!fs.existsSync(absPath)) {
      mod = { __loadError: new Error(`${rel(absPath)} does not exist. ${what}`) };
    } else {
      try { mod = await import(pathToFileURL(absPath).href); } catch (err) {
        mod = { __loadError: new Error(`${rel(absPath)} must load in Node as ESM (relative imports with .js): ${err.message}`) };
      }
    }
    esmCache.set(absPath, mod);
  }
  const mod = esmCache.get(absPath);
  if (mod.__loadError) throw mod.__loadError;
  return mod;
}
const actionsModule = () => loadEsm(ACTIONS_MOD, 'It is the hub\'s one data module (ADR assistant-management/0001 sub-decision 1).');
const menuModule = () => loadEsm(MENU_MOD, 'It holds the page addresses.');

function need(mod, name) {
  assert(mod[name] !== undefined, `ui/src/pages/assistant/actions.js must export ${name}`);
  return mod[name];
}

/** The two entries, or a failure that says which is missing (ADR 0001 sub-decision 1). */
async function dutyEntries() {
  const actions = need(await actionsModule(), 'ASSISTANT_ACTIONS');
  const keys = actions.map((a) => a && a.key);
  const missing = DUTY_KEYS.filter((k) => !keys.includes(k));
  assert(missing.length === 0, `ASSISTANT_ACTIONS has no entry with key ${missing.map(show).join(' or ')} (ADR assistant-duty-cards/0001 sub-decisions 1–2); its keys are ${show(keys)}`);
  return DUTY_KEYS.map((k) => actions.find((a) => a.key === k));
}

/** A description's words as a reader sees them, and its link parts. */
function partsText(parts) {
  assert(Array.isArray(parts), `a description must be an array of parts, got ${show(parts)}`);
  return parts.map((p) => (typeof p === 'string' ? p : p && p.text)).join('');
}
const linkParts = (parts) => (Array.isArray(parts) ? parts.filter((p) => p && typeof p === 'object') : []);

/** The attention answer as the hub hands it to assistantAttention(): summarized, every checked action as given. */
function answered(actions) { return { answered: true, hasAssistant: true, actions }; }
const allCheckedDone = () => Object.fromEntries(D.CHECKED.map((k) => [k, { finished: true, done: true, pending: false }]));
// Re-aimed by assistant-coming-soon #1 (AC-2): the five that say Coming soon are never marked or counted, so the
// placeholders the hub marks and counts are the rest (Your Assistant's Treasure Map), and COUNTED_KEYS is every action
// the hub can mark.
const COUNTED_KEYS = D.ALL_KEYS.filter((k) => !CS.KEYS.includes(k));
const placeholdersInOrder = () => COUNTED_KEYS.filter((k) => !D.CHECKED.includes(k));

/* ───────────────────────── C — the data module ───────────────────────── */

test('C1: the hub has thirteen actions — Duty Menu, then Your Assistant\'s Treasure Map, close the persona section right after Outbox Relays, and the other eleven keep their order (AC-1)', async () => {
  const actions = need(await actionsModule(), 'ASSISTANT_ACTIONS');
  const keys = actions.map((a) => a && a.key);
  const wrong = [];
  if (keys.length !== 13) wrong.push(`thirteen actions, got ${keys.length}`);
  if (show(keys) !== show(D.ALL_KEYS)) wrong.push(`the actions in order: want ${show(D.ALL_KEYS)}, got ${show(keys)}`);
  const persona = actions.filter((a) => a && a.section === 'persona').map((a) => a.key);
  if (show(persona) !== show(D.PERSONA_KEYS)) wrong.push(`"Your Assistant's Public Persona": want ${show(D.PERSONA_KEYS)}, got ${show(persona)}`);
  const at = keys.indexOf(D.AFTER_KEY);
  if (keys[at + 1] !== DUTY_KEYS[0] || keys[at + 2] !== DUTY_KEYS[1]) wrong.push(`right after ${D.AFTER_KEY}: want ${show(DUTY_KEYS)}, got ${show(keys.slice(at + 1, at + 3))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('C2: each card has its approved section, address, title and description, and the description carries no link (AC-1; story § Copy)', async () => {
  const entries = await dutyEntries();
  const wrong = [];
  D.CARDS.forEach((want, i) => {
    const got = entries[i];
    if (got.section !== want.section) wrong.push(`${want.key} section: want ${show(want.section)}, got ${show(got.section)}`);
    if (got.path !== want.path) wrong.push(`${want.key} path: want ${show(want.path)}, got ${show(got.path)}`);
    if (got.title !== want.title) wrong.push(`${want.key} title: want ${show(want.title)}, got ${show(got.title)}`);
    let text;
    try { text = partsText(got.description); } catch (err) { text = `(${err.message})`; }
    if (text !== want.text) wrong.push(`${want.key} description: want ${show(want.text)}, got ${show(text)}`);
    const links = linkParts(got.description);
    if (links.length) wrong.push(`${want.key}: the approved description has no link, got ${show(links)}`);
  });
  assert(wrong.length === 0, wrong.join('; '));
});

// Re-aimed by assistant-duty-menu #1: the Duty Menu card's page is built (its criteria: test/assistant-duty-menu-check.test.js C1).
test('C3, re-aimed by assistant-self-map #1: the Treasure Map card\'s page is built — no card of this book is a placeholder; its entry carries the story\'s criteria line, no planning notes, and no editor link (assistant-self-map #1 § Copy; ADR 0001 sub-decision 9)', async () => {
  const entries = await dutyEntries();
  const wrong = [];
  if (PLACEHOLDER_CARDS.length !== 0) wrong.push(`no placeholder card is left, got ${show(PLACEHOLDER_CARDS.map((c) => c.key))}`);
  const want = D.CARDS.find((c) => c.key === 'treasure-map');
  const got = entries[DUTY_KEYS.indexOf('treasure-map')];
  if (!got) wrong.push('the Treasure Map card is missing');
  else {
    if (got.alertCriteria !== want.alertCriteria) wrong.push(`alertCriteria: want ${show(want.alertCriteria)}, got ${show(got.alertCriteria)}`);
    if (got.planningNotes !== want.planningNotes) wrong.push(`planningNotes: want ${show(want.planningNotes)}, got ${show(got.planningNotes)}`);
    if (got.editLink !== undefined && got.editLink !== null) wrong.push(`no editor link, got editLink ${show(got.editLink)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

// Re-aimed by assistant-duty-menu #1 (ADR 0001 sub-decision 6): duty-menu joins CHECKED_ACTIONS after outbox-relays.
test('C4: CHECKED_ACTIONS is the six checks, duty-menu right after outbox-relays, and treasure-map right after duty-menu (AC-3; ADR 0001 sub-decision 3; assistant-duty-menu ADR 0001 sub-decision 6; re-aimed by assistant-self-map ADR 0001 sub-decision 9)', async () => {
  await dutyEntries();
  const checked = need(await actionsModule(), 'CHECKED_ACTIONS');
  assert(show(checked) === show(D.CHECKED), `CHECKED_ACTIONS: want ${show(D.CHECKED)}, got ${show(checked)}`);
});

// Re-aimed by assistant-duty-menu #1: the Duty Menu card is checked, so a done answer leaves it unmarked and in Done.
test('C5: for a viewer with an Assistant whose checked actions are all done, the marks and both counts are exactly the placeholders — none since assistant-self-map #1 — and the Done list is the checked actions, both cards among them (AC-3)', async () => {
  await dutyEntries();
  const got = need(await actionsModule(), 'assistantAttention')(WITH_ASSISTANT, answered(allCheckedDone()));
  const want = placeholdersInOrder();
  const wrong = [];
  if (show(got.needsAttention) !== show(want)) wrong.push(`needsAttention: want ${show(want)}, got ${show(got.needsAttention)}`);
  if (got.count !== want.length) wrong.push(`the count line: want ${want.length}, got ${got.count}`);
  if (got.alertCount !== want.length) wrong.push(`the Assistant Alert: want ${want.length}, got ${got.alertCount}`);
  if (show(got.done) !== show(D.CHECKED)) wrong.push(`done: want ${show(D.CHECKED)}, got ${show(got.done)}`);
  for (const k of D.PLACEHOLDER_KEYS) if ((got.done || []).includes(k)) wrong.push(`${k} must never be Done`);
  assert(wrong.length === 0, wrong.join('; '));
});

// Re-aimed by assistant-duty-menu #1: only the Treasure Map card is still a placeholder; the Duty Menu card's answer counts.
test('C6, re-aimed by assistant-self-map #1: an answer about the Treasure Map card now moves it — done: unmarked, Done, not counted; pending: marked and counted once (was "changes nothing"; ADR assistant-self-map/0001 sub-decision 9)', async () => {
  await dutyEntries();
  const attention = need(await actionsModule(), 'assistantAttention');
  const base = attention(WITH_ASSISTANT, answered(allCheckedDone()));
  const wrong = [];
  if (base.needsAttention.includes('treasure-map') || !(base.done || []).includes('treasure-map')) wrong.push(`done: unmarked and Done, got ${show({ needsAttention: base.needsAttention, done: base.done })}`);
  const pending = attention(WITH_ASSISTANT, answered({ ...allCheckedDone(), 'treasure-map': { finished: true, done: false, pending: true } }));
  if (!pending.needsAttention.includes('treasure-map') || (pending.done || []).includes('treasure-map')) wrong.push('pending: marked, not Done');
  if (pending.count !== base.count + 1 || pending.alertCount !== base.alertCount + 1) wrong.push(`pending: counted once (${base.count}/${base.alertCount} → ${pending.count}/${pending.alertCount})`);
  assert(wrong.length === 0, wrong.join('; '));
});

// Re-aimed by assistant-duty-menu #1: both cards are still marked; the Alert counts the placeholders only, so the Duty
// Menu card, now checked, is marked but not counted until a finished answer says it needs attention.
test('C7: before the answer arrives, or when it failed, both cards are marked, and the Assistant Alert counts the placeholders only — none since assistant-self-map #1 (AC-3)', async () => {
  await dutyEntries();
  const attention = need(await actionsModule(), 'assistantAttention');
  const wrong = [];
  for (const [label, given] of [['no answer', null], ['not answered', { answered: false, actions: {} }]]) {
    const got = attention(WITH_ASSISTANT, given);
    for (const k of DUTY_KEYS) if (!got.needsAttention.includes(k)) wrong.push(`${label}: ${k} must be marked`);
    if (got.count !== COUNTED_KEYS.length) wrong.push(`${label}: every action but the five coming soon is marked until answered, want ${COUNTED_KEYS.length}, got ${got.count}`);
    if (got.alertCount !== placeholdersInOrder().length) wrong.push(`${label}: the Alert counts the placeholders only, want ${placeholdersInOrder().length}, got ${got.alertCount}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('C8: a visitor, or a signed-in viewer with no Assistant here, sees no mark and nothing counted, whatever the answer says (AC-3)', async () => {
  await dutyEntries();
  const attention = need(await actionsModule(), 'assistantAttention');
  const NONE = { hasAssistant: false, needsAttention: [], done: [], count: 0, alertCount: 0 };
  const wrong = [];
  for (const [label, user] of [['visitor', null], ['no assistant', NO_ASSISTANT]]) {
    for (const given of [null, answered(allCheckedDone())]) {
      const got = attention(user, given);
      const shaped = got && { hasAssistant: got.hasAssistant, needsAttention: got.needsAttention, done: got.done, count: got.count, alertCount: got.alertCount };
      if (show(shaped) !== show(NONE)) wrong.push(`${label}, ${given ? 'answered' : 'no answer'}: want ${show(NONE)}, got ${show(shaped)}`);
    }
  }
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── W — routes and deep links, by source ───────────────────────── */

// Re-aimed by assistant-duty-menu #1: /assistant/duty-menu has its own page (test/assistant-duty-menu-page.test.js D1).
test('W1, re-aimed by assistant-self-map #1: both cards\' addresses route to their built pages in App.jsx\'s ACTION_PAGES, and every action\'s route is still generated from ASSISTANT_ACTIONS (AC-2; ADR 0001 § Codebase facts; assistant-duty-menu ADR 0001 and assistant-self-map ADR 0001 sub-decision 9)', async () => {
  await dutyEntries();
  const app = codeOnly(safeRead(APP));
  const pages = (app.match(/const\s+ACTION_PAGES\s*=\s*\{([\s\S]*?)\};/) || [])[1];
  const wrong = [];
  if (pages === undefined) wrong.push('App.jsx has no `const ACTION_PAGES = { … };`');
  else for (const k of DUTY_KEYS) if (!new RegExp(`(^|[\\s,{])['"]?${k}['"]?\\s*:`).test(pages)) wrong.push(`ACTION_PAGES gives ${k} its built page`);
  const placeholder = (app.match(/import\s+(\w+)\s+from\s+['"]\.\/pages\/assistant\/ActionPage(?:\.jsx?)?['"]/) || [])[1];
  if (!placeholder) wrong.push('no default import from ./pages/assistant/ActionPage (the placeholder page)');
  else if (!new RegExp(`ASSISTANT_ACTIONS\\.map\\(\\s*\\(?\\s*(\\w+)\\s*\\)?\\s*=>\\s*\\(\\s*\\{\\s*path:\\s*\\1\\.path\\s*,\\s*element:\\s*ACTION_PAGES\\[\\s*\\1\\.key\\s*\\]\\s*\\?\\?\\s*<${placeholder}\\b[^>]*\\baction=\\{\\s*\\1\\s*\\}`).test(app)) {
    wrong.push(`the action routes are not generated as ...ASSISTANT_ACTIONS.map((a) => ({ path: a.path, element: ACTION_PAGES[a.key] ?? <${placeholder} action={a} /> }))`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('W2: opening either address directly reaches the app — the server\'s probe filter lets both through to the SPA catch-all (AC-2)', async () => {
  const entries = await dutyEntries();
  const { isBlockedProbePath } = require(SITE_TRUST);
  assert(typeof isBlockedProbePath === 'function', `${rel(SITE_TRUST)} must export isBlockedProbePath()`);
  const blocked = entries.map((e) => e.path).filter((p) => isBlockedProbePath(p) || isBlockedProbePath(`${p}/`));
  assert(blocked.length === 0, `these addresses would be refused before the app is served: ${show(blocked)}`);
});

/* ───────────────────────── S — nothing else changes ───────────────────────── */

// Re-aimed by assistant-duty-menu #1: the attention answer checks the Duty Menu now (ADR 0001 sub-decision 7).
test('S1: the hub\'s three sections are unchanged, and the server\'s attention answer checks both cards — duty-menu since assistant-duty-menu #1, treasure-map since assistant-self-map #1 (AC-4, re-aimed; ADR assistant-self-map/0001 sub-decision 8)', async () => {
  await dutyEntries();
  const sections = need(await actionsModule(), 'ASSISTANT_SECTIONS').map((s) => ({ key: s.key, heading: s.heading }));
  const wrong = [];
  if (show(sections) !== show(X.SECTIONS)) wrong.push(`ASSISTANT_SECTIONS: want ${show(X.SECTIONS)}, got ${show(sections)}`);
  const api = codeOnly(safeRead(ATTENTION_API));
  if (!api) wrong.push(`${rel(ATTENTION_API)} not found`);
  for (const k of DUTY_KEYS) if (!api.includes(`'${k}'`) && !api.includes(`"${k}"`)) wrong.push(`${rel(ATTENTION_API)} answers ${k}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('S2: the person\'s own Treasure Map page stays at /treasure-map, and no hub action takes that address (AC-4)', async () => {
  const entries = await dutyEntries();
  const menu = await menuModule();
  const wrong = [];
  if (menu.MANAGE_TREASURE_MAP_PATH !== D.PERSON_TREASURE_MAP_PATH) wrong.push(`MANAGE_TREASURE_MAP_PATH: want ${show(D.PERSON_TREASURE_MAP_PATH)}, got ${show(menu.MANAGE_TREASURE_MAP_PATH)}`);
  const actions = need(await actionsModule(), 'ASSISTANT_ACTIONS');
  const taken = actions.filter((a) => a.path === D.PERSON_TREASURE_MAP_PATH).map((a) => a.key);
  if (taken.length) wrong.push(`no action may sit at ${D.PERSON_TREASURE_MAP_PATH}, got ${show(taken)}`);
  if (entries[1].path === D.PERSON_TREASURE_MAP_PATH) wrong.push('the Assistant\'s Treasure Map card must not open the person\'s Treasure Map page');
  assert(wrong.length === 0, wrong.join('; '));
});

async function run() {
  console.log(`${NL}=== assistant-duty-cards (assistant-duty-cards #1) ===`);
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
  console.log(`${NL}assistant-duty-cards: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

module.exports = { run };
