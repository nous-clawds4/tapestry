'use strict';
/**
 * assistant-identification-tags #2: the Identification Tags page, and your two taggings of your Assistant.
 *
 * Story: engineering-team/stories/assistant-identification-tags/2-the-page-and-your-two-taggings.md
 * ADR:   engineering-team/decisions/assistant-identification-tags/0002-the-page-reads-the-one-answer-and-publishes-through-the-tagging-publisher.md
 * Plan:  engineering-team/stories/assistant-identification-tags/2-the-page-and-your-two-taggings.test-plan.md
 * Browser half: tests/brainstorm/assistant-identification-tags-page.spec.js (B-class — what a viewer SEES and what a press
 * does). Expected words and shapes: test/helpers/identificationTagsFixtures.js.
 *
 * Classes:
 *   C — the pure ESM modules, loaded in Node: ui/src/pages/assistant/identificationTags.js (the words, rowState,
 *       cardState) and ui/src/utils/taggingPublishReport.js (describeTaggingPublish, publishTone, relayLine).  [AC-2, AC-3, AC-4]
 *   S — source sentinels on the files the runner cannot execute: the page (JSX), the route map in App.jsx, the publisher's
 *       report-returning variant, the styles block.                                                        [AC-1, AC-4 … AC-7]
 *   R — regressions that pass before and after: the publisher's callers and exports; actions.js untouched.
 *
 * Everything except R FAILS against the current code: the two pure modules and the page do not exist, App.jsx routes every
 * action to the placeholder, and the publisher has no report-returning variant.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const X = require('./helpers/identificationTagsFixtures');
const H = require('./helpers/assistantManagementFixtures');

const REPO = path.resolve(__dirname, '..');
const COPY_MOD = path.join(REPO, 'ui/src/pages/assistant/identificationTags.js');
const REPORT_MOD = path.join(REPO, 'ui/src/utils/taggingPublishReport.js');
const PAGE = path.join(REPO, 'ui/src/pages/assistant/IdentificationTags.jsx');
const APP = path.join(REPO, 'ui/src/App.jsx');
const PUBLISHER = path.join(REPO, 'ui/src/utils/publishProfileTag.js');
const ACTIONS_MOD = path.join(REPO, 'ui/src/pages/assistant/actions.js');
const STYLES = path.join(REPO, 'ui/src/styles.css');
const NL = String.fromCharCode(10);

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {});
  return v;
}
const sameJson = (a, b) => show(sortKeys(a)) === show(sortKeys(b));
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .split(NL)
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}
async function loadEsm(absPath) {
  try { return await import(pathToFileURL(absPath).href); } catch (err) { return { __loadError: err }; }
}
async function esm(absPath, what) {
  assert(fs.existsSync(absPath), `${rel(absPath)} does not exist. ${what}`);
  const mod = await loadEsm(absPath);
  assert(!mod.__loadError, `${rel(absPath)} must load in Node as ESM (relative imports with .js): ${mod.__loadError && mod.__loadError.message}`);
  return mod;
}
const copyModule = () => esm(COPY_MOD, 'ADR 0002 sub-decision 2 creates it: IDENTIFICATION_TAGS_COPY, rowState, cardState — pure, no imports.');
const reportModule = () => esm(REPORT_MOD, 'ADR 0002 sub-decision 4 creates it: describeTaggingPublish, publishTone, relayLine — pure, no imports.');

const ENTRY = X.REQUIRED[1]; // My Agent
const rowOf = (answer, key) => answer.actions[X.CHECKED_ACTION].taggings.find((r) => r.key === key);

/* ───────────────────────── C — the words and the rules ───────────────────────── */

test('C1: the page\'s words are the approved ones, and the two pure modules import nothing (ADR 0002 sub-decisions 2 and 4)', async () => {
  const mod = await copyModule();
  const c = mod.IDENTIFICATION_TAGS_COPY;
  assert(c, 'IDENTIFICATION_TAGS_COPY is exported');
  const wrong = [];
  const want = X.PAGE_COPY;
  for (const k of ['treasureMap', 'definitionUnknown', 'publishing', 'signedOutLine', 'noExtension', 'doneBadge', 'doneSrPrefix']) {
    if (c[k] !== want[k]) wrong.push(`${k}: want ${show(want[k])}, got ${show(c[k])}`);
  }
  if (!sameJson(c.cards, want.cards)) wrong.push(`cards: want ${show(want.cards)}, got ${show(c.cards)}`);
  if (!sameJson(c.states, want.states)) wrong.push(`states: want ${show(want.states)}, got ${show(c.states)}`);
  if (!sameJson(c.buttons, want.buttons)) wrong.push(`buttons: want ${show(want.buttons)}, got ${show(c.buttons)}`);
  if (!sameJson(c.couldNotCheck, want.couldNotCheck)) wrong.push(`couldNotCheck: want ${show(want.couldNotCheck)}, got ${show(c.couldNotCheck)}`);
  if (typeof c.tagNotFound !== 'function' || c.tagNotFound('My Human') !== want.tagNotFound('My Human')) wrong.push(`tagNotFound("My Human"): got ${show(c.tagNotFound && c.tagNotFound('My Human'))}`);
  if (typeof c.signatureRefused !== 'function' || c.signatureRefused('My Agent', 'declined') !== want.signatureRefused('My Agent', 'declined')) wrong.push('signatureRefused(name, reason)');
  for (const [file, label] of [[COPY_MOD, 'the copy module'], [REPORT_MOD, 'the report util']]) {
    const src = codeOnly(safeRead(file));
    if (/^\s*import\b/m.test(src) || /\brequire\s*\(/.test(src)) wrong.push(`${label} must import nothing`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('C2: rowState — the phases before an answer: idle is unknown, checking is checking, failed is could-not-check with request-failed (AC-2)', async () => {
  const { rowState } = await copyModule();
  const cases = [['idle', { state: 'unknown', reason: null, definitionKnown: false }], ['checking', { state: 'checking', reason: null, definitionKnown: false }], ['failed', { state: 'could-not-check', reason: 'request-failed', definitionKnown: false }]];
  const wrong = [];
  for (const [phase, want] of cases) {
    const got = rowState(ENTRY, null, phase);
    if (!sameJson(got, want)) wrong.push(`${phase}: want ${show(want)}, got ${show(got)}`);
  }
  const noRow = rowState(ENTRY, null, 'answered');
  if (!(noRow.state === 'could-not-check' && noRow.reason === 'request-failed')) wrong.push(`answered without a row for the entry: want could-not-check/request-failed, got ${show(noRow)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('C3: rowState — with an answer: present, missing, tag-not-found (whatever the check found), could-not-check with the tagging\'s reason, and definitionKnown only from a found definition (AC-2, AC-3)', async () => {
  const { rowState } = await copyModule();
  const wrong = [];
  const check = (label, row, want) => { const got = rowState(ENTRY, row, 'answered'); if (!sameJson(got, want)) wrong.push(`${label}: want ${show(want)}, got ${show(got)}`); };
  check('present', rowOf(X.DONE, 'my-agent'), { state: 'present', reason: null, definitionKnown: true });
  check('missing', rowOf(X.MISSING_ALL, 'my-agent'), { state: 'missing', reason: null, definitionKnown: true });
  check('tag not found', rowOf(X.TAG_NOT_FOUND, 'my-agent'), { state: 'tag-not-found', reason: null, definitionKnown: false });
  check('tag not found even when the tagging is present', { ...rowOf(X.TAG_NOT_FOUND, 'my-agent'), present: true }, { state: 'tag-not-found', reason: null, definitionKnown: false });
  check('unfinished', rowOf(X.UNFINISHED, 'my-agent'), { state: 'could-not-check', reason: 'no-outside-relays', definitionKnown: false });
  check('unfinished, local unreadable', { ...rowOf(X.UNFINISHED, 'my-agent'), reason: 'local-unreadable' }, { state: 'could-not-check', reason: 'local-unreadable', definitionKnown: false });
  check('missing with an unfinished definition', { ...rowOf(X.MISSING_ALL, 'my-agent'), definition: { finished: false, found: null, source: null, reason: 'outside-unreachable', eventId: null, address: 'x' } }, { state: 'missing', reason: null, definitionKnown: false });
  assert(wrong.length === 0, wrong.join('; '));
});

test('C4: cardState — done when every row is present; unknown when every row is unknown; marked otherwise, checking and could-not-check included (AC-2)', async () => {
  const { cardState } = await copyModule();
  const cases = [
    [['present', 'present'], 'done'], [['unknown', 'unknown'], 'unknown'], [['present', 'missing'], 'marked'],
    [['missing', 'missing'], 'marked'], [['present', 'tag-not-found'], 'marked'], [['checking', 'checking'], 'marked'],
    [['present', 'could-not-check'], 'marked'], [['could-not-check', 'could-not-check'], 'marked'],
  ];
  const wrong = [];
  for (const [states, want] of cases) {
    const got = cardState(states.map((state) => ({ state })));
    if (got !== want) wrong.push(`${show(states)}: want ${want}, got ${show(got)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

const RELAYS = ['wss://a.example', 'wss://b.example', 'wss://c.example'];
const details = (map) => ({ successes: Object.keys(map).filter((r) => map[r].status === 'accepted'), failures: Object.keys(map).filter((r) => map[r].status !== 'accepted'), details: map });

test('C5: describeTaggingPublish — the rows follow the relay order and the chokepoint\'s per-relay answers; a relay with no answer is unreachable; local-only mode skips every relay (AC-4)', async () => {
  const { describeTaggingPublish } = await reportModule();
  const external = details({ [RELAYS[0]]: { status: 'accepted', reason: '' }, [RELAYS[1]]: { status: 'refused', reason: 'blocked' } });
  const r = describeTaggingPublish({ name: 'My Agent', local: { success: true }, external, relays: RELAYS });
  assert(sameJson(r.rows, [
    { relay: RELAYS[0], status: 'accepted', reason: '' }, { relay: RELAYS[1], status: 'refused', reason: 'blocked' },
    { relay: RELAYS[2], status: 'unreachable', reason: 'no publish result' },
  ]), `rows: got ${show(r.rows)}`);
  const kept = describeTaggingPublish({ name: 'My Agent', local: { success: true }, external: { successes: [], failures: [], skippedByGate: true }, relays: RELAYS });
  assert(kept.rows.length === 3 && kept.rows.every((row) => row.status === 'skipped' && row.reason === 'local-only publish mode'), `local-only: every relay skipped; got ${show(kept.rows)}`);
});

test('C6: describeTaggingPublish — outcome, ok and the summary in the story\'s words, including a failed local write with the browser\'s parallel sends (ADR 0002 sub-decision 5)', async () => {
  const { describeTaggingPublish } = await reportModule();
  const W = X.PUBLISH_WORDS;
  const acc = (r) => ({ status: 'accepted', reason: '' });
  const ref = () => ({ status: 'refused', reason: 'no' });
  const cases = [
    ['all accepted', { success: true }, details({ [RELAYS[0]]: acc(), [RELAYS[1]]: acc(), [RELAYS[2]]: acc() }), { ok: true, outcome: 'published', message: W.published('My Agent', 3, 3) }],
    ['partly', { success: true }, details({ [RELAYS[0]]: acc(), [RELAYS[1]]: ref(), [RELAYS[2]]: ref() }), { ok: true, outcome: 'published', message: W.published('My Agent', 1, 3) + W.partly(3, 1) }],
    ['none', { success: true }, details({ [RELAYS[0]]: ref(), [RELAYS[1]]: ref(), [RELAYS[2]]: ref() }), { ok: true, outcome: 'not-delivered', message: W.none('My Agent', 3) }],
    ['kept local', { success: true }, { successes: [], failures: [], skippedByGate: true }, { ok: true, outcome: 'kept-local', message: W.keptLocal('My Agent') }],
    ['no relays given', { success: true }, { successes: [], failures: [], details: {} }, { ok: true, outcome: 'kept-local', message: W.noRelays('My Agent') }],
    ['local failed, some accepted', { success: false, error: 'strfry import failed' }, details({ [RELAYS[0]]: acc(), [RELAYS[1]]: ref(), [RELAYS[2]]: ref() }), { ok: true, outcome: 'published', message: W.localFailedSome('My Agent', 'strfry import failed', 1, 3) }],
    ['local failed, none', { success: false, error: 'strfry import failed' }, details({ [RELAYS[0]]: ref(), [RELAYS[1]]: ref(), [RELAYS[2]]: ref() }), { ok: false, outcome: 'not-delivered', message: W.localFailedNone('My Agent', 'strfry import failed', 3) }],
    ['local failed, kept local', { success: false, error: 'strfry import failed' }, { successes: [], failures: [], skippedByGate: true }, { ok: false, outcome: 'kept-local', message: W.localFailedKept('My Agent', 'strfry import failed') }],
    ['local failed without a reason', { success: false }, { successes: [], failures: [], skippedByGate: true }, { ok: false, outcome: 'kept-local', message: W.localFailedKept('My Agent', "no answer from this instance's relay") }],
  ];
  const wrong = [];
  for (const [label, local, external, want] of cases) {
    const relays = label === 'no relays given' ? [] : RELAYS;
    const got = describeTaggingPublish({ name: 'My Agent', local, external, relays });
    const shaped = got && { ok: got.ok, outcome: got.outcome, message: got.message };
    if (!sameJson(shaped, want)) wrong.push(`${label}: want ${show(want)}, got ${show(shaped)}`);
  }
  assert(wrong.length === 0, wrong.join(NL));
});

test('C7: publishTone never shows a partial or empty result as a clean success, and relayLine uses the editor\'s words (AC-4)', async () => {
  const { describeTaggingPublish, publishTone, relayLine } = await reportModule();
  const W = X.PUBLISH_WORDS;
  const acc = () => ({ status: 'accepted', reason: '' });
  const tone = (local, external) => publishTone(describeTaggingPublish({ name: 'n', local, external, relays: RELAYS }));
  const wrong = [];
  if (tone({ success: true }, details({ [RELAYS[0]]: acc(), [RELAYS[1]]: acc(), [RELAYS[2]]: acc() })) !== 'success') wrong.push('all accepted → success');
  if (tone({ success: true }, details({ [RELAYS[0]]: acc(), [RELAYS[1]]: { status: 'refused', reason: 'x' }, [RELAYS[2]]: acc() })) !== 'warning') wrong.push('partial → warning');
  if (tone({ success: true }, details({ [RELAYS[0]]: { status: 'refused', reason: 'x' }, [RELAYS[1]]: { status: 'unreachable', reason: 'y' }, [RELAYS[2]]: { status: 'timeout', reason: '' } })) !== 'warning') wrong.push('none accepted, local ok → warning');
  if (tone({ success: true }, { successes: [], failures: [], skippedByGate: true }) !== 'info') wrong.push('kept local → info');
  if (tone({ success: false, error: 'e' }, { successes: [], failures: [], skippedByGate: true }) !== 'error') wrong.push('not ok → error');
  const lines = [
    [{ status: 'accepted', reason: '' }, W.relay.accepted], [{ status: 'refused', reason: 'blocked' }, W.relay.refused('blocked')], [{ status: 'refused', reason: '' }, W.relay.refused('')],
    [{ status: 'unreachable', reason: 'ENOTFOUND' }, W.relay.unreachable('ENOTFOUND')], [{ status: 'timeout', reason: '' }, W.relay.timeout('')], [{ status: 'timeout', reason: 'slow' }, W.relay.timeout('slow')],
    [{ status: 'skipped', reason: 'local-only publish mode' }, W.relay.skipped],
  ];
  for (const [row, want] of lines) { const got = relayLine(row); if (got !== want) wrong.push(`relayLine(${show(row)}): want ${show(want)}, got ${show(got)}`); }
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── S — the page, the route, the publisher, by source ───────────────────────── */

test('S1: the page exists and reads only the shared answers — useAuth, useConfig, useAssistantAttention — never fetches, and takes the list and the canonical author from the library (AC-1, AC-7; ADR 0002 sub-decision 1)', () => {
  const src = codeOnly(safeRead(PAGE));
  assert(src, `${rel(PAGE)} does not exist — ADR 0002 § Implementation notes 4 creates it`);
  const wrong = [];
  for (const [re, what] of [
    [/export\s+default\s+function\s+IdentificationTagsPage\s*\(/, 'export default function IdentificationTagsPage()'],
    [/\buseAuth\s*\(/, 'useAuth()'], [/\buseConfig\s*\(/, 'useConfig() (the runtime TA for the local z)'], [/\buseAssistantAttention\s*\(/, 'useAssistantAttention() — the one answer'],
    [/from\s*['"]@tapestry\/identification-tags['"]/, "the library through the '@tapestry/identification-tags' alias"],
    [/\bREQUIRED_TAGGINGS\b/, 'REQUIRED_TAGGINGS'], [/\bCANONICAL_TAG_AUTHOR\b/, 'CANONICAL_TAG_AUTHOR'],
    [/\browState\s*\(/, 'rowState(…)'], [/\bcardState\s*\(/, 'cardState(…)'], [/\bIDENTIFICATION_TAGS_COPY\b/, 'IDENTIFICATION_TAGS_COPY'],
    [/\bASSISTANT_ACTIONS\b/, "the action's own entry (heading and description come from actions.js, not a second copy)"],
    [/aria-live=["']polite["']/, 'an aria-live="polite" results region'], [/type=["']checkbox["']/, 'a checkbox per row'],
  ]) if (!re.test(src)) wrong.push(`no ${what}`);
  for (const [re, what] of [[/\bfetch\s*\(/, 'fetch('], [/['"`]\/api\//, 'an /api/ path'], [/localStorage|sessionStorage/, 'browser storage']]) {
    if (re.test(src)) wrong.push(`uses ${what} — the page reads the shared answer and stores nothing`);
  }
  assert(wrong.length === 0, `ADR 0002: ${wrong.join('; ')}`);
});

test('S2: the first card publishes through the publisher\'s report-returning variant — the canonical tag, the viewer\'s own Assistant as the target, an apply — describes each result with the report util, and refreshes the answer (AC-4; ADR 0002 sub-decision 6)', () => {
  const src = codeOnly(safeRead(PAGE));
  assert(src, `${rel(PAGE)} does not exist`);
  const wrong = [];
  for (const [re, what] of [
    [/\bpublishProfileTagAssertionWithReport\s*\(/, 'publishProfileTagAssertionWithReport(…)'],
    [/authorPubkey:\s*CANONICAL_TAG_AUTHOR/, 'authorPubkey: CANONICAL_TAG_AUTHOR (the canonical tag)'],
    [/targetPubkey:\s*user\.assistantPubkey/, "targetPubkey: user.assistantPubkey (the viewer's own Assistant)"],
    [/polarity:\s*1\b/, 'polarity: 1 (an apply)'], [/localTaPubkey:\s*taPubkey/, 'localTaPubkey: taPubkey (the runtime local z)'],
    [/\bdescribeTaggingPublish\s*\(/, 'describeTaggingPublish(…)'], [/\bPUBLISH_RELAYS\b/, 'PUBLISH_RELAYS handed to the report (the relays every tagging goes to)'],
    [/\brefresh\s*\(\s*\)/, 'refresh() after the press'], [/window\.nostr/, 'a window.nostr pre-flight (the no-extension line)'],
  ]) if (!re.test(src)) wrong.push(`no ${what}`);
  if (/publishOrThrow\s*\(/.test(src) || /publishProfileTagAssertion\s*\(/.test(src.replace(/publishProfileTagAssertionWithReport/g, ''))) wrong.push('the page must use the report-returning variant, not the throwing publisher');
  if (/kind:\s*39999/.test(src) || /['"]profile-tag-/.test(src)) wrong.push('the page must not build a tagging itself (one home for the wire shape)');
  assert(wrong.length === 0, `ADR 0002 sub-decision 6: ${wrong.join('; ')}`);
});

test('S3: App.jsx routes this one action to the page through an override map, and the other nine to the placeholder (AC-6; ADR 0002 sub-decision 1)', () => {
  const app = codeOnly(safeRead(APP));
  const wrong = [];
  if (!/import\s+IdentificationTagsPage\s+from\s+['"]\.\/pages\/assistant\/IdentificationTags(?:\.jsx?)?['"]/.test(app)) wrong.push('no default import from ./pages/assistant/IdentificationTags');
  if (!/const\s+ACTION_PAGES\s*=\s*\{[^}]*['"]identification-tags['"]\s*:\s*<IdentificationTagsPage\b/.test(app)) wrong.push("no ACTION_PAGES map with 'identification-tags': <IdentificationTagsPage />");
  if (!/ASSISTANT_ACTIONS\.map\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*\(\s*\{\s*path:\s*\1\.path\s*,\s*element:\s*ACTION_PAGES\[\s*\1\.key\s*\]\s*\?\?\s*<AssistantActionPage\b[^>]*\baction=\{\s*\1\s*\}/.test(app)) {
    wrong.push('the routes are not ...ASSISTANT_ACTIONS.map((a) => ({ path: a.path, element: ACTION_PAGES[a.key] ?? <AssistantActionPage action={a} /> }))');
  }
  const keys = (app.match(/const\s+ACTION_PAGES\s*=\s*\{([^}]*)\}/) || ['', ''])[1].match(/['"]([a-z-]+)['"]\s*:/g) || [];
  if (keys.length !== 1) wrong.push(`ACTION_PAGES names exactly one action in this story; got ${show(keys)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('S4: the publisher gains publishProfileTagAssertionWithReport and assertPublished; the old function is a wrapper with its contract; publishOrThrow stays (ADR 0002 sub-decision 3)', () => {
  const src = codeOnly(safeRead(PUBLISHER));
  const wrong = [];
  for (const [re, what] of [
    [/export\s+async\s+function\s+publishProfileTagAssertionWithReport\s*\(/, 'export async function publishProfileTagAssertionWithReport('],
    [/export\s+function\s+assertPublished\s*\(/, 'export function assertPublished('],
    [/export\s+async\s+function\s+publishOrThrow\s*\(/, 'export async function publishOrThrow( (nine callers)'],
    [/export\s+async\s+function\s+publishProfileTagAssertion\s*\(/, 'export async function publishProfileTagAssertion('],
  ]) if (!re.test(src)) wrong.push(`no ${what}`);
  const start = src.search(/export\s+async\s+function\s+publishProfileTagAssertion\s*\(/);
  const body = start >= 0 ? src.slice(start, src.indexOf('\n}', start) + 2) : '';
  if (!/publishProfileTagAssertionWithReport\s*\(/.test(body)) wrong.push('publishProfileTagAssertion must call the variant');
  if (!/assertPublished\s*\(/.test(body)) wrong.push('publishProfileTagAssertion must keep the throw rule (assertPublished)');
  if (!/return\s+signed\s*;/.test(body)) wrong.push('publishProfileTagAssertion must still return the signed event');
  const vstart = src.search(/export\s+async\s+function\s+publishProfileTagAssertionWithReport\s*\(/);
  const vbody = vstart >= 0 ? src.slice(vstart, src.indexOf('\n}', vstart) + 2) : '';
  if (!/publishEverywhere\s*\(/.test(vbody)) wrong.push('the variant publishes through publishEverywhere');
  if (/publishOrThrow\s*\(|assertPublished\s*\(/.test(vbody)) wrong.push('the variant never throws on delivery');
  if (!/return\s*\{\s*signed\s*,\s*result\s*\}/.test(vbody)) wrong.push('the variant returns { signed, result }');
  assert(wrong.length === 0, wrong.join('; '));
});

test('S5: the styles block exists with the card, its marked and done looks, the rows, and a phone-width rule (AC-6; ADR 0002 sub-decision 7)', () => {
  const css = safeRead(STYLES);
  const wrong = [];
  for (const cls of ['.bs-idtags-card', '.bs-idtags-card.is-marked', '.bs-idtags-card.is-done', '.bs-idtags-rows', '.bs-idtags-results']) {
    if (!css.includes(cls)) wrong.push(`no ${cls}`);
  }
  const phone = [...css.matchAll(/@media \(max-width: 480px\) \{([\s\S]*?)\n\}/g)].some((m) => m[1].includes('bs-idtags'));
  if (!phone) wrong.push('no @media (max-width: 480px) rule for .bs-idtags-*');
  assert(wrong.length === 0, wrong.join('; '));
});

test('S6: the second card renders no publish button in this story, and the first card\'s button is disabled while nothing is checked or a publish runs (AC-3, AC-5)', () => {
  const src = codeOnly(safeRead(PAGE));
  assert(src, `${rel(PAGE)} does not exist`);
  const wrong = [];
  if (!/onPublish\s*&&/.test(src) && !/onPublish\s*\?/.test(src)) wrong.push('the card renders its button only when given onPublish (the second card gets none until story 3)');
  if (!/disabled=\{[^}]*(publishing|checkedCount|checked\.size|nothingChecked)[^}]*\}/.test(src)) wrong.push('the button is disabled while publishing or while nothing is checked');
  if (!/\bdefaultChecked\b|checked=\{/.test(src)) wrong.push('the checkbox reflects the checked state');
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── R — regressions that pass before and after ───────────────────────── */

test('R1: the publisher\'s callers keep their contract: publishProfileTagAssertion is still imported by useProfileTags and Tag.jsx, and publishOrThrow by its other callers', () => {
  const src = safeRead(path.join(REPO, 'ui/src/hooks/useProfileTags.js'));
  assert(/import\s*\{[^}]*\bpublishProfileTagAssertion\b[^}]*\}\s*from\s*['"]\.\.\/utils\/publishProfileTag['"]/.test(src), 'useProfileTags imports publishProfileTagAssertion');
  const tag = safeRead(path.join(REPO, 'ui/src/pages/Tag.jsx'));
  assert(/\bpublishProfileTagAssertion\s*\(/.test(tag), 'Tag.jsx calls publishProfileTagAssertion');
  const pin = safeRead(path.join(REPO, 'ui/src/utils/publishTagPin.js'));
  assert(/\bpublishOrThrow\b/.test(pin), 'publishTagPin imports publishOrThrow');
});

test('R2: actions.js is unchanged by this story — the identification-tags entry still carries the owner\'s description, and there are still ten actions', async () => {
  const mod = await esm(ACTIONS_MOD, 'It holds the ten actions.');
  const entry = mod.ASSISTANT_ACTIONS.find((a) => a.key === X.CHECKED_ACTION);
  assert(entry && entry.path === X.PAGE, `the action's path is ${X.PAGE}`);
  const hubEntry = H.ACTIONS.find((a) => a.path === X.PAGE);
  assert(mod.plainText(entry.description) === hubEntry.text, 'the description is the owner\'s');
  assert(mod.ASSISTANT_ACTIONS.length === 10, 'ten actions');
});

async function run() {
  console.log(`${NL}=== assistant-identification-tags-page (assistant-identification-tags #2) ===`);
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
  console.log(`${NL}assistant-identification-tags-page: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

module.exports = { run };
