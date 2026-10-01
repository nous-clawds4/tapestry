const { test, expect } = require('@playwright/test');
const { nip19 } = require('nostr-tools');
const { REQUIRED_TAGGINGS } = require('../../src/lib/identification-tags');

/**
 * my-assistants #2 — tag, re-tag and untag your Assistants from /assistants: what a viewer does and sees.
 *
 * Story: engineering-team/stories/my-assistants/2-tag-and-untag-from-the-page.md
 * ADR:   engineering-team/decisions/my-assistants/0002-tag-and-withdraw-from-the-browser-the-read-carries-what-they-need.md
 * Plan:  engineering-team/stories/my-assistants/2-tag-and-untag-from-the-page.test-plan.md
 * Node half: test/my-assistants-actions.test.js (the read's new fields, the pure planning, the orchestration).
 *
 * SAFETY — nothing here may reach a relay (ADR 0002 § Consequences). Every test:
 *   - mocks /api/publish-policy as { allowExternalPublish: false } (the gate fails OPEN when unanswered);
 *   - routes every WebSocket to a handler that closes it and counts it, and the count must end at 0;
 *   - mocks /api/strfry/publish, recording each signed event it is given.
 * window.nostr is a stub (addInitScript) whose signatures are fake: nothing it signs is valid anywhere.
 *
 *   C1 — search: under 2 characters nothing; matches offered with a count; listed profiles left out; no match line.
 *   C2 — a pasted npub (and a hex key) offers that exact profile first, even when search does not find it.
 *   C3 — Tag from search: the signed tagging's shape, the result line, the refreshed list, the count, the search.
 *   C4 — rows open: click, Enter, Space; one at a time; aria-expanded; the untagged Local row opens too, with no
 *        Change or Remove (re-aimed by my-assistants #3).
 *   C5 — Change: the apply then the withdrawal (their shapes and order); the row ends with the other chip; a row
 *        with both tags offers no Change.
 *   C6 — Remove: one withdrawal naming every id and address; the row leaves; a tagged Local row stays, Not tagged.
 *   C7 — the Brainstorm tag unpublished: its buttons disabled with the reason; Tapestry still works.
 *   C8 — while one press publishes: the pressed button says so, every action button is disabled, nothing doubles.
 *   C9 — no extension; the wrong key in it: nothing signed or posted, and the page says why.
 *   C10 — no relay took it: an error line, the list unchanged, the button usable again.
 *   C11 — a half-done change: both lines said; the list shows what the relays now say (both chips).
 *   C12 — the refresh keeps the rows on screen: no loading line while the re-read is held.
 *
 * Added for ADR 0002 Amendment 1 (review 1):
 *   C9 — also for Remove and Change: no extension, the wrong key → nothing signed or posted (blocking 2).
 *   C13 — a withdrawal's report lists the community relay (wss://dcosl.brainstorm.world); an apply's does not.
 *   C14 — a failed re-read after a press: the rows are kept, the report shows, and the refresh note says so.
 *   C15 — Searching… until the search answers; a changed query never shows the previous query's results.
 *   C16 — the result area is always there (role="status"), and focus moves to it after a press.
 *   C17 — a row removed while open comes back closed when it is tagged again.
 */
const COMMUNITY = 'wss://dcosl.brainstorm.world';

const VIEWER = 'a1'.repeat(32);
const LOCAL = 'a2'.repeat(32);
const A = 'c1'.repeat(32);
const B = 'c2'.repeat(32);
const X = 'd1'.repeat(32);
const Y = 'd2'.repeat(32);
const OTHER = 'b9'.repeat(32);
const NOUS = REQUIRED_TAGGINGS.find((e) => e.key === 'my-tapestry-assistant').author;
const BR = { key: 'brainstorm', name: 'My Brainstorm Assistant', slug: 'my-brainstorm-assistant' };
const TP = { key: 'tapestry', name: 'My Tapestry Assistant', slug: 'my-tapestry-assistant' };
const DEF = {
  brainstorm: { address: `39999:${NOUS}:${BR.slug}`, found: true, eventId: 'b0'.repeat(32) },
  tapestry: { address: `39999:${NOUS}:${TP.slug}`, found: true, eventId: 'e0'.repeat(32) },
};
const CUSTOMER = { pubkey: VIEWER, assistantPubkey: LOCAL, classification: 'customer' };
const APOS = '[\'’]';
const re = (s) => new RegExp(s.replace(/'/g, APOS));
const npubShort = (pk) => { const n = nip19.npubEncode(pk); return `${n.slice(0, 12)}…${n.slice(-6)}`; };
const dOf = (slug, target) => `profile-tag-${slug}-${target.slice(0, 8)}-${VIEWER.slice(0, 8)}`;
const addrOf = (slug, target) => `39999:${VIEWER}:${dOf(slug, target)}`;
const tag = (t) => ({ key: t.key, name: t.name });
const retractFor = (target, keys, idSeed) => Object.fromEntries(keys.map((k, i) => {
  const t = k === 'brainstorm' ? BR : TP;
  return [k, { ids: [`${idSeed}${i}`.padEnd(64, '0')], addresses: [addrOf(t.slug, target)] }];
}));
const rowOf = (pubkey, keys, { local = false, idSeed = 'f' } = {}) => ({
  pubkey, local, tags: keys.map((k) => tag(k === 'brainstorm' ? BR : TP)), retract: retractFor(pubkey, keys, idSeed),
});
const answerOf = (rows, definitions = DEF) => ({ body: { success: true, signedIn: true, local: LOCAL, rows, definitions } });
const PROFILES = {
  [LOCAL]: { display_name: 'Zed Local' },
  [A]: { name: 'Ava' },
  [B]: { display_name: 'Bea' },
  [X]: { display_name: 'Xavi', nip05: 'xavi@ex.example', website: 'https://x.example' },
  [Y]: { display_name: 'Yara the Unranked' },
};
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
function deferred() { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; }

/**
 * signer: 'viewer' (default) | 'none' | 'other'; holdSign: true → signEvent waits for window.__releaseSign().
 * answers: the read's answers in order (the last repeats); each { body, status, hold }.
 * publish: (event, n) → the /api/strfry/publish answer for the n-th post (default success).
 * search: { [query]: hits }.
 */
async function setup(page, { session = CUSTOMER, signer = 'viewer', holdSign = false, answers, publish, search = {}, searchHold = {} } = {}) {
  const state = { reads: 0, posted: [], ws: 0, requests: [] };
  await page.routeWebSocket(/.*/, (ws) => { state.ws++; ws.close(); });
  await page.addInitScript(({ signer, holdSign, viewer, other }) => {
    window.__signed = [];
    if (signer === 'none') { try { delete window.nostr; } catch {} return; }
    let release = null;
    window.__releaseSign = () => { if (release) release(); };
    window.nostr = {
      getPublicKey: async () => (signer === 'other' ? other : viewer),
      signEvent: async (unsigned) => {
        if (holdSign) await new Promise((r) => { release = r; });
        const n = window.__signed.length;
        const signed = { ...unsigned, pubkey: unsigned.pubkey || viewer, id: n.toString(16).padStart(64, '7'), sig: 'f'.repeat(128) };
        window.__signed.push(signed);
        return signed;
      },
    };
  }, { signer, holdSign, viewer: VIEWER, other: OTHER });

  page.on('request', (req) => { const u = new URL(req.url()); if (u.pathname.startsWith('/api/')) state.requests.push(`${req.method()} ${u.pathname}`); });
  await page.route('**/api/publish-policy', (r) => json(r, { success: true, allowExternalPublish: false }));
  // The Treasure Map reads (my-assistants #3): none published, so these tests stay hermetic.
  await page.route('**/api/strfry/scan**', (r) => json(r, { success: true, events: [] }));
  await page.route('**/api/neo4j/query', (r) => json(r, { success: true, data: [{ name: 'relay one', json: JSON.stringify({ nostrRelay: { websocketUrl: 'wss://one.example' } }) }] }));
  // NIP-05 checks (my-assistants #4): answered "unchecked", so no lookup leaves the test.
  await page.route('**/api/nip05/verify**', (r) => json(r, { verified: false, status: 'unchecked' }));
  await page.route('**/api/relay/external**', (r) => json(r, { success: true, events: [] }));
  await page.route('**/api/strfry/publish', async (r) => {
    const body = JSON.parse(r.request().postData() || '{}');
    state.posted.push(body.event);
    const out = publish ? publish(body.event, state.posted.length) : { success: true };
    return json(r, out);
  });
  await page.route('**/api/assistant/pubkey', (r) => json(r, { success: true, pubkey: '2'.repeat(64) }));
  await page.route('**/api/owner/pubkey', (r) => json(r, { success: true, pubkey: '1'.repeat(64) }));
  await page.route('**/api/relays', (r) => json(r, { success: true, relays: [] }));
  await page.route('**/api/status', (r) => json(r, { success: true }));
  await page.route('**/api/user-prefs', (r) => json(r, { success: true, preferences: {} }));
  await page.route('**/api/grapevine/preferences', (r) => json(r, { success: true, preferences: {} }));
  await page.route('**/api/setup/status**', (r) => json(r, { success: true, signedIn: true, steps: { account: { done: true }, follow: { done: true }, activate: { done: true } } }));
  await page.route('**/api/assistant/attention**', (r) => json(r, { success: true, signedIn: true, hasAssistant: false, actions: {} }));
  await page.route('**/api/assistant/roster', (r) => json(r, { success: true, assistants: [], viewer: null }));
  await page.route('**/api/auth/status', (r) => json(r, session ? { authenticated: true, pubkey: session.pubkey } : { authenticated: false, pubkey: null }));
  await page.route('**/api/auth/user-classification', (r) => json(r, {
    success: true, classification: session ? session.classification : 'unauthenticated',
    pubkey: session ? session.pubkey : null, assistantPubkey: session ? session.assistantPubkey : null,
  }));
  await page.route('**/api/profiles**', (r) => {
    const keys = (new URL(r.request().url()).searchParams.get('pubkeys') || '').split(',').filter(Boolean);
    const out = {};
    for (const k of keys) if (Object.prototype.hasOwnProperty.call(PROFILES, k)) out[k] = PROFILES[k];
    return json(r, { success: true, profiles: out });
  });
  await page.route('**/api/search/profiles/meili**', async (r) => {
    const q = new URL(r.request().url()).searchParams.get('q') || '';
    if (searchHold[q]) await searchHold[q];
    const hits = search[q] || [];
    return json(r, { success: true, hits });
  });
  await page.route('**/api/assistant/my-assistants**', async (r) => {
    const list = answers || [answerOf([])];
    const a = list[Math.min(state.reads, list.length - 1)];
    state.reads++;
    if (a.hold) await a.hold;
    return json(r, a.body, a.status || 200);
  });
  return state;
}

const PAGE = '/assistants';
const main = (page) => page.locator('main');
const list = (page) => page.getByRole('list', { name: 'Your Assistants' });
const items = (page) => list(page).locator(':scope > li, :scope > [role="listitem"]');
const rowNamed = (page, name) => items(page).filter({ has: page.getByText(name, { exact: true }) });
const searchBox = (page) => page.getByPlaceholder('Search by name, NIP-05, URL or npub');
const results = (page) => page.getByRole('list', { name: 'Profiles you can tag' }).locator(':scope > li, :scope > [role="listitem"]');
const toggle = (row) => row.locator('[aria-expanded]').first();
const signed = (page) => page.evaluate(() => window.__signed);
const tagValues = (ev, name) => ev.tags.filter((t) => t[0] === name).map((t) => t[1]);
async function settled(page, n) { await expect(items(page)).toHaveCount(n); }
async function noSockets(state) { expect(state.ws, 'no WebSocket may be opened (nothing reaches a relay)').toBe(0); }

test.describe('/assistants — tagging actions', () => {
  test('C1: search — under 2 characters nothing; matches with a count; listed profiles left out; a no-match line', async ({ page }) => {
    const state = await setup(page, {
      answers: [answerOf([rowOf(A, ['tapestry'])])],
      search: {
        a: [{ pubkey: X, display_name: 'Xavi' }], // a 1-character search would find Xavi: none may be asked for
        av: [{ pubkey: A, name: 'Ava' }, { pubkey: X, display_name: 'Xavi', nip05: 'xavi@ex.example', website: 'https://x.example' }],
        zz: [],
      },
    });
    await page.goto(PAGE);
    await settled(page, 1);
    await expect(main(page).getByText('Find a profile to tag as an Assistant', { exact: true })).toBeVisible();
    await searchBox(page).fill('a');
    await page.waitForTimeout(600);
    await expect(results(page)).toHaveCount(0);
    await expect(main(page).getByText(/untagged profiles?$/)).toHaveCount(0);
    await expect(main(page).getByText('No untagged profile matches.', { exact: true })).toHaveCount(0);
    expect(state.requests.filter((r) => r === 'GET /api/search/profiles/meili'), 'no search is asked for under 2 characters').toEqual([]);
    await searchBox(page).fill('av');
    await expect(results(page)).toHaveCount(1);
    await expect(results(page).first()).toContainText('Xavi');
    await expect(results(page).first()).toContainText('xavi@ex.example');
    await expect(results(page).first()).toContainText('https://x.example');
    await expect(main(page).getByText('1 untagged profile', { exact: true })).toBeVisible();
    await expect(results(page).first().getByRole('button', { name: 'Tag: My Brainstorm Assistant' })).toBeVisible();
    await expect(results(page).first().getByRole('button', { name: 'Tag: My Tapestry Assistant' })).toBeVisible();
    await searchBox(page).fill('zz');
    await expect(main(page).getByText('No untagged profile matches.', { exact: true })).toBeVisible();
    await noSockets(state);
  });

  test('C1b: signed out, there is no search box', async ({ page }) => {
    const state = await setup(page, { session: null, answers: [{ body: { success: true, signedIn: false } }] });
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { level: 1, name: 'Your Assistants.' })).toBeVisible();
    await expect(searchBox(page)).toHaveCount(0);
    await noSockets(state);
  });

  test('C2: a pasted npub, or a hex key, offers that exact profile first even when search does not find it', async ({ page }) => {
    const state = await setup(page, { answers: [answerOf([])] });
    await page.goto(PAGE);
    await expect(main(page).getByText(re("You haven't tagged any Assistants yet"))).toBeVisible();
    await searchBox(page).fill(nip19.npubEncode(Y));
    await expect(results(page)).toHaveCount(1);
    await expect(results(page).first()).toContainText('Yara the Unranked');
    await searchBox(page).fill(B);
    await expect(results(page)).toHaveCount(1);
    await expect(results(page).first()).toContainText('Bea');
    await noSockets(state);
  });

  test('C3: Tag from search — the signed tagging, the result line, the refreshed list and count, and the search updated', async ({ page }) => {
    const state = await setup(page, {
      answers: [answerOf([rowOf(A, ['tapestry'])]), answerOf([rowOf(A, ['tapestry']), rowOf(X, ['tapestry'], { idSeed: 'a' })])],
      search: { xa: [{ pubkey: X, display_name: 'Xavi' }] },
    });
    await page.goto(PAGE);
    await settled(page, 1);
    await expect(main(page).getByText('1 Assistant', { exact: true })).toBeVisible();
    await searchBox(page).fill('xa');
    await results(page).first().getByRole('button', { name: 'Tag: My Tapestry Assistant' }).click();
    await settled(page, 2);
    await expect(main(page).getByText('2 Assistants', { exact: true })).toBeVisible();
    await expect(rowNamed(page, 'Xavi').getByText('My Tapestry Assistant', { exact: true })).toBeVisible();
    await expect(results(page)).toHaveCount(0);
    const ev = (await signed(page))[0];
    expect(ev.kind).toBe(39999);
    expect(tagValues(ev, 'p')).toEqual([X]);
    expect(tagValues(ev, 'a')).toEqual([DEF.tapestry.address]);
    expect(tagValues(ev, 'e')).toEqual([DEF.tapestry.eventId]);
    expect(tagValues(ev, 'polarity')).toEqual(['1']);
    expect(tagValues(ev, 'd')).toEqual([dOf(TP.slug, X)]);
    expect(state.posted.map((e) => e.id)).toEqual([ev.id]);
    await expect(main(page).getByText(/"My Tapestry Assistant" was saved on this instance['’]s relay only/)).toBeVisible();
    await noSockets(state);
  });

  test('C4: rows open by click, Enter and Space, one at a time; the untagged Local row opens with no Change or Remove', async ({ page }) => {
    const state = await setup(page, { answers: [answerOf([rowOf(LOCAL, [], { local: true }), rowOf(A, ['tapestry']), rowOf(B, ['brainstorm'])])] });
    await page.goto(PAGE);
    await settled(page, 3);
    const a = rowNamed(page, 'Ava');
    const b = rowNamed(page, 'Bea');
    await expect(toggle(a)).toHaveAttribute('aria-expanded', 'false');
    await expect(main(page).getByRole('button', { name: 'Remove Tag' })).toHaveCount(0);
    await toggle(a).click();
    await expect(toggle(a)).toHaveAttribute('aria-expanded', 'true');
    await expect(a.getByRole('button', { name: 'Remove Tag' })).toBeVisible();
    await toggle(b).focus();
    await page.keyboard.press('Enter');
    await expect(toggle(b)).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle(a)).toHaveAttribute('aria-expanded', 'false');
    await expect(main(page).getByRole('button', { name: 'Remove Tag' })).toHaveCount(1);
    await page.keyboard.press('Space');
    await expect(toggle(b)).toHaveAttribute('aria-expanded', 'false');
    // Re-aimed by my-assistants #3 (ADR 0003 sub-decision 4): every row opens now. The untagged Local row opens to its
    // duties and Manage on Treasure Map, with no Change and no Remove; its prompt stays.
    const local = rowNamed(page, 'Zed Local');
    await toggle(local).click();
    await expect(toggle(local)).toHaveAttribute('aria-expanded', 'true');
    await expect(local.getByRole('button', { name: 'Remove Tag' })).toHaveCount(0);
    await expect(local.getByRole('button', { name: /^Change to/ })).toHaveCount(0);
    await expect(local.getByRole('link', { name: 'Manage on Treasure Map' })).toBeVisible();
    await expect(local.getByRole('link', { name: /Tag it as My Tapestry Assistant/ })).toBeVisible();
    await noSockets(state);
  });

  test('C5: Change — the apply of the other tag, then the withdrawal of the first; the row ends with the other chip', async ({ page }) => {
    const before = rowOf(A, ['tapestry'], { idSeed: 'c' });
    const state = await setup(page, { answers: [answerOf([before, rowOf(B, ['brainstorm', 'tapestry'])]), answerOf([rowOf(A, ['brainstorm']), rowOf(B, ['brainstorm', 'tapestry'])])] });
    await page.goto(PAGE);
    await settled(page, 2);
    const both = rowNamed(page, 'Bea');
    await toggle(both).click();
    await expect(both.getByRole('button', { name: /^Change to/ })).toHaveCount(0);
    const a = rowNamed(page, 'Ava');
    await toggle(a).click();
    await a.getByRole('button', { name: 'Change to My Brainstorm Assistant' }).click();
    await expect(rowNamed(page, 'Ava').getByText('My Brainstorm Assistant', { exact: true })).toBeVisible();
    await expect(rowNamed(page, 'Ava').getByText('My Tapestry Assistant', { exact: true })).toHaveCount(0);
    const evs = await signed(page);
    expect(evs.map((e) => e.kind)).toEqual([39999, 5]);
    expect(tagValues(evs[0], 'a')).toEqual([DEF.brainstorm.address]);
    expect(tagValues(evs[0], 'p')).toEqual([A]);
    expect(tagValues(evs[1], 'e')).toEqual(before.retract.tapestry.ids);
    expect(tagValues(evs[1], 'a')).toEqual(before.retract.tapestry.addresses);
    expect(tagValues(evs[1], 'k')).toEqual(['39999']);
    expect(state.posted.map((e) => e.kind)).toEqual([39999, 5]);
    await noSockets(state);
  });

  test('C6: Remove — one withdrawal naming every id and address; the row leaves; a tagged Local row stays, Not tagged', async ({ page }) => {
    const both = rowOf(B, ['brainstorm', 'tapestry'], { idSeed: 'd' });
    const localTagged = rowOf(LOCAL, ['tapestry'], { local: true, idSeed: 'e' });
    const state = await setup(page, { answers: [answerOf([localTagged, both]), answerOf([localTagged]), answerOf([rowOf(LOCAL, [], { local: true })])] });
    await page.goto(PAGE);
    await settled(page, 2);
    await expect(main(page).getByText('2 Assistants', { exact: true })).toBeVisible();
    const b = rowNamed(page, 'Bea');
    await toggle(b).click();
    await b.getByRole('button', { name: 'Remove Tag' }).click();
    await settled(page, 1);
    await expect(main(page).getByText('1 Assistant', { exact: true })).toBeVisible();
    const ev = (await signed(page))[0];
    expect(ev.kind).toBe(5);
    expect(tagValues(ev, 'e').sort()).toEqual([...both.retract.brainstorm.ids, ...both.retract.tapestry.ids].sort());
    expect(tagValues(ev, 'a').sort()).toEqual([...both.retract.brainstorm.addresses, ...both.retract.tapestry.addresses].sort());
    const local = rowNamed(page, 'Zed Local');
    await toggle(local).click();
    await local.getByRole('button', { name: 'Remove Tag' }).click();
    await expect(rowNamed(page, 'Zed Local').getByText('Not tagged', { exact: true })).toBeVisible();
    await settled(page, 1);
    await noSockets(state);
  });

  test('C7: the Brainstorm tag unpublished — its buttons disabled with the reason; Tapestry still works', async ({ page }) => {
    const missing = { ...DEF, brainstorm: { ...DEF.brainstorm, found: false, eventId: null } };
    const state = await setup(page, {
      answers: [answerOf([rowOf(A, ['tapestry'])], missing)],
      search: { xa: [{ pubkey: X, display_name: 'Xavi' }] },
    });
    await page.goto(PAGE);
    await settled(page, 1);
    await searchBox(page).fill('xa');
    await expect(results(page).first().getByRole('button', { name: 'Tag: My Brainstorm Assistant' })).toBeDisabled();
    await expect(results(page).first().getByRole('button', { name: 'Tag: My Tapestry Assistant' })).toBeEnabled();
    // Amendment 1 (sub-decision 13): the reason is tied to the disabled button.
    await expect(results(page).first().getByRole('button', { name: 'Tag: My Brainstorm Assistant' }))
      .toHaveAccessibleDescription(re("The My Brainstorm Assistant tag hasn't been published yet, so it can't be applied."));
    await expect(main(page).getByText(re("The My Brainstorm Assistant tag hasn't been published yet, so it can't be applied.")).first()).toBeVisible();
    const a = rowNamed(page, 'Ava');
    await toggle(a).click();
    await expect(a.getByRole('button', { name: 'Change to My Brainstorm Assistant' })).toBeDisabled();
    await expect(a.getByRole('button', { name: 'Change to My Brainstorm Assistant' }))
      .toHaveAccessibleDescription(re("The My Brainstorm Assistant tag hasn't been published yet, so it can't be applied."));
    await expect(a.getByText(re("The My Brainstorm Assistant tag hasn't been published yet"))).toBeVisible();
    await expect(a.getByRole('button', { name: 'Remove Tag' })).toBeEnabled();
    expect(await signed(page)).toEqual([]);
    await noSockets(state);
  });

  test('C8: while a press publishes, the pressed button says so, every action is disabled, and nothing doubles', async ({ page }) => {
    const state = await setup(page, {
      holdSign: true,
      answers: [answerOf([rowOf(A, ['tapestry'])]), answerOf([rowOf(A, ['tapestry']), rowOf(X, ['tapestry'])])],
      search: { xa: [{ pubkey: X, display_name: 'Xavi' }] },
    });
    await page.goto(PAGE);
    await settled(page, 1);
    const a = rowNamed(page, 'Ava');
    await toggle(a).click();
    await searchBox(page).fill('xa');
    const tagBtn = results(page).first().getByRole('button', { name: /^Tag: My Tapestry Assistant|^Tagging…/ });
    await tagBtn.click();
    await expect(results(page).first().getByRole('button', { name: 'Tagging…' })).toBeDisabled();
    await expect(results(page).first().getByRole('button', { name: 'Tag: My Brainstorm Assistant' })).toBeDisabled();
    await expect(a.getByRole('button', { name: 'Remove Tag' })).toBeDisabled();
    await expect(a.getByRole('button', { name: 'Change to My Brainstorm Assistant' })).toBeDisabled();
    await page.evaluate(() => window.__releaseSign());
    await settled(page, 2);
    expect((await signed(page)).length).toBe(1);
    expect(state.posted.length).toBe(1);
    await noSockets(state);
  });

  const PRESSES = {
    tag: async (page) => {
      await searchBox(page).fill('xa');
      await results(page).first().getByRole('button', { name: 'Tag: My Tapestry Assistant' }).click();
    },
    change: async (page) => {
      const a = rowNamed(page, 'Ava');
      await toggle(a).click();
      await a.getByRole('button', { name: 'Change to My Brainstorm Assistant' }).click();
    },
    remove: async (page) => {
      const a = rowNamed(page, 'Ava');
      await toggle(a).click();
      await a.getByRole('button', { name: 'Remove Tag' }).click();
    },
  };
  for (const [label, signer, words] of [['no extension', 'none', /No NIP-07 extension detected/], ['the wrong key in it', 'other', /different account/]]) {
    for (const press of ['tag', 'change', 'remove']) {
      test(`C9 (${press}, ${label}): nothing signed or posted, and the page says why`, async ({ page }) => {
        const state = await setup(page, { signer, answers: [answerOf([rowOf(A, ['tapestry'])])], search: { xa: [{ pubkey: X, display_name: 'Xavi' }] } });
        await page.goto(PAGE);
        await settled(page, 1);
        await PRESSES[press](page);
        await expect(main(page).getByText(words).first()).toBeVisible();
        expect(await signed(page), 'nothing signed').toEqual([]);
        expect(state.posted, 'nothing posted').toEqual([]);
        await settled(page, 1);
        await expect(rowNamed(page, 'Ava').getByText('My Tapestry Assistant', { exact: true })).toBeVisible();
        await noSockets(state);
      });
    }
  }

  test('C10: no relay took it — an error line, the list unchanged, and the button usable again', async ({ page }) => {
    const state = await setup(page, {
      answers: [answerOf([rowOf(A, ['tapestry'])])],
      publish: () => ({ success: false, error: 'strfry import failed' }),
      search: { xa: [{ pubkey: X, display_name: 'Xavi' }] },
    });
    await page.goto(PAGE);
    await settled(page, 1);
    await searchBox(page).fill('xa');
    await results(page).first().getByRole('button', { name: 'Tag: My Tapestry Assistant' }).click();
    await expect(main(page).getByText(/could not be saved on this instance['’]s relay \(strfry import failed\)/).first()).toBeVisible();
    await settled(page, 1);
    await expect(main(page).getByText('1 Assistant', { exact: true })).toBeVisible();
    await expect(results(page).first().getByRole('button', { name: 'Tag: My Tapestry Assistant' })).toBeEnabled();
    await noSockets(state);
  });

  test('C11: a half-done change — both lines said, and the list shows both chips, as the relays now say', async ({ page }) => {
    const state = await setup(page, {
      answers: [answerOf([rowOf(A, ['tapestry'])]), answerOf([rowOf(A, ['brainstorm', 'tapestry'])])],
      publish: (ev) => (ev.kind === 5 ? { success: false, error: 'strfry import failed' } : { success: true }),
    });
    await page.goto(PAGE);
    await settled(page, 1);
    const a = rowNamed(page, 'Ava');
    await toggle(a).click();
    await a.getByRole('button', { name: 'Change to My Brainstorm Assistant' }).click();
    await expect(main(page).getByText(/"My Brainstorm Assistant" was saved/).first()).toBeVisible();
    await expect(main(page).getByText(/"Withdrawal of My Tapestry Assistant" could not be saved/).first()).toBeVisible();
    await expect(rowNamed(page, 'Ava').getByText('My Brainstorm Assistant', { exact: true })).toBeVisible();
    await expect(rowNamed(page, 'Ava').getByText('My Tapestry Assistant', { exact: true })).toBeVisible();
    await noSockets(state);
  });

  test('C12: the refresh keeps the rows on screen — no loading line while the re-read is held', async ({ page }) => {
    const hold = deferred();
    const state = await setup(page, {
      answers: [answerOf([rowOf(A, ['tapestry'])]), { ...answerOf([rowOf(A, ['tapestry']), rowOf(X, ['tapestry'])]), hold: hold.promise }],
      search: { xa: [{ pubkey: X, display_name: 'Xavi' }] },
    });
    await page.goto(PAGE);
    await settled(page, 1);
    await searchBox(page).fill('xa');
    await results(page).first().getByRole('button', { name: 'Tag: My Tapestry Assistant' }).click();
    await expect.poll(() => state.reads).toBe(2);
    for (let i = 0; i < 8; i++) {
      const s = await page.evaluate(() => (document.querySelector('main') || {}).innerText || '');
      expect(s.includes('Loading your Assistants…'), `sample ${i}: no loading line during a refresh`).toBe(false);
      expect(s.includes('Ava'), `sample ${i}: the rows stay on screen`).toBe(true);
      await page.waitForTimeout(100);
    }
    hold.resolve();
    await settled(page, 2);
    await noSockets(state);
  });

  test('C13: a withdrawal is reported to the community relay too; an apply is not', async ({ page }) => {
    const state = await setup(page, {
      answers: [answerOf([rowOf(A, ['tapestry'])]), answerOf([rowOf(A, ['tapestry']), rowOf(X, ['tapestry'])]), answerOf([rowOf(X, ['tapestry'])])],
      search: { xa: [{ pubkey: X, display_name: 'Xavi' }] },
    });
    await page.goto(PAGE);
    await settled(page, 1);
    await searchBox(page).fill('xa');
    await results(page).first().getByRole('button', { name: 'Tag: My Tapestry Assistant' }).click();
    await settled(page, 2);
    await expect(main(page).getByText(/"My Tapestry Assistant" was saved/)).toBeVisible();
    await expect(main(page).getByText(COMMUNITY, { exact: true }), 'an apply is not sent to the community relay').toHaveCount(0);
    const a = rowNamed(page, 'Ava');
    await toggle(a).click();
    await a.getByRole('button', { name: 'Remove Tag' }).click();
    await settled(page, 1);
    await expect(main(page).getByText(/"Withdrawal of My Tapestry Assistant" was saved/)).toBeVisible();
    await expect(main(page).getByText(COMMUNITY, { exact: true }), 'the withdrawal lists the community relay').toHaveCount(1);
    await noSockets(state);
  });

  test('C14: a failed re-read after a press keeps the rows, shows the report, and says the list was not re-read', async ({ page }) => {
    const state = await setup(page, {
      answers: [answerOf([rowOf(A, ['tapestry'])]), { status: 500, body: { success: false, error: 'Could not load your Assistants' } }],
      search: { xa: [{ pubkey: X, display_name: 'Xavi' }] },
    });
    await page.goto(PAGE);
    await settled(page, 1);
    await searchBox(page).fill('xa');
    await results(page).first().getByRole('button', { name: 'Tag: My Tapestry Assistant' }).click();
    await expect(main(page).getByText(/"My Tapestry Assistant" was saved/)).toBeVisible();
    await expect(main(page).getByText(re("The list couldn't be re-read; it may not show this yet."))).toBeVisible();
    await settled(page, 1);
    await expect(main(page).getByText(re("Couldn't load your Assistants\\."))).toHaveCount(0);
    await noSockets(state);
  });

  test('C15: Searching… until the answer; a changed query never shows the previous query\'s results', async ({ page }) => {
    const first = deferred();
    const second = deferred();
    const state = await setup(page, {
      answers: [answerOf([rowOf(A, ['tapestry'])])],
      search: { xa: [{ pubkey: X, display_name: 'Xavi' }], yo: [{ pubkey: Y, display_name: 'Yara the Unranked' }] },
      searchHold: { xa: first.promise, yo: second.promise },
    });
    await page.goto(PAGE);
    await settled(page, 1);
    await searchBox(page).fill('xa');
    await expect(main(page).getByText('Searching…', { exact: true })).toBeVisible();
    await expect(main(page).getByText('No untagged profile matches.', { exact: true })).toHaveCount(0);
    await expect(results(page)).toHaveCount(0);
    first.resolve();
    await expect(results(page)).toHaveCount(1);
    await searchBox(page).fill('yo');
    for (let i = 0; i < 6; i++) {
      const text = await page.evaluate(() => (document.querySelector('main') || {}).innerText || '');
      expect(text.includes('Xavi'), `sample ${i}: the previous query's result must not show`).toBe(false);
      await page.waitForTimeout(100);
    }
    await expect(main(page).getByText('Searching…', { exact: true })).toBeVisible();
    second.resolve();
    await expect(results(page).first()).toContainText('Yara the Unranked');
    await noSockets(state);
  });

  test('C16: the result area is always there, and focus moves to it after a press', async ({ page }) => {
    const state = await setup(page, {
      answers: [answerOf([rowOf(A, ['tapestry'])]), answerOf([rowOf(A, ['tapestry']), rowOf(X, ['tapestry'])])],
      search: { xa: [{ pubkey: X, display_name: 'Xavi' }] },
    });
    await page.goto(PAGE);
    await settled(page, 1);
    // Re-aimed by my-assistants #3: wait for the Treasure Map read to settle (its count shows) before counting.
    await expect(main(page).getByText(/^\d+ on your Treasure Map$/)).toBeVisible();
    await expect(main(page).locator('[role="status"]'), 'one status region in the ready page, before any press').toHaveCount(1);
    await searchBox(page).fill('xa');
    await results(page).first().getByRole('button', { name: 'Tag: My Tapestry Assistant' }).click();
    await settled(page, 2);
    const region = main(page).locator('[role="status"]');
    await expect(region).toContainText('"My Tapestry Assistant" was saved');
    expect(await region.evaluate((el) => el === document.activeElement || el.contains(document.activeElement)), 'focus is in the result area').toBe(true);
    await noSockets(state);
  });

  test('C17: a row removed while open comes back closed when it is tagged again', async ({ page }) => {
    const state = await setup(page, {
      answers: [answerOf([rowOf(A, ['tapestry']), rowOf(B, ['tapestry'])]), answerOf([rowOf(B, ['tapestry'])]), answerOf([rowOf(A, ['tapestry']), rowOf(B, ['tapestry'])])],
      search: { av: [{ pubkey: A, name: 'Ava' }] },
    });
    await page.goto(PAGE);
    await settled(page, 2);
    const a = rowNamed(page, 'Ava');
    await toggle(a).click();
    await a.getByRole('button', { name: 'Remove Tag' }).click();
    await settled(page, 1);
    await searchBox(page).fill('av');
    await results(page).first().getByRole('button', { name: 'Tag: My Tapestry Assistant' }).click();
    await settled(page, 2);
    await expect(toggle(rowNamed(page, 'Ava'))).toHaveAttribute('aria-expanded', 'false');
    await noSockets(state);
  });
});
