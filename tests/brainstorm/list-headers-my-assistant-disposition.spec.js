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
 */

const OWNER = '1'.repeat(64);
const OWNER_TA = '2'.repeat(64);
const VIEWER = 'a1'.repeat(32);
const VIEWER_TA = 'a2'.repeat(32);
const STRANGER = '9'.repeat(64);
const THEIRS = `39998:${'8'.repeat(64)}:somebody-elses-concept`;
const SENTINEL = 'b-tag-deferred';
const COMMUNITY = 'wss://dcosl.brainstorm.world';

const OWNER_SESSION = { pubkey: OWNER, assistantPubkey: OWNER_TA, classification: 'owner' };
const CUSTOMER = { pubkey: VIEWER, assistantPubkey: VIEWER_TA, classification: 'customer' };
const GUEST = { pubkey: 'c1'.repeat(32), assistantPubkey: null, classification: 'guest' };

const NOW = 1790000000;
const dOf = (name) => `d-${name.replace(/\s+/g, '-')}`;
const addr = (pubkey, name) => `39998:${pubkey}:${dOf(name)}`;

function fixtures() {
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
  ];
}
const nameOf = (ev) => ev.tags.find((t) => t[0] === 'names')[1];
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/**
 * relay: 'accept' | 'reject' | 'drop'; policy: 'open' | 'local-only'; refuse: { status, error } for both actions.
 */
async function mockStack(page, { session = null, relay = 'accept', policy = 'open', refuse = null } = {}) {
  const headers = fixtures();
  const state = { headers, posts: [], scans: 0, sockets: [], events: [] };
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
  await page.route(/\/api\/list-headers\/my-assistant\/([^/]+)\/(self-declare|b-defer)$/, (r) => {
    const m = new URL(r.request().url()).pathname.match(/\/api\/list-headers\/my-assistant\/([^/]+)\/(self-declare|b-defer)$/);
    const handle = decodeURIComponent(m[1]);
    const action = m[2];
    state.posts.push({ method: r.request().method(), handle, action });
    if (refuse) return json(r, { success: false, error: refuse.error }, refuse.status);
    const i = state.headers.findIndex((e) => e.kind === 39998 && `39998:${e.pubkey}:${e.tags.find((t) => t[0] === 'd')[1]}` === handle);
    if (i < 0) return json(r, { success: false, error: 'not found' }, 404);
    const cur = state.headers[i];
    const bs = cur.tags.filter((t) => t[0] === 'b').map((t) => t[1]);
    const real = bs.some((v) => v !== SENTINEL);
    let tags;
    if (action === 'self-declare') {
      if (bs.includes(handle)) return json(r, { success: true, result: 'already-declared', event: cur });
      tags = [...cur.tags.filter((t) => !(t[0] === 'b' && t[1] === SENTINEL)), ['b', handle, 'pointer']];
    } else {
      if (real) return json(r, { success: false, error: 'this header already carries a real b — deferral applies only to unaffiliated headers' });
      if (bs.includes(SENTINEL)) return json(r, { success: true, result: 'already-deferred', event: cur });
      tags = [...cur.tags, ['b', SENTINEL]];
    }
    const signed = { ...cur, tags, created_at: cur.created_at + 1, id: `${'5'.repeat(60)}${String(state.posts.length).padStart(4, '0')}` };
    state.headers[i] = signed;
    return json(r, { success: true, result: action === 'self-declare' ? 'declared' : 'deferred', event: signed });
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
});
