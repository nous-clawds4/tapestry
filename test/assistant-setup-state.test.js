/**
 * assistant-profile #1: The setup prompt tells the truth.
 *
 * Story: engineering-team/stories/assistant-profile/1-setup-prompt-tells-the-truth.md
 * ADR:   engineering-team/decisions/assistant-profile/0001-one-setup-state-answer-local-first.md
 * Plan:  engineering-team/stories/assistant-profile/1-setup-prompt-tells-the-truth.test-plan.md
 * Browser half: tests/brainstorm/assistant-setup-prompt.spec.js (B-class — what a viewer SEES).
 *
 * Classes:
 *   U — resolveAssistantProfileState executed with injected fakes (the feedReadPath seam the
 *       ADR names). Stack-free: no strfry, no relays, no network. Every branch of the ratified
 *       rule — local hit, relay hit + copy home, relay miss, relay failure or hang, fallback not
 *       allowed, the negative memo.
 *   S — source sentinels on the server for what U cannot reach without a key store: the status
 *       handler asks the resolver, anonymous calls stay local-only, one publish-relay list, lazy
 *       requires.
 *   D — source sentinels on the dashboard and its new hook (this runner does not transpile JSX):
 *       the pubkeys=null race has no source left, the check waits for sign-in and asks about the
 *       signed-in user's own assistant.
 *   R — regressions that pass before and after: the editor keeps reading the same endpoint and
 *       field, so every surface shares one answer (AC5).
 *   H — the live contract against whatever instance is reachable (BRAINSTORM_BASE_URL, else
 *       localhost:7778). GETs only — this suite never writes. The local Docker stack serves the
 *       SHARED checkout, so from a worktree H1 stays red until the code is deployed; staging is
 *       where it is decisive.
 *
 * U/S/D and H1 FAIL against current code: profileState.js does not exist, the status handler
 * scans the local relay inline, and the dashboard asks /api/profiles about the instance TA from
 * an effect with [] deps. R1 and H2 pass before and after.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const RESOLVER = path.join(REPO, 'src/api/assistant/profileState.js');
const ASSISTANT_SRC = path.join(REPO, 'src/api/assistant/index.js');
const DASHBOARD = path.join(REPO, 'ui/src/pages/Dashboard.jsx');
const HOOK = path.join(REPO, 'ui/src/hooks/useAssistantSetupState.js');
const EDITOR = path.join(REPO, 'ui/src/components/AssistantProfileEditor.jsx');
const HOST_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';

// Fixture keys — never live ones. The resolver is handed its pubkey, so nothing here depends
// on which instance the suite happens to run beside.
const PK = 'a1'.repeat(32);
const OTHER_PK = 'b2'.repeat(32);
const RELAYS = ['wss://relay-one.example', 'wss://relay-two.example'];
const RELAY_BUDGET_MS = 4000;            // ADR 0001 § Implementation notes
const NEGATIVE_MEMO_MS = 5 * 60 * 1000;  // ADR 0001 § Implementation notes

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

let hExecuted = 0;
let hSkipped = 0;

function kind0(pubkey, createdAt, id, content = { name: `fixture ${id}` }) {
  return { id, pubkey, kind: 0, created_at: createdAt, tags: [], content: JSON.stringify(content), sig: '0'.repeat(128) };
}

/** The resolver under test — or a failure that says exactly what is missing. */
function getResolver() {
  if (!fs.existsSync(RESOLVER)) {
    throw new Error('src/api/assistant/profileState.js does not exist. ADR 0001 creates it and exports ' +
      'resolveAssistantProfileState — the one place that decides whether an assistant has a profile.');
  }
  delete require.cache[require.resolve(RESOLVER)];
  const mod = require(RESOLVER);
  if (typeof mod.resolveAssistantProfileState !== 'function') {
    throw new Error('src/api/assistant/profileState.js does not export resolveAssistantProfileState (ADR 0001).');
  }
  return mod.resolveAssistantProfileState;
}

/**
 * Injected fakes, handed over under `options.deps` (the feedReadPath seam). Each RECORDS its calls.
 *   local       — what the local relay holds for the assistant: an event, null, or a function.
 *   relayEvents — what the publish relays return: an array, or a function (to throw or to hang).
 */
function fakes(opts = {}) {
  const state = { now: opts.now ?? 1_700_000_000_000 };
  const calls = { scanLocal: [], queryRelays: [], importEvent: [] };
  const deps = {
    scanLocalKind0: async (pubkey) => {
      calls.scanLocal.push(pubkey);
      return typeof opts.local === 'function' ? opts.local() : (opts.local ?? null);
    },
    queryRelaysKind0: async (relays, pubkey, params) => {
      calls.queryRelays.push({ relays, pubkey, params });
      const r = opts.relayEvents ?? [];
      return typeof r === 'function' ? r() : r;
    },
    importEvent: async (event) => {
      calls.importEvent.push(event);
      if (opts.importFails) throw new Error('strfry import failed (fixture)');
    },
    getPublishRelays: () => opts.relays ?? RELAYS,
    now: () => state.now,
    memo: opts.memo ?? new Map(),
  };
  return { deps, calls, state };
}

/** Resolve within `ms`, or report 'HUNG' — clearing the timer either way. */
async function within(promise, ms) {
  let timer;
  const hung = new Promise((resolve) => { timer = setTimeout(() => resolve('HUNG'), ms); });
  try { return await Promise.race([promise, hung]); } finally { clearTimeout(timer); }
}

/** The source of a top-level function, up to the next top-level declaration. */
function functionBody(src, name) {
  const start = src.search(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`));
  if (start < 0) return '';
  const rest = src.slice(start + 1);
  const next = rest.search(/\n(?:async\s+function|function|const|let|module\.exports)\b/);
  return next < 0 ? src.slice(start) : src.slice(start, start + 1 + next);
}

async function getJson(url, timeoutMs = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { throw new Error(`${url} → HTTP ${res.status}, not JSON: ${text.slice(0, 120)}`); }
    return { status: res.status, body };
  } finally { clearTimeout(timer); }
}

async function stackAvailable() {
  try {
    const { status, body } = await getJson(`${HOST_BASE}/api/assistant/pubkey`, 3000);
    return status === 200 && body && body.success === true;
  } catch { return false; }
}

/* ───────────────────────── U — the resolver, with injected fakes ───────────────────────── */

test('U0: src/api/assistant/profileState.js exists and exports resolveAssistantProfileState (ADR 0001)', () => {
  getResolver();
});

test('U1: a kind 0 on the local relay answers "has a profile" from the local relay alone — no relay query and no import, even when relays are allowed and would fail', async () => {
  const resolve = getResolver();
  const { deps, calls } = fakes({
    local: kind0(PK, 100, 'local'),
    relayEvents: () => { throw new Error('the publish relays must not be asked when the local relay has the profile'); },
  });
  const r = await resolve({ assistantPubkey: PK, allowRelayFallback: true, deps });
  assert(r && r.hasProfile === true, `AC1: expected hasProfile true for a profile on the local relay, got ${JSON.stringify(r)}`);
  assert(r.source === 'local', `AC1: expected source 'local', got ${JSON.stringify(r.source)}`);
  assert(r.profile && r.profile.name === 'fixture local',
    `the parsed profile must come back (the editor prefills from it), got ${JSON.stringify(r.profile)}`);
  assert(calls.scanLocal.length === 1 && calls.scanLocal[0] === PK,
    `the local relay must be asked once, about this assistant; calls: ${JSON.stringify(calls.scanLocal)}`);
  assert(calls.queryRelays.length === 0,
    `AC1: a local profile must be answered with NO relay traffic — a slow or dead relay can never erase it — but the relays were queried ${calls.queryRelays.length}×`);
  assert(calls.importEvent.length === 0, 'nothing may be imported when the local relay already holds the profile');
});

test('U2: no local profile, but a publish relay has one → "has a profile" (source relay), and exactly the newest valid event is copied to the local relay', async () => {
  const resolve = getResolver();
  const older = kind0(PK, 100, 'older');
  const newest = kind0(PK, 300, 'newest');
  const otherAuthor = kind0(OTHER_PK, 999, 'other-author');        // newer, but not this assistant's
  const otherKind = { ...kind0(PK, 998, 'other-kind'), kind: 1 };   // this assistant's, but not a profile
  const { deps, calls } = fakes({ local: null, relayEvents: [older, otherAuthor, newest, otherKind] });
  const r = await resolve({ assistantPubkey: PK, allowRelayFallback: true, deps });
  assert(r && r.hasProfile === true, `AC2: a profile on a publish relay means "has a profile", got ${JSON.stringify(r)}`);
  assert(r.source === 'relay', `AC2: expected source 'relay', got ${JSON.stringify(r.source)}`);
  assert(calls.importEvent.length === 1,
    `AC2: the found profile must be copied to the local relay exactly once, imported ${calls.importEvent.length}×`);
  assert(calls.importEvent[0].id === 'newest',
    `AC2: the NEWEST kind 0 by this assistant must be copied home, got ${calls.importEvent[0] && calls.importEvent[0].id}. ` +
    'Events by another author, or of another kind, are not this assistant\'s profile.');
});

test('U3: if copying home fails, the answer is still "has a profile" (it exists on a publish relay), and the next check tries the copy again', async () => {
  const resolve = getResolver();
  const memo = new Map();
  const { deps, calls } = fakes({ local: null, relayEvents: [kind0(PK, 300, 'newest')], importFails: true, memo });
  const first = await resolve({ assistantPubkey: PK, allowRelayFallback: true, deps });
  assert(first && first.hasProfile === true && first.source === 'relay',
    `AC2: an import failure must not turn an existing profile into "no profile", got ${JSON.stringify(first)}`);
  const second = await resolve({ assistantPubkey: PK, allowRelayFallback: true, deps });
  assert(second && second.hasProfile === true, `the second check must still find it, got ${JSON.stringify(second)}`);
  assert(calls.importEvent.length === 2,
    `a failed repair must be retried on the next check (a found profile is never memoized), imported ${calls.importEvent.length}×`);
});

test('U4: no kind 0 by this assistant on the local relay or any publish relay → "no profile", the prompt\'s trigger', async () => {
  const resolve = getResolver();
  const notOurs = [kind0(OTHER_PK, 500, 'other-author'), { ...kind0(PK, 400, 'other-kind'), kind: 3 }];
  const { deps, calls } = fakes({ local: null, relayEvents: notOurs });
  const r = await resolve({ assistantPubkey: PK, allowRelayFallback: true, deps });
  assert(r && r.hasProfile === false, `AC3: expected hasProfile false, got ${JSON.stringify(r)}`);
  assert(r.source === null, `AC3: "no profile" has no source, got ${JSON.stringify(r.source)}`);
  assert(calls.queryRelays.length === 1, `the publish relays must be asked once, asked ${calls.queryRelays.length}×`);
  assert(calls.importEvent.length === 0, 'nothing may be imported when nothing was found');
});

test('U5: when the publish relays fail, the local relay\'s answer stands — "no profile", never an error', async () => {
  const resolve = getResolver();
  const { deps } = fakes({ local: null, relayEvents: () => { throw new Error('ECONNREFUSED (fixture)'); } });
  let r;
  try {
    r = await resolve({ assistantPubkey: PK, allowRelayFallback: true, deps });
  } catch (err) {
    throw new Error(`open question resolved at approval: unreachable publish relays leave the local answer standing — the resolver must not reject, but threw: ${err.message}`);
  }
  assert(r && r.hasProfile === false && r.source === null,
    `with an empty local relay and failing publish relays the answer is "no profile", got ${JSON.stringify(r)}`);
});

test('U6: a publish relay that never answers cannot hold the check — it returns "no profile" within the relay budget', async () => {
  const resolve = getResolver();
  const { deps } = fakes({ local: null, relayEvents: () => new Promise(() => {}) });
  const started = Date.now();
  const r = await within(resolve({ assistantPubkey: PK, allowRelayFallback: true, deps }), RELAY_BUDGET_MS + 4000);
  assert(r !== 'HUNG',
    `the resolver did not return within ${RELAY_BUDGET_MS + 4000} ms of a hanging relay query — ADR 0001 races the query against an outer timeout of ${RELAY_BUDGET_MS} ms, so a hung socket cannot hold a page`);
  assert(r.hasProfile === false, `a relay that never answers leaves the local answer standing, got ${JSON.stringify(r)}`);
  const elapsed = Date.now() - started;
  assert(elapsed < RELAY_BUDGET_MS + 2000, `the check took ${elapsed} ms; the budget is ${RELAY_BUDGET_MS} ms`);
});

test('U7: when the relay fallback is not allowed (an anonymous caller), the answer is the local relay\'s alone — no relay query, nothing written', async () => {
  const resolve = getResolver();
  const { deps, calls } = fakes({ local: null, relayEvents: [kind0(PK, 300, 'on-a-relay')] });
  const r = await resolve({ assistantPubkey: PK, allowRelayFallback: false, deps });
  assert(r && r.hasProfile === false && r.source === null,
    `with the fallback disallowed only the local relay counts, got ${JSON.stringify(r)}`);
  assert(calls.queryRelays.length === 0, `AC4/ADR 0001: an anonymous check must not query relays, queried ${calls.queryRelays.length}×`);
  assert(calls.importEvent.length === 0, 'AC4/ADR 0001: an anonymous check must never write to the local relay');
});

test('U8: a "no profile" answer is never sticky — once the profile lands on the local relay (a publish), the very next check says "has a profile"', async () => {
  const resolve = getResolver();
  const memo = new Map();
  let localHolds = null;
  const { deps } = fakes({ local: () => localHolds, relayEvents: [], memo });
  const before = await resolve({ assistantPubkey: PK, allowRelayFallback: true, deps });
  assert(before && before.hasProfile === false, `precondition: no profile anywhere, got ${JSON.stringify(before)}`);
  localHolds = kind0(PK, 1000, 'just-published');   // what publishing from the editor does
  const after = await resolve({ assistantPubkey: PK, allowRelayFallback: true, deps });
  assert(after && after.hasProfile === true && after.source === 'local',
    `AC5: immediately after a publish every surface must say "set up" — the memoized miss must not mask the local relay, got ${JSON.stringify(after)}`);
});

test('U9: after a relay miss, checks within 5 minutes skip the relays; after 5 minutes they are asked again — and the memory is per assistant', async () => {
  const resolve = getResolver();
  const memo = new Map();
  const { deps, calls, state } = fakes({ local: null, relayEvents: [], memo });
  const t0 = state.now;
  await resolve({ assistantPubkey: PK, allowRelayFallback: true, deps });
  assert(calls.queryRelays.length === 1, `precondition: the first check asks the relays, asked ${calls.queryRelays.length}×`);

  state.now = t0 + 60 * 1000;
  const again = await resolve({ assistantPubkey: PK, allowRelayFallback: true, deps });
  assert(again && again.hasProfile === false, `within the window the answer is still "no profile", got ${JSON.stringify(again)}`);
  assert(calls.queryRelays.length === 1,
    `ADR 0001: a miss is remembered for ${NEGATIVE_MEMO_MS / 60000} minutes so every page load does not re-query every relay — queried ${calls.queryRelays.length}×`);

  await resolve({ assistantPubkey: OTHER_PK, allowRelayFallback: true, deps });
  assert(calls.queryRelays.length === 2, 'the memory is per assistant: another assistant\'s first check must still ask the relays');

  state.now = t0 + NEGATIVE_MEMO_MS + 1000;
  await resolve({ assistantPubkey: PK, allowRelayFallback: true, deps });
  assert(calls.queryRelays.length === 3, `after ${NEGATIVE_MEMO_MS / 60000} minutes the relays must be asked again, queried ${calls.queryRelays.length}× in total`);
});

test('U10: the relays asked are exactly the instance\'s publish relays, about this assistant, with the 4-second budget', async () => {
  const resolve = getResolver();
  const { deps, calls } = fakes({ local: null, relayEvents: [] });
  await resolve({ assistantPubkey: PK, allowRelayFallback: true, deps });
  const q = calls.queryRelays[0];
  assert(q, 'the publish relays were not queried at all');
  assert(JSON.stringify(q.relays) === JSON.stringify(RELAYS),
    `the check must read the same list the publisher writes to (getPublishRelays), got ${JSON.stringify(q.relays)}`);
  assert(q.pubkey === PK, `the relays must be asked about this assistant, got ${q.pubkey}`);
  assert(q.params && q.params.maxWait === RELAY_BUDGET_MS,
    `ADR 0001: the relay query carries maxWait ${RELAY_BUDGET_MS}, got ${JSON.stringify(q.params)}`);
});

test('U11: index.js exports getAssistantPublishRelays() — a non-empty list of relay URLs, the one list publishing and checking share', () => {
  let mod;
  try { mod = require(ASSISTANT_SRC); } catch (err) { throw new Error(`src/api/assistant/index.js failed to load: ${err.message}`); }
  assert(typeof mod.getAssistantPublishRelays === 'function',
    'ADR 0001: src/api/assistant/index.js must export getAssistantPublishRelays() — the seam story 2 makes configurable');
  const list = mod.getAssistantPublishRelays();
  assert(Array.isArray(list) && list.length > 0, `getAssistantPublishRelays() must return a non-empty array, got ${JSON.stringify(list)}`);
  assert(list.every((u) => typeof u === 'string' && /^wss?:\/\//.test(u)), `every publish relay must be a ws(s):// URL: ${JSON.stringify(list)}`);
});

/* ───────────────────────── S — the server, by source ───────────────────────── */

test('S1: the status endpoint decides hasProfile through the resolver — no kind-0 scan of its own remains', () => {
  const body = functionBody(safeRead(ASSISTANT_SRC), 'handleAssistantStatus');
  assert(body, 'handleAssistantStatus not found in src/api/assistant/index.js');
  assert(/resolveAssistantProfileState\s*\(/.test(body),
    'AC5: handleAssistantStatus must ask resolveAssistantProfileState (ADR 0001) — one rule is what makes every surface agree');
  assert(!/strfry scan/.test(body),
    'AC5: handleAssistantStatus still runs its own `strfry scan` for the kind 0 — a second rule, which is how the dashboard and the editor came to disagree');
});

test('S2: anonymous status calls stay local-only — the relay fallback is allowed for the assistant\'s own signed-in user, the operator, or the in-container loopback', () => {
  const body = functionBody(safeRead(ASSISTANT_SRC), 'handleAssistantStatus');
  assert(body, 'handleAssistantStatus not found in src/api/assistant/index.js');
  assert(/allowRelayFallback/.test(body), 'ADR 0001: handleAssistantStatus must hand the resolver an allowRelayFallback decision');
  assert(/localTrusted/.test(body), 'ADR 0001: the in-container operator path (req.localTrusted) is one of the callers allowed the fallback');
  assert(/session[\s\S]{0,60}pubkey[\s\S]{0,40}={2,3}\s*customerPubkey|customerPubkey\s*={2,3}[\s\S]{0,40}session[\s\S]{0,40}pubkey/i.test(body),
    'ADR 0001: the fallback must require the signed-in session to be the assistant\'s own user (session pubkey === customerPubkey), so an anonymous GET never writes to the local relay');
});

test('S3: publishing uses the list the check reads — getAssistantPublishRelays(), with no second hardcoded list', () => {
  const src = safeRead(ASSISTANT_SRC);
  assert(!/\bEXTERNAL_RELAYS\b/.test(src),
    'ADR 0001: the EXTERNAL_RELAYS constant must go — publishing and checking share getAssistantPublishRelays(), which story 2 makes configurable in one place');
  const body = functionBody(src, 'handlePublishProfile');
  assert(/getAssistantPublishRelays\s*\(/.test(body), 'ADR 0001: handlePublishProfile must publish to getAssistantPublishRelays()');
});

test('S4: profileState.js loads in a bare checkout — no top-level require of nostr-tools, ws, the key store or settings', () => {
  const src = safeRead(RESOLVER);
  assert(src, 'src/api/assistant/profileState.js does not exist (see U0).');
  const heavy = /nostr-tools|['"]ws['"]|NOSTR_TOOLS_PATH|WS_PATH|assistantKeys|secureKeyStorage|config\/settings/;
  const offenders = src.split('\n').filter((line) => /^(?:const|let|var)\b.*\brequire\s*\(/.test(line) && heavy.test(line));
  assert(offenders.length === 0,
    'ADR 0001: real helpers are required lazily inside their functions, never at module top level (the bare-checkout trap, ' +
    `stories/_intake.md 2026-07-05). Top-level: ${offenders.join(' | ')}`);
});

test('S5: the status response reports where the answer came from (profileSource)', () => {
  const body = functionBody(safeRead(ASSISTANT_SRC), 'handleAssistantStatus');
  assert(/profileSource/.test(body), "ADR 0001: /api/assistant/status adds profileSource ('local' | 'relay' | null)");
});

/* ───────────────────────── D — the dashboard and its hook, by source ───────────────────────── */

test('D1: the dashboard no longer asks /api/profiles about the instance TA — the pubkeys=null race has nothing left to fire', () => {
  const src = safeRead(DASHBOARD);
  assert(src, 'ui/src/pages/Dashboard.jsx not found');
  assert(!src.includes('/api/profiles?pubkeys='),
    'AC1: Dashboard.jsx still fetches /api/profiles?pubkeys=… for the setup check — reproduced on 2026-09-11 as `pubkeys=null` on every hard load of staging and prod.');
  assert(!/\btaPubkey\b|\bTA_PUBKEY\b/.test(src),
    'AC4: Dashboard.jsx still reads the instance TA pubkey — the prompt must concern the signed-in user\'s own assistant, never the instance TA (ADR 0001).');
});

test('D2: the setup check waits for sign-in to resolve, and re-runs when the signed-in user changes', () => {
  const src = safeRead(HOOK);
  assert(src, 'ui/src/hooks/useAssistantSetupState.js does not exist — ADR 0001 adds it; the dashboard reads setup state through it.');
  assert(/useAuth\s*\(/.test(src), 'the hook must read the signed-in user from useAuth()');
  const depArrays = src.match(/\[[^[\]]*\]/g) || [];
  const keyed = depArrays.some((a) => /(?<!['"])\b(?:authLoading|loading)\b(?!['"])/.test(a) && /\buser\??\.pubkey\b/.test(a));
  assert(keyed,
    'AC1: no dependency list names both the auth-loading flag and user?.pubkey. The race was an effect with [] deps that read a value before it existed; the fix keys the check on the resolved sign-in (ADR 0001).');
});

test('D3: the check asks about the signed-in user\'s OWN assistant — /api/assistant/status?customerPubkey=<user.pubkey> — never the instance TA', () => {
  const src = safeRead(HOOK);
  assert(src, 'ui/src/hooks/useAssistantSetupState.js does not exist (see D2).');
  assert(/\/api\/assistant\/status\?customerPubkey=\$\{[^}]*\buser\??\.pubkey\b[^}]*\}/.test(src),
    'AC4/AC5: the hook must ask /api/assistant/status about user.pubkey — the endpoint the editor already trusts, about the viewer\'s own assistant.');
  assert(!/\btaPubkey\b/.test(src), 'AC4: the hook must not consult the instance TA pubkey.');
});

test('D4: the check tells "no assistant" (no request) and "unknown" (an error) apart from "needs setup"', () => {
  const src = safeRead(HOOK);
  assert(src, 'ui/src/hooks/useAssistantSetupState.js does not exist (see D2).');
  for (const s of ['loading', 'no-assistant', 'set-up', 'needs-setup', 'unknown']) {
    assert(src.includes(`'${s}'`) || src.includes(`"${s}"`), `ADR 0001: the hook's status '${s}' is missing`);
  }
  assert(/\bassistantPubkey\b/.test(src),
    'AC4: the hook must gate on user.assistantPubkey — a user with no assistant gets no prompt and no request');
});

test('D5: the dashboard shows the welcome prompt only for a definite "needs setup"', () => {
  const src = safeRead(DASHBOARD);
  assert(/useAssistantSetupState/.test(src), 'AC1: Dashboard.jsx must read setup state through useAssistantSetupState (ADR 0001)');
  assert(/['"]needs-setup['"]/.test(src), 'AC1/AC3: Dashboard.jsx must render the prompt only when the status is \'needs-setup\'');
});

test('D6: the prompt sends each viewer where they can publish their own assistant\'s profile — Owner/Admin to /tapestry/settings/assistant, everyone else to /settings', () => {
  const src = safeRead(DASHBOARD);
  assert(src.includes('/tapestry/settings/assistant'), 'the Owner/Admin destination /tapestry/settings/assistant is missing');
  assert(/['"`]\/settings['"`]/.test(src),
    'AC3: no /settings destination — the Tapestry settings page is Owner/Admin-only, so a Customer\'s prompt leads to a dead end today');
});

/* ───────────────────────── R — regressions (pass before and after) ───────────────────────── */

test('R1: the editor still reads the same endpoint and field, so the editor and the dashboard share one answer', () => {
  const src = safeRead(EDITOR);
  assert(src.includes('/api/assistant/status?customerPubkey='), 'AssistantProfileEditor must keep reading /api/assistant/status');
  assert(/status\.hasProfile/.test(src), 'AssistantProfileEditor\'s "Currently published" line must keep reading status.hasProfile');
});

/* ───────────────────────── H — the live contract (GET only) ───────────────────────── */

test('H1: the live status endpoint reports where its answer came from, and an anonymous call is answered from the local relay alone', async () => {
  if (!(await stackAvailable())) { hSkipped++; return 'SKIP'; }
  hExecuted++;
  const { body: owner } = await getJson(`${HOST_BASE}/api/owner/pubkey`);
  assert(owner && owner.success && /^[0-9a-f]{64}$/.test(owner.pubkey || ''), `${HOST_BASE}/api/owner/pubkey returned no owner pubkey`);
  const { body: st } = await getJson(`${HOST_BASE}/api/assistant/status?customerPubkey=${owner.pubkey}`);
  assert(st && st.success === true, `status call failed: ${JSON.stringify(st).slice(0, 200)}`);
  if (!st.hasRelayKey) { console.log('        (the owner has no assistant key on this instance — nothing to assert)'); return undefined; }
  assert(Object.prototype.hasOwnProperty.call(st, 'profileSource'),
    `ADR 0001: /api/assistant/status must report profileSource ('local' | 'relay' | null); ${HOST_BASE} does not. ` +
    'Not implemented — or not deployed there: the local Docker stack serves the SHARED checkout, not a worktree, so from a worktree this stays red until staging.');
  const expected = st.hasProfile ? 'local' : null;
  assert(st.profileSource === expected,
    `AC4/ADR 0001: an anonymous status call never uses the relay fallback — hasProfile=${st.hasProfile} must come with profileSource=${JSON.stringify(expected)}, got ${JSON.stringify(st.profileSource)}`);
  return undefined;
});

test('H2: an anonymous call\'s hasProfile agrees with what the instance\'s local relay actually holds', async () => {
  if (!(await stackAvailable())) { hSkipped++; return 'SKIP'; }
  hExecuted++;
  const { body: owner } = await getJson(`${HOST_BASE}/api/owner/pubkey`);
  const { body: st } = await getJson(`${HOST_BASE}/api/assistant/status?customerPubkey=${owner.pubkey}`);
  if (!st.hasRelayKey) return undefined;
  const filter = encodeURIComponent(JSON.stringify({ kinds: [0], authors: [st.assistantPubkey], limit: 1 }));
  const { body: scan } = await getJson(`${HOST_BASE}/api/strfry/scan?filter=${filter}`);
  const events = Array.isArray(scan && scan.events) ? scan.events : [];
  const localHas = events.some((e) => e && e.kind === 0 && e.pubkey === st.assistantPubkey);
  assert(st.hasProfile === localHas,
    `AC5: status says hasProfile=${st.hasProfile}, but the local relay ${localHas ? 'holds' : 'does not hold'} a kind 0 by ${st.assistantPubkey.slice(0, 12)}…`);
  return undefined;
});

async function run() {
  console.log('\n=== assistant-setup-state (assistant-profile #1) ===');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
      else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  // OPEN.md #104/#106: a fully-skipped H-class is otherwise indistinguishable from a real pass.
  console.log(`assistant-setup-state: H-class ${hExecuted} executed / ${hSkipped} skipped`);
  if (hSkipped > 0 && hExecuted === 0) {
    console.log('assistant-setup-state: !! LIVE COVERAGE DID NOT RUN — stack unreachable.');
    if (process.env.TAPESTRY_REQUIRE_LIVE === '1') {
      failures.push({ name: 'live coverage', message: 'TAPESTRY_REQUIRE_LIVE=1 but the whole H-class skipped.' });
      fail++;
    }
  }
  console.log(`\nassistant-setup-state: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped, hExecuted, hSkipped };
}

module.exports = { run };
