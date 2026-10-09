'use strict';
/**
 * assistant-profile-checklist #2: the checklist page at /assistant/profile, and its one-click fixes.
 *
 * Story: engineering-team/stories/assistant-profile-checklist/2-the-checklist-page-and-its-one-click-fixes.md
 * ADR:   engineering-team/decisions/assistant-profile-checklist/0002-the-checklist-page-fixes-through-the-one-writer.md
 * Plan:  engineering-team/stories/assistant-profile-checklist/2-the-checklist-page-and-its-one-click-fixes.test-plan.md
 * Browser half: tests/brainstorm/assistant-profile-checklist-page.spec.js (what a viewer sees and what a press sends).
 * Expected words and shapes: test/helpers/profileChecklistFixtures.js.
 *
 * Classes:
 *   P — the pure module ui/src/pages/assistant/profileChecklistCopy.js, loaded in Node as ESM: the approved words,
 *       panelState, panelLine, fixFor, applyProfileFix, summaryText, describeProfilePublish.            [AC-3 … AC-5]
 *   D — source sentinels on the files this runner cannot execute (JSX): the page, its route, what it fetches and
 *       posts, the one-at-a-time rule, the re-check.                                                  [AC-1, AC-2, AC-4 … AC-6]
 *
 * Every test FAILS against the current code: neither file exists, and /assistant/profile routes to the placeholder.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const X = require('./helpers/profileChecklistFixtures');

const REPO = path.resolve(__dirname, '..');
const COPY_MOD = path.join(REPO, 'ui/src/pages/assistant/profileChecklistCopy.js');
const PAGE_FILE = path.join(REPO, 'ui/src/pages/assistant/ProfileChecklist.jsx');
const APP = path.join(REPO, 'ui/src/App.jsx');
const PAGES_DIR = path.join(REPO, 'ui/src/pages/assistant');
const NL = String.fromCharCode(10);
const PUBLIC = X.PUBLIC_INSTANCE;
const INSTANCE = X.instanceBlock(PUBLIC);

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
/** Every string anywhere inside a value (objects, arrays, and the source of functions). */
function strings(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (typeof v === 'function') out.push(String(v));
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}

async function copyModule() {
  assert(fs.existsSync(COPY_MOD), `${rel(COPY_MOD)} does not exist. ADR 0002 sub-decision 1 creates it: the page's words and rules, pure, loadable in Node (PROFILE_CHECKLIST_COPY, panelState, panelLine, fixFor, applyProfileFix, summaryText, describeProfilePublish).`);
  let mod;
  try { mod = await import(pathToFileURL(COPY_MOD).href); } catch (err) {
    throw new Error(`${rel(COPY_MOD)} must load in Node as ESM (no imports, or relative .js ones): ${err.message}`);
  }
  return mod;
}
function fn(mod, name) {
  assert(typeof mod[name] === 'function', `profileChecklistCopy.js must export ${name}() (ADR 0002 § Implementation notes)`);
  return mod[name];
}
const item = (key) => X.ITEMS.find((i) => i.key === key);
const rowOf = (action, key) => (action.items || []).find((r) => r.key === key);
const fill = (key, rowOrNull, instance = INSTANCE) => {
  const r = rowOrNull || {};
  return { domain: instance.domain, url: instance.website, address: r.address, value: r.value, n: r.relaysHolding, m: r.relaysTotal };
};

/* ───────────────────────── P — the pure module ───────────────────────── */

test('P1: the module loads in Node with no imports (or only relative .js ones), and is named apart from the page by more than letter case (ADR 0002 sub-decision 1)', async () => {
  await copyModule();
  const imports = [...codeOnly(safeRead(COPY_MOD)).matchAll(/^\s*import\b[^;]*?from\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  assert(imports.every((s) => s.startsWith('.') && s.endsWith('.js')), `only relative .js imports; got ${show(imports)}`);
  const names = fs.readdirSync(PAGES_DIR).map((f) => f.replace(/\.(jsx?|mjs)$/, '').toLowerCase());
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  assert(dup.length === 0, `two files in ui/src/pages/assistant differ only by letter case or extension: ${show(dup)} (the dev container's mount is case-insensitive)`);
});

test('P2: every approved word of the page is in PROFILE_CHECKLIST_COPY — the summary lines, the no-profile notice and its fix, the sign-in line, the no-public-address line, Checking…, Publishing…, Coming soon (story 2 § Copy)', async () => {
  const mod = await copyModule();
  assert(mod.PROFILE_CHECKLIST_COPY && typeof mod.PROFILE_CHECKLIST_COPY === 'object', 'PROFILE_CHECKLIST_COPY must be exported');
  const all = strings(mod.PROFILE_CHECKLIST_COPY).join(NL);
  const C = X.PAGE_COPY;
  const want = [C.summaryDone, C.noProfileNotice, C.noProfileFix, C.signedOut, C.noPublicAddress, C.checking, C.publishing, C.comingSoon, 'items need attention', '1 item needs attention'];
  const missing = want.filter((w) => !all.includes(w));
  assert(missing.length === 0, `missing approved words: ${show(missing)}`);
});

test('P3: every panel\'s title and description are the approved words, under PROFILE_CHECKLIST_COPY.panels[key] (story 2 § Copy, Panels; ADR 0002 sub-decision 3)', async () => {
  const mod = await copyModule();
  const panels = (mod.PROFILE_CHECKLIST_COPY || {}).panels || {};
  const wrong = [];
  for (const { key } of X.ITEMS) {
    const p = panels[key] || {};
    const want = X.PANELS[key];
    if (p.title !== want.title) wrong.push(`${key} title: want ${show(want.title)}, got ${show(p.title)}`);
    const desc = typeof want.description === 'function' ? want.description({ domain: '{domain}' }) : want.description;
    if (p.description !== desc) wrong.push(`${key} description: want ${show(desc)}, got ${show(p.description)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('P4: panelState(item, row, phase, action) — the banner is always coming-soon; idle is unknown; checking is checking; a failed fetch, no profile action, a check that failed, no row, or an unfinished row is could-not-check; a finished row is done or needs-attention (ADR 0002 sub-decision 2)', async () => {
  const state = fn(await copyModule(), 'panelState');
  const A = X.PROFILE_PENDING;
  const cases = [
    ['banner, answered', 'banner', rowOf(A, 'banner'), 'answered', A, 'coming-soon'],
    ['banner, idle', 'banner', null, 'idle', null, 'coming-soon'],
    ['idle', 'nip05', null, 'idle', null, 'unknown'],
    ['checking', 'nip05', null, 'checking', null, 'checking'],
    ['failed', 'nip05', null, 'failed', null, 'could-not-check'],
    ['answered, no profile action', 'nip05', null, 'answered', undefined, 'could-not-check'],
    ['check-failed', 'nip05', null, 'answered', X.PROFILE_CHECK_FAILED, 'could-not-check'],
    ['no row', 'nip05', undefined, 'answered', { ...A, items: [] }, 'could-not-check'],
    ['unfinished row', 'visible', rowOf(X.PROFILE_UNFINISHED, 'visible'), 'answered', X.PROFILE_UNFINISHED, 'could-not-check'],
    ['done', 'nip05', rowOf(A, 'nip05'), 'answered', A, 'done'],
    ['needs attention', 'website', rowOf(A, 'website'), 'answered', A, 'needs-attention'],
    ['no profile', 'website', rowOf(X.PROFILE_NONE, 'website'), 'answered', X.PROFILE_NONE, 'needs-attention'],
  ];
  const wrong = [];
  for (const [label, key, row, phase, action, want] of cases) {
    const got = state(item(key), row, phase, action);
    if (got !== want) wrong.push(`${label}: want ${want}, got ${show(got)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('P5: panelLine renders each panel\'s done line and each reason\'s line in the approved words, filled with this instance and the row (story 2 § Copy; ADR 0002 sub-decision 3)', async () => {
  const line = fn(await copyModule(), 'panelLine');
  const wrong = [];
  const check = (label, key, row, action, want) => {
    const got = line(item(key), row, 'answered', action);
    if (got !== want) wrong.push(`${label}: want ${show(want)}, got ${show(got)}`);
  };
  const D = X.PROFILE_DONE;
  for (const key of X.COUNTED) {
    const r = rowOf(D, key);
    check(`${key} done`, key, r, D, X.PANELS[key].done(fill(key, r)));
  }
  for (const key of X.COUNTED) {
    for (const [reason, render] of Object.entries(X.PANELS[key].lines)) {
      if (reason === 'unreachable') continue; // P6
      const r = { ...rowOf(D, key), done: false, reason, ...(key === 'website' && reason === 'other' ? { value: 'https://alice.example' } : {}) };
      const action = X.profileAction(D.items.map((x) => (x.key === key ? r : x)));
      check(`${key} ${reason}`, key, r, action, render(fill(key, r)));
    }
  }
  check('banner', 'banner', rowOf(D, 'banner'), D, X.PANELS.banner.line);
  assert(wrong.length === 0, wrong.join('; '));
});

test('P6: panelLine for the other states — no public address, could not check (the domain, no relay, the local relay, this instance), Checking…, nothing for no-profile (the notice says it) or for a visitor (story 2 § Copy; ADR 0002 sub-decision 2)', async () => {
  const line = fn(await copyModule(), 'panelLine');
  const C = X.PAGE_COPY;
  const unreachableNip05 = { ...rowOf(X.PROFILE_DONE, 'nip05'), finished: false, done: false, reason: 'unreachable' };
  const unreadable = { key: 'website', counts: true, finished: false, done: false, reason: 'profile-unreadable' };
  const cases = [
    ['no public address', 'nip05', rowOf(X.PROFILE_DEV, 'nip05'), 'answered', X.PROFILE_DEV, C.noPublicAddress],
    ['nip05 could not check', 'nip05', unreachableNip05, 'answered', X.PROFILE_DONE, X.PANELS.nip05.lines.unreachable({ domain: PUBLIC.domain })],
    ['visible could not check', 'visible', rowOf(X.PROFILE_UNFINISHED, 'visible'), 'answered', X.PROFILE_UNFINISHED, X.PANELS.visible.lines.unreachable()],
    ['the profile could not be read', 'website', unreadable, 'answered', X.profileAction([unreadable]), C.profileUnreadable],
    ['the check failed', 'website', undefined, 'answered', X.PROFILE_CHECK_FAILED, C.couldNotCheck],
    ['the fetch failed', 'website', null, 'failed', null, C.couldNotCheck],
    ['checking', 'website', null, 'checking', null, C.checking],
    ['no profile', 'website', rowOf(X.PROFILE_NONE, 'website'), 'answered', X.PROFILE_NONE, ''],
    ['a visitor', 'website', null, 'idle', null, ''],
  ];
  const wrong = [];
  for (const [label, key, row, phase, action, want] of cases) {
    const got = line(item(key), row, phase, action);
    if (got !== want) wrong.push(`${label}: want ${show(want)}, got ${show(got)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('P7: summaryText — "Your Assistant\'s profile is complete." when done; "{n} items need attention" counting the counted panels not done (the banner never); "1 item needs attention"; Checking… while the answer is not in (story 2 AC-3)', async () => {
  const summary = fn(await copyModule(), 'summaryText');
  const C = X.PAGE_COPY;
  const one = X.profileAction(X.allRows({ website: { done: false, reason: 'none', value: null } }));
  const cases = [
    ['done', X.PROFILE_DONE, C.summaryDone], ['two', X.PROFILE_PENDING, C.summaryCount(2)], ['one', one, C.summaryCount(1)],
    ['one unfinished', X.PROFILE_UNFINISHED, C.summaryCount(1)], ['no profile', X.PROFILE_NONE, C.summaryCount(6)],
    ['every fixable', X.PROFILE_ALL_FIXABLE, C.summaryCount(6)], ['not in', null, C.checking],
  ];
  const wrong = cases.filter(([, a, want]) => summary(a) !== want).map(([label, a, want]) => `${label}: want ${show(want)}, got ${show(summary(a))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('P8: fixFor(row, instance) — the approved fix for each panel that needs attention, and none where it cannot work: no public address, no profile (the notice offers it), local-only mode or no relays, could not check, done, the avatar (the editor link until story 3) and the banner (story 2 AC-4; ADR 0002 sub-decision 4)', async () => {
  const fixFor = fn(await copyModule(), 'fixFor');
  const F = X.PROFILE_ALL_FIXABLE;
  const r = (key, over = {}) => ({ ...rowOf(F, key), ...over });
  const P = X.PANELS;
  const offered = [
    ['nip05 not-listed', r('nip05'), 'republish', P.nip05.fix()],
    ['nip05 none', r('nip05', { reason: 'none' }), 'republish', P.nip05.fix()],
    ['nip05 other-domain', r('nip05', { reason: 'other-domain' }), 'republish', P.nip05.fix()],
    ['website none', r('website'), 'set-website', P.website.fix({ url: PUBLIC.website })],
    ['website other', r('website', { reason: 'other', value: 'https://alice.example' }), 'set-website', P.website.fix({ url: PUBLIC.website })],
    ['client-tag none', r('client-tag'), 'republish', P['client-tag'].fix({ domain: PUBLIC.domain })],
    ['visible only-here', r('visible'), 'republish', P.visible.fix()],
    ...Object.entries(P['name-and-about'].fixByReason).map(([reason, label]) => [`name-and-about ${reason}`, r('name-and-about', { reason }), 'fill-name-about', label]),
  ];
  const none = [
    ['nip05 no public address', rowOf(X.PROFILE_DEV, 'nip05'), X.instanceBlock(X.DEV_INSTANCE)],
    ['website no public address', rowOf(X.PROFILE_DEV, 'website'), X.instanceBlock(X.DEV_INSTANCE)],
    ['client-tag no public address', rowOf(X.PROFILE_DEV, 'client-tag'), X.instanceBlock(X.DEV_INSTANCE)],
    ['no profile', rowOf(X.PROFILE_NONE, 'website'), INSTANCE],
    ['visible local-only mode', r('visible', { reason: 'local-only-mode' }), INSTANCE],
    ['visible no relays', r('visible', { reason: 'no-relays' }), INSTANCE],
    ['visible could not check', r('visible', { finished: false, reason: 'unreachable' }), INSTANCE],
    ['nip05 could not check', r('nip05', { finished: false, reason: 'unreachable' }), INSTANCE],
    ['done', rowOf(X.PROFILE_DONE, 'website'), INSTANCE],
    ['the avatar', r('avatar'), INSTANCE],
    ['the banner', rowOf(F, 'banner'), INSTANCE],
  ];
  const wrong = [];
  for (const [label, row, fix, text] of offered) {
    const got = fixFor(row, INSTANCE);
    if (!got || got.fix !== fix || got.label !== text) wrong.push(`${label}: want ${show({ fix, label: text })}, got ${show(got)}`);
  }
  for (const [label, row, inst] of none) {
    const got = fixFor(row, inst);
    if (got !== null) wrong.push(`${label}: want null, got ${show(got)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('P9: applyProfileFix changes only what its fix is about — republish keeps every field as published, set-website sets this instance\'s address, fill-name-about fills only the empty ones from the default, publish-default is the default, set-picture sets the picture — always exactly the seven kind-0 fields (story 2 AC-4; ADR 0002 sub-decision 5)', async () => {
  const apply = fn(await copyModule(), 'applyProfileFix');
  const status = X.statusAnswer();
  const opts = (extra = {}) => ({ status, instance: INSTANCE, fields: X.PROFILE_CONTENT_FIELDS, ...extra });
  const base = { name: 'Alice Bot', display_name: '', about: '', picture: PUBLIC.avatarUrl, banner: 'https://img.example/banner.png', website: '', lud16: 'alice@pay.example' };
  const D = X.DEFAULTS;
  const pick = (o) => X.PROFILE_CONTENT_FIELDS.reduce((acc, k) => { acc[k] = typeof o[k] === 'string' ? o[k] : ''; return acc; }, {});
  const cases = [
    ['republish', apply('republish', opts()), base],
    ['set-website', apply('set-website', opts()), { ...base, website: PUBLIC.website }],
    ['fill-name-about', apply('fill-name-about', opts()), { ...base, display_name: D.display_name, about: D.about }],
    ['publish-default', apply('publish-default', opts()), pick(D)],
    ['set-picture', apply('set-picture', opts({ url: `${PUBLIC.website}/generated/ta-avatar-${'cd'.repeat(16)}.png` })), { ...base, picture: `${PUBLIC.website}/generated/ta-avatar-${'cd'.repeat(16)}.png` }],
    ['no profile at press time: the default is the base', apply('set-website', { ...opts(), status: X.statusAnswer({ hasProfile: false }) }), { ...pick(D), website: PUBLIC.website }],
    ['a non-string field is empty', apply('republish', { ...opts(), status: X.statusAnswer({ profile: { ...X.PUBLISHED, lud16: 7, about: null } }) }), { ...base, lud16: '' }],
    ['a name of spaces counts as empty', apply('fill-name-about', { ...opts(), status: X.statusAnswer({ profile: { ...X.PUBLISHED, name: '   ' } }) }), { ...base, name: D.name, display_name: D.display_name, about: D.about }],
  ];
  const wrong = [];
  for (const [label, got, want] of cases) {
    if (!got || !sameJson(Object.keys(got).sort(), [...X.PROFILE_CONTENT_FIELDS].sort())) wrong.push(`${label}: exactly the seven fields; got keys ${show(got && Object.keys(got))}`);
    else if (!sameJson(got, want)) wrong.push(`${label}: want ${show(want)}, got ${show(got)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('P10: describeProfilePublish turns the one writer\'s answer into { ok, outcome, message, rows } — a publish with its relays; a refused local write is not ok with its error and no rows; no answer is the request-failed line (story 2 AC-5; ADR 0002 sub-decision 6)', async () => {
  const describe = fn(await copyModule(), 'describeProfilePublish');
  const wrong = [];
  const pub = X.publishAnswer({ accepted: 1 });
  const got = describe(pub);
  const want = { ok: true, outcome: pub.outcome, message: pub.message, rows: pub.relays.results.map((r) => ({ relay: r.relay, status: r.status, reason: r.reason || '' })) };
  if (!sameJson(got, want)) wrong.push(`published: want ${show(want)}, got ${show(got)}`);
  const failed = describe(X.PUBLISH_LOCAL_FAILED);
  if (!failed || failed.ok !== false || failed.message !== X.PUBLISH_LOCAL_FAILED.error || !sameJson(failed.rows, [])) wrong.push(`local failure: want not ok with its error and no rows; got ${show(failed)}`);
  const refused = describe({ success: false, code: 'not-your-assistant', error: 'refused words' });
  if (!refused || refused.ok !== false || refused.message !== 'refused words') wrong.push(`a refusal: want not ok with its error; got ${show(refused)}`);
  for (const nothing of [null, undefined, 'x']) {
    const r = describe(nothing);
    if (!r || r.ok !== false || r.message !== X.PAGE_COPY.requestFailed || !sameJson(r.rows, [])) wrong.push(`${show(nothing)}: want the request-failed line; got ${show(r)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── D — the page, by source ───────────────────────── */

test('D1: /assistant/profile routes to the checklist page — ACTION_PAGES has profile: <ProfileChecklistPage />, imported from ./pages/assistant/ProfileChecklist, so the placeholder no longer appears there (story 2 AC-1; ADR 0002 sub-decision 1)', () => {
  const app = codeOnly(safeRead(APP));
  const pages = (app.match(/const\s+ACTION_PAGES\s*=\s*\{([\s\S]*?)\};/) || [])[1] || '';
  assert(/['"]?profile['"]?\s*:\s*<ProfileChecklistPage\s*\/>/.test(pages), `ACTION_PAGES must map profile to <ProfileChecklistPage />; it reads: ${pages.trim().slice(0, 200)}`);
  assert(/import\s+ProfileChecklistPage\s+from\s+['"]\.\/pages\/assistant\/ProfileChecklist['"]/.test(app), 'App.jsx imports ProfileChecklistPage from ./pages/assistant/ProfileChecklist');
});

test('D2: the page reads the one answer and draws the seven panels from the shared list — useAuth, useAssistantAttention, PROFILE_ITEMS from @tapestry/assistant-profile-items, the copy module, the editor link — and fetches nothing to draw them (story 2 AC-1, AC-3)', () => {
  const src = codeOnly(safeRead(PAGE_FILE));
  assert(src, `${rel(PAGE_FILE)} does not exist — ADR 0002 sub-decision 1 creates it`);
  const wrong = [];
  for (const [re, what] of [
    [/export\s+default\s+function\s+ProfileChecklistPage\s*\(/, 'export default function ProfileChecklistPage'],
    [/\buseAuth\s*\(/, 'useAuth()'], [/\buseAssistantAttention\s*\(/, 'useAssistantAttention()'],
    [/import\s*\{[^}]*\bPROFILE_ITEMS\b[^}]*\}\s*from\s*['"]@tapestry\/assistant-profile-items['"]/, 'PROFILE_ITEMS from @tapestry/assistant-profile-items'],
    [/from\s*['"]\.\/profileChecklistCopy(\.js)?['"]/, 'the copy module'],
    [/\bpanelState\s*\(/, 'panelState(…)'], [/\bpanelLine\s*\(/, 'panelLine(…)'], [/\bfixFor\s*\(/, 'fixFor(…)'], [/\bsummaryText\s*\(/, 'summaryText(…)'],
    [/editLink|\/assistant\/profile\/edit|MY_ASSISTANT_PATH/, 'the link to the Edit Assistant Profile page'],
    [/ASSISTANT_COPY\.backToHub|ASSISTANT_MANAGEMENT_PATH/, 'the back link to the hub'],
    [/ASSISTANT_COPY\.noAssistantLine/, 'the hub\'s no-assistant line'], [/ASSISTANT_COPY\.signInButton/, 'the sign-in button'],
  ]) if (!re.test(src)) wrong.push(`no ${what}`);
  if (/\/api\/assistant\/attention/.test(src)) wrong.push('the page must not fetch the attention answer itself (the provider does)');
  if (/localStorage|sessionStorage/.test(src)) wrong.push('the page stores nothing in the browser');
  assert(wrong.length === 0, wrong.join('; '));
});

test('D3: a press reads /api/assistant/status for the viewer, composes with applyProfileFix, posts the one writer with { customerPubkey, content }, reports with relayLine and publishTone, and re-checks with refresh() (story 2 AC-4 … AC-6; ADR 0002 sub-decision 6)', () => {
  const src = codeOnly(safeRead(PAGE_FILE));
  const wrong = [];
  for (const [re, what] of [
    [/\/api\/assistant\/status\?customerPubkey=/, 'GET /api/assistant/status?customerPubkey=…'],
    [/\bapplyProfileFix\s*\(/, 'applyProfileFix(…)'],
    [/fetch\(\s*['"`]\/api\/assistant\/publish-profile['"`]/, "fetch('/api/assistant/publish-profile', …)"],
    [/method:\s*['"]POST['"]/, "method: 'POST'"],
    [/customerPubkey/, 'customerPubkey in the body'],
    [/\bdescribeProfilePublish\s*\(/, 'describeProfilePublish(…)'],
    [/import\s*\{[^}]*\brelayLine\b[^}]*\}\s*from\s*['"][^'"]*taggingPublishReport['"]/, 'relayLine from ui/src/utils/taggingPublishReport'],
    [/\bpublishTone\b/, 'publishTone'], [/\brefresh\s*\(\s*\)/, 'refresh()'],
    [/publish-default/, "the no-profile notice's publish-default fix"],
  ]) if (!re.test(src)) wrong.push(`no ${what}`);
  if (/\/api\/strfry\/publish|finalizeEvent|window\.nostr/.test(src)) wrong.push('fixes go through the one writer only — no other signer');
  assert(wrong.length === 0, wrong.join('; '));
});

test('D4: one fix at a time — a single in-flight state disables every fix button while one is publishing (story 2 AC-5; ADR 0002 sub-decision 6)', () => {
  const src = codeOnly(safeRead(PAGE_FILE));
  const m = src.match(/const\s*\[\s*(\w+)\s*,\s*set\w+\s*\]\s*=\s*useState\(\s*null\s*\)/g) || [];
  const names = m.map((s) => s.match(/\[\s*(\w+)/)[1]);
  const inFlight = names.find((n) => new RegExp(`disabled=\\{[^}]*\\b${n}\\b`).test(src));
  assert(inFlight, `one useState(null) in-flight value (ADR 0002 calls it fixing) must disable the fix buttons — disabled={… ${names.join(' | ') || 'fixing'} …}`);
  const buttons = (src.match(/<button\b/g) || []).length;
  const disabledByIt = (src.match(new RegExp(`disabled=\\{[^}]*\\b${inFlight}\\b`, 'g')) || []).length;
  assert(disabledByIt >= 1 && buttons >= 1, `the fix buttons are disabled by ${inFlight}`);
});

async function run() {
  console.log(`${NL}=== assistant-profile-checklist-page (assistant-profile-checklist #2) ===`);
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fnc] of tests) {
    try {
      await fnc();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}assistant-profile-checklist-page: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => { process.exitCode = r.fail > 0 ? 1 : 0; });
}
