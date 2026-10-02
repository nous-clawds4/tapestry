const { test, expect } = require('@playwright/test');

/**
 * list-headers-disposition #3 — Disposition on My Assistant rows: what a signed-in person SEES and DOES on
 * /tapestry/lists.
 *
 * Story: engineering-team/stories/list-headers-disposition/3-disposition-on-my-assistant-rows.md
 * ADR:   engineering-team/decisions/list-headers-disposition/0003-my-assistant-disposition-endpoints-and-panel.md
 * Plan:  engineering-team/stories/list-headers-disposition/3-disposition-on-my-assistant-rows.test-plan.md
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
    // M11: a real-sized list of the viewer's own Assistant's undecided rows (the Owner has 183 on the Mac Studio).
    ...Array.from({ length: extraOwnRows }, (_, i) => h(`ta bulk ${String(i + 1).padStart(3, '0')}`)),
  ];
}
const nameOf = (ev) => ev.tags.find((t) => t[0] === 'names')[1];
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/**
 * relay: 'accept' | 'reject' | 'drop'; policy: 'open' | 'local-only'; refuse: { status, error } for both actions.
 */
async function mockStack(page, { session = null, relay = 'accept', policy = 'open', refuse = null, extraOwnRows = 0, communityHold = null } = {}) {
  const headers = fixtures(extraOwnRows);
  const state = { headers, posts: [], scans: 0, sockets: [], events: [], communityReads: 0 };
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
    const bs = cur.tags.filter((t) => t[0] === 'b').map((t) => t[1]);
    const real = bs.some((v) => v !== SENTINEL);
    let tags;
    if (action === 'b-append') {
      if (typeof body.target !== 'string') return json(r, { success: false, error: "The target must be a list header's address (39998:pubkey:d-tag)" }, 400);
      const target = body.target.trim();
      if (/[\p{Cc}\p{Cf}]/u.test(target)) return json(r, { success: false, error: "The target contains characters an address can't have" }, 400);
      if (Buffer.byteLength(target, 'utf8') > 1024) return json(r, { success: false, error: 'The target is too long — the relay keeps tag values of at most 1024 bytes' }, 400);
      if (!/^39998:[0-9a-f]{64}:.+$/.test(target)) return json(r, { success: false, error: "The target must be a list header's address (39998:pubkey:d-tag)" }, 400);
      if (target === handle) return json(r, { success: false, error: "That's this header's own address — use Submit as a Shared Concept instead" }, 400);
      if (bs.includes(target)) return json(r, { success: true, result: 'already-wired', event: cur });
      tags = [...cur.tags.filter((t) => !(t[0] === 'b' && t[1] === SENTINEL)), ['b', target, 'pointer']];
    } else if (action === 'self-declare') {
      if (bs.includes(handle)) return json(r, { success: true, result: 'already-declared', event: cur });
      tags = [...cur.tags.filter((t) => !(t[0] === 'b' && t[1] === SENTINEL)), ['b', handle, 'pointer']];
    } else {
      if (real) return json(r, { success: false, error: 'this header already carries a real b — deferral applies only to unaffiliated headers' });
      if (bs.includes(SENTINEL)) return json(r, { success: true, result: 'already-deferred', event: cur });
      tags = [...cur.tags, ['b', SENTINEL]];
    }
    const signed = { ...cur, tags, created_at: cur.created_at + 1, id: `${'5'.repeat(60)}${String(state.posts.length).padStart(4, '0')}` };
    state.headers[i] = signed;
    return json(r, { success: true, result: { 'self-declare': 'declared', 'b-defer': 'deferred', 'b-append': 'wired' }[action], event: signed });
  });
  return state;
}

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
  test('M1 (AC 1): Disposition… on every row the viewer\'s own Assistant wrote, and nowhere else', async ({ browser }) => {
    const expectations = [
      ['the Owner', OWNER_SESSION, ['ta undecided a', 'ta wired', 'ta self', 'ta private', 'ta undecided b']],
      ['a customer', CUSTOMER, ['viewer ta undecided']],
      ['a guest with no Assistant here', GUEST, []],
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
});
