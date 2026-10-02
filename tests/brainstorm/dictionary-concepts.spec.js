const { test, expect } = require('@playwright/test');

/**
 * Dictionary › Concepts: whose dictionary the page shows (the owner's correction of 2026-09-29).
 *
 * The rows are the person's own dictionary: exactly what Active b-tags lists under "Mine". The
 * page resolves the person as Active b-tags does and sends their pubkeys to
 * GET /api/dictionaries/concepts as `authors`. What only a browser can answer is pinned here:
 * which `authors` the page actually sends for each kind of reader, and what it then says. The
 * structural and live halves are in test/dictionary-concepts.test.js (its H1 rebuilds the rows
 * from strfry and compares them with the Active b-tags rule on real data).
 *
 * Network-mocked, the author-scoped-inspection.spec.js idiom: signed-in states come from mocking
 * /api/auth/status, /api/auth/user-classification and the roster. The dictionary endpoint is
 * mocked too, and it applies the server's rule to the fixture headers for whichever authors are
 * asked for, so a page that sent the wrong person would show the wrong rows.
 *
 *   D1 — signed out: the owner's pair is asked for, and the page says it is the owner's.
 *   D2 — a signed-in customer: their account and their assistant, "your", and no Add.
 *   D3 — the signed-in owner: the owner's pair, and Add to Dictionary is offered.
 *   D4 — signed in with no assistant: the account alone, and the page says so.
 *
 * /dictionary is the same list in the Brainstorm design's styling (pages/dictionary/). It renders
 * the control panel page's own body, so these ask only what the frame adds:
 *
 *   D5 — signed out: the owner's pair and the same rows, headed "The owner’s Dictionary.", in the
 *        design's type, and each row opens /dictionary/:coord.
 *   D6 — a signed-in customer: their own pair, headed "Your Dictionary.".
 *   D7 — a row's entry opens on /dictionary/:coord, and its back link returns to /dictionary.
 *   D8 — the avatar menu offers Dictionary (/dictionary), right after Dictionaries.
 *   D9 — with a setup step left, the Setup Alert sits centred in the bar and the avatar at its right.
 *
 * The entry page, laid out as the design's Dictionary entry screen (test/dictionary-entry.test.js
 * holds the pure rule and the structural pins):
 *
 *   D10 — the Items table asks once, for the entry's own header, its shared concept and the
 *         person; it pages ten at a time, searches (name and filer) and sorts; the Curation card
 *         names the Assistant the Treasure Map assigns; what has no backend is disabled; the GUM₁
 *         sentence; the header panels open.
 *   D11 — a Treasure Map that cannot be read names no curator and says so.
 *
 * "Managed by" on /dictionary (test/dictionary-managed-by.test.js holds the pure rules):
 *
 *   D12 — a signed-in reader picks another of their Assistants: the URL names it, the list is its
 *         Dictionary (read for that Assistant alone), and the page says it reads this relay.
 *   D13 — "All of my Assistants": one row per shared concept, with "n of m Assistants".
 *   D14 — a link to another Assistant's Dictionary reads only that one; its entry returns to it
 *         and names the Assistant's header.
 *   D15 — signed out it is a label, and an unreadable link says nothing about "your own"; signed in, a
 *         link naming someone else's Assistant falls back, and says so.
 *   D16 — an Assistant's Dictionary that cannot be read is an error with Try again, never "0 concepts".
 *   D17 — when the reader's Assistants cannot be read, the page says so and offers Try again.
 *   D18 — the menu works from the keyboard: focus moves in, arrows move, Escape returns to the trigger.
 *   D19 — focus leaving for nowhere (Safari, pressing an option) leaves the menu open, so a pick lands;
 *         Escape on the trigger closes it.
 *
 * The item page (the design's Dictionary item screen):
 *
 *   D20 — an Items row opens /dictionary/:coord/items/:item: "Item N in <concept>", who filed it, the
 *         raw event; its back link returns to the entry.
 *   D21 — a direct visit works out the number from the Items, and says when an item is filed by
 *         someone the community doesn't trust.
 *   D22 — it says no more than it knows: an event filed elsewhere isn't "untrusted", a failed
 *         Dictionary read is named, and a "%" in a d-tag doesn't crash the page.
 *   D23 — a modified click on a row (new tab) doesn't navigate this tab.
 *
 * Create New Concept (the design's screen; test/dictionary-new-concept.test.js holds the draft rule):
 *
 *   D24 — a signed-in customer creates a concept: the preview is the shared header, it is signed with
 *         their own key (NIP-07) and published, and the page opens its entry saying what the
 *         broadcast did.
 *   D25 — a header the signer already has at that name is never replaced: nothing is published.
 *   D26 — the owner's Assistant signs on the server; a different extension key is refused; signed
 *         out, the form is disabled.
 */

const OWNER = '1'.repeat(64);
const OWNER_TA = '2'.repeat(64);
const CUST = '3'.repeat(64);
const CUST_TA = '4'.repeat(64);
const ADMIN_NO_TA = '5'.repeat(64);
const REMOTE_TA = '8'.repeat(64); // an Assistant the customer tagged, hosted elsewhere
const FOREIGN = `39998:${'f'.repeat(64)}:shared-thing`;
const SENTINEL = 'b-tag-deferred';

const ROSTER = [
  { accountPubkey: OWNER, assistantPubkey: OWNER_TA, role: 'owner', displayName: 'Ada' },
  { accountPubkey: CUST, assistantPubkey: CUST_TA, role: 'customer', displayName: 'Baz' },
];

/** Fixture headers: [d, name, author, b]. */
const HEADERS = [
  ['cat-breed', 'cat breed', OWNER_TA, FOREIGN],
  ['dog', 'dog', OWNER_TA, `39998:${OWNER_TA}:dog`],
  ['owner-signed', 'owner signed', OWNER, FOREIGN],
  ['customer-thing', 'customer thing', CUST_TA, FOREIGN],
  ['admin-thing', 'admin thing', ADMIN_NO_TA, FOREIGN],
  ['deferred-one', 'deferred one', OWNER_TA, SENTINEL],
  ['remote-thing', 'remote thing', REMOTE_TA, FOREIGN], // the same shared concept as "customer thing"
  ['remote-only', 'remote only', REMOTE_TA, `39998:${'e'.repeat(64)}:elsewhere`],
];
const ALL_NAMES = HEADERS.map((h) => h[1]);

/** The server's rule over the fixtures: the requested authors' headers that carry a real b. */
function dictionaryFor(authors) {
  return HEADERS
    .filter(([, , author, b]) => authors.includes(author) && b !== SENTINEL)
    .map(([d, name, author, b]) => {
      const coord = `39998:${author}:${d}`;
      const selfDeclared = b === coord;
      return {
        coord, name, plural: null, description: null, author,
        targets: selfDeclared ? [] : [b], selfDeclared, isFirmware: false,
        itemCount: 0, sharedCoord: selfDeclared ? coord : b, gum: 0,
        totalAuthorCount: 0, totalEventCount: 0, override: null,
      };
    });
}

async function mockStack(page, { session = null } = {}) {
  const asked = [];
  const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/assistant/pubkey', (r) => json(r, { success: true, pubkey: OWNER_TA }));
  await page.route('**/api/owner/pubkey', (r) => json(r, { success: true, pubkey: OWNER }));
  await page.route('**/api/profiles**', (r) => json(r, { success: true, profiles: {} }));
  await page.route('**/api/relays', (r) => json(r, { success: true, relays: [] }));
  await page.route('**/api/status', (r) => json(r, { success: true }));
  await page.route('**/api/user-prefs', (r) => json(r, { success: true, preferences: {} }));
  await page.route('**/api/assistant/roster', (r) => json(r, {
    success: true,
    assistants: ROSTER,
    viewer: session ? { accountPubkey: session.pubkey, assistantPubkey: session.assistantPubkey } : null,
  }));
  await page.route('**/api/auth/status', (r) => json(r, session
    ? { authenticated: true, pubkey: session.pubkey }
    : { authenticated: false, pubkey: null }));
  await page.route('**/api/auth/user-classification', (r) => json(r, {
    success: true,
    classification: session ? session.classification : 'unauthenticated',
    pubkey: session ? session.pubkey : null,
    assistantPubkey: session ? session.assistantPubkey : null,
  }));
  await page.route('**/api/dictionaries/concepts**', (r) => {
    const authors = (new URL(r.request().url()).searchParams.get('authors') || '').split(',').filter(Boolean);
    asked.push(authors.join(','));
    return json(r, {
      success: true, metric: 'gum1', authors, entries: dictionaryFor(authors),
      pov: { branch: 'house', observer: null, fellBackToHouse: false, cutoff: 0.01, threshold: 2 },
    });
  });
  return asked;
}

const URL_ = '/tapestry/dictionaries/concepts';
const list = (page) => page.getByRole('list', { name: /Concepts in/ });

/** The row names on the page, in fixture order. */
async function names(page) {
  await expect(list(page)).toBeVisible();
  const out = [];
  for (const name of ALL_NAMES) {
    if (await list(page).locator('.dict-row-name', { hasText: new RegExp(`^${name}$`) }).count() > 0) out.push(name);
  }
  return out;
}


/** The customer's Assistants: their local one and Robin, tagged, with names. Call after mockStack (and mockEntry). */
async function mockAssistants(page) {
  const json = (r, body) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/assistant/my-assistants', (r) => json(r, {
    success: true, signedIn: true, local: CUST_TA,
    rows: [
      { pubkey: CUST_TA, local: true, tags: [{ key: 'tapestry', name: 'My Tapestry Assistant' }] },
      { pubkey: REMOTE_TA, local: false, tags: [{ key: 'brainstorm', name: 'My Brainstorm Assistant' }] },
    ],
  }));
  await page.route('**/api/profiles**', (r) => json(r, {
    success: true,
    profiles: {
      [CUST_TA]: { name: 'Baz’s Assistant', nip05: 'baz-assistant@here.example' },
      [REMOTE_TA]: { name: 'Robin', website: 'robin.example' },
    },
  }));
}

/**
 * Create New Concept's reads and writes: a stand-in NIP-07 extension holding `key`, the existing-header
 * check (`existing` → the signer already has one), the publish, and a local-only publish policy so no
 * socket is opened. Returns the publish bodies.
 */
async function mockCreate(page, { key, existing = false } = {}) {
  const json = (r, body) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  const published = [];
  await page.addInitScript((pk) => {
    window.nostr = {
      getPublicKey: async () => pk,
      signEvent: async (ev) => ({ ...ev, pubkey: pk, id: '1'.repeat(64), sig: '2'.repeat(128) }),
    };
  }, key);
  await page.route('**/api/publish-policy', (r) => json(r, { success: true, allowExternalPublish: false }));
  await page.route('**/api/strfry/scan**', (r) => {
    const filter = JSON.parse(new URL(r.request().url()).searchParams.get('filter') || '{}');
    if ((filter.kinds || []).includes(39998) && filter['#d'] && existing) {
      return json(r, { success: true, events: [{ id: '3'.repeat(64), kind: 39998, pubkey: filter.authors[0], created_at: 1, content: '', tags: [['d', filter['#d'][0]]] }] });
    }
    return json(r, { success: true, events: [] });
  });
  await page.route('**/api/strfry/publish', (r) => {
    const body = JSON.parse(r.request().postData() || '{}');
    published.push(body);
    const ev = body.signAs === 'assistant' ? { ...body.event, pubkey: OWNER_TA, id: '4'.repeat(64), sig: '5'.repeat(128) } : body.event;
    return json(r, { success: true, event: ev });
  });
  return published;
}

const TRUSTED_FILER = '6'.repeat(64);
const UNTRUSTED_FILER = '9'.repeat(64);
const UNTRUSTED_ITEM = 'e'.repeat(64);
const ELSEWHERE_ITEM = 'c'.repeat(64);
const CURATOR = '7'.repeat(64);

/** The entry page's own reads, on top of mockStack: its Items, the two headers, the Treasure Map. */
async function mockEntry(page, { map = 'assigned' } = {}) {
  const json = (r, body) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  const itemsAsked = [];
  const items = Array.from({ length: 22 }, (_, i) => ({
    id: String(i + 1).padStart(64, '0'), address: null, kind: 9999, author: TRUSTED_FILER,
    name: `item ${String(i + 1).padStart(2, '0')}`, createdAt: i + 1,
  }));
  items.push({ id: 'f'.repeat(64), address: null, kind: 9999, author: TRUSTED_FILER, name: 'zebra', createdAt: 99 });
  await page.route('**/api/dictionaries/concepts/items**', (r) => {
    itemsAsked.push(Object.fromEntries(new URL(r.request().url()).searchParams));
    return json(r, { success: true, items, filerCount: 1, totalCount: 25, pov: { branch: 'house', fellBackToHouse: false } });
  });
  await page.route('**/api/strfry/scan**', (r) => {
    const filter = JSON.parse(new URL(r.request().url()).searchParams.get('filter') || '{}');
    if (Array.isArray(filter.ids)) {
      // An item page reads its event by id: a listed item, or one filed by someone untrusted.
      const id = filter.ids[0];
      const listed = items.find((it) => it.id === id);
      const ev = listed
        ? { id, kind: 9999, pubkey: TRUSTED_FILER, created_at: listed.createdAt, content: '', tags: [['z', FOREIGN], ['name', listed.name]] }
        : id === UNTRUSTED_ITEM ? { id, kind: 9999, pubkey: UNTRUSTED_FILER, created_at: 5, content: '', tags: [['z', FOREIGN], ['name', 'mystery']] }
          : id === ELSEWHERE_ITEM ? { id, kind: 9999, pubkey: UNTRUSTED_FILER, created_at: 6, content: '', tags: [['z', `39998:${'d'.repeat(64)}:other`], ['name', 'stray']] }
            : null;
      return json(r, { success: true, events: ev ? [ev] : [] });
    }
    if ((filter.kinds || []).includes(10040)) {
      if (map === 'unreadable') return r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'strfry is down' }) });
      // ["39998:cat-breed", OWNER_TA] empowers 39998:<OWNER_TA>:cat-breed, the entry D10 opens.
      return json(r, { success: true, events: [{ id: 'a'.repeat(64), kind: 10040, pubkey: OWNER, created_at: 1, content: '', tags: [['39998:cat-breed', OWNER_TA]] }] });
    }
    if ((filter.kinds || []).includes(39998)) {
      const [author] = filter.authors || [];
      const [d] = filter['#d'] || [];
      return json(r, { success: true, events: [{ id: `${d}`.padEnd(64, '0').slice(0, 64), kind: 39998, pubkey: author, created_at: 1, content: '', tags: [['d', d], ['names', d.replace('-', ' '), `${d}s`], ['b', FOREIGN]] }] });
    }
    return json(r, { success: true, events: [] });
  });
  await page.route('**/api/neo4j/query', (r) => json(r, { success: true, data: [] }));
  await page.route('**/api/profiles**', (r) => json(r, {
    success: true,
    profiles: {
      [CURATOR]: { name: 'Curio', nip05: 'curio@example.com' },
      ['f'.repeat(64)]: { name: 'Fiona', nip05: 'fiona.example' },
      [TRUSTED_FILER]: { name: 'Trusty' },
    },
  }));
  return itemsAsked;
}

test.describe('Dictionary › Concepts — whose dictionary', () => {
  test('D1: signed out, the page shows the owner’s dictionary', async ({ page }) => {
    const asked = await mockStack(page);
    await page.goto(URL_);
    await expect(page.getByText(/concepts? in the owner’s Dictionary/)).toBeVisible();
    expect(asked.at(-1), 'signed out → the owner and the owner’s assistant').toBe(`${OWNER},${OWNER_TA}`);
    expect(await names(page)).toEqual(['cat breed', 'dog', 'owner signed']);
    await expect(page.getByText('You’re signed out, so this is the owner’s Dictionary.')).toBeVisible();
    await expect(list(page).getByText('Shared by the owner')).toBeVisible();
  });

  test('D2: a signed-in customer sees their own dictionary, and no Add', async ({ page }) => {
    const asked = await mockStack(page, { session: { pubkey: CUST, assistantPubkey: CUST_TA, classification: 'customer' } });
    await page.goto(URL_);
    await expect(page.getByText(/concepts? in your Dictionary/)).toBeVisible();
    expect(asked.at(-1), 'a customer → their account and their assistant').toBe(`${CUST},${CUST_TA}`);
    expect(await names(page)).toEqual(['customer thing']);
    await page.getByRole('button', { name: /Don’t see what you’re looking for\?/ }).click();
    await expect(page.getByText('For now only the owner of this instance can add a concept from here.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add to Dictionary' })).toHaveCount(0);
  });

  test('D3: the signed-in owner sees their dictionary, marked as theirs', async ({ page }) => {
    const asked = await mockStack(page, { session: { pubkey: OWNER, assistantPubkey: OWNER_TA, classification: 'owner' } });
    await page.goto(URL_);
    await expect(page.getByText(/concepts? in your Dictionary/)).toBeVisible();
    expect(asked.at(-1), 'the owner → the owner and the owner’s assistant').toBe(`${OWNER},${OWNER_TA}`);
    expect(await names(page)).toEqual(['cat breed', 'dog', 'owner signed']);
    await expect(list(page).getByText('Shared by you')).toBeVisible();
    await page.getByRole('button', { name: /Don’t see what you’re looking for\?/ }).click();
    await expect(page.getByText('For now only the owner of this instance can add a concept from here.')).toHaveCount(0);
  });

  test('D4: signed in with no assistant, the account alone, and the page says so', async ({ page }) => {
    const asked = await mockStack(page, { session: { pubkey: ADMIN_NO_TA, assistantPubkey: null, classification: 'admin' } });
    await page.goto(URL_);
    await expect(page.getByText(/concepts? in your Dictionary/)).toBeVisible();
    expect(asked.at(-1), 'no assistant → the account only').toBe(ADMIN_NO_TA);
    expect(await names(page)).toEqual(['admin thing']);
    await expect(page.getByText('You have no assistant key on this instance')).toBeVisible();
  });
});


const PAGE = '/dictionary';
const CUSTOMER = { pubkey: CUST, assistantPubkey: CUST_TA, classification: 'customer' };
const coordOf = (author, d) => `39998:${author}:${d}`;

test.describe('/dictionary — the same dictionary in the design’s styling', () => {
  test('D5: signed out, /dictionary shows the owner’s dictionary, and its rows open /dictionary/:coord', async ({ page }) => {
    const asked = await mockStack(page);
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { level: 1, name: 'The owner’s Dictionary.' })).toBeVisible();
    await expect(page.getByText(/concepts? in the owner’s Dictionary/)).toBeVisible();
    expect(asked.at(-1), 'signed out → the owner and the owner’s assistant').toBe(`${OWNER},${OWNER_TA}`);
    expect(await names(page)).toEqual(['cat breed', 'dog', 'owner signed']);
    await expect(list(page).getByRole('link', { name: /^cat breed/ }))
      .toHaveAttribute('href', `/dictionary/${encodeURIComponent(coordOf(OWNER_TA, 'cat-breed'))}`);
    await expect(page.locator('.bsd-page')).toHaveCSS('font-family', /^Figtree/);
    await expect(page.getByRole('link', { name: 'Brainstorm home' })).toHaveAttribute('href', '/');
  });

  test('D6: a signed-in customer sees their own dictionary as “Your Dictionary.”', async ({ page }) => {
    const asked = await mockStack(page, { session: CUSTOMER });
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { level: 1, name: 'Your Dictionary.' })).toBeVisible();
    expect(asked.at(-1), 'a customer → their account and their assistant').toBe(`${CUST},${CUST_TA}`);
    expect(await names(page)).toEqual(['customer thing']);
  });

  test('D7: a row opens its entry on /dictionary/:coord, whose back link returns to /dictionary', async ({ page }) => {
    await mockStack(page);
    await page.route('**/api/strfry/scan**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, events: [] }),
    }));
    await page.goto(PAGE);
    await list(page).getByRole('link', { name: /^dog/ }).click();
    await expect(page).toHaveURL(`${new URL(page.url()).origin}/dictionary/${encodeURIComponent(coordOf(OWNER_TA, 'dog'))}`);
    await expect(page.getByRole('heading', { level: 1, name: 'dog' })).toBeVisible();
    await expect(page.getByText('Shared by the owner')).toBeVisible();
    const back = page.getByRole('link', { name: 'Dictionary', exact: true });
    await expect(back).toHaveAttribute('href', '/dictionary');
    await back.click();
    await expect(page.getByRole('heading', { level: 1, name: 'The owner’s Dictionary.' })).toBeVisible();
  });

  test('D8: the avatar menu offers Dictionary, right after Dictionaries', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    await page.goto(PAGE);
    await page.locator('.bs-usermenu-avatar-btn').click();
    const links = page.locator('.bs-usermenu-dropdown .bs-usermenu-link');
    const labels = (await links.allTextContents()).map((t) => t.trim());
    const i = labels.findIndex((l) => /Dictionaries$/.test(l));
    expect(i, 'Dictionaries is still in the menu').toBeGreaterThanOrEqual(0);
    expect(labels[i + 1]).toMatch(/Dictionary$/);
    await expect(links.nth(i + 1)).toHaveAttribute('href', '/dictionary');
  });

  test('D10: the entry page — Items, Curation, disabled controls and the header panels', async ({ page }) => {
    await mockStack(page);
    const itemsAsked = await mockEntry(page);
    const coord = coordOf(OWNER_TA, 'cat-breed');
    await page.goto(`${PAGE}/${encodeURIComponent(coord)}`);

    const card = page.locator('.dict-items');
    await expect(card.locator('.dict-items-count')).toHaveText('23 items');
    expect(itemsAsked, 'asked once, after the row is known').toHaveLength(1);
    expect(itemsAsked[0], 'the own header, its shared concept, and the owner’s pair').toMatchObject({
      coord, shared: FOREIGN, authors: `${OWNER},${OWNER_TA}`,
    });
    await expect(page.getByRole('table', { name: 'Items' }).getByRole('columnheader')).toHaveText(['#', 'Item', 'Filed by']);
    const rows = card.locator('.dict-items-row:not(.dict-items-row--head)');
    await expect(rows).toHaveCount(10);
    await expect(card.locator('.dict-items-range')).toHaveText('1–10 of 23');
    await expect(rows.first().locator('.dict-items-by')).toHaveAttribute('href', `/user/${TRUSTED_FILER}`);
    await expect(rows.first().locator('.dict-items-by')).toHaveText('Trusty');
    await card.getByRole('button', { name: 'Next' }).click();
    await expect(card.locator('.dict-items-range')).toHaveText('11–20 of 23');
    await card.getByRole('button', { name: 'Next' }).click();
    await expect(rows).toHaveCount(3);
    await expect(card.getByRole('button', { name: 'Next' })).toBeDisabled();

    await card.getByRole('button', { name: /Search & sort/ }).click();
    await card.getByPlaceholder('Search items').fill('zeb');
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator('.dict-items-n')).toHaveText('23');
    await card.getByPlaceholder('Search items').fill('trusty');
    await expect(rows, 'the keyword matches who filed it too').toHaveCount(10);
    await card.getByPlaceholder('Search items').fill('nothing like it');
    await expect(card.getByText('No items match “nothing like it”.')).toBeVisible();
    await card.getByPlaceholder('Search items').fill('');
    await card.locator('select').selectOption('za');
    await expect(rows.first().locator('.dict-items-item')).toHaveText('zebra');
    await expect(card.getByRole('button', { name: 'Customize' })).toBeDisabled();
    await expect(page.getByText(/2 more filed by people below the verified cutoff are not shown\./)).toBeVisible();

    await page.getByRole('button', { name: /^Curation/ }).click();
    const curation = page.locator('.dict-curation');
    await expect(curation.locator('.dict-strip-name')).toContainText('The owner’s Assistant');
    await expect(curation.getByText('Assigned to this Concept on the owner’s Treasure Map')).toBeVisible();
    const switches = curation.getByRole('switch');
    await expect(switches).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      await expect(switches.nth(i)).toBeDisabled();
      await expect(switches.nth(i)).toHaveAttribute('aria-checked', 'false');
    }

    const strip = page.locator('.dict-author-strip');
    await expect(strip).toContainText('A Shared Community Concept, authored by Fiona');
    await expect(strip).toContainText('0 members of the owner’s trusted, extended community file items under it.');
    await expect(strip.getByRole('button', { name: 'Veto' })).toBeDisabled();

    await page.getByRole('button', { name: 'Community Concept header' }).click();
    await expect(page.locator('#dict-community-header')).toContainText(FOREIGN);
    await expect(page.locator('#dict-community-header .dict-json')).toContainText('["d","shared-thing"]');
    await page.getByRole('button', { name: 'The owner’s Assistant’s header' }).click();
    await expect(page.locator('#dict-own-header')).toContainText(coord);
    await expect(page.locator('#dict-own-header').getByRole('link', { name: 'Open the concept →' })).toBeVisible();
  });

  test('D11: a Treasure Map that cannot be read names no curator, and says so', async ({ page }) => {
    await mockStack(page);
    await mockEntry(page, { map: 'unreadable' });
    await page.goto(`${PAGE}/${encodeURIComponent(coordOf(OWNER_TA, 'cat-breed'))}`);
    const curation = page.locator('.dict-curation');
    await expect(curation.locator('.dict-items-count')).toHaveText('Could not read the Treasure Map');
    await page.getByRole('button', { name: /^Curation/ }).click();
    await expect(curation.getByText(/^Could not read the owner’s Treasure Map: /)).toBeVisible();
    await expect(curation.getByText('Curated by')).toHaveCount(0);
  });

  test('D12: a signed-in reader picks another of their Assistants, and the list is its Dictionary', async ({ page }) => {
    const asked = await mockStack(page, { session: CUSTOMER });
    await mockAssistants(page);
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { level: 1, name: 'Your Dictionary.' })).toBeVisible();
    const trigger = page.getByRole('button', { name: /^Managed by Baz’s Assistant/ });
    await expect(trigger).toBeVisible();
    await trigger.click();
    const menu = page.getByRole('menu', { name: 'Whose Dictionary to show' });
    await expect(menu.getByRole('menuitemradio')).toHaveText([/Baz’s Assistant\s*Local/, /Robin/, /All of my Assistants/]);
    await expect(menu.getByRole('menuitemradio', { name: /Baz’s Assistant/ })).toHaveAttribute('aria-checked', 'true');
    await menu.getByRole('menuitemradio', { name: /Robin/ }).click();
    await expect(page).toHaveURL(/\?managedBy=npub1/);
    await expect(page.getByText('2 concepts in Robin’s Dictionary')).toBeVisible();
    expect(asked.at(-1), 'Robin’s Dictionary is read for Robin alone').toBe(REMOTE_TA);
    expect(await names(page)).toEqual(['remote thing', 'remote only']);
    await expect(page.getByText('Read from this instance’s relay: Robin may keep more of its Dictionary on its own instance.')).toBeVisible();
    await page.getByRole('button', { name: /^Managed by Robin/ }).click();
    await page.getByRole('menuitemradio', { name: /Baz’s Assistant/ }).click();
    await expect(page).toHaveURL(/\/dictionary$/);
    await expect(page.getByText('1 concept in your Dictionary')).toBeVisible();
  });

  test('D13: All of my Assistants — one row per shared concept, with its support', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    await mockAssistants(page);
    await page.goto(`${PAGE}?managedBy=all`);
    await expect(page.getByText('2 concepts across your 2 Assistants')).toBeVisible();
    expect(await names(page)).toEqual(['customer thing', 'remote only']);
    const row = (name) => list(page).locator('.dict-row', { has: page.locator('.dict-row-name', { hasText: new RegExp(`^${name}$`) }) });
    await expect(row('customer thing').locator('.dict-support')).toHaveText('2 of 2 Assistants');
    await expect(row('remote only').locator('.dict-support')).toHaveText('1 of 2 Assistants');
    await expect(page.getByRole('button', { name: /^Managed by All of my Assistants/ })).toBeVisible();
    await expect(page.getByText(/^Read from this instance’s relay: your other Assistants may keep more/)).toBeVisible();
  });

  test('D14: a link to another Assistant’s Dictionary reads only that one, and its entry comes back to it', async ({ page }) => {
    const asked = await mockStack(page, { session: CUSTOMER });
    await mockEntry(page);
    await mockAssistants(page);
    await page.goto(`${PAGE}?managedBy=${REMOTE_TA}`);
    await expect(page.getByText('2 concepts in Robin’s Dictionary')).toBeVisible();
    expect(asked, 'never the reader’s own Dictionary first').toEqual([REMOTE_TA]);
    await list(page).getByRole('link', { name: /^remote thing/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'remote thing' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dictionary', exact: true })).toHaveAttribute('href', `/dictionary?managedBy=${REMOTE_TA}`);
    await expect(page.getByRole('button', { name: 'Robin’s header' })).toBeVisible();
  });

  test('D15: signed out it is a label; a link naming someone else’s Assistant falls back, and says so', async ({ page }) => {
    await mockStack(page);
    await page.goto(PAGE);
    await expect(page.locator('.bsd-managed')).toHaveText('Managed by The owner’s Assistant');
    await expect(page.getByRole('button', { name: /^Managed by/ })).toHaveCount(0);
    await page.goto(`${PAGE}?managedBy=nprofile1notavalidkey`);
    await expect(page.getByText(/concepts? in the owner’s Dictionary/)).toBeVisible();
    await expect(page.getByText(/so this is your own/)).toHaveCount(0);

    const page2 = await page.context().newPage();
    const asked = await mockStack(page2, { session: CUSTOMER });
    await mockAssistants(page2);
    await page2.goto(`${PAGE}?managedBy=${'9'.repeat(64)}`);
    await expect(page2.getByText('The link named a Dictionary that isn’t one of your Assistants’, so this is your own.')).toBeVisible();
    await expect(page2.getByText('1 concept in your Dictionary')).toBeVisible();
    expect(asked.at(-1)).toBe(`${CUST},${CUST_TA}`);
  });

  test('D16: an Assistant’s Dictionary that cannot be read is an error, never an empty Dictionary', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    await mockAssistants(page);
    let fail = true;
    await page.route('**/api/dictionaries/concepts?**', (r) => {
      const authors = new URL(r.request().url()).searchParams.get('authors');
      if (fail && authors === REMOTE_TA) return r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'boom' }) });
      return r.fallback();
    });
    await page.goto(`${PAGE}?managedBy=${REMOTE_TA}`);
    await expect(page.getByText('Could not assemble Robin’s Dictionary: boom')).toBeVisible();
    await expect(page.getByText(/concepts? in Robin’s Dictionary/)).toHaveCount(0);
    await expect(page.getByText(/holds no concept headers from Robin/)).toHaveCount(0);
    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('2 concepts in Robin’s Dictionary')).toBeVisible();
  });

  test('D17: when the reader’s Assistants cannot be read, the page says so, and Try again reads them', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    await mockAssistants(page);
    let fail = true;
    await page.route('**/api/assistant/my-assistants', (r) => (fail
      ? r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'down' }) })
      : r.fallback()));
    await page.goto(`${PAGE}?managedBy=${REMOTE_TA}`);
    await expect(page.getByText('Couldn’t load your Assistants, so this is your own Dictionary, not the one the link named.')).toBeVisible();
    await expect(page.getByText('1 concept in your Dictionary')).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('2 concepts in Robin’s Dictionary')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Managed by Robin/ })).toBeVisible();
  });

  test('D18: the menu works from the keyboard', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    await mockAssistants(page);
    await page.goto(PAGE);
    const trigger = page.getByRole('button', { name: /^Managed by Baz’s Assistant/ });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const items = page.getByRole('menuitemradio');
    await expect(items.nth(0), 'focus moves to the chosen option').toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press('End');
    await expect(items.nth(2)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(0), 'wraps to the top').toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(trigger, 'Escape returns focus to the trigger').toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\?managedBy=npub1/);
    await expect(page.getByRole('button', { name: /^Managed by Robin/ }), 'a pick returns focus to the trigger').toBeFocused();
  });

  test('D19: focus leaving for nowhere keeps the menu open, so a mouse pick lands; Escape on the trigger closes it', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    await mockAssistants(page);
    await page.goto(PAGE);
    const trigger = page.getByRole('button', { name: /^Managed by Baz’s Assistant/ });
    await trigger.click();
    await expect(page.getByRole('menu')).toBeVisible();
    // Safari blurs a pressed button without focusing it: focus goes nowhere before the click lands.
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await expect(page.getByRole('menu'), 'still open').toBeVisible();
    await page.getByRole('menuitemradio', { name: /Robin/ }).click();
    await expect(page).toHaveURL(/\?managedBy=npub1/);
    const robin = page.getByRole('button', { name: /^Managed by Robin/ });
    await robin.click();
    await robin.focus();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu'), 'Escape on the trigger closes it').toHaveCount(0);
  });

  test('D20: an Items row opens its item page, which says where it is and who filed it', async ({ page }) => {
    await mockStack(page);
    await mockEntry(page);
    const coord = coordOf(OWNER_TA, 'cat-breed');
    await page.goto(`${PAGE}/${encodeURIComponent(coord)}`);
    const card = page.locator('.dict-items');
    await expect(card.locator('.dict-items-count')).toHaveText('23 items');
    const link = card.getByRole('link', { name: 'item 03' });
    const id = String(3).padStart(64, '0');
    await expect(link).toHaveAttribute('href', `/dictionary/${encodeURIComponent(coord)}/items/${id}`);
    await card.locator('.dict-items-row', { has: page.getByRole('link', { name: 'item 04' }) }).locator('.dict-items-n').click();
    await expect(page.getByRole('heading', { level: 1, name: 'item 04' }), 'a click anywhere on the row opens it').toBeVisible();
    await page.goBack();
    await link.click();
    await expect(page.getByRole('heading', { level: 1, name: 'item 03' })).toBeVisible();
    await expect(page.getByText('Item 3 in cat breed')).toBeVisible();
    await expect(page.getByText('item 03 is one of the items the owner’s trusted community has filed under cat breed.')).toBeVisible();
    await expect(page.locator('.dict-filed-by-name')).toHaveText('Trusty');
    await expect(page.getByRole('link', { name: /View Nostr profile/ })).toHaveAttribute('href', `/user/${TRUSTED_FILER}`);
    await page.getByRole('button', { name: 'Raw Nostr event' }).click();
    await expect(page.locator('#dict-item-raw .dict-json')).toContainText('["name","item 03"]');
    const back = page.getByRole('link', { name: 'cat breed', exact: true });
    await expect(back).toHaveAttribute('href', `/dictionary/${encodeURIComponent(coord)}`);
    await back.click();
    await expect(page.getByRole('heading', { level: 1, name: 'cat breed' })).toBeVisible();
    await expect(page.locator('.dict-items .dict-items-count')).toHaveText('23 items');
  });

  test('D21: a direct visit works out the item’s number, and says when it isn’t in the trusted Items', async ({ page }) => {
    await mockStack(page);
    const itemsAsked = await mockEntry(page);
    const coord = coordOf(OWNER_TA, 'cat-breed');
    const id5 = String(5).padStart(64, '0');
    await page.goto(`${PAGE}/${encodeURIComponent(coord)}/items/${id5}`);
    await expect(page.getByText('Item 5 in cat breed')).toBeVisible();
    expect(itemsAsked, 'the Items are read once, for the entry and its shared concept').toHaveLength(1);
    expect(itemsAsked[0]).toMatchObject({ coord, shared: FOREIGN });

    await page.goto(`${PAGE}/${encodeURIComponent(coord)}/items/${UNTRUSTED_ITEM}`);
    await expect(page.getByRole('heading', { level: 1, name: 'mystery' })).toBeVisible();
    await expect(page.locator('.dict-entry-sub')).toHaveText('Filed under cat breed');
    await expect(page.getByText('mystery is filed under cat breed, but not by anyone the owner’s community trusts, so it isn’t in the entry’s Items.')).toBeVisible();
  });

  test('D22: the item page says no more than it knows', async ({ page }) => {
    await mockStack(page);
    await mockEntry(page);
    const coord = coordOf(OWNER_TA, 'cat-breed');
    // Filed under another concept: not "untrusted", and not "in" this one.
    await page.goto(`${PAGE}/${encodeURIComponent(coord)}/items/${ELSEWHERE_ITEM}`);
    await expect(page.getByText('stray isn’t filed under cat breed.')).toBeVisible();
    await expect(page.getByText(/not by anyone/)).toHaveCount(0);
    await expect(page.getByText(/Filed under cat breed|Item \d+ in/)).toHaveCount(0);

    // A "%" in a d-tag: the router has decoded it once; the page must not decode it again and crash.
    await page.goto(`${PAGE}/${encodeURIComponent(coord)}/items/${encodeURIComponent(`39999:${TRUSTED_FILER}:50%off`)}`);
    await expect(page.getByRole('heading', { level: 1, name: `39999:${TRUSTED_FILER}:50%off` })).toBeVisible();
    await expect(page.getByText('No event found for this item on this relay.').first()).toBeVisible();
    await expect(page.getByText(/Unexpected Application Error|URI malformed/)).toHaveCount(0);

    // The person's Dictionary can't be read: say so, and nothing about trust.
    const page2 = await page.context().newPage();
    await mockStack(page2);
    await mockEntry(page2);
    await page2.route('**/api/dictionaries/concepts?**', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'boom' }) }));
    await page2.goto(`${PAGE}/${encodeURIComponent(coord)}/items/${UNTRUSTED_ITEM}`);
    await expect(page2.getByText(/^Couldn’t read the owner’s Dictionary \(boom\)/)).toBeVisible();
    await expect(page2.getByText(/not by anyone/)).toHaveCount(0);
  });

  test('D23: a modified click on an Items row is left to the browser', async ({ page }) => {
    await mockStack(page);
    await mockEntry(page);
    const coord = coordOf(OWNER_TA, 'cat-breed');
    await page.goto(`${PAGE}/${encodeURIComponent(coord)}`);
    const row = page.locator('.dict-items .dict-items-row', { has: page.getByRole('link', { name: 'item 02' }) });
    await row.locator('.dict-items-n').click({ modifiers: ['ControlOrMeta'] });
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(new RegExp(`/dictionary/${encodeURIComponent(coord)}$`));
    await row.locator('.dict-items-n').click();
    await expect(page.getByRole('heading', { level: 1, name: 'item 02' })).toBeVisible();
  });

  test('D24: a signed-in customer creates a shared concept, signed with their own key', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    const published = await mockCreate(page, { key: CUST });
    await page.goto(PAGE);
    await page.getByRole('link', { name: 'Create New Concept' }).click();
    await expect(page).toHaveURL(/\/dictionary\/new$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Create New Concept' })).toBeVisible();
    const create = page.getByRole('button', { name: 'Create concept' });
    await expect(create, 'both names first').toBeDisabled();
    await page.getByLabel('Singular name').fill('Taco Truck in Nashville');
    await page.getByLabel('Plural name').fill('Taco Trucks in Nashville');
    await page.getByLabel('Description').fill('Trucks that sell tacos.');
    const coord = `39998:${CUST}:taco-truck-in-nashville`;
    await expect(page.getByLabel('Header preview')).toContainText(`["b","${coord}","pointer"]`);
    await expect(page.getByText('Header you publish (shared: its b-tag points to itself)')).toBeVisible();
    await expect(page.getByText(/You publish the header, signed with your nostr extension, and share it, so others can find it and adopt it\./)).toBeVisible();
    await expect(page.getByText(/Private/)).toHaveCount(0);
    await create.click();
    await expect(page).toHaveURL(`${new URL(page.url()).origin}/dictionary/${encodeURIComponent(coord)}`);
    await expect(page.getByText('Saved here. External publishing is off for this deployment, so it was not sent onward.')).toBeVisible();
    expect(published, 'one publish').toHaveLength(1);
    expect(published[0].signAs).toBe('client');
    expect(published[0].event.pubkey).toBe(CUST);
    expect(published[0].event.tags).toEqual([
      ['d', 'taco-truck-in-nashville'], ['names', 'Taco Truck in Nashville', 'Taco Trucks in Nashville'],
      ['description', 'Trucks that sell tacos.'], ['b', coord, 'pointer'],
    ]);
  });

  test('D25: a header the signer already has at that name is never replaced', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    const published = await mockCreate(page, { key: CUST, existing: true });
    await page.goto(`${PAGE}/new`);
    await page.getByLabel('Singular name').fill('Bird');
    await page.getByLabel('Plural name').fill('Birds');
    await page.getByRole('button', { name: 'Create concept' }).click();
    await expect(page.getByRole('alert')).toContainText('You already have a concept header at this name');
    await expect(page.getByRole('link', { name: 'open the existing one' })).toHaveAttribute('href', `/dictionary/${encodeURIComponent(`39998:${CUST}:bird`)}`);
    expect(published, 'nothing published').toHaveLength(0);
  });

  test('D26: the owner’s Assistant signs on the server; another key is refused; signed out it is disabled', async ({ page }) => {
    await mockStack(page, { session: { pubkey: OWNER, assistantPubkey: OWNER_TA, classification: 'owner' } });
    const published = await mockCreate(page, { key: OWNER });
    await page.goto(`${PAGE}/new`);
    await expect(page.getByText('Header your Assistant publishes (shared: its b-tag points to itself)')).toBeVisible();
    await page.getByLabel('Singular name').fill('Bird');
    await page.getByLabel('Plural name').fill('Birds');
    await page.getByRole('button', { name: 'Create concept' }).click();
    await expect(page).toHaveURL(new RegExp(`/dictionary/${encodeURIComponent(`39998:${OWNER_TA}:bird`)}$`));
    expect(published[0].signAs).toBe('assistant');
    expect(published[0].event.sig, 'the server signs it').toBeUndefined();
    expect(published[0].event.tags.at(-1)).toEqual(['b', `39998:${OWNER_TA}:bird`, 'pointer']);

    const page2 = await page.context().newPage();
    await mockStack(page2, { session: CUSTOMER });
    const none = await mockCreate(page2, { key: 'f'.repeat(64) });
    await page2.goto(`${PAGE}/new`);
    await page2.getByLabel('Singular name').fill('Bird');
    await page2.getByLabel('Plural name').fill('Birds');
    await page2.getByRole('button', { name: 'Create concept' }).click();
    await expect(page2.getByRole('alert')).toContainText('Your nostr extension holds a different key from the account you’re signed in with.');
    expect(none).toHaveLength(0);

    const page3 = await page.context().newPage();
    await mockStack(page3);
    await page3.goto(`${PAGE}/new`);
    await expect(page3.getByText('Sign in to create a concept.')).toBeVisible();
    await expect(page3.getByLabel('Singular name')).toBeDisabled();
    await expect(page3.getByRole('button', { name: 'Create concept' })).toBeDisabled();
  });

  test('D9: with a setup step left, the Setup Alert is centred in the bar and the avatar sits at its right', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockStack(page, { session: CUSTOMER });
    await page.route('**/api/setup/status**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({
        success: true, signedIn: true,
        steps: { account: { done: true }, follow: { done: false, pending: true }, activate: { done: false, pending: true } },
      }),
    }));
    await page.goto(PAGE);
    const alert = page.locator('.bsd-nav .bs-setup-alert');
    await expect(alert).toBeVisible();
    const bar = await page.locator('.bsd-nav').boundingBox();
    const pill = await alert.boundingBox();
    const avatar = await page.locator('.bsd-nav .bs-usermenu').boundingBox();
    expect(Math.abs((pill.x + pill.width / 2) - (bar.x + bar.width / 2)), 'the pill is centred').toBeLessThan(4);
    expect(avatar.x, 'the avatar is right of the pill').toBeGreaterThan(pill.x + pill.width);
    expect(bar.x + bar.width - (avatar.x + avatar.width), 'and near the right edge').toBeLessThan(40);
  });
});
