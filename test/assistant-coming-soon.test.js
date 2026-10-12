'use strict';
/**
 * assistant-coming-soon #1: Coming soon — five hub cards that aren't built yet stop asking for attention.
 *
 * Story (with its Design note, Edge cases and AC→handle lines; Light profile, no ADR):
 *   engineering-team/stories/done/assistant-coming-soon/1-coming-soon-cards.md
 * Browser half: tests/brainstorm/assistant-coming-soon.spec.js.
 * Expected cards and words: test/helpers/comingSoonFixtures.js (CS).
 * The suites this story re-aims (every action without a check counted, now less the five): assistant-attention C3, R2;
 * assistant-duty-cards C5, C7; assistant-duty-menu-check C3, C4, C5; assistant-management-page D7;
 * assistant-profile-check C2; assistant-trusted-content C2.
 *
 * Classes:
 *   C — the hub's pure readings and words in ui/src/pages/assistant/actions.js, loaded in Node.     [AC-1–AC-4]
 *   D — source sentinels on what this runner cannot execute: the card (Index.jsx), the placeholder page
 *       (ActionPage.jsx), the pill's CSS, the top-bar pill and the server's answer.                 [AC-1, AC-3, AC-4]
 *
 * Every C and D test FAILS against the code before this story — actions.js has no COMING_SOON_ACTIONS and none of the
 * three words, assistantAttention marks and counts the five, the card has no Coming soon pill, and the page says
 * "Placeholder page." for every action — except the sentinels marked (sentinel), which pass before and after: C5 (the
 * Treasure Map card stays marked and counted), C6 (nothing for a visitor or a viewer with no Assistant), C7 (the five
 * entries' words are unchanged), D4 (the muted pill's CSS already exists) and D5 (the top-bar pill and the server's
 * answer need no change).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const CS = require('./helpers/comingSoonFixtures');
const X = require('./helpers/assistantManagementFixtures');

const REPO = path.resolve(__dirname, '..');
const ACTIONS_MOD = path.join(REPO, 'ui/src/pages/assistant/actions.js');
const PROFILE_COPY_MOD = path.join(REPO, 'ui/src/pages/assistant/profileChecklistCopy.js');
const UI_UTIL = path.join(REPO, 'ui/src/utils/assistantAttention.js');
const HUB_PAGE = path.join(REPO, 'ui/src/pages/assistant/Index.jsx');
const ACTION_PAGE = path.join(REPO, 'ui/src/pages/assistant/ActionPage.jsx');
const TOP_BAR_ALERT = path.join(REPO, 'ui/src/components/TopBarAlert.jsx');
const ATTENTION_MODULE = path.join(REPO, 'src/api/assistant/attention.js');
const STYLES = path.join(REPO, 'ui/src/styles.css');
const NL = String.fromCharCode(10);

// Fixture keys, never live ones.
const USER = { pubkey: 'cc'.repeat(32), classification: 'customer', assistantPubkey: 'c1'.repeat(32) };
const NO_ASSISTANT = { pubkey: 'ee'.repeat(32), classification: 'guest', assistantPubkey: null };

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
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .split(NL)
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}

async function esm(absPath, what) {
  assert(fs.existsSync(absPath), `${rel(absPath)} does not exist. ${what}`);
  let mod;
  try { mod = await import(pathToFileURL(absPath).href); } catch (err) { throw new Error(`${rel(absPath)} must load in Node as an ES module: ${err.message}`); }
  return mod;
}
const actionsModule = () => esm(ACTIONS_MOD, 'It holds ASSISTANT_ACTIONS, CHECKED_ACTIONS, ASSISTANT_COPY and assistantAttention.');
const uiUtil = () => esm(UI_UTIL, 'It holds summarizeAttention.');

/** The attention answer as the hub hands it to assistantAttention(): summarized, every given action as given. */
const answered = (actions) => ({ answered: true, hasAssistant: true, actions });
const DONE = { finished: true, done: true, pending: false };
const allCheckedDone = (mod) => Object.fromEntries(mod.CHECKED_ACTIONS.map((k) => [k, { ...DONE }]));

/** What the hub marks and counts, once the five are left out (story AC-2), in ASSISTANT_ACTIONS order. */
function expected(mod) {
  const keys = mod.ASSISTANT_ACTIONS.map((a) => a.key).filter((k) => !CS.KEYS.includes(k));
  const placeholders = keys.filter((k) => !mod.CHECKED_ACTIONS.includes(k));
  return { keys, placeholders };
}
const pick = (r) => r && { needsAttention: r.needsAttention, done: r.done, shared: r.shared, count: r.count, alertCount: r.alertCount };

/* ───────────────────────── C — the data module ───────────────────────── */

test('C1: COMING_SOON_ACTIONS is exactly the five, in ASSISTANT_ACTIONS order — each a real action, none checked — and Your Assistant\'s Treasure Map is in neither list (AC-1, AC-4; Design note)', async () => {
  const mod = await actionsModule();
  const list = mod.COMING_SOON_ACTIONS;
  assert(Array.isArray(list), `actions.js must export COMING_SOON_ACTIONS (an array of keys), got ${show(list)}`);
  const keys = mod.ASSISTANT_ACTIONS.map((a) => a.key);
  const wrong = [];
  if (show(list) !== show(CS.KEYS)) wrong.push(`want ${show(CS.KEYS)}, got ${show(list)}`);
  const inOrder = keys.filter((k) => list.includes(k));
  if (show(inOrder) !== show(list)) wrong.push(`in ASSISTANT_ACTIONS order: want ${show(inOrder)}, got ${show(list)}`);
  for (const k of list) {
    if (!keys.includes(k)) wrong.push(`${k} is not an action`);
    if (mod.CHECKED_ACTIONS.includes(k)) wrong.push(`${k} is a checked action too`);
  }
  if (list.includes(CS.STILL_PLACEHOLDER)) wrong.push(`${CS.STILL_PLACEHOLDER} is left as it is (the owner, at intake)`);
  if (mod.CHECKED_ACTIONS.includes(CS.STILL_PLACEHOLDER)) wrong.push(`${CS.STILL_PLACEHOLDER} has no check yet`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('C2: the words — ASSISTANT_COPY.comingSoon is the background image panel\'s pill word, comingSoonSrPrefix and comingSoonPage are § Copy\'s, and the words that stay are unchanged (§ Copy; J1 note)', async () => {
  const { ASSISTANT_COPY: C } = await actionsModule();
  const { PROFILE_CHECKLIST_COPY } = await esm(PROFILE_COPY_MOD, 'It holds the background image panel\'s words.');
  const wrong = [];
  if (C.comingSoon !== CS.COPY.pill) wrong.push(`comingSoon: want ${show(CS.COPY.pill)}, got ${show(C.comingSoon)}`);
  if (C.comingSoon !== PROFILE_CHECKLIST_COPY.comingSoon) wrong.push(`comingSoon must equal PROFILE_CHECKLIST_COPY.comingSoon (${show(PROFILE_CHECKLIST_COPY.comingSoon)})`);
  if (C.comingSoonSrPrefix !== CS.COPY.srPrefix) wrong.push(`comingSoonSrPrefix: want ${show(CS.COPY.srPrefix)}, got ${show(C.comingSoonSrPrefix)}`);
  if (C.comingSoonPage !== CS.COPY.pageLine) wrong.push(`comingSoonPage: want ${show(CS.COPY.pageLine)}, got ${show(C.comingSoonPage)}`);
  for (const [k, want] of [['placeholder', CS.COPY.placeholder], ['needsAttention', X.COPY.needsAttention], ['done', 'Done'], ['shared', 'Shared']]) {
    if (C[k] !== want) wrong.push(`${k} is unchanged: want ${show(want)}, got ${show(C[k])}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('C3: AC-2\'s table — every check done: the Treasure Map card alone, 1 and 1 (was 6 and 6); failed, not answered, checking or no answer yet: 8 marked (the seven checked and the Treasure Map card), 1 in the pill (was 13 and 6) (AC-2)', async () => {
  const mod = await actionsModule();
  const summarize = (await uiUtil()).summarizeAttention;
  const { keys, placeholders } = expected(mod);
  const wrong = [];
  // Every check done.
  const done = mod.assistantAttention(USER, answered(allCheckedDone(mod)));
  if (show(done.needsAttention) !== show(placeholders)) wrong.push(`every check done: marked want ${show(placeholders)}, got ${show(done.needsAttention)}`);
  if (done.count !== 1 || done.alertCount !== 1) wrong.push(`every check done: count and pill want 1 and 1, got ${done.count} and ${done.alertCount}`);
  if (show(done.done) !== show(mod.CHECKED_ACTIONS)) wrong.push(`every check done: Done want ${show(mod.CHECKED_ACTIONS)}, got ${show(done.done)}`);
  // Not in yet, or failed.
  for (const [label, att] of [
    ['no answer', undefined],
    ['failed', summarize(null)],
    ['not answered', { answered: false, actions: {} }],
    ['checking', { phase: 'checking', answered: false, actions: {} }],
  ]) {
    const got = att === undefined ? mod.assistantAttention(USER) : mod.assistantAttention(USER, att);
    if (show(got.needsAttention) !== show(keys)) wrong.push(`${label}: marked want ${show(keys)}, got ${show(got.needsAttention)}`);
    if (got.count !== 8) wrong.push(`${label}: the count line want 8, got ${got.count}`);
    if (got.alertCount !== 1) wrong.push(`${label}: the pill want 1, got ${got.alertCount}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('C4: an answer that says anything about one of the five changes nothing — done, pending, unfinished, shared or nonsense: never marked, never Done, never shared, never counted (AC-2; E4)', async () => {
  const mod = await actionsModule();
  const base = mod.assistantAttention(USER, answered(allCheckedDone(mod)));
  const claims = [
    { ...DONE },
    { finished: true, done: false, pending: true },
    { finished: false, done: false, pending: false },
    { finished: true, done: true, pending: false, shared: 'entirely' },
    { done: 'yes', pending: 1 },
  ];
  const wrong = [];
  for (const claim of claims) {
    const forged = { ...allCheckedDone(mod), ...Object.fromEntries(CS.KEYS.map((k) => [k, claim])) };
    const got = mod.assistantAttention(USER, answered(forged));
    for (const k of CS.KEYS) {
      if (got.needsAttention.includes(k)) wrong.push(`${show(claim)}: ${k} is never marked`);
      if ((got.done || []).includes(k)) wrong.push(`${show(claim)}: ${k} is never Done`);
      if (got.shared && got.shared[k]) wrong.push(`${show(claim)}: ${k} is never shared`);
    }
    if (show(pick(got)) !== show(pick(base))) wrong.push(`${show(claim)}: the answer must not move, want ${show(pick(base))}, got ${show(pick(got))}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('C5 (sentinel): Your Assistant\'s Treasure Map card is still marked and counted in both readings, in every state of the answer, and an answer about it changes nothing (AC-4)', async () => {
  const mod = await actionsModule();
  const summarize = (await uiUtil()).summarizeAttention;
  const k = CS.STILL_PLACEHOLDER;
  const wrong = [];
  // In these states no checked action is pending, so the pill counts placeholders only: the Treasure Map card among them.
  for (const [label, att] of [
    ['no answer', undefined],
    ['failed', summarize(null)],
    ['every check done', answered(allCheckedDone(mod))],
  ]) {
    const got = att === undefined ? mod.assistantAttention(USER) : mod.assistantAttention(USER, att);
    if (!got.needsAttention.includes(k)) wrong.push(`${label}: ${k} is marked`);
    if ((got.done || []).includes(k)) wrong.push(`${label}: ${k} is never Done`);
    if (got.alertCount < 1) wrong.push(`${label}: ${k} is counted in the pill, got ${got.alertCount}`);
  }
  const base = mod.assistantAttention(USER, answered(allCheckedDone(mod)));
  for (const claim of [{ ...DONE }, { finished: true, done: false, pending: true }]) {
    const got = mod.assistantAttention(USER, answered({ ...allCheckedDone(mod), [k]: claim }));
    if (show(pick(got)) !== show(pick(base))) wrong.push(`a claim ${show(claim)} about ${k} changes nothing, want ${show(pick(base))}, got ${show(pick(got))}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('C6 (sentinel): a visitor, or a signed-in viewer with no Assistant here, gets no marks, nothing Done and nothing counted, whatever the answer says (AC-4)', async () => {
  const mod = await actionsModule();
  const NONE = { needsAttention: [], done: [], shared: {}, count: 0, alertCount: 0 };
  const wrong = [];
  for (const [label, who] of [['visitor', null], ['no assistant', NO_ASSISTANT]]) {
    for (const att of [null, answered(allCheckedDone(mod))]) {
      const got = mod.assistantAttention(who, att);
      if (got.hasAssistant !== false || show(pick(got)) !== show(NONE)) wrong.push(`${label}, ${att ? 'answered' : 'no answer'}: got ${show(got)}`);
    }
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('C7 (sentinel): the five keep their section, address, title, description, alert criteria ("Not yet defined.") and planning notes (AC-3)', async () => {
  const mod = await actionsModule();
  const wrong = [];
  for (const card of CS.CARDS) {
    const got = mod.ASSISTANT_ACTIONS.find((a) => a.key === card.key);
    const want = X.ACTIONS.find((a) => a.path === card.path);
    if (!got || !want) { wrong.push(`${card.key}: missing (${got ? 'fixture' : 'actions.js'})`); continue; }
    if (got.path !== card.path) wrong.push(`${card.key} path: want ${show(card.path)}, got ${show(got.path)}`);
    if (got.title !== card.title || got.title !== want.title) wrong.push(`${card.key} title: want ${show(card.title)}, got ${show(got.title)}`);
    if (got.section !== want.section) wrong.push(`${card.key} section: want ${show(want.section)}, got ${show(got.section)}`);
    if (mod.plainText(got.description) !== want.text) wrong.push(`${card.key} description changed`);
    if ((got.alertCriteria ?? null) !== null) wrong.push(`${card.key}: no alert criteria yet, got ${show(got.alertCriteria)}`);
    if ((got.planningNotes ?? null) !== (want.planningNotes ?? null)) wrong.push(`${card.key} planning notes changed`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── D — what this runner cannot execute, by source ───────────────────────── */

function actionCardSource() {
  const code = codeOnly(safeRead(HUB_PAGE));
  const at = code.indexOf('function ActionCard');
  assert(at >= 0, `${rel(HUB_PAGE)} has no ActionCard`);
  const end = code.indexOf('export default function', at);
  return { card: code.slice(at, end > at ? end : at + 4000), page: code.slice(end > at ? end : 0) , all: code };
}

test('D1: the card draws Coming soon — Index.jsx imports COMING_SOON_ACTIONS from ./actions; ActionCard takes `comingSoon`; the page hands it COMING_SOON_ACTIONS.includes(action.key), not gated on sign-in; the muted pill (bs-setup-step-badge is-neutral, aria-hidden) with ASSISTANT_COPY.comingSoon; ASSISTANT_COPY.comingSoonSrPrefix for a screen reader (AC-1)', () => {
  const { card, page, all } = actionCardSource();
  const wrong = [];
  if (!/import\s*\{[^}]*\bCOMING_SOON_ACTIONS\b[^}]*\}\s*from\s*['"]\.\/actions(\.js)?['"]/.test(all)) wrong.push('Index.jsx imports COMING_SOON_ACTIONS from ./actions');
  if (!/function\s+ActionCard\s*\(\s*\{[^}]*\bcomingSoon\b[^}]*\}/.test(card)) wrong.push('ActionCard takes a `comingSoon` prop');
  const handed = page.match(/<ActionCard[^>]*\bcomingSoon=\{([^}]*)\}/);
  if (!handed) wrong.push('the page hands `comingSoon` to each card');
  else {
    if (!/COMING_SOON_ACTIONS\.includes\(\s*action\.key\s*\)/.test(handed[1])) wrong.push(`comingSoon is COMING_SOON_ACTIONS.includes(action.key), got ${show(handed[1].trim())}`);
    if (/signedIn|user|hasAssistant|loading/.test(handed[1])) wrong.push('comingSoon does not depend on sign-in: it is the same for every viewer');
  }
  if (!/className="bs-setup-step-badge is-neutral"\s+aria-hidden="true">\s*\{\s*ASSISTANT_COPY\.comingSoon\s*\}/.test(card)) wrong.push('the pill is <span className="bs-setup-step-badge is-neutral" aria-hidden="true">{ASSISTANT_COPY.comingSoon}</span>');
  if (!/bs-sr-only[^>]*>\s*\{\s*ASSISTANT_COPY\.comingSoonSrPrefix\s*\}/.test(card)) wrong.push('a bs-sr-only span carries ASSISTANT_COPY.comingSoonSrPrefix');
  assert(wrong.length === 0, wrong.join('; '));
});

test('D2: the screen-reader prefix sits inside the card\'s link, before the title, as the other prefixes do; the pill sits after the link, in the title row (AC-1)', () => {
  const { card } = actionCardSource();
  const link = card.match(/<Link\b[^>]*className="bs-assistant-hub-card-link"[^>]*>([\s\S]*?)<\/Link>/);
  assert(link, 'the card\'s link (bs-assistant-hub-card-link) is found');
  const inside = link[1];
  const wrong = [];
  const sr = inside.indexOf('ASSISTANT_COPY.comingSoonSrPrefix');
  const title = inside.indexOf('action.title');
  if (sr < 0) wrong.push('the Coming soon prefix is inside the link');
  else if (title >= 0 && sr > title) wrong.push('the prefix comes before the title');
  const after = card.slice(card.indexOf(link[0]) + link[0].length);
  if (!/ASSISTANT_COPY\.comingSoon\b(?!SrPrefix|Page)/.test(after)) wrong.push('the pill comes after the link');
  const head = card.match(/className="bs-assistant-hub-card-head"[\s\S]*?<\/div>/);
  if (!head || !/ASSISTANT_COPY\.comingSoon\b(?!SrPrefix|Page)/.test(head[0])) wrong.push('the pill is in the title row (bs-assistant-hub-card-head)');
  assert(wrong.length === 0, wrong.join('; '));
});

test('D3: the placeholder page says ASSISTANT_COPY.comingSoonPage for the five and ASSISTANT_COPY.placeholder for any other action — ActionPage.jsx imports COMING_SOON_ACTIONS from ./actions and keeps the bold line (AC-3, AC-4)', () => {
  const code = codeOnly(safeRead(ACTION_PAGE));
  assert(code, `${rel(ACTION_PAGE)} is the placeholder page`);
  const wrong = [];
  if (!/import\s*\{[^}]*\bCOMING_SOON_ACTIONS\b[^}]*\}\s*from\s*['"]\.\/actions(\.js)?['"]/.test(code)) wrong.push('ActionPage.jsx imports COMING_SOON_ACTIONS from ./actions');
  if (!/COMING_SOON_ACTIONS\.includes\(\s*action\.key\s*\)/.test(code)) wrong.push('it asks COMING_SOON_ACTIONS.includes(action.key)');
  if (!/ASSISTANT_COPY\.comingSoonPage\b/.test(code)) wrong.push('it shows ASSISTANT_COPY.comingSoonPage');
  if (!/ASSISTANT_COPY\.placeholder\b/.test(code)) wrong.push('it still shows ASSISTANT_COPY.placeholder for the other actions');
  const bold = code.match(/<p>\s*<strong>\s*\{([^}]*)\}\s*<\/strong>\s*<\/p>/);
  if (!bold) wrong.push('the line is still the bold first paragraph, <p><strong>{…}</strong></p>');
  else if (!/comingSoonPage|placeholder|line|words|lead/.test(bold[1])) wrong.push(`the bold line reads the chosen words, got ${show(bold[1].trim())}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('D4 (sentinel): the muted pill needs no new CSS — .bs-setup-step-badge.is-neutral is already in styles.css, and it is not green (AC-1)', () => {
  const css = safeRead(STYLES);
  const rule = css.match(/\.bs-setup-step-badge\.is-neutral\s*\{([^}]*)\}/);
  assert(rule, 'styles.css has .bs-setup-step-badge.is-neutral');
  const color = (rule[1].match(/(?:^|;)\s*color:\s*([^;]+)/) || [])[1] || '';
  assert(color && !/3fb950|green/i.test(color), `the muted pill is not green, got ${show(color.trim())}`);
});

test('D5 (sentinel): nothing else needs to change — the top-bar pill reads alertCount from the one answer, and the server\'s answer names none of the five (AC-2, AC-4)', () => {
  const alert = codeOnly(safeRead(TOP_BAR_ALERT));
  const wrong = [];
  if (!/\{\s*alertCount\s*\}\s*=\s*assistantAttention\(\s*user\s*,\s*attention\s*\)/.test(alert)) wrong.push('TopBarAlert.jsx takes alertCount from assistantAttention(user, attention)');
  const server = codeOnly(safeRead(ATTENTION_MODULE));
  if (!server) wrong.push(`${rel(ATTENTION_MODULE)} is the server's answer`);
  for (const k of CS.KEYS) if (new RegExp(`['"\`]${k}['"\`]`).test(server)) wrong.push(`the server's answer names ${k}`);
  assert(wrong.length === 0, wrong.join('; '));
});

async function run() {
  console.log(`${NL}=== assistant-coming-soon (assistant-coming-soon #1) ===`);
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}assistant-coming-soon: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
