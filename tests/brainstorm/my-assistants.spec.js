const { test, expect } = require('@playwright/test');
const { nip19 } = require('nostr-tools');

/**
 * my-assistants #1 — the My Assistants page, its menu link, and the list of your Assistants: what a viewer SEES.
 *
 * Story: engineering-team/stories/my-assistants/1-the-my-assistants-page.md
 * ADR:   engineering-team/decisions/my-assistants/0001-one-session-read-lists-your-assistants.md
 * Plan:  engineering-team/stories/my-assistants/1-the-my-assistants-page.test-plan.md
 * Node half: test/my-assistants-page.test.js (the rule, the handler, the view-model, the menu list).
 *
 * Network-mocked, the dictionary-concepts.spec.js idiom: sign-in comes from /api/auth/status and
 * /api/auth/user-classification; the page's own read, GET /api/assistant/my-assistants, answers what each test
 * gives it, and can be held on a promise the test releases. Profiles answer from a fixture map.
 *
 * The one markup contract these tests add (plan § Test infrastructure): the rows are a list whose accessible name is
 * "Your Assistants", one listitem per row.
 *
 *   A1 — signed out: the frame, the heading and introduction, the sign-in line; no count, no empty line, no list.
 *   A2 — signed in: every row's name, npub, URL, NIP-05 and tag chips; Local first with its tooltip; the count.
 *   A3 — your Assistant here, untagged: first, Local, "Not tagged" with its tooltip, the prompt and its link.
 *   A4 — no rows: the empty line and "0 Assistants".
 *   A5 — the read fails (500, then a dropped connection): the error line and Try again, never the empty line;
 *        Try again reads again and shows the rows.
 *   A6 — profiles can't be looked up: every row still listed, with the npub as its name and — for URL and NIP-05.
 *   A7 — loading: while sign-in, the read, or the profiles are held, the loading line shows in every sample and
 *        neither the empty line, a count nor a row ever does.
 *   A8 — the avatar menus: My Assistants right after My Treasure Map, opening /assistants; none when signed out.
 *   A9 — at 375 px, long names, URLs and NIP-05s wrap: the page doesn't scroll sideways and nothing is cut off.
 *   A10 — the frame: the design's type and a 1040 px column; /dictionary keeps its 720 px column.
 *   A11 — a refresh of /assistants renders the page, never "Page not found"; the page only reads (GET).
 *   A12 — a profile whose name fields are not text is still listed, and the page shows no error (added after review 1).
 */

const VIEWER = 'a1'.repeat(32);
const LOCAL = 'a2'.repeat(32);
const A = 'c1'.repeat(32);
const B = 'c2'.repeat(32);
const C = 'c3'.repeat(32);
const OWNER = '1'.repeat(64);
const OWNER_TA = '2'.repeat(64);

const BRAINSTORM = { key: 'brainstorm', name: 'My Brainstorm Assistant' };
const TAPESTRY = { key: 'tapestry', name: 'My Tapestry Assistant' };
const CUSTOMER = { pubkey: VIEWER, assistantPubkey: LOCAL, classification: 'customer' };

const APOS = '[\'’]';
const re = (s) => new RegExp(s.replace(/'/g, APOS));
const WORDS = {
  intro: re("Every profile you've tagged My Brainstorm Assistant or My Tapestry Assistant\\. Open a row to see what that Assistant does according to your Treasure Map\\."),
  signedOut: 'Sign in to see your Assistants.',
  loading: 'Loading your Assistants…',
  error: re("Couldn't load your Assistants\\."),
  empty: re("You haven't tagged any Assistants yet\\. Search above to find one\\."),
  localTip: re("^The Assistant hosted on the instance you're using right now$"),
  notTaggedTip: re("^You haven't tagged this Assistant as yours yet$"),
  prompt: re("This is your Assistant on this instance, but you haven't tagged it as yours\\."),
  count: /^\d+ Assistants?$/,
};

const npubShort = (pk) => { const n = nip19.npubEncode(pk); return `${n.slice(0, 12)}…${n.slice(-6)}`; };
const row = (pubkey, tags, local = false) => ({ pubkey, local, tags });
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
function deferred() { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; }

/**
 * Mock everything the page and its frame ask for.
 *   answers  — the page's read, in order (the last repeats): { body, status, hold, abort }
 *   profiles — { [pubkey]: profile } (a pubkey left out has no profile)
 *   profilesFail — row lookups answer 500
 *   profilesHold — a promise row lookups wait on
 */
async function mockStack(page, { session = null, answers = [], profiles = {}, profilesFail = false, profilesHold = null, authHold = null } = {}) {
  const asked = { mine: 0, requests: [] };
  const rowKeys = new Set();
  for (const a of answers) for (const r of ((a.body && a.body.rows) || [])) rowKeys.add(r.pubkey);
  // A read-only Cypher POST (the Treasure Map's relay list, my-assistants #3) is recorded as a READ: the server's own
  // write guard (src/api/neo4j/queryPost.js WRITE_KEYWORDS) decides what a write is. Re-aimed by my-assistants #3.
  const WRITE_KEYWORDS = /\b(CREATE|MERGE|DELETE|SET|REMOVE|DETACH|DROP|CALL\s*\{)\b/i;
  page.on('request', (req) => {
    const p = new URL(req.url()).pathname;
    if (!p.startsWith('/api/')) return;
    let cypherText = '';
    try { cypherText = p === '/api/neo4j/query' ? (JSON.parse(req.postData() || '{}').cypher || '') : ''; } catch { /* not JSON */ }
    const read = req.method() === 'POST' && p === '/api/neo4j/query' && cypherText && !WRITE_KEYWORDS.test(cypherText);
    asked.requests.push(read ? `READ ${p}` : `${req.method()} ${p}`);
  });
  // The Treasure Map reads (my-assistants #3): none published, everywhere — so these tests stay hermetic.
  await page.route('**/api/strfry/scan**', (r) => json(r, { success: true, events: [] }));
  await page.route('**/api/neo4j/query', (r) => json(r, { success: true, data: [{ name: 'relay one', json: JSON.stringify({ nostrRelay: { websocketUrl: 'wss://one.example' } }) }] }));
  await page.route('**/api/relay/external**', (r) => json(r, { success: true, events: [] }));

  await page.route('**/api/assistant/pubkey', (r) => json(r, { success: true, pubkey: OWNER_TA }));
  await page.route('**/api/owner/pubkey', (r) => json(r, { success: true, pubkey: OWNER }));
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
  await page.route('**/api/auth/status', async (r) => {
    if (authHold) await authHold;
    return json(r, session ? { authenticated: true, pubkey: session.pubkey } : { authenticated: false, pubkey: null });
  });
  await page.route('**/api/auth/user-classification', (r) => json(r, {
    success: true,
    classification: session ? session.classification : 'unauthenticated',
    pubkey: session ? session.pubkey : null,
    assistantPubkey: session ? session.assistantPubkey : null,
  }));
  await page.route('**/api/profiles**', async (r) => {
    const keys = (new URL(r.request().url()).searchParams.get('pubkeys') || '').split(',').filter(Boolean);
    const forRows = keys.some((k) => rowKeys.has(k));
    if (forRows && profilesHold) await profilesHold;
    if (forRows && profilesFail) return json(r, { success: false, error: 'relays unreachable' }, 500);
    const out = {};
    for (const k of keys) if (Object.prototype.hasOwnProperty.call(profiles, k)) out[k] = profiles[k];
    return json(r, { success: true, profiles: out });
  });
  await page.route('**/api/assistant/my-assistants**', async (r) => {
    const a = answers[Math.min(asked.mine, answers.length - 1)] || { body: { success: true, signedIn: false } };
    asked.mine++;
    if (a.hold) await a.hold;
    if (a.abort) return r.abort('connectionreset');
    return json(r, a.body, a.status || 200);
  });
  return asked;
}

const PAGE = '/assistants';
const main = (page) => page.locator('main');
const list = (page) => page.getByRole('list', { name: 'Your Assistants' });
const items = (page) => list(page).locator(':scope > li, :scope > [role="listitem"]');
const heading = (page) => page.getByRole('heading', { level: 1, name: 'Your Assistants.' });

/** Which fixture names the rows show, top to bottom. */
async function order(page, names) {
  const texts = await items(page).allTextContents();
  return texts.map((t) => names.find((n) => t.includes(n)) || `?? ${t.slice(0, 40)}`);
}
/** Sample main's text every 100 ms, `n` times. */
async function sample(page, n = 10) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(await page.evaluate(() => {
      const m = document.querySelector('main');
      return { text: m ? m.innerText : '', rows: m ? m.querySelectorAll('li, [role="listitem"]').length : 0 };
    }));
    await page.waitForTimeout(100);
  }
  return out;
}
function neverShows(samples, { what }) {
  for (const [i, s] of samples.entries()) {
    expect(s.text, `sample ${i}: the loading line should show while ${what}`).toContain(WORDS.loading);
    expect(WORDS.empty.test(s.text), `sample ${i}: the empty line must never show while ${what}`).toBe(false);
    expect(s.text.split('\n').some((l) => WORDS.count.test(l.trim())), `sample ${i}: no count while ${what}`).toBe(false);
    expect(s.rows, `sample ${i}: no rows while ${what}`).toBe(0);
  }
}

const FULL = {
  body: {
    success: true, signedIn: true, local: LOCAL,
    rows: [row(B, [BRAINSTORM, TAPESTRY]), row(C, [TAPESTRY]), row(LOCAL, [TAPESTRY], true), row(A, [BRAINSTORM])],
  },
};
const FULL_PROFILES = {
  [LOCAL]: { display_name: 'Zed Local', website: 'https://tapestry.example', nip05: 'zed@tapestry.example' },
  [A]: { name: 'alice', website: 'brainstorm.world', nip05: 'alice@brainstorm.world' },
  [B]: { display_name: 'Bob', nip05: 'bob@bob.example' },
  // C has no profile.
};

test.describe('/assistants — the My Assistants page', () => {
  test('A1: signed out, the page asks you to sign in, in the design’s frame, with no list, count or empty line', async ({ page }) => {
    await mockStack(page);
    await page.goto(PAGE);
    await expect(heading(page)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Brainstorm home' })).toHaveAttribute('href', '/');
    await expect(main(page).getByText('My Assistants', { exact: true })).toBeVisible();
    await expect(main(page)).toContainText(WORDS.intro);
    await expect(main(page).getByRole('link', { name: 'Treasure Map', exact: true })).toHaveAttribute('href', '/tapestry/grapevine/treasure-map');
    await expect(main(page).getByText(WORDS.signedOut, { exact: true })).toBeVisible();
    await expect(main(page).getByRole('button', { name: 'Sign in with nostr' })).toBeVisible();
    await expect(list(page)).toHaveCount(0);
    await expect(main(page).getByText(WORDS.count)).toHaveCount(0);
    await expect(main(page).getByText(WORDS.empty)).toHaveCount(0);
  });

  test('A2: signed in, each row shows name, npub, URL, NIP-05 and its tags; Local first; the count', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER, answers: [FULL], profiles: FULL_PROFILES });
    await page.goto(PAGE);
    await expect(items(page)).toHaveCount(4);
    const cName = npubShort(C);
    expect(await order(page, ['Zed Local', 'alice', 'Bob', cName])).toEqual(['Zed Local', 'alice', 'Bob', cName]);
    await expect(main(page).getByText('4 Assistants', { exact: true })).toBeVisible();

    const expectRow = async (i, { name, pk, url, nip05, chips }) => {
      const r = items(page).nth(i);
      await expect(r.getByText(name, { exact: true }).first()).toBeVisible();
      await expect(r.getByText(npubShort(pk), { exact: true }).first()).toBeVisible();
      await expect(r.getByText('URL', { exact: true })).toBeVisible();
      await expect(r.getByText('NIP-05', { exact: true })).toBeVisible();
      await expect(r.getByText(url, { exact: true }).first()).toBeVisible();
      await expect(r.getByText(nip05, { exact: true }).first()).toBeVisible();
      if (url === '—' && nip05 === '—') await expect(r.getByText('—', { exact: true })).toHaveCount(2);
      for (const t of [BRAINSTORM, TAPESTRY]) {
        await expect(r.getByText(t.name, { exact: true }), `${name}: chip ${t.name}`).toHaveCount(chips.includes(t) ? 1 : 0);
      }
    };
    await expectRow(0, { name: 'Zed Local', pk: LOCAL, url: 'https://tapestry.example', nip05: 'zed@tapestry.example', chips: [TAPESTRY] });
    await expectRow(1, { name: 'alice', pk: A, url: 'brainstorm.world', nip05: 'alice@brainstorm.world', chips: [BRAINSTORM] });
    await expectRow(2, { name: 'Bob', pk: B, url: '—', nip05: 'bob@bob.example', chips: [BRAINSTORM, TAPESTRY] });
    await expectRow(3, { name: cName, pk: C, url: '—', nip05: '—', chips: [TAPESTRY] });

    const first = items(page).nth(0);
    await expect(first.getByText('Local', { exact: true })).toBeVisible();
    const tips = await first.locator('[title]').evaluateAll((els) => els.map((e) => e.getAttribute('title')));
    expect(tips.some((t) => WORDS.localTip.test(t)), `the Local badge's tooltip; titles ${JSON.stringify(tips)}`).toBe(true);
    for (const i of [1, 2, 3]) await expect(items(page).nth(i).getByText('Local', { exact: true })).toHaveCount(0);
    await expect(main(page).getByText('Not tagged', { exact: true })).toHaveCount(0);
  });

  test('A3: your Assistant here, untagged — first, Local, "Not tagged", and a prompt linking to Identification Tags', async ({ page }) => {
    await mockStack(page, {
      session: CUSTOMER,
      answers: [{ body: { success: true, signedIn: true, local: LOCAL, rows: [row(A, [BRAINSTORM]), row(LOCAL, [], true)] } }],
      profiles: FULL_PROFILES,
    });
    await page.goto(PAGE);
    await expect(items(page)).toHaveCount(2);
    expect(await order(page, ['Zed Local', 'alice'])).toEqual(['Zed Local', 'alice']);
    await expect(main(page).getByText('2 Assistants', { exact: true })).toBeVisible();
    const first = items(page).nth(0);
    await expect(first.getByText('Local', { exact: true })).toBeVisible();
    await expect(first.getByText('Not tagged', { exact: true })).toBeVisible();
    const tips = await first.locator('[title]').evaluateAll((els) => els.map((e) => e.getAttribute('title')));
    expect(tips.some((t) => WORDS.notTaggedTip.test(t)), `the Not tagged mark's tooltip; titles ${JSON.stringify(tips)}`).toBe(true);
    await expect(first).toContainText(WORDS.prompt);
    const link = first.getByRole('link', { name: /Tag it as My Tapestry Assistant/ });
    await expect(link).toHaveAttribute('href', '/assistant/identification-tags');
    for (const t of [BRAINSTORM, TAPESTRY]) await expect(first.getByText(t.name, { exact: true })).toHaveCount(0);
    await expect(items(page).nth(1).getByText('Not tagged', { exact: true })).toHaveCount(0);
  });

  test('A4: signed in with no rows — the empty line and "0 Assistants"', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER, answers: [{ body: { success: true, signedIn: true, local: null, rows: [] } }] });
    await page.goto(PAGE);
    await expect(main(page).getByText(WORDS.empty)).toBeVisible();
    await expect(main(page).getByText('0 Assistants', { exact: true })).toBeVisible();
    await expect(items(page)).toHaveCount(0);
    await expect(main(page).getByText(WORDS.error)).toHaveCount(0);
  });

  test('A5: a failed read shows the error line and Try again — never the empty line — and Try again reads again', async ({ page }) => {
    const asked = await mockStack(page, {
      session: CUSTOMER,
      answers: [
        { status: 500, body: { success: false, error: 'Could not load your Assistants' } },
        { abort: true },
        FULL,
      ],
      profiles: FULL_PROFILES,
    });
    await page.goto(PAGE);
    await expect(main(page).getByText(WORDS.error)).toBeVisible();
    await expect(main(page).getByText(WORDS.empty)).toHaveCount(0);
    await expect(main(page).getByText(WORDS.count)).toHaveCount(0);
    await main(page).getByRole('button', { name: 'Try again' }).click();
    await expect(main(page).getByText(WORDS.error), 'a dropped connection is an error too').toBeVisible();
    await expect(main(page).getByText(WORDS.empty)).toHaveCount(0);
    await main(page).getByRole('button', { name: 'Try again' }).click();
    await expect(items(page)).toHaveCount(4);
    await expect(main(page).getByText(WORDS.error)).toHaveCount(0);
    expect(asked.mine, 'each Try again reads again').toBe(3);
  });

  test('A6: when profiles can’t be looked up, every row is still listed, named by npub, with — for URL and NIP-05', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER, answers: [FULL], profiles: FULL_PROFILES, profilesFail: true });
    await page.goto(PAGE);
    await expect(items(page)).toHaveCount(4);
    await expect(main(page).getByText('4 Assistants', { exact: true })).toBeVisible();
    const first = items(page).nth(0);
    await expect(first.getByText(npubShort(LOCAL), { exact: true }).first()).toBeVisible();
    await expect(first.getByText('Local', { exact: true })).toBeVisible();
    for (let i = 0; i < 4; i++) await expect(items(page).nth(i).getByText('—', { exact: true })).toHaveCount(2);
    await expect(main(page).getByText(WORDS.error)).toHaveCount(0);
  });

  test('A7a: while sign-in is still resolving, only the loading line — never the sign-in line, the empty line or a count', async ({ page }) => {
    const auth = deferred();
    await mockStack(page, { session: CUSTOMER, authHold: auth.promise, answers: [FULL], profiles: FULL_PROFILES });
    await page.goto(PAGE);
    await expect(heading(page)).toBeVisible();
    const samples = await sample(page);
    neverShows(samples, { what: 'sign-in resolves' });
    for (const s of samples) expect(s.text.includes(WORDS.signedOut), 'the sign-in line must not show while sign-in resolves').toBe(false);
    auth.resolve();
    await expect(items(page)).toHaveCount(4);
  });

  test('A7b: while the read is held, only the loading line; released empty, the empty line appears', async ({ page }) => {
    const hold = deferred();
    await mockStack(page, { session: CUSTOMER, answers: [{ hold: hold.promise, body: { success: true, signedIn: true, local: null, rows: [] } }] });
    await page.goto(PAGE);
    await expect(heading(page)).toBeVisible();
    await expect(main(page).getByText(WORDS.loading)).toBeVisible();
    neverShows(await sample(page), { what: 'the read is held' });
    hold.resolve();
    await expect(main(page).getByText(WORDS.empty)).toBeVisible();
    await expect(main(page).getByText(WORDS.loading)).toHaveCount(0);
  });

  test('A7c: while the profiles are held, still only the loading line — rows appear once, already in order', async ({ page }) => {
    const hold = deferred();
    await mockStack(page, { session: CUSTOMER, answers: [FULL], profiles: FULL_PROFILES, profilesHold: hold.promise });
    await page.goto(PAGE);
    await expect(heading(page)).toBeVisible();
    await expect(main(page).getByText(WORDS.loading)).toBeVisible();
    neverShows(await sample(page), { what: 'the profiles are held' });
    hold.resolve();
    await expect(items(page)).toHaveCount(4);
    expect(await order(page, ['Zed Local', 'alice', 'Bob', npubShort(C)])).toEqual(['Zed Local', 'alice', 'Bob', npubShort(C)]);
  });

  test('A8a: the avatar menu offers My Assistants right after My Treasure Map, and it opens /assistants', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER, answers: [FULL], profiles: FULL_PROFILES });
    for (const from of ['/dictionary', '/']) {
      await page.goto(from);
      await page.locator('.bs-usermenu-avatar-btn').first().click();
      const links = page.locator('.bs-usermenu-dropdown .bs-usermenu-link');
      const labels = (await links.allTextContents()).map((t) => t.trim());
      const i = labels.findIndex((l) => /My Treasure Map$/.test(l));
      expect(i, `${from}: My Treasure Map is in the menu (${JSON.stringify(labels)})`).toBeGreaterThanOrEqual(0);
      expect(labels[i + 1], `${from}: the item after My Treasure Map`).toMatch(/My Assistants$/);
      await expect(links.nth(i + 1)).toHaveAttribute('href', '/assistants');
      await links.nth(i + 1).click();
      await expect(page).toHaveURL(/\/assistants$/);
      await expect(heading(page)).toBeVisible();
    }
  });

  test('A8b: signed out, no menu offers My Assistants', async ({ page }) => {
    await mockStack(page);
    for (const from of ['/', PAGE]) {
      await page.goto(from);
      await expect(page.getByRole('link', { name: /My Assistants/ })).toHaveCount(0);
    }
  });

  test('A9: at 375 px, long names, URLs and NIP-05s wrap — no sideways scroll, nothing cut off', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const long = {
      [LOCAL]: { display_name: 'A very long display name for an Assistant that goes on and on and on', website: `https://${'x'.repeat(90)}.example/some/long/path`, nip05: `someone@${'y'.repeat(70)}.example` },
      [A]: { name: 'Averyveryveryveryveryveryveryveryveryverylongnamewithoutanyspacesatall', website: `https://${'z'.repeat(120)}.example`, nip05: `${'q'.repeat(60)}@brainstorm.world` },
    };
    await mockStack(page, {
      session: CUSTOMER,
      answers: [{ body: { success: true, signedIn: true, local: LOCAL, rows: [row(LOCAL, [], true), row(A, [BRAINSTORM, TAPESTRY]), row(B, [TAPESTRY])] } }],
      profiles: long,
    });
    await page.goto(PAGE);
    await expect(items(page)).toHaveCount(3);
    const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
    expect(m.scroll, `the page is ${m.scroll}px wide in a ${m.width}px viewport`).toBeLessThanOrEqual(m.width);
    const rights = await items(page).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().right));
    for (const [i, r] of rights.entries()) expect(r, `row ${i} ends inside the viewport`).toBeLessThanOrEqual(375.5);
    // …and nothing is cut off inside a row: a long value wraps rather than overflowing a clipped box.
    const clipped = await list(page).evaluate((ul) => [ul, ...ul.querySelectorAll('*')]
      .filter((el) => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1)
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}: ${el.scrollWidth} > ${el.clientWidth}`));
    expect(clipped, 'no element in the list is wider than its box').toEqual([]);
  });

  test('A10: the design’s type and a 1040 px column; /dictionary keeps its 720 px column', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockStack(page, { session: CUSTOMER, answers: [FULL], profiles: FULL_PROFILES });
    await page.goto(PAGE);
    await expect(heading(page)).toBeVisible();
    await expect(page.locator('.bsd-page')).toHaveCSS('font-family', /^Figtree/);
    await expect(main(page)).toHaveCSS('max-width', '1040px');
    await page.route('**/api/dictionaries/concepts**', (r) => json(r, { success: true, metric: 'gum1', authors: [], entries: [], pov: {} }));
    await page.goto('/dictionary');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(main(page)).toHaveCSS('max-width', '720px');
  });

  test('A11: a refresh of /assistants renders the page, never "Page not found", and the page only reads', async ({ page }) => {
    const asked = await mockStack(page, { session: CUSTOMER, answers: [FULL], profiles: FULL_PROFILES });
    await page.goto(PAGE);
    await expect(items(page)).toHaveCount(4);
    await page.reload();
    await expect(heading(page)).toBeVisible();
    await expect(items(page)).toHaveCount(4);
    await expect(page.getByText(/Page not found/i)).toHaveCount(0);
    const writes = asked.requests.filter((r) => !r.startsWith('GET ') && !r.startsWith('READ '));
    expect(writes, 'the page publishes, signs and stores nothing (a read-only Cypher POST is a read)').toEqual([]);
  });

  // Added after review 1 (blocking finding 1): one malformed profile must not take the page down.
  test('A12: a profile whose name fields are not text is still listed, and the others with it — no error line', async ({ page }) => {
    await mockStack(page, {
      session: CUSTOMER,
      answers: [FULL],
      profiles: { ...FULL_PROFILES, [A]: { display_name: 42, name: ['x'], website: 'brainstorm.world' } },
    });
    await page.goto(PAGE);
    await expect(items(page)).toHaveCount(4);
    await expect(main(page).getByText(WORDS.error)).toHaveCount(0);
    await expect(main(page).getByText('4 Assistants', { exact: true })).toBeVisible();
    await expect(list(page).getByText(npubShort(A), { exact: true }).first()).toBeVisible();
    await expect(list(page).getByText('Bob', { exact: true })).toBeVisible();
  });
});
