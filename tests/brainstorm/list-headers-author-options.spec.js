const { test, expect } = require('@playwright/test');

/**
 * list-headers-disposition #1 — Me and My Local Tapestry Assistant in the List Headers Author selector: what a
 * viewer SEES on /tapestry/lists.
 *
 * Story: engineering-team/stories/done/list-headers-disposition/1-author-selector-me-and-my-assistant.md
 * ADR:   engineering-team/decisions/done/list-headers-disposition/0001-me-and-my-assistant-from-the-signed-in-user.md
 * Plan:  engineering-team/stories/done/list-headers-disposition/1-author-selector-me-and-my-assistant.test-plan.md
 * Node half: test/list-headers-author-options.test.js (the pure rules).
 *
 * Network-mocked and hermetic: a catch-all answers every /api call these tests don't name (so a `vite preview`
 * that proxies /api to a live stack is never reached). Sign-in comes from /api/auth/status and
 * /api/auth/user-classification; the rows from GET /api/strfry/scan. The scan waits until the instance config
 * (owner and Owner's-Assistant pubkeys) has been answered, so today's pinned entries are deterministic.
 *
 *   L1 — AC 1: signed in with an Assistant here: All authors, Me, My Local Tapestry Assistant, then today's entries
 *        in today's order (the same tail a signed-out visitor sees).
 *   L2 — AC 2: Me lists only the account's own headers, both kinds, and the count reads "<shown> of <total> lists".
 *   L3 — AC 3: My Local Tapestry Assistant lists only the Assistant held for that person; a non-Owner never sees a
 *        header signed by the Owner's Assistant.
 *   L4 — the Owner: Me and 👑 Owner pick the same rows, My Local Tapestry Assistant picks the Owner's Assistant's,
 *        and the selector keeps showing the entry the Owner chose (story § Out of scope; ADR 0001).
 *   L5 — AC 4: nothing matches: the entries are still there, and the table says "No DLists match your filters".
 *   L6 — AC 5: signed out: neither entry; the selector is exactly today's.
 *   L7 — AC 5: no Assistant here: Me choosable; My Local Tapestry Assistant shown, greyed out, labelled as none;
 *        it can't be chosen, and the table stays unfiltered.
 *   L8 — AC 6: two people, two sessions, same rows: each sees only their own.
 *   L9 — ADR 0001: signing out while Me is chosen puts the selector back on All authors, every row listed; signing
 *        back in on the same page doesn't bring the stale choice back (the reset's only visible effect: at sign-out the
 *        browser already shows the first entry).
 *   R1 — today's literal author entries still filter by their author (passes before and after).
 */

const OWNER = '1'.repeat(64);
const OWNER_TA = '2'.repeat(64);
const VIEWER = 'a1'.repeat(32);
const VIEWER_TA = 'a2'.repeat(32);
const OTHER = 'b1'.repeat(32);
const OTHER_TA = 'b2'.repeat(32);
const STRANGER = '9'.repeat(64);
const NOBODY = 'c1'.repeat(32);      // signed in, has an Assistant, and neither has written a header
const NOBODY_TA = 'c2'.repeat(32);

const CUSTOMER = { pubkey: VIEWER, assistantPubkey: VIEWER_TA, classification: 'customer' };
const CUSTOMER_B = { pubkey: OTHER, assistantPubkey: OTHER_TA, classification: 'customer' };
const OWNER_SESSION = { pubkey: OWNER, assistantPubkey: OWNER_TA, classification: 'owner' };
const NO_ASSISTANT = { pubkey: VIEWER, assistantPubkey: null, classification: 'guest' };
const EMPTY_HANDED = { pubkey: NOBODY, assistantPubkey: NOBODY_TA, classification: 'customer' };

const NOW = 1790000000;
let seq = 0;
function header(pubkey, kind, name) {
  seq++;
  const id = seq.toString(16).padStart(64, '0');
  const tags = [['names', name, `${name}s`]];
  if (kind === 39998) tags.unshift(['d', `d-${name}`]);
  return { id, pubkey, kind, created_at: NOW - seq * 60, tags, content: '', sig: '0'.repeat(128) };
}

// Deliberately scrambled, so "today's order" is the page's rule and not the fixture's.
const HEADERS = [
  header(STRANGER, 39998, 'stranger list'),
  header(VIEWER_TA, 39998, 'viewer assistant list'),
  header(OWNER_TA, 39998, 'owner assistant list'),
  header(VIEWER, 9998, 'viewer plain list'),
  header(OTHER, 39998, 'other list'),
  header(OWNER, 39998, 'owner list'),
  header(OTHER_TA, 39998, 'other assistant list'),
  header(VIEWER, 39998, 'viewer replaceable list'),
];
const TOTAL = HEADERS.length;
const namesBy = (...pks) => HEADERS.filter((h) => pks.includes(h.pubkey)).map((h) => h.tags.find((t) => t[0] === 'names')[1]).sort();

// Today's selector over HEADERS, by today's rule (ui/src/pages/lists/Index.jsx authorOptions + authorDisplayName):
// the Owner, then the Owner's Assistant pinned (no profiles, so the short-pubkey labels), then everyone else in
// first-seen order.
const short = (pk) => `${pk.slice(0, 8)}…`;
const TODAYS_TAIL = [
  `👑 Owner (${short(OWNER)})`,
  `🤖 Assistant (${short(OWNER_TA)})`,
  short(STRANGER),
  short(VIEWER_TA),
  short(VIEWER),
  short(OTHER),
  short(OTHER_TA),
];

const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function mockStack(page, { session = null, signInAs = null } = {}) {
  let configAnswered;
  const config = new Promise((resolve) => { configAnswered = resolve; });
  let owner = false;
  let ta = false;
  const settle = () => { if (owner && ta) configAnswered(); };

  // Catch-all FIRST: Playwright tries the most recently registered matching route first, so every route below wins
  // over this one, and anything unnamed is answered here instead of reaching a live stack.
  await page.route('**/api/**', (r) => json(r, { success: false, error: 'not mocked in this spec' }, 404));

  await page.route('**/api/owner/pubkey', (r) => { owner = true; settle(); return json(r, { success: true, pubkey: OWNER }); });
  await page.route('**/api/assistant/pubkey', (r) => { ta = true; settle(); return json(r, { success: true, pubkey: OWNER_TA }); });
  await page.route('**/api/relays', (r) => json(r, { success: true, relays: [] }));
  await page.route('**/api/status', (r) => json(r, { success: true }));
  await page.route('**/api/user-prefs', (r) => json(r, { success: true, preferences: {} }));
  await page.route('**/api/grapevine/preferences', (r) => json(r, { success: true, preferences: {} }));
  await page.route('**/api/setup/status**', (r) => json(r, session
    ? { success: true, signedIn: true, steps: { account: { done: true }, follow: { done: true }, activate: { done: true } } }
    : { success: true, signedIn: false }));
  await page.route('**/api/assistant/attention**', (r) => json(r, session
    ? { success: true, signedIn: true, hasAssistant: false, actions: {} }
    : { success: true, signedIn: false }));
  await page.route('**/api/assistant/roster', (r) => json(r, { success: true, assistants: [], viewer: null }));
  await page.route('**/api/profiles**', (r) => json(r, { success: true, profiles: {} }));
  await page.route('**/api/dlists/item-counts', (r) => json(r, { success: true, counts: {}, totalItems: 0 }));
  await page.route('**/api/neo4j/event-uuids', (r) => json(r, { success: true, uuids: [] }));
  await page.route('**/api/strfry/scan**', async (r) => {
    let filter = {};
    try { filter = JSON.parse(new URL(r.request().url()).searchParams.get('filter') || '{}'); } catch { /* not JSON */ }
    const kinds = Array.isArray(filter.kinds) ? filter.kinds : [];
    if (!(kinds.includes(39998) || kinds.includes(9998))) return json(r, { success: true, events: [] });
    await config;
    return json(r, { success: true, events: HEADERS });
  });

  await page.route('**/api/auth/status', (r) => json(r, session
    ? { authenticated: true, pubkey: session.pubkey }
    : { authenticated: false, pubkey: null }));
  await page.route('**/api/auth/user-classification', (r) => json(r, {
    success: true,
    classification: session ? session.classification : 'unauthenticated',
    pubkey: session ? session.pubkey : null,
    assistantPubkey: session ? session.assistantPubkey : null,
  }));
  await page.route('**/api/auth/logout', (r) => { session = null; return json(r, { success: true }); });

  // In-page sign-in (AuthContext.runLogin): a stub NIP-07 signer, then verify-user and login-user. Signing in makes
  // `signInAs` the session every later auth answer reports.
  if (signInAs) {
    await page.addInitScript((pk) => {
      window.nostr = {
        getPublicKey: async () => pk,
        signEvent: async (e) => ({ ...e, pubkey: pk, id: '0'.repeat(64), sig: '0'.repeat(128) }),
      };
    }, signInAs.pubkey);
    await page.route('**/api/auth/verify-user', (r) => json(r, { authorized: true, challenge: 'list-headers-test-challenge' }));
    await page.route('**/api/auth/login-user', (r) => { session = signInAs; return json(r, { success: true }); });
  }
}

const PAGE = '/tapestry/lists';
const authorSelect = (page) => page.locator('select').filter({ has: page.locator('option', { hasText: /^All authors$/ }) });
const optionTexts = async (page) => (await authorSelect(page).locator('option').allTextContents()).map((s) => s.trim());
const countLine = (page) => page.getByText(/^\d+ (of \d+ )?lists$/);

async function rowNames(page) {
  const rows = page.locator('table.data-table tbody tr');
  const out = [];
  for (const tr of await rows.all()) {
    if (await tr.locator('td.empty-row').count()) continue;
    out.push((await tr.locator('td').first().textContent()).trim());
  }
  return out.sort();
}

/** Open the page and wait until the rows are in AND sign-in has settled one way or the other. */
async function open(page, session, { signInAs = null } = {}) {
  await mockStack(page, { session, signInAs });
  await page.goto(PAGE);
  await expect(page.getByRole('heading', { name: /Simple Lists \(DLists\)/ })).toBeVisible();
  await expect(countLine(page)).toHaveText(`${TOTAL} lists`);
  if (session) await expect(page.locator('.header-user .user-button')).toBeVisible();
  else await expect(page.locator('.header-loading')).toHaveCount(0);
}

const exactly = (s) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

/** Choose an entry by its label, failing with a sentence (not a selectOption timeout) when it isn't offered. */
async function choose(page, label) {
  await expect(authorSelect(page).locator('option', { hasText: exactly(label) }), `the Author selector offers "${label}"`)
    .toHaveCount(1);
  await authorSelect(page).selectOption({ label });
}

test.describe('List Headers — Me and My Local Tapestry Assistant (list-headers-disposition #1)', () => {
  test('L1 (AC 1): signed in with an Assistant here, the selector reads All authors, Me, My Local Tapestry Assistant, then today\'s entries in today\'s order', async ({ page, browser }) => {
    await open(page, CUSTOMER);
    await expect.poll(() => optionTexts(page), {
      message: 'story AC 1: the two new entries sit right under All authors, and today\'s entries follow unchanged',
    }).toEqual(['All authors', 'Me', 'My Local Tapestry Assistant', ...TODAYS_TAIL]);

    // The same tail a signed-out visitor sees on the same rows.
    const ctx = await browser.newContext();
    const out = await ctx.newPage();
    await open(out, null);
    expect(await optionTexts(out), 'story AC 1: after the two new entries, the selector is exactly the signed-out one')
      .toEqual(['All authors', ...(await optionTexts(page)).slice(3)]);
    await ctx.close();
  });

  test('L2 (AC 2): Me lists only the account\'s own headers, of both kinds, and the count reads "<shown> of <total> lists"', async ({ page }) => {
    await open(page, CUSTOMER);
    await choose(page, 'Me');
    await expect.poll(() => rowNames(page), { message: 'story AC 2: only headers signed by the signed-in account (kind 9998 and 39998)' })
      .toEqual(namesBy(VIEWER));
    await expect(countLine(page)).toHaveText(`${namesBy(VIEWER).length} of ${TOTAL} lists`);
  });

  test('L3 (AC 3): My Local Tapestry Assistant lists only the Assistant held for this person, never the Owner\'s Assistant', async ({ page }) => {
    await open(page, CUSTOMER);
    await choose(page, 'My Local Tapestry Assistant');
    await expect.poll(() => rowNames(page), { message: 'story AC 3: only headers signed by the Assistant this instance holds for the signed-in person' })
      .toEqual(namesBy(VIEWER_TA));
    expect(await rowNames(page), 'story AC 3: a non-Owner never sees a header signed by the Owner\'s Assistant')
      .not.toContain('owner assistant list');
    await expect(countLine(page)).toHaveText(`${namesBy(VIEWER_TA).length} of ${TOTAL} lists`);
  });

  test('L4 (the Owner): Me and 👑 Owner pick the same rows, My Local Tapestry Assistant picks the Owner\'s Assistant\'s, and the selector shows what was chosen', async ({ page }) => {
    await open(page, OWNER_SESSION);
    await choose(page, 'My Local Tapestry Assistant');
    await expect.poll(() => rowNames(page), { message: 'for the Owner, My Local Tapestry Assistant is the Owner\'s Assistant' })
      .toEqual(namesBy(OWNER_TA));

    await choose(page, 'Me');
    await expect.poll(() => rowNames(page), { message: 'for the Owner, Me is the Owner\'s own headers' }).toEqual(namesBy(OWNER));
    const ownerLabel = `👑 Owner (${short(OWNER)})`;
    await choose(page, ownerLabel);
    await expect.poll(() => rowNames(page), { message: 'story § Out of scope: Me and 👑 Owner pick the same rows' }).toEqual(namesBy(OWNER));
    await expect.poll(() => authorSelect(page).evaluate((s) => s.options[s.selectedIndex].text.trim()), {
      message: 'ADR 0001: the selector keeps showing the entry the Owner chose (👑 Owner), not "Me" — the two never share a value',
    }).toBe(ownerLabel);
    await choose(page, 'Me');
    await expect.poll(() => authorSelect(page).evaluate((s) => s.options[s.selectedIndex].text.trim()), {
      message: 'ADR 0001: choosing Me shows Me',
    }).toBe('Me');
  });

  test('L5 (AC 4): with nothing to match, the entries are still there and the table says so', async ({ page }) => {
    await open(page, EMPTY_HANDED);
    await expect.poll(() => optionTexts(page), { message: 'story AC 4: the entries are never hidden because nothing matches' })
      .toEqual(['All authors', 'Me', 'My Local Tapestry Assistant', ...TODAYS_TAIL]);
    for (const label of ['Me', 'My Local Tapestry Assistant']) {
      await choose(page, label);
      await expect(page.locator('td.empty-row'), `story AC 4: choosing ${label} with nothing to match shows today's empty message`)
        .toHaveText('No DLists match your filters');
      await expect(countLine(page)).toHaveText(`0 of ${TOTAL} lists`);
    }
  });

  test('L6 (AC 5): signed out, neither entry appears and the selector is exactly today\'s', async ({ page }) => {
    await open(page, null);
    await page.waitForTimeout(300); // let any late identity answer land before checking for absence
    expect(await optionTexts(page), 'story AC 5: a signed-out visitor sees today\'s selector, with no Me and no My Local Tapestry Assistant')
      .toEqual(['All authors', ...TODAYS_TAIL]);
  });

  test('L7 (AC 5): with no Assistant here, Me is choosable and My Local Tapestry Assistant is greyed out, labelled as none, and can\'t be chosen', async ({ page }) => {
    await open(page, NO_ASSISTANT);
    const me = authorSelect(page).locator('option', { hasText: /^Me$/ });
    const mine = authorSelect(page).locator('option', { hasText: /^My Local Tapestry Assistant/ });
    await expect(me, 'story AC 5: Me appears').toHaveCount(1);
    await expect(me).toBeEnabled();
    await expect(mine, 'story AC 5: My Local Tapestry Assistant still appears').toHaveCount(1);
    await expect(mine, 'story AC 5: it can\'t be chosen').toBeDisabled();
    await expect(mine, 'story AC 5: it says there is none on this instance').toHaveText(/none on this instance/i);
    expect(await optionTexts(page), 'story AC 1 / AC 5: the order holds without an Assistant')
      .toEqual(['All authors', 'Me', (await mine.textContent()).trim(), ...TODAYS_TAIL]);
    expect(await rowNames(page), 'ADR 0001: nothing is filtered — no fallback picked anyone\'s Assistant')
      .toEqual(HEADERS.map((h) => h.tags.find((t) => t[0] === 'names')[1]).sort());
    await expect(countLine(page)).toHaveText(`${TOTAL} lists`);
  });

  test('L8 (AC 6): two people in their own sessions each see only their own rows', async ({ browser }) => {
    const a = await browser.newContext();
    const b = await browser.newContext();
    const pa = await a.newPage();
    const pb = await b.newPage();
    await open(pa, CUSTOMER);
    await open(pb, CUSTOMER_B);

    await choose(pa, 'Me');
    await choose(pb, 'Me');
    await expect.poll(() => rowNames(pa), { message: 'story AC 6: person A\'s Me is A\'s headers only' }).toEqual(namesBy(VIEWER));
    await expect.poll(() => rowNames(pb), { message: 'story AC 6: person B\'s Me is B\'s headers only' }).toEqual(namesBy(OTHER));

    await choose(pa, 'My Local Tapestry Assistant');
    await choose(pb, 'My Local Tapestry Assistant');
    await expect.poll(() => rowNames(pa), { message: 'story AC 6: person A\'s Assistant is A\'s only' }).toEqual(namesBy(VIEWER_TA));
    await expect.poll(() => rowNames(pb), { message: 'story AC 6: person B\'s Assistant is B\'s only' }).toEqual(namesBy(OTHER_TA));
    await a.close();
    await b.close();
  });

  test('L9 (ADR 0001): signing out while Me is chosen puts the selector back on All authors, and signing back in doesn\'t bring the stale choice back', async ({ page }) => {
    await open(page, CUSTOMER, { signInAs: CUSTOMER });
    await choose(page, 'Me');
    await expect.poll(() => rowNames(page)).toEqual(namesBy(VIEWER));

    await page.locator('.header-user .user-button').click();
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await expect(page.locator('.header-user')).toHaveCount(0);

    const shown = () => authorSelect(page).evaluate((s) => (s.selectedIndex >= 0 ? s.options[s.selectedIndex].text.trim() : null));
    await expect.poll(shown, { message: 'ADR 0001: after sign-out the selector shows All authors' }).toBe('All authors');
    await expect.poll(() => rowNames(page), { message: 'ADR 0001: every row is listed again' })
      .toEqual(HEADERS.map((h) => h.tags.find((t) => t[0] === 'names')[1]).sort());
    expect(await optionTexts(page), 'story AC 5: signed out, the two entries are gone').toEqual(['All authors', ...TODAYS_TAIL]);

    // Sign back in on the same page. The choice made before signing out must not re-apply by itself.
    await page.getByRole('button', { name: 'Sign in with Nostr' }).click();
    await expect(page.locator('.header-user .user-button')).toBeVisible();
    await expect.poll(() => optionTexts(page), { message: 'signed in again, the two entries are back' })
      .toEqual(['All authors', 'Me', 'My Local Tapestry Assistant', ...TODAYS_TAIL]);
    await page.waitForTimeout(300); // let a stale choice re-apply, if it is going to
    expect(await shown(), 'ADR 0001: a choice made before signing out does not come back on the next sign-in').toBe('All authors');
    expect(await rowNames(page), 'ADR 0001: every row is still listed after signing back in')
      .toEqual(HEADERS.map((h) => h.tags.find((t) => t[0] === 'names')[1]).sort());
  });

  test('R1: today\'s literal author entries still filter by their author', async ({ page }) => {
    await open(page, CUSTOMER);
    await choose(page, short(STRANGER));
    await expect.poll(() => rowNames(page)).toEqual(namesBy(STRANGER));
    await choose(page, `🤖 Assistant (${short(OWNER_TA)})`);
    await expect.poll(() => rowNames(page)).toEqual(namesBy(OWNER_TA));
    await expect(countLine(page)).toHaveText(`1 of ${TOTAL} lists`);
  });
});
