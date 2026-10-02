const { test, expect } = require('@playwright/test');

/**
 * list-headers-disposition #3 — Disposition on My Assistant rows: what a signed-in person SEES and DOES on
 * /tapestry/lists.
 *
 * Story: engineering-team/stories/done/list-headers-disposition/3-disposition-on-my-assistant-rows.md
 * ADR:   engineering-team/decisions/done/list-headers-disposition/0003-my-assistant-disposition-endpoints-and-panel.md
 * Plan:  engineering-team/stories/done/list-headers-disposition/3-disposition-on-my-assistant-rows.test-plan.md
 * Node half: test/list-headers-my-assistant-disposition.test.js (the rules, the handler, who signs, live refusals).
 *
 * Hermetic. A catch-all answers every /api call these tests don't name, and EVERY WebSocket is mocked
 * (routeWebSocket on /.*\/), so nothing reaches a real relay. The two disposition endpoints are answered by a
 * small stand-in that holds header state and applies story 3's rules; the community relay is a mock that
 * accepts, rejects or drops each EVENT as the test says; /api/publish-policy decides local-only.
 *
 *   M1 — AC 1: Disposition… on every 39998 row the viewer's own Assistant wrote, whatever its state; none
 *        elsewhere (other Assistants, the account itself, kind 9998, signed out, no Assistant).
 *   M2 — AC 1: the button opens the panel without opening the list; the rest of the row still opens it.
 *   M3 — AC 2 + AC 5: Submit on an undecided row: the self-declare call, one EVENT to the community relay
 *        carrying the self-pointing b, "published", and 🤝 in the row with no reload.
 *   M4 — AC 2: Submit on a wired row shows 🔗 🤝; on a kept-private row shows 🤝 alone.
 *   M5 — AC 2: Submit on a self-declared row re-sends the existing event and says "Already shared".
 *   M6 — AC 3: Keep private on an undecided row: the b-defer call, nothing sent to any relay, 🔒 in the row.
 *   M7 — AC 3: Keep private can't be chosen beside a real b-tag, with the reason; on a private row it says so.
 *   M8 — AC 4: a refusal from the server shows in the panel and changes nothing.
 *   M9 — AC 5: "kept here" when external publishing is off (no socket at all); "didn't reach" when the relay
 *        rejects it — and the row still shows the new state, because it's saved here.
 *   M10 — AC 6: Next undecided → walks the viewer's own Assistant's undecided rows; at the end only Done.
 *   W8..W9 — story 4 review round 1 (ADR 0004 Amendment 1): the panel's mirrored target bounds (another kind, too
 *        long in bytes, a format character), each with no request; a server 502 from the relay read-back, shown with the
 *        row unchanged.
 *   W1..W7 — story 4 (Wire; ADR 0004): the Wire section and its pick-list; Wire with its outcome; already wired;
 *        a second target; the panel's own refusals, with no request; Next keeps the pick-list without a second read.
 *   M11 — AC 1 on a real-sized list (review round 1, ADR 0003 Amendment 1 §4): Disposition… on the last of 70 rows
 *        opens a panel the person can see — inside the viewport, below the fixed top bar — and Next keeps it there.
 *
 * Story 5 (Me rows; ADR 0005 — prepare, sign in the browser, commit). Story 5 AC 1 changes M1: the account's own
 * kind-39998 rows now carry the button too. The browser signer is a stub installed with addInitScript that logs
 * every signEvent call, so "the signer is asked once" and "never asked" are counted, not inferred.
 *   E1 — AC 2: Submit on a Me row: prepare then commit, one signature by the account, one EVENT, 🤝 with no reload.
 *   E2 — AC 2: Keep private on a Me row: one signature, nothing sent to any relay, 🔒.
 *   E3 — AC 2: Wire on a Me row: prepare and commit both carry the target, one signature, one EVENT, 🔗.
 *   E4 — AC 2: already self-declared / private / wired: the signer is never asked, nothing is committed.
 *   E5 — AC 3: no signer in the browser — for each action, the sentence, no commit, the row unchanged.
 *   E6 — AC 3: declined in the signer — asked once, the sentence, no commit.
 *   E7 — AC 3: a signer on another account — not asked; and one that signs as another account — no commit.
 *   E8 — AC 4: a refusal at prepare never asks the signer; a refusal at commit leaves the row unchanged.
 *   E9 — AC 5: Next from a Me row walks only Me rows; from an Assistant row only Assistant rows, never signing.
 *   E10 — AC 2: Submit on a Me row when external publishing is off says so and keeps it here.
 *   Review round 1 (ADR 0005 Amendment 1):
 *   E11 — §1: act on a Me row, then sign out in the page: the panel is gone, no Next, no button on any row, no error.
 *   E12 — §1: sign out with the panel open: gone, with no page error; signing back in doesn't bring it back.
 *   E13 — §4: a decline (or a non-Error rejection) at the signer's account step: the cancelled sentence, the panel not
 *         left busy, the signer never asked to sign, nothing committed.
 */

const OWNER = '1'.repeat(64);
const OWNER_TA = '2'.repeat(64);
const VIEWER = 'a1'.repeat(32);
const VIEWER_TA = 'a2'.repeat(32);
const STRANGER = '9'.repeat(64);
const THEIRS = `39998:${'8'.repeat(64)}:somebody-elses-concept`;
const ANOTHER = `39998:${'ab'.repeat(32)}:another-concept`;
// story 4: the community relay's Shared Concepts, as GET /api/relay/external returns them (self-declared headers).
function sharedConcept(address, name, description) {
  const [kind, pubkey, d] = address.split(':');
  return {
    id: `${pubkey.slice(0, 8)}${'0'.repeat(56)}`, pubkey, kind: Number(kind), created_at: 1789000000, content: '', sig: '0'.repeat(128),
    tags: [['d', d], ['names', name, `${name}s`], ['description', description], ['b', address, 'pointer']],
  };
}
const COMMUNITY_CONCEPTS = [
  sharedConcept(THEIRS, 'somebody elses concept', 'A concept somebody else shares'),
  sharedConcept(ANOTHER, 'another concept', 'Another shared concept'),
];
const SENTINEL = 'b-tag-deferred';
const COMMUNITY = 'wss://dcosl.brainstorm.world';

const OWNER_SESSION = { pubkey: OWNER, assistantPubkey: OWNER_TA, classification: 'owner' };
const CUSTOMER = { pubkey: VIEWER, assistantPubkey: VIEWER_TA, classification: 'customer' };
const GUEST = { pubkey: 'c1'.repeat(32), assistantPubkey: null, classification: 'guest' };

const NOW = 1790000000;
const dOf = (name) => `d-${name.replace(/\s+/g, '-')}`;
const addr = (pubkey, name) => `39998:${pubkey}:${dOf(name)}`;

function fixtures(extraOwnRows = 0) {
  let seq = 0;
  const h = (name, { kind = 39998, pubkey = OWNER_TA, b = [] } = {}) => {
    seq++;
    const tags = [['names', name, `${name}s`]];
    if (kind === 39998) tags.unshift(['d', dOf(name)]);
    for (const v of b) tags.push(v === SENTINEL ? ['b', v] : ['b', v, 'pointer']);
    return { id: seq.toString(16).padStart(64, '0'), pubkey, kind, created_at: NOW - seq * 60, tags, content: '', sig: '0'.repeat(128) };
  };
  return [
    h('ta undecided a'),
    h('ta wired', { b: [THEIRS] }),
    h('ta self', { b: [addr(OWNER_TA, 'ta self')] }),
    h('ta private', { b: [SENTINEL] }),
    h('ta undecided b'),
    h('ta plain 9998', { kind: 9998 }),
    h('owner own list', { pubkey: OWNER }),
    h('viewer ta undecided', { pubkey: VIEWER_TA }),
    h('stranger list', { pubkey: STRANGER }),
    // story 5: rows the accounts wrote with their own keys (Me rows).
    h('owner own b', { pubkey: OWNER }),
    h('owner own self', { pubkey: OWNER, b: [addr(OWNER, 'owner own self')] }),
    h('owner own wired', { pubkey: OWNER, b: [THEIRS] }),
    h('owner own private', { pubkey: OWNER, b: [SENTINEL] }),
    h('owner own 9998', { pubkey: OWNER, kind: 9998 }),
    h('viewer own list', { pubkey: VIEWER }),
    h('guest own list', { pubkey: GUEST.pubkey }),
    // M11: a real-sized list of the viewer's own Assistant's undecided rows (the Owner has 183 on the Mac Studio).
    ...Array.from({ length: extraOwnRows }, (_, i) => h(`ta bulk ${String(i + 1).padStart(3, '0')}`)),
  ];
}
const nameOf = (ev) => ev.tags.find((t) => t[0] === 'names')[1];
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/**
 * relay: 'accept' | 'reject' | 'drop'; policy: 'open' | 'local-only'; refuse: { status, error } for both actions.
 */
async function mockStack(page, { session = null, relay = 'accept', policy = 'open', refuse = null, refuseCommit = null, signer = null, extraOwnRows = 0, communityHold = null } = {}) {
  const headers = fixtures(extraOwnRows);
  const state = { headers, posts: [], mePosts: [], commits: [], scans: 0, sockets: [], events: [], communityReads: 0 };
  // Review round 1 (Amendment 1 §1): the session can end and start again in the page. Every auth answer below reads
  // `session`, so signing out makes the page signed-out and signing in restores the same account.
  const signedInAs = session;
  if (signer) await stubSigner(page, signer, session ? session.pubkey : null);
  let configAnswered;
  const config = new Promise((resolve) => { configAnswered = resolve; });
  let owner = false;
  let ta = false;
  const settle = () => { if (owner && ta) configAnswered(); };

  await page.routeWebSocket(/.*/, (ws) => {
    state.sockets.push(ws.url());
    if (relay === 'drop') { ws.close(); return; }
    ws.onMessage((raw) => {
      let m;
      try { m = JSON.parse(String(raw)); } catch { return; }
      if (m[0] !== 'EVENT') return;
      state.events.push({ url: ws.url(), event: m[1] });
      ws.send(JSON.stringify(['OK', m[1].id, relay === 'accept', relay === 'accept' ? '' : 'blocked: test relay']));
    });
  });

  await page.route('**/api/**', (r) => json(r, { success: false, error: 'not mocked in this spec' }, 404));
  await page.route('**/api/owner/pubkey', (r) => { owner = true; settle(); return json(r, { success: true, pubkey: OWNER }); });
  await page.route('**/api/assistant/pubkey', (r) => { ta = true; settle(); return json(r, { success: true, pubkey: OWNER_TA }); });
  await page.route('**/api/publish-policy', (r) => json(r, { success: true, allowExternalPublish: policy !== 'local-only' }));
  await page.route('**/api/relays', (r) => json(r, { success: true, relays: [] }));
  await page.route('**/api/status', (r) => json(r, { success: true }));
  await page.route('**/api/user-prefs', (r) => json(r, { success: true, preferences: {} }));
  await page.route('**/api/grapevine/preferences', (r) => json(r, { success: true, preferences: {} }));
  await page.route('**/api/setup/status**', (r) => json(r, session
    ? { success: true, signedIn: true, steps: { account: { done: true }, follow: { done: true }, activate: { done: true } } }
    : { success: true, signedIn: false }));
  await page.route('**/api/assistant/attention**', (r) => json(r, session ? { success: true, signedIn: true, hasAssistant: false, actions: {} } : { success: true, signedIn: false }));
  await page.route('**/api/assistant/roster', (r) => json(r, { success: true, assistants: [], viewer: null }));
  await page.route('**/api/profiles**', (r) => json(r, { success: true, profiles: {} }));
  await page.route('**/api/dlists/item-counts', (r) => json(r, { success: true, counts: {}, totalItems: 0 }));
  await page.route('**/api/neo4j/event-uuids', (r) => json(r, { success: true, uuids: [] }));
  await page.route('**/api/shared-concepts/**', (r) => json(r, { success: true, rows: [] }));
  // story 4: the Wire pick-list reads the community relay through the server.
  await page.route('**/api/relay/external**', async (r) => {
    state.communityReads++;
    if (communityHold) await communityHold;
    return json(r, { success: true, events: COMMUNITY_CONCEPTS });
  });
  await page.route('**/api/strfry/scan**', async (r) => {
    let filter = {};
    try { filter = JSON.parse(new URL(r.request().url()).searchParams.get('filter') || '{}'); } catch { /* not JSON */ }
    const kinds = Array.isArray(filter.kinds) ? filter.kinds : [];
    if (!(kinds.includes(39998) || kinds.includes(9998))) return json(r, { success: true, events: [] });
    state.scans++;
    await config;
    return json(r, { success: true, events: state.headers });
  });
  await page.route('**/api/auth/status', (r) => json(r, session ? { authenticated: true, pubkey: session.pubkey } : { authenticated: false, pubkey: null }));
  await page.route('**/api/auth/user-classification', (r) => json(r, {
    success: true,
    classification: session ? session.classification : 'unauthenticated',
    pubkey: session ? session.pubkey : null,
    assistantPubkey: session ? session.assistantPubkey : null,
  }));
  await page.route('**/api/auth/logout', (r) => { session = null; return json(r, { success: true }); });
  await page.route('**/api/auth/verify-user', (r) => json(r, { authorized: true, challenge: 'list-headers-test-challenge' }));
  await page.route('**/api/auth/login-user', (r) => { session = signedInAs; return json(r, { success: true }); });

  // The stand-in server: story 3's rules over the held headers, signed "by" the session's own Assistant.
  await page.route(/\/api\/list-headers\/my-assistant\/([^/]+)\/(self-declare|b-defer|b-append)$/, (r) => {
    const m = new URL(r.request().url()).pathname.match(/\/api\/list-headers\/my-assistant\/([^/]+)\/(self-declare|b-defer|b-append)$/);
    const handle = decodeURIComponent(m[1]);
    const action = m[2];
    let body = {};
    try { body = r.request().postDataJSON() || {}; } catch { /* no body */ }
    state.posts.push(action === 'b-append' ? { method: r.request().method(), handle, action, target: body.target } : { method: r.request().method(), handle, action });
    if (refuse) return json(r, { success: false, error: refuse.error }, refuse.status);
    const i = state.headers.findIndex((e) => e.kind === 39998 && `39998:${e.pubkey}:${e.tags.find((t) => t[0] === 'd')[1]}` === handle);
    if (i < 0) return json(r, { success: false, error: 'not found' }, 404);
    const cur = state.headers[i];
    const c = standInRules(cur, handle, action, body);
    if (c.answer) return json(r, c.answer.body, c.answer.status);
    const { tags } = c;
    const signed = { ...cur, tags, created_at: cur.created_at + 1, id: `${'5'.repeat(60)}${String(state.posts.length).padStart(4, '0')}` };
    state.headers[i] = signed;
    return json(r, { success: true, result: { 'self-declare': 'declared', 'b-defer': 'deferred', 'b-append': 'wired' }[action], event: signed });
  });
  // story 5 (ADR 0005): the Me routes. prepare answers the template (or "already"); commit takes back only the
  // account's signature of exactly that change. The real checks are the Node suite's; this stand-in keeps the page honest.
  await page.route(/\/api\/list-headers\/me\/([^/]+)\/(self-declare|b-defer|b-append)\/(prepare|commit)$/, (r) => {
    const m = new URL(r.request().url()).pathname.match(/\/api\/list-headers\/me\/([^/]+)\/(self-declare|b-defer|b-append)\/(prepare|commit)$/);
    const handle = decodeURIComponent(m[1]);
    const [action, phase] = [m[2], m[3]];
    let body = {};
    try { body = r.request().postDataJSON() || {}; } catch { /* no body */ }
    state.mePosts.push(action === 'b-append' ? { handle, action, phase, target: body.target } : { handle, action, phase });
    if (phase === 'commit') state.commits.push(body.event);
    if (refuse) return json(r, { success: false, error: refuse.error }, refuse.status);
    if (phase === 'commit' && refuseCommit) return json(r, { success: false, error: refuseCommit.error }, refuseCommit.status);
    if (!session) return json(r, { success: false, error: 'authentication required' }, 401);
    if (handle.split(':')[1] !== session.pubkey) return json(r, { success: false, error: 'You can only disposition headers you wrote' }, 403);
    const i = state.headers.findIndex((e) => e.kind === 39998 && `39998:${e.pubkey}:${e.tags.find((t) => t[0] === 'd')[1]}` === handle);
    if (i < 0) return json(r, { success: false, error: 'not found' }, 404);
    const cur = state.headers[i];
    const c = standInRules(cur, handle, action, body);
    const changed = "The signed version isn't exactly this action's change to the current header, so nothing was saved";
    if (c.answer) return phase === 'commit' && c.answer.status === 200 ? json(r, { success: false, error: changed }, 409) : json(r, c.answer.body, c.answer.status);
    if (phase === 'prepare') {
      return json(r, { success: true, result: 'sign', template: { kind: 39998, content: cur.content, tags: c.tags, created_at: cur.created_at + 1, pubkey: session.pubkey } });
    }
    const ev = body.event;
    if (!ev || typeof ev !== 'object' || ev.pubkey !== session.pubkey) {
      return json(r, { success: false, error: "That version wasn't signed by the account you're signed in with, so nothing was saved" }, 403);
    }
    if (ev.kind !== 39998 || ev.content !== cur.content || JSON.stringify(ev.tags) !== JSON.stringify(c.tags)) return json(r, { success: false, error: changed }, 409);
    state.headers[i] = ev;
    return json(r, { success: true, result: { 'self-declare': 'declared', 'b-defer': 'deferred', 'b-append': 'wired' }[action], event: ev });
  });
  return state;
}

/**
 * Stories 3–5's rules, for both stand-ins: { answer: { status, body } } for a refusal or an "already", or { tags } for the
 * new version.
 */
function standInRules(cur, handle, action, body) {
  const answer = (b, status = 200) => ({ answer: { status, body: b } });
  const bs = cur.tags.filter((t) => t[0] === 'b').map((t) => t[1]);
  const real = bs.some((v) => v !== SENTINEL);
  if (action === 'b-append') {
    if (typeof body.target !== 'string') return answer({ success: false, error: "The target must be a list header's address (39998:pubkey:d-tag)" }, 400);
    const target = body.target.trim();
    if (/[\p{Cc}\p{Cf}]/u.test(target)) return answer({ success: false, error: "The target contains characters an address can't have" }, 400);
    if (Buffer.byteLength(target, 'utf8') > 1024) return answer({ success: false, error: 'The target is too long — the relay keeps tag values of at most 1024 bytes' }, 400);
    if (!/^39998:[0-9a-f]{64}:.+$/.test(target)) return answer({ success: false, error: "The target must be a list header's address (39998:pubkey:d-tag)" }, 400);
    if (target === handle) return answer({ success: false, error: "That's this header's own address — use Submit as a Shared Concept instead" }, 400);
    if (bs.includes(target)) return answer({ success: true, result: 'already-wired', event: cur });
    return { tags: [...cur.tags.filter((t) => !(t[0] === 'b' && t[1] === SENTINEL)), ['b', target, 'pointer']] };
  }
  if (action === 'self-declare') {
    if (bs.includes(handle)) return answer({ success: true, result: 'already-declared', event: cur });
    return { tags: [...cur.tags.filter((t) => !(t[0] === 'b' && t[1] === SENTINEL)), ['b', handle, 'pointer']] };
  }
  if (real) return answer({ success: false, error: 'this header already carries a real b — deferral applies only to unaffiliated headers' });
  if (bs.includes(SENTINEL)) return answer({ success: true, result: 'already-deferred', event: cur });
  return { tags: [...cur.tags, ['b', SENTINEL]] };
}

/**
 * story 5: the browser signer (NIP-07), stubbed. mode 'ok' signs as `pubkey`; 'decline' rejects like a person saying
 * no; 'other' is on another account; 'liar' says `pubkey` but signs as another account; 'none' is no signer at all.
 * Review round 1 (Amendment 1 §4): 'pk-decline' rejects at the account step (getPublicKey) with an Error;
 * 'pk-undefined' rejects there with no error object at all.
 * Every signEvent call is logged in window.__signLog, so a test counts prompts instead of inferring them.
 */
const OTHER_ACCOUNT = 'd4'.repeat(32);
async function stubSigner(page, mode, pubkey) {
  await page.addInitScript(({ mode, pubkey, other }) => {
    window.__signLog = [];
    if (mode === 'none') { try { delete window.nostr; } catch { /* not there */ } return; }
    window.nostr = {
      getPublicKey: async () => {
        if (mode === 'pk-decline') throw new Error('User rejected');
        if (mode === 'pk-undefined') return Promise.reject(undefined); // eslint-disable-line prefer-promise-reject-errors
        return mode === 'other' ? other : pubkey;
      },
      signEvent: async (template) => {
        window.__signLog.push(template);
        if (mode === 'decline') throw new Error('User rejected the request');
        const n = window.__signLog.length;
        return { ...template, pubkey: mode === 'liar' ? other : pubkey, id: String(n).padStart(64, 'e'), sig: 'b'.repeat(128) };
      },
    };
  }, { mode, pubkey, other: OTHER_ACCOUNT });
}
const signLog = (page) => page.evaluate(() => window.__signLog || []);

const PAGE = '/tapestry/lists';

async function open(page, opts = {}) {
  const state = await mockStack(page, opts);
  await page.goto(PAGE);
  await expect(page.getByRole('heading', { name: /Simple Lists \(DLists\)/ })).toBeVisible();
  await expect(page.getByText(/^\d+ (of \d+ )?lists$/)).toHaveText(`${state.headers.length} lists`);
  if (opts.session) await expect(page.locator('.header-user .user-button')).toBeVisible();
  return state;
}

const rowOf = (page, name) => page.locator('table.data-table tbody tr').filter({ has: page.locator('td:first-child', { hasText: new RegExp(`^${name}$`) }) });
async function compassCell(page, name) {
  const heads = (await page.locator('table.data-table thead th').allTextContents()).map((s) => s.trim());
  const i = heads.findIndex((t) => t.startsWith('🧭'));
  expect(i, 'the 🧭 column exists (story 2)').toBeGreaterThanOrEqual(0);
  return rowOf(page, name).locator('td').nth(i);
}
const marks = async (page, name) => (await (await compassCell(page, name)).locator('span[title]').allTextContents()).map((s) => s.trim()).filter(Boolean);
const dispositionButton = async (page, name) => (await compassCell(page, name)).getByRole('button', { name: /Disposition/ });

async function openPanel(page, name) {
  const button = await dispositionButton(page, name);
  await expect(button, `story AC 1: "${name}" has a Disposition… button`).toHaveCount(1);
  await button.click();
  await expect(page.getByText(new RegExp(`Disposition: ${name}`)), `the panel opens for "${name}"`).toBeVisible();
}
const fixtureNames = fixtures().map(nameOf);

test.describe('List Headers — Disposition on My Assistant rows (list-headers-disposition #3)', () => {
  test('M1 (AC 1; story 5 AC 1): Disposition… on every 39998 row the viewer\'s own Assistant or own account wrote, and nowhere else', async ({ browser }) => {
    // Story 5 AC 1: the account's own kind-39998 rows (Me rows) carry the button too, whatever their state; its 9998 rows don't.
    const OWNER_ME = ['owner own list', 'owner own b', 'owner own self', 'owner own wired', 'owner own private'];
    const expectations = [
      ['the Owner', OWNER_SESSION, ['ta undecided a', 'ta wired', 'ta self', 'ta private', 'ta undecided b', ...OWNER_ME]],
      ['a customer', CUSTOMER, ['viewer ta undecided', 'viewer own list']],
      ['a guest with no Assistant here', GUEST, ['guest own list']],
      ['a signed-out visitor', null, []],
    ];
    for (const [who, session, own] of expectations) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await open(page, { session });
      for (const name of fixtureNames) {
        await expect(await dispositionButton(page, name), `story AC 1: for ${who}, "${name}" ${own.includes(name) ? 'has' : 'has no'} Disposition… button`)
          .toHaveCount(own.includes(name) ? 1 : 0);
      }
      await ctx.close();
    }
  });

  test('M2 (AC 1): the button opens the panel and not the list; the rest of the row still opens the list', async ({ page }) => {
    await open(page, { session: OWNER_SESSION });
    await openPanel(page, 'ta undecided a');
    await expect(page, 'story AC 1: clicking Disposition… does not open the list').toHaveURL(/\/tapestry\/lists$/);
    await rowOf(page, 'ta undecided a').locator('td').first().click();
    await expect(page, 'story AC 1: the rest of the row still opens the list').toHaveURL(new RegExp(`/tapestry/lists/${encodeURIComponent(addr(OWNER_TA, 'ta undecided a'))}$`));
  });

  test('M3 (AC 2, AC 5): Submit on an undecided row — the self-declare call, one EVENT carrying the self-pointing b, "published", 🤝 without a reload', async ({ page }) => {
    const state = await open(page, { session: OWNER_SESSION });
    const scansBefore = state.scans;
    await openPanel(page, 'ta undecided a');
    await page.getByRole('button', { name: /Submit as a Shared Concept/ }).click();
    await expect(page.getByText('Submitted as a shared concept — published to the community relay.'), 'story AC 5: "published"').toBeVisible();
    expect(state.posts, 'story AC 2: one self-declare call for this header').toEqual([{ method: 'POST', handle: addr(OWNER_TA, 'ta undecided a'), action: 'self-declare' }]);
    const sent = state.events.filter((e) => e.url.startsWith(COMMUNITY));
    expect(sent.length, 'story AC 2: the new version is sent to the community relay once').toBe(1);
    expect(sent[0].event.tags, 'story AC 2: what is sent carries the self-pointing b').toContainEqual(['b', addr(OWNER_TA, 'ta undecided a'), 'pointer']);
    await expect.poll(() => marks(page, 'ta undecided a'), { message: 'story AC 2: the row shows 🤝 without a reload' }).toEqual(['🤝']);
    expect(state.scans, 'story AC 2: no reload — the rows were not read again').toBe(scansBefore);
  });

  test('M4 (AC 2): Submit on a wired row shows 🔗 🤝; on a kept-private row it shows 🤝 alone', async ({ page }) => {
    await open(page, { session: OWNER_SESSION });
    await openPanel(page, 'ta wired');
    await page.getByRole('button', { name: /Submit as a Shared Concept/ }).click();
    await expect.poll(() => marks(page, 'ta wired'), { message: 'story AC 2: wired + submitted' }).toEqual(['🔗', '🤝']);
    await page.getByRole('button', { name: 'Done' }).click();
    await openPanel(page, 'ta private');
    await page.getByRole('button', { name: /Submit as a Shared Concept/ }).click();
    await expect.poll(() => marks(page, 'ta private'), { message: 'story AC 2: the marker is dropped' }).toEqual(['🤝']);
  });

  test('M5 (AC 2): Submit on an already self-declared row re-sends the existing event and says so', async ({ page }) => {
    const state = await open(page, { session: OWNER_SESSION });
    const existing = state.headers.find((e) => nameOf(e) === 'ta self');
    await openPanel(page, 'ta self');
    await page.getByRole('button', { name: /Submit as a Shared Concept/ }).click();
    await expect(page.getByText('Already shared — re-broadcast to the community relay.'), 'story AC 2: "already shared"').toBeVisible();
    const sent = state.events.filter((e) => e.url.startsWith(COMMUNITY));
    expect(sent.map((e) => e.event.id), 'story AC 2: the EXISTING version is re-sent, nothing new').toEqual([existing.id]);
  });

  test('M6 (AC 3): Keep private on an undecided row — the b-defer call, nothing sent to any relay, 🔒 in the row', async ({ page }) => {
    const state = await open(page, { session: OWNER_SESSION });
    await openPanel(page, 'ta undecided b');
    await page.getByRole('button', { name: /Keep private/ }).click();
    await expect(page.getByText(/^Kept private/), 'story AC 3: the panel confirms').toBeVisible();
    expect(state.posts.map((p) => p.action), 'story AC 3: one b-defer call').toEqual(['b-defer']);
    await expect.poll(() => marks(page, 'ta undecided b'), { message: 'story AC 3: the row shows 🔒' }).toEqual(['🔒']);
    await page.waitForTimeout(300);
    expect(state.events, 'story AC 3 / AC 5: Keep private never sends anything to a relay').toEqual([]);
  });

  test('M7 (AC 3): Keep private can\'t be chosen beside a real b-tag, with the reason; on a private row it says it already is', async ({ page }) => {
    await open(page, { session: OWNER_SESSION });
    for (const name of ['ta wired', 'ta self']) {
      await openPanel(page, name);
      const keep = page.getByRole('button', { name: /Keep private/ });
      await expect(keep, `story AC 3: Keep private is disabled on "${name}"`).toBeDisabled();
      await expect(keep, `story AC 3: and says why on "${name}"`).toHaveAttribute('title', /already carries a real b/);
      await page.getByRole('button', { name: /✕|Close/ }).first().click();
    }
    await openPanel(page, 'ta private');
    await page.getByRole('button', { name: /Keep private/ }).click();
    await expect(page.getByText('Already kept private — nothing new was signed.'), 'story AC 3: already private').toBeVisible();
    await expect.poll(() => marks(page, 'ta private')).toEqual(['🔒']);
  });

  test('M8 (AC 4): a refusal from the server shows in the panel, and the row is unchanged', async ({ page }) => {
    const state = await open(page, { session: OWNER_SESSION, refuse: { status: 403, error: 'You can only disposition headers your own Assistant wrote' } });
    await openPanel(page, 'ta undecided a');
    await page.getByRole('button', { name: /Submit as a Shared Concept/ }).click();
    await expect(page.getByText('You can only disposition headers your own Assistant wrote'), 'story AC 4: the refusal is shown').toBeVisible();
    await expect.poll(() => marks(page, 'ta undecided a')).toEqual(['○']);
    expect(state.events, 'story AC 4: nothing is sent after a refusal').toEqual([]);
  });

  test('M9 (AC 5): "kept here" when external publishing is off (no socket at all); "didn\'t reach" when the relay rejects it — saved here either way', async ({ browser }) => {
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const state = await open(page, { session: OWNER_SESSION, policy: 'local-only' });
      await openPanel(page, 'ta undecided a');
      await page.getByRole('button', { name: /Submit as a Shared Concept/ }).click();
      await expect(page.getByText('Saved here. External publishing is off for this deployment, so it was not sent onward.'), 'story AC 5: kept here').toBeVisible();
      expect(state.sockets.filter((u) => u.startsWith(COMMUNITY)), 'story AC 5: local-only opens no socket to the community relay').toEqual([]);
      await expect.poll(() => marks(page, 'ta undecided a')).toEqual(['🤝']);
      await ctx.close();
    }
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await open(page, { session: OWNER_SESSION, relay: 'reject' });
      await openPanel(page, 'ta undecided a');
      await page.getByRole('button', { name: /Submit as a Shared Concept/ }).click();
      await expect(page.getByText("Saved here, but it didn't reach the community relay — try again."), 'story AC 5: not delivered, saved here').toBeVisible();
      await expect.poll(() => marks(page, 'ta undecided a'), { message: 'story AC 5: saved here, so the row shows the new state' }).toEqual(['🤝']);
      await ctx.close();
    }
  });

  test('M10 (AC 6): Next undecided → walks the viewer\'s own Assistant\'s undecided rows; at the end only Done', async ({ page }) => {
    await open(page, { session: OWNER_SESSION });
    await openPanel(page, 'ta undecided a');
    await page.getByRole('button', { name: /Keep private/ }).click();
    await page.getByRole('button', { name: /Next undecided/ }).click();
    await expect(page.getByText(/Disposition: ta undecided b/), 'story AC 6: Next opens the next undecided row of the viewer\'s own Assistant').toBeVisible();
    await page.getByRole('button', { name: /Keep private/ }).click();
    await expect(page.getByRole('button', { name: 'Done' }), 'story AC 6: Done is offered').toBeVisible();
    await expect(page.getByRole('button', { name: /Next undecided/ }), 'story AC 6: no undecided row left — no Next').toHaveCount(0);
  });
  test('M11 (AC 1, Amendment 1 §4): on a long list, Disposition… on the last row opens a panel inside the viewport, and Next keeps it there', async ({ page }) => {
    await open(page, { session: OWNER_SESSION, extraOwnRows: 70 });
    const last = 'ta bulk 070';
    const button = await dispositionButton(page, last);
    await button.scrollIntoViewIfNeeded();
    await button.click();
    const inView = async (name) => {
      const box = await page.getByText(new RegExp(`^Disposition: ${name}$`)).boundingBox();
      const vp = page.viewportSize();
      // Below the 48 px fixed top bar (.app-header) and above the bottom edge.
      return !!box && box.y >= 48 && box.y + box.height <= vp.height;
    };
    await expect.poll(() => inView(last), { message: `Amendment 1 §4: the panel for "${last}" is inside the viewport after the click` }).toBe(true);
    await page.getByRole('button', { name: /Keep private/ }).click();
    await page.getByRole('button', { name: /Next undecided/ }).click();
    await expect.poll(() => inView('ta undecided a'), { message: 'Amendment 1 §4: after Next, the panel for the next undecided row is inside the viewport' }).toBe(true);
  });
  // ── story 4 — Wire (ADR 0004) ──

  const wireField = (page) => page.getByPlaceholder(/kind:pubkey:d-tag/);
  const wireButton = (page) => page.getByRole('button', { name: /^Wire$/ });
  /** Put a target in the Wire field, failing with a sentence (not a fill timeout) when there is no Wire section. */
  async function fillTarget(page, value) {
    await expect(wireField(page), 'story 4 AC 1: the panel has a Wire address field').toBeVisible();
    await wireField(page).fill(value);
  }
  async function pick(page, name) {
    const button = page.getByRole('button', { name });
    await expect(button, `story 4 AC 1: the pick-list offers "${name}"`).toBeVisible();
    await button.click();
  }

  test('W1 (story 4 AC 1): the Wire section — searching, then the community\'s Shared Concepts by name with their descriptions; picking one fills the field; Wire waits for a target', async ({ page }) => {
    let release;
    const hold = new Promise((r) => { release = r; });
    await open(page, { session: OWNER_SESSION, communityHold: hold });
    await openPanel(page, 'ta undecided a');
    await expect(page.getByText(/or wire to an external shared concept/), 'story 4 AC 1: the Wire section').toBeVisible();
    await expect(page.getByText('Searching the community relay…'), 'story 4 AC 1: while the list loads').toBeVisible();
    await expect(wireButton(page), 'story 4 AC 1: Wire can\'t be clicked with an empty field').toBeDisabled();
    release();
    const pick = page.getByRole('button', { name: 'somebody elses concept' });
    await expect(pick, 'story 4 AC 1: a Shared Concept by name').toBeVisible();
    await expect(pick, 'story 4 AC 1: its description on hover').toHaveAttribute('title', 'A concept somebody else shares');
    await expect(page.getByRole('button', { name: 'another concept' })).toBeVisible();
    await expect(page.getByText('Searching the community relay…')).toHaveCount(0);
    await pick.click();
    await expect(wireField(page), 'story 4 AC 1: picking puts its address in the field').toHaveValue(THEIRS);
    await expect(wireButton(page)).toBeEnabled();
  });

  test('W2 (story 4 AC 2): Wire — the b-append call with the target, one EVENT carrying the pointer b, "Wired", 🔗 without a reload, then Next / Done', async ({ page }) => {
    const state = await open(page, { session: OWNER_SESSION });
    const scansBefore = state.scans;
    await openPanel(page, 'ta undecided a');
    await pick(page, 'somebody elses concept');
    await wireButton(page).click();
    await expect(page.getByText('Wired — broadcast to the community relay.'), 'story 4 AC 2: "published"').toBeVisible();
    expect(state.posts, 'story 4 AC 2: one b-append call, with the target').toEqual([{ method: 'POST', handle: addr(OWNER_TA, 'ta undecided a'), action: 'b-append', target: THEIRS }]);
    const sent = state.events.filter((e) => e.url.startsWith(COMMUNITY));
    expect(sent.length, 'story 4 AC 2: sent to the community relay once').toBe(1);
    expect(sent[0].event.tags).toContainEqual(['b', THEIRS, 'pointer']);
    await expect.poll(() => marks(page, 'ta undecided a'), { message: 'story 4 AC 2: the row shows 🔗 without a reload' }).toEqual(['🔗']);
    expect(state.scans).toBe(scansBefore);
    await expect(page.getByRole('button', { name: /Next undecided/ }), 'story 4 AC 2: Next, as after the other actions').toBeVisible();
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
  });

  test('W3 (story 4 AC 2): wiring a self-declared row shows 🔗 🤝; wiring a kept-private row drops the marker; a second target keeps the first', async ({ page }) => {
    const state = await open(page, { session: OWNER_SESSION });
    await openPanel(page, 'ta self');
    await fillTarget(page, THEIRS);
    await wireButton(page).click();
    await expect.poll(() => marks(page, 'ta self'), { message: 'story 4 AC 2: self-declared + wired' }).toEqual(['🔗', '🤝']);
    await page.getByRole('button', { name: 'Done' }).click();
    await openPanel(page, 'ta private');
    await fillTarget(page, THEIRS);
    await wireButton(page).click();
    await expect.poll(() => marks(page, 'ta private'), { message: 'story 4 AC 2: the marker is dropped' }).toEqual(['🔗']);
    await page.getByRole('button', { name: 'Done' }).click();
    await openPanel(page, 'ta wired');
    await fillTarget(page, ANOTHER);
    await wireButton(page).click();
    await expect(page.getByText('Wired — broadcast to the community relay.')).toBeVisible();
    const wired = state.headers.find((e) => nameOf(e) === 'ta wired');
    const bs = wired.tags.filter((t) => t[0] === 'b').map((t) => t[1]);
    expect(bs, 'story 4 AC 2: both wirings are kept').toEqual(expect.arrayContaining([THEIRS, ANOTHER]));
  });

  test('W4 (story 4 AC 3): already wired to that target — the existing event is re-sent and the panel says so', async ({ page }) => {
    const state = await open(page, { session: OWNER_SESSION });
    const existing = state.headers.find((e) => nameOf(e) === 'ta wired');
    await openPanel(page, 'ta wired');
    await fillTarget(page, THEIRS);
    await wireButton(page).click();
    await expect(page.getByText('Already wired — re-broadcast to the community relay.'), 'story 4 AC 3').toBeVisible();
    expect(state.events.filter((e) => e.url.startsWith(COMMUNITY)).map((e) => e.event.id), 'story 4 AC 3: the EXISTING version is re-sent').toEqual([existing.id]);
  });

  test('W5 (story 4 AC 4): a target that isn\'t a header address, or is the header\'s own, is refused in the panel — with no request', async ({ page }) => {
    const state = await open(page, { session: OWNER_SESSION });
    await openPanel(page, 'ta undecided a');
    await fillTarget(page, 'not an address');
    await wireButton(page).click();
    await expect(page.getByText("The target must be a list header's address (39998:pubkey:d-tag)"), 'story 4 AC 4 / Amendment 1: not a list header\'s address').toBeVisible();
    await fillTarget(page, addr(OWNER_TA, 'ta undecided a'));
    await wireButton(page).click();
    await expect(page.getByText(/own address.*Submit as a Shared Concept/), 'story 4 AC 4: its own address points to Submit').toBeVisible();
    expect(state.posts, 'ADR 0004: the panel refuses these itself — no request is sent').toEqual([]);
    await expect.poll(() => marks(page, 'ta undecided a')).toEqual(['○']);
  });

  test('W6 (story 4 AC 2): Wire when external publishing is off — saved here, not sent onward, and the panel says so', async ({ page }) => {
    const state = await open(page, { session: OWNER_SESSION, policy: 'local-only' });
    await openPanel(page, 'ta undecided a');
    await fillTarget(page, THEIRS);
    await wireButton(page).click();
    await expect(page.getByText('Wired here. External publishing is off for this deployment, so it was not sent onward.'), 'story 4 AC 2: kept here').toBeVisible();
    expect(state.sockets.filter((u) => u.startsWith(COMMUNITY)), 'local-only opens no socket to the community relay').toEqual([]);
    await expect.poll(() => marks(page, 'ta undecided a')).toEqual(['🔗']);
  });

  test('W7 (ADR 0004): Next keeps the pick-list — one community read for the whole panel session', async ({ page }) => {
    const state = await open(page, { session: OWNER_SESSION });
    await openPanel(page, 'ta undecided a');
    await expect(page.getByRole('button', { name: 'somebody elses concept' })).toBeVisible();
    await page.getByRole('button', { name: /Keep private/ }).click();
    await page.getByRole('button', { name: /Next undecided/ }).click();
    await expect(page.getByText(/Disposition: ta undecided b/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'somebody elses concept' }), 'ADR 0004: the list is still there after Next').toBeVisible();
    await expect(page.getByText('Searching the community relay…'), 'ADR 0004: no "Searching…" again after Next').toHaveCount(0);
    expect(state.communityReads, 'ADR 0004: one community read for the whole panel session').toBe(1);
  });
  test('W8 (Amendment 1): the panel refuses another kind, a target too long in bytes, and a hidden format character — each with no request', async ({ page }) => {
    const state = await open(page, { session: OWNER_SESSION });
    await openPanel(page, 'ta undecided a');
    const cases = [
      [`1:${'9'.repeat(64)}:a-note`, "The target must be a list header's address (39998:pubkey:d-tag)"],
      [`39998:${'9'.repeat(64)}:${'é'.repeat(477)}`, 'The target is too long — the relay keeps tag values of at most 1024 bytes'],
      [`39998:${'9'.repeat(64)}:some${String.fromCharCode(0x202e)}concept`, "The target contains characters an address can't have"],
    ];
    for (const [target, sentence] of cases) {
      await fillTarget(page, target);
      await wireButton(page).click();
      await expect(page.getByText(sentence), `Amendment 1: the panel says "${sentence}"`).toBeVisible();
    }
    expect(state.posts, 'Amendment 1: the panel refuses these itself — no request is sent').toEqual([]);
    await expect.poll(() => marks(page, 'ta undecided a')).toEqual(['○']);
  });

  test('W9 (Amendment 1 §4): when the relay doesn\'t keep the new version, the panel says so and the row is unchanged', async ({ page }) => {
    const state = await open(page, { session: OWNER_SESSION, refuse: { status: 502, error: "The relay didn't keep the new version, so nothing was saved" } });
    await openPanel(page, 'ta undecided a');
    await fillTarget(page, THEIRS);
    await wireButton(page).click();
    await expect(page.getByText("The relay didn't keep the new version, so nothing was saved"), 'Amendment 1 §4: the refusal is shown').toBeVisible();
    await expect.poll(() => marks(page, 'ta undecided a'), { message: 'Amendment 1 §4: the row is unchanged' }).toEqual(['○']);
    expect(state.events, 'Amendment 1 §4: nothing is sent to the community relay').toEqual([]);
  });

  // ── story 5 — Me rows: prepare, sign in the browser, commit (ADR 0005) ──

  const ME_ROW = 'owner own list';
  const steps = (state) => state.mePosts.map((p) => `${p.action}/${p.phase}`);

  test('E1 (story 5 AC 2): Submit on a Me row — prepare, ONE signature by the account, commit, one EVENT by the account, 🤝 without a reload', async ({ page }) => {
    const state = await open(page, { session: OWNER_SESSION, signer: 'ok' });
    const scansBefore = state.scans;
    await openPanel(page, ME_ROW);
    await page.getByRole('button', { name: /Submit as a Shared Concept/ }).click();
    await expect(page.getByText('Submitted as a shared concept — published to the community relay.'), 'story 5 AC 2: "published"').toBeVisible();
    expect(steps(state), 'ADR 0005: prepare, then commit').toEqual(['self-declare/prepare', 'self-declare/commit']);
    expect(state.mePosts.every((p) => p.handle === addr(OWNER, ME_ROW)), 'ADR 0005: both for this header').toBe(true);
    expect(state.posts, 'story 5: a Me row never uses the Assistant routes').toEqual([]);
    const signed = await signLog(page);
    expect(signed.length, 'story 5 AC 2: the browser signer is asked once').toBe(1);
    expect(signed[0], 'ADR 0005: what is signed is the server\'s template, by the account').toMatchObject({ kind: 39998, pubkey: OWNER });
    expect(signed[0].tags).toContainEqual(['b', addr(OWNER, ME_ROW), 'pointer']);
    expect(state.commits[0] && state.commits[0].pubkey, 'ADR 0005: the commit carries the signed version').toBe(OWNER);
    const sent = state.events.filter((e) => e.url.startsWith(COMMUNITY));
    expect(sent.length, 'story 5 AC 2: sent to the community relay once').toBe(1);
    expect(sent[0].event.pubkey, 'story 5: the account is the author of what is sent').toBe(OWNER);
    expect(sent[0].event.tags).toContainEqual(['b', addr(OWNER, ME_ROW), 'pointer']);
    await expect.poll(() => marks(page, ME_ROW), { message: 'story 5 AC 2: 🤝 without a reload' }).toEqual(['🤝']);
    expect(state.scans).toBe(scansBefore);
  });

  test('E2 (story 5 AC 2): Keep private on a Me row — one signature, nothing sent to any relay, 🔒', async ({ page }) => {
    const state = await open(page, { session: OWNER_SESSION, signer: 'ok' });
    await openPanel(page, ME_ROW);
    await page.getByRole('button', { name: /Keep private/ }).click();
    await expect(page.getByText(/^Kept private/), 'story 5 AC 2: the panel confirms').toBeVisible();
    expect(steps(state)).toEqual(['b-defer/prepare', 'b-defer/commit']);
    expect((await signLog(page)).length, 'story 5 AC 2: one signature').toBe(1);
    await expect.poll(() => marks(page, ME_ROW), { message: 'story 5 AC 2: 🔒' }).toEqual(['🔒']);
    await page.waitForTimeout(300);
    expect(state.events, 'story 5 AC 2: Keep private is never sent to a relay').toEqual([]);
  });

  test('E3 (story 5 AC 2): Wire on a Me row — prepare and commit both carry the target, one signature, one EVENT, 🔗', async ({ page }) => {
    const state = await open(page, { session: OWNER_SESSION, signer: 'ok' });
    await openPanel(page, ME_ROW);
    await pick(page, 'somebody elses concept');
    await wireButton(page).click();
    await expect(page.getByText('Wired — broadcast to the community relay.'), 'story 5 AC 2: "Wired"').toBeVisible();
    expect(state.mePosts, 'ADR 0005: the target goes with prepare and with commit').toEqual([
      { handle: addr(OWNER, ME_ROW), action: 'b-append', phase: 'prepare', target: THEIRS },
      { handle: addr(OWNER, ME_ROW), action: 'b-append', phase: 'commit', target: THEIRS },
    ]);
    const signed = await signLog(page);
    expect(signed.length, 'story 5 AC 2: one signature').toBe(1);
    expect(signed[0].tags).toContainEqual(['b', THEIRS, 'pointer']);
    const sent = state.events.filter((e) => e.url.startsWith(COMMUNITY));
    expect(sent.length).toBe(1);
    expect(sent[0].event.pubkey).toBe(OWNER);
    await expect.poll(() => marks(page, ME_ROW), { message: 'story 5 AC 2: 🔗' }).toEqual(['🔗']);
  });

  test('E4 (story 5 AC 2): already self-declared, already private, already wired — the signer is never asked and nothing is committed', async ({ page }) => {
    const state = await open(page, { session: OWNER_SESSION, signer: 'ok' });
    const existing = state.headers.find((e) => nameOf(e) === 'owner own self');
    await openPanel(page, 'owner own self');
    await page.getByRole('button', { name: /Submit as a Shared Concept/ }).click();
    await expect(page.getByText('Already shared — re-broadcast to the community relay.'), 'story 5 AC 2: already shared').toBeVisible();
    expect(state.events.filter((e) => e.url.startsWith(COMMUNITY)).map((e) => e.event.id), 'the EXISTING version is re-sent').toEqual([existing.id]);
    await page.getByRole('button', { name: /✕|Close/ }).first().click();
    await openPanel(page, 'owner own private');
    await page.getByRole('button', { name: /Keep private/ }).click();
    await expect(page.getByText('Already kept private — nothing new was signed.'), 'story 5 AC 2: already private').toBeVisible();
    await page.getByRole('button', { name: /✕|Close/ }).first().click();
    await openPanel(page, 'owner own wired');
    await fillTarget(page, THEIRS);
    await wireButton(page).click();
    await expect(page.getByText('Already wired — re-broadcast to the community relay.'), 'story 5 AC 2: already wired').toBeVisible();
    expect(steps(state), 'ADR 0005: only prepare — nothing to commit').toEqual(['self-declare/prepare', 'b-defer/prepare', 'b-append/prepare']);
    expect(await signLog(page), 'story 5 AC 2: when nothing new is needed, the signer isn\'t asked at all').toEqual([]);
  });

  test('E5 (story 5 AC 3): no signer in the browser — each action says so, commits nothing, and leaves the row as it was', async ({ page }) => {
    const state = await open(page, { session: OWNER_SESSION, signer: 'none' });
    const sentence = 'Signing your own headers needs a NIP-07 browser signer — nothing was saved';
    await openPanel(page, ME_ROW);
    await page.getByRole('button', { name: /Submit as a Shared Concept/ }).click();
    await expect(page.getByText(sentence), 'story 5 AC 3: Submit with no signer').toBeVisible();
    await expect.poll(() => steps(state)).toEqual(['self-declare/prepare']);
    await page.getByRole('button', { name: /Keep private/ }).click();
    await expect.poll(() => steps(state), { message: 'story 5 AC 3: Keep private was tried' }).toEqual(['self-declare/prepare', 'b-defer/prepare']);
    await expect(page.getByText(sentence), 'story 5 AC 3: Keep private with no signer').toBeVisible();
    await fillTarget(page, THEIRS);
    await wireButton(page).click();
    await expect.poll(() => steps(state), { message: 'story 5 AC 3: Wire was tried' }).toEqual(['self-declare/prepare', 'b-defer/prepare', 'b-append/prepare']);
    await expect(page.getByText(sentence), 'story 5 AC 3: Wire with no signer').toBeVisible();
    expect(state.events, 'story 5 AC 3: nothing sent').toEqual([]);
    await expect.poll(() => marks(page, ME_ROW), { message: 'story 5 AC 3: the row is unchanged' }).toEqual(['○']);
  });

  test('E6 (story 5 AC 3): declined in the signer — asked once, the sentence, no commit, the row unchanged', async ({ page }) => {
    const state = await open(page, { session: OWNER_SESSION, signer: 'decline' });
    await openPanel(page, ME_ROW);
    await page.getByRole('button', { name: /Submit as a Shared Concept/ }).click();
    await expect(page.getByText('Signing was cancelled in your signer — nothing was saved'), 'story 5 AC 3: declined').toBeVisible();
    expect((await signLog(page)).length, 'story 5 AC 3: the person was asked once').toBe(1);
    expect(steps(state), 'story 5 AC 3: no commit').toEqual(['self-declare/prepare']);
    expect(state.events).toEqual([]);
    await expect.poll(() => marks(page, ME_ROW)).toEqual(['○']);
  });

  test('E7 (story 5 AC 3): a signer on another account isn\'t asked to sign; one that signs as another account is never committed', async ({ browser }) => {
    for (const [mode, asked] of [['other', 0], ['liar', 1]]) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const state = await open(page, { session: OWNER_SESSION, signer: mode });
      await openPanel(page, ME_ROW);
      await page.getByRole('button', { name: /Submit as a Shared Concept/ }).click();
      await expect(page.getByText(/Your signer is on a different account/), `story 5 AC 3 (${mode}): the mismatch sentence`).toBeVisible();
      expect((await signLog(page)).length, `story 5 AC 3 (${mode}): signEvent calls`).toBe(asked);
      expect(steps(state), `story 5 AC 3 (${mode}): no commit`).toEqual(['self-declare/prepare']);
      expect(state.events, `story 5 AC 3 (${mode}): nothing sent`).toEqual([]);
      await expect.poll(() => marks(page, ME_ROW)).toEqual(['○']);
      await ctx.close();
    }
  });

  test('E8 (story 5 AC 4): a refusal at prepare never asks the signer; a refusal at commit shows, and the row is unchanged', async ({ browser }) => {
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const error = "The stored header couldn't be verified, so nothing was signed";
      const state = await open(page, { session: OWNER_SESSION, signer: 'ok', refuse: { status: 409, error } });
      await openPanel(page, ME_ROW);
      await page.getByRole('button', { name: /Submit as a Shared Concept/ }).click();
      await expect(page.getByText(error), 'story 5 AC 4: the prepare refusal is shown').toBeVisible();
      expect(await signLog(page), 'ADR 0005: a doomed request never prompts the person').toEqual([]);
      expect(steps(state)).toEqual(['self-declare/prepare']);
      await ctx.close();
    }
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const error = "The relay didn't keep the new version, so nothing was saved";
      const state = await open(page, { session: OWNER_SESSION, signer: 'ok', refuseCommit: { status: 502, error } });
      await openPanel(page, ME_ROW);
      await page.getByRole('button', { name: /Submit as a Shared Concept/ }).click();
      await expect(page.getByText(error), 'story 5 AC 4: the commit refusal is shown').toBeVisible();
      expect(steps(state)).toEqual(['self-declare/prepare', 'self-declare/commit']);
      expect(state.events, 'story 5 AC 4: nothing sent after a refused commit').toEqual([]);
      await expect.poll(() => marks(page, ME_ROW), { message: 'story 5 AC 4: the row is unchanged' }).toEqual(['○']);
      await ctx.close();
    }
  });

  test('E9 (story 5 AC 5): Next from a Me row walks only Me rows; from an Assistant row only Assistant rows, never asking the signer', async ({ browser }) => {
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await open(page, { session: OWNER_SESSION, signer: 'ok' });
      await openPanel(page, ME_ROW);
      await page.getByRole('button', { name: /Keep private/ }).click();
      await page.getByRole('button', { name: /Next undecided/ }).click();
      await expect(page.getByText(/^Disposition: owner own b$/), 'story 5 AC 5: Next opens the next undecided Me row, not an Assistant row').toBeVisible();
      await page.getByRole('button', { name: /Keep private/ }).click();
      await expect(page.getByRole('button', { name: 'Done' }), 'story 5 AC 5: only Done').toBeVisible();
      await expect(page.getByRole('button', { name: /Next undecided/ }), 'story 5 AC 5: the Assistant\'s undecided rows aren\'t offered from a Me walk').toHaveCount(0);
      expect((await signLog(page)).length, 'one signature per Me action').toBe(2);
      await ctx.close();
    }
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const state = await open(page, { session: OWNER_SESSION, signer: 'ok' });
      await openPanel(page, 'ta undecided a');
      await page.getByRole('button', { name: /Keep private/ }).click();
      await page.getByRole('button', { name: /Next undecided/ }).click();
      await expect(page.getByText(/^Disposition: ta undecided b$/), 'story 5 AC 5: from an Assistant row, Next stays on Assistant rows').toBeVisible();
      await page.getByRole('button', { name: /Keep private/ }).click();
      await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();
      await expect(page.getByRole('button', { name: /Next undecided/ }), 'story 5 AC 5: undecided Me rows aren\'t offered from an Assistant walk').toHaveCount(0);
      expect(await signLog(page), 'an Assistant walk never asks the browser signer').toEqual([]);
      expect(state.mePosts, 'an Assistant walk never uses the Me routes').toEqual([]);
      await ctx.close();
    }
  });

  test('E10 (story 5 AC 2): Submit on a Me row when external publishing is off — saved here, not sent onward, and the panel says so', async ({ page }) => {
    const state = await open(page, { session: OWNER_SESSION, signer: 'ok', policy: 'local-only' });
    await openPanel(page, ME_ROW);
    await page.getByRole('button', { name: /Submit as a Shared Concept/ }).click();
    await expect(page.getByText('Saved here. External publishing is off for this deployment, so it was not sent onward.'), 'story 5 AC 2: kept here').toBeVisible();
    expect(state.sockets.filter((u) => u.startsWith(COMMUNITY)), 'local-only opens no socket to the community relay').toEqual([]);
    expect(steps(state), 'ADR 0005: still prepare, sign, commit').toEqual(['self-declare/prepare', 'self-declare/commit']);
    expect((await signLog(page)).length, 'story 5 AC 2: one signature').toBe(1);
    await expect.poll(() => marks(page, ME_ROW)).toEqual(['🤝']);
  });

  // ── review round 1 — ADR 0005 Amendment 1 ──

  async function signOut(page) {
    await page.locator('.header-user .user-button').click();
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await expect(page.locator('.header-user'), 'signed out in the page').toHaveCount(0);
  }
  const panelHeadings = (page) => page.getByText(/^Disposition: /);

  test('E11 (Amendment 1 §1): act on a Me row, then sign out in the page — the panel is gone, there is no Next, no row has the button, and nothing throws', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const state = await open(page, { session: OWNER_SESSION, signer: 'ok' });
    await openPanel(page, ME_ROW);
    await page.getByRole('button', { name: /Keep private/ }).click();
    await expect(page.getByText(/^Kept private/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Next undecided/ }), 'signed in, Next is offered').toBeVisible();
    await signOut(page);
    await expect(panelHeadings(page), 'Amendment 1 §1: signed out, the panel is gone').toHaveCount(0);
    await expect(page.getByRole('button', { name: /Next undecided/ }), 'Amendment 1 §1: no Next can open another person\'s row').toHaveCount(0);
    await expect(page.getByRole('button', { name: /Disposition…/ }), 'story 5 AC 1: signed out, no row has the button').toHaveCount(0);
    expect(errors, 'Amendment 1 §1: nothing throws').toEqual([]);
    expect(steps(state), 'only the Keep private made before signing out').toEqual(['b-defer/prepare', 'b-defer/commit']);
    expect(state.posts).toEqual([]);
  });

  test('E12 (Amendment 1 §1): sign out with the panel open — gone with no page error; signing back in doesn\'t bring it back', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const state = await open(page, { session: OWNER_SESSION, signer: 'ok' });
    await openPanel(page, ME_ROW);
    await signOut(page);
    await expect(panelHeadings(page), 'Amendment 1 §1: signed out, the panel is gone').toHaveCount(0);
    expect(errors, 'Amendment 1 §1: nothing throws').toEqual([]);
    await page.getByRole('button', { name: 'Sign in with Nostr' }).click();
    await expect(page.locator('.header-user .user-button'), 'signed back in, in the page').toBeVisible();
    await expect(await dispositionButton(page, ME_ROW), 'signed in again, the row has its button back').toHaveCount(1);
    await page.waitForTimeout(300); // let a stale panel come back, if it is going to
    await expect(panelHeadings(page), 'Amendment 1 §1: the panel doesn\'t come back by itself at the next sign-in').toHaveCount(0);
    expect(state.mePosts, 'nothing was prepared or committed').toEqual([]);
    expect(errors).toEqual([]);
  });

  test('E13 (Amendment 1 §4): a decline at the signer\'s account step, or a rejection with no error object — the cancelled sentence, the panel not left busy, no signature, no commit', async ({ browser }) => {
    for (const mode of ['pk-decline', 'pk-undefined']) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const state = await open(page, { session: OWNER_SESSION, signer: mode });
      await openPanel(page, ME_ROW);
      await page.getByRole('button', { name: /Submit as a Shared Concept/ }).click();
      await expect(page.getByText('Signing was cancelled in your signer — nothing was saved'), `Amendment 1 §4 (${mode}): the cancelled sentence`).toBeVisible();
      await expect(page.getByRole('button', { name: /Submit as a Shared Concept/ }), `Amendment 1 §4 (${mode}): the panel isn't left busy`).toBeEnabled();
      await expect(page.getByRole('button', { name: /Keep private/ })).toBeEnabled();
      expect(await signLog(page), `Amendment 1 §4 (${mode}): the signer was never asked to sign`).toEqual([]);
      expect(steps(state), `Amendment 1 §4 (${mode}): no commit`).toEqual(['self-declare/prepare']);
      await expect.poll(() => marks(page, ME_ROW)).toEqual(['○']);
      await ctx.close();
    }
  });
});
