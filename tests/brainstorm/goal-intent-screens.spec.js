const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

/**
 * goal-intent-fields #3: Show the four on the goal screens that already exist.
 *
 * Story: engineering-team/stories/goal-intent-fields/3-show-the-four-on-the-goal-screens-that-already-exist.md
 * ADR:   engineering-team/decisions/goal-intent-fields/0003-screen-side-intent-display-and-the-narrow-d13-supersession.md
 *        — **Amendment 1** authorizes this class.
 * Unit/source half: test/show-the-four-on-the-goal-screens-that-already-exist.test.js (U/S/H/R).
 *
 * ── Why this file exists ─────────────────────────────────────────────────
 * Gate 3 built a probe against the ratified design: goalIntent.js implemented
 * faithfully, imported into all three screens, all four properties named, every
 * formatter CALLED — and none of the results RENDERED. The U/S/H suite went
 * 36 passed, 0 failed. The owner saw exactly what they see today: nothing.
 *
 * An S-class scan asserts a token appears IN A FILE. Only a browser can assert a
 * value reaches A SCREEN. AC1's "all four visible", AC2's "still shows the goal",
 * and — most of all — ADR d2 ("a number renders only where the owner recorded
 * one", a RENDERING-TIME BRANCH that a source scan sees both arms of) are
 * decided here and nowhere else.
 *
 * Network-mocked browser round-trip against the local control panel, following
 * tests/brainstorm/tapestry-create.spec.js rather than inventing a pattern.
 *
 *   B0 — the served bundle is not older than the sources under test.   [prerequisite]
 *   B1 — Goals list, all four stored: estimate number, both flag words, prompt TEXT. [AC1]
 *   B2 — Goals list, none stored: the row still renders, with the declared defaults
 *        and the prompt shown explicitly as not set.                     [AC2]
 *   B3 — Goal detail: all four, and the prompt IN FULL — proved by a marker taken
 *        from BEYOND PROMPT_EXCERPT_MAX.                                 [AC1]
 *   B4 — Goal detail, none stored: defaults rendered, never a literal null.  [AC2]
 *   B5 — Proposals card, owner-recorded estimate: its number appears.    [AC1 + ADR d1]
 *   B6 — Proposals card, never recorded: the words appear and NO DIGIT appears in
 *        the estimate's position.            [AC4 + ADR d2 — the decisive assertion]
 *   B7 — AC4 at rendered level: row order equals the mocked response order. [AC4]
 *
 * ── The expected strings come from the module, not from this file ────────
 * Every assertion is built from goalIntent.js's OWN exports (LABEL_*, PROMPT_UNSET,
 * estimateLine(), flagWord(), promptDisplay()). The story says copy is "a review
 * consideration, not an externally testable criterion", so this file pins no
 * sentence: it pins that THE FORMATTER'S OUTPUT REACHES THE DOM. Reword any
 * constant and these still pass; delete a render call and they all fail.
 *
 * ── Prerequisites ────────────────────────────────────────────────────────
 *   BRAINSTORM_SERVER_ACCESSIBLE=true   (the tapestry-create.spec.js gate)
 *   the control panel up on $BRAINSTORM_BASE_URL (default http://localhost:7778)
 *   **the UI BUILT** — bin/control-panel.js:124 serves <repo>/dist, and ui/ builds
 *   there via `cd ui && npm run build` (ui/vite.config.js outDir '../dist').
 *   A source-only edit is INVISIBLE to this class. B0 guards exactly that.
 *
 * These FAIL against the current build: ui/src/utils/goalIntent.js does not exist
 * and the three screens render none of the four.
 */

const REPO = path.resolve(__dirname, '../..');
const GOAL_INTENT = path.join(REPO, 'ui/src/utils/goalIntent.js');
const DIST_INDEX = path.join(REPO, 'dist/index.html');
const SOURCES_UNDER_TEST = [
  GOAL_INTENT,
  path.join(REPO, 'ui/src/pages/brain/Goals.jsx'),
  path.join(REPO, 'ui/src/pages/brain/GoalDetail.jsx'),
  path.join(REPO, 'ui/src/pages/brain/Proposals.jsx'),
  path.join(REPO, 'ui/src/styles.css'),
];

test.describe('Show the four on the goal screens (goal-intent-fields #3)', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  const TA = 'e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36';
  const OWNER = '1111111111111111111111111111111111111111111111111111111111111111';

  /* ── the formatter module: the source of every expected string ──────────
   * Loaded by dynamic import of the plain .js (ui/package.json is
   * "type": "module"). A missing module fails LOUDLY here rather than
   * surfacing as an unreadable ERR_MODULE_NOT_FOUND inside a browser test.
   */
  let giCache = null;
  async function gi() {
    if (giCache) return giCache;
    if (!fs.existsSync(GOAL_INTENT)) {
      throw new Error(
        'ui/src/utils/goalIntent.js does not exist yet — ADR 0003 d3\'s one pure formatter is not implemented, ' +
        'so nothing can reach any of these three screens. (The unit half of this story fails the same way.)');
    }
    const mod = await import(pathToFileURL(GOAL_INTENT).href);
    for (const name of ['promptDisplay', 'estimateLine', 'estimateLineOnProposalCard', 'flagWord',
      'LABEL_ESTIMATE', 'LABEL_NEEDS_YOU', 'LABEL_TOO_BIG', 'PROMPT_UNSET', 'ESTIMATE_UNSET_ON_CARD',
      'PROMPT_EXCERPT_MAX']) {
      if (mod[name] === undefined) {
        throw new Error(`ui/src/utils/goalIntent.js must export \`${name}\` (ADR 0003 d3). ` +
          `Exports found: ${Object.keys(mod).join(', ')}`);
      }
    }
    giCache = mod;
    return mod;
  }

  const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  /** `label` then `value`, separated by any whitespace — a label carrying a value. */
  const labelled = (label, value) => new RegExp(`${escapeRe(label)}\\s*${escapeRe(value)}`);
  /** DOM text with runs of whitespace collapsed, so JSX line breaks don't matter. */
  const flat = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

  /* ── fixtures: one goal with all four, one with none ────────────────────
   * The prompt is long enough to be truncated on a list screen AND carries a
   * marker deep inside it. That marker is the only instrument that separates
   * "in full" (B3) from "an excerpt" (B1) — no source-level test can do it.
   */
  const DEEP_MARKER = 'ZEBRAFISH-CHECKPOINT-8817';
  const LONG_PROMPT = [
    '# Session prompt',
    '',
    'Read the goal, then orient before touching code.',
    '',
    ...Array.from({ length: 40 }, (_, i) => `${i + 1}. step ${i + 1} — do the thing and write down what happened`),
    '',
    `Before you finish, say ${DEEP_MARKER} out loud.`,
    '',
  ].join('\n');

  const GOAL_ALL = {
    uuid: `39999:${TA}:goal-with-all-four`,
    name: 'Wire the greenhouse sensors',
    slug: 'goal-with-all-four',
    statement: 'the ask, in one sentence',
    origin: 'noted in conversation',
    capturedOn: '2026-07-04',
    captureDate: '2026-07-04',
    standing: 'viable',
    deliverable: 'what done produces',
    boundary: 'what it stays inside',
    parent: null, parentUuid: null, parentSlug: null, parentName: null,
    hasChildren: false, pointerCount: 0,
    prompt: LONG_PROMPT,
    chanceOfSuccess: 75,
    needsHumanInput: false,   // stored EXPLICITLY — the value 5 live goals carry
    needsBreakdown: true,
  };
  const GOAL_NONE = {
    uuid: `39999:${TA}:goal-with-none-of-the-four`,
    name: 'Repaint the potting shed',
    slug: 'goal-with-none-of-the-four',
    statement: 'the other ask',
    origin: 'noted in conversation',
    capturedOn: '2026-07-03',
    captureDate: '2026-07-03',
    standing: 'viable',
    deliverable: 'what done produces',
    boundary: 'what it stays inside',
    parent: null, parentUuid: null, parentSlug: null, parentName: null,
    hasChildren: false, pointerCount: 0,
    prompt: null, chanceOfSuccess: null, needsHumanInput: null, needsBreakdown: null,
  };

  function card(goal) {
    return {
      proposalId: `proposed-${goal.slug}-abc123`,
      goal: goal.slug,
      goalName: goal.name,
      whyNow: 'nothing else is blocked by it',
      passedOver: [{ goal: 'some-other-goal', goalName: 'Some other goal', whyNot: 'it can wait' }],
      madeOn: '2026-07-06',
      prompt: goal.prompt,
      chanceOfSuccess: goal.chanceOfSuccess,
      needsHumanInput: goal.needsHumanInput,
      needsBreakdown: goal.needsBreakdown,
    };
  }

  /**
   * Install the route mocks. `goals` drives both the list and the detail read;
   * `proposals` drives the queue. Every endpoint the three pages touch is
   * stubbed — an unmocked one would hang the load and look like a render bug.
   */
  async function mock(page, { goals = [], proposals = [], classification = 'owner' } = {}) {
    const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

    // ConfigContext plumbing.
    await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: TA })));
    await page.route('**/api/owner/pubkey', (r) => r.fulfill(json({ success: true, pubkey: OWNER })));
    await page.route('**/api/relays', (r) => r.fulfill(json({ success: true, relays: [] })));
    await page.route('**/api/status', (r) => r.fulfill(json({ success: true })));

    // AuthContext: status → classification → profile. All three pages render a
    // lock panel unless classification is owner/admin (ADR 0003 Amendment 1).
    await page.route('**/api/auth/status', (r) => r.fulfill(json({ authenticated: true, pubkey: OWNER })));
    await page.route('**/api/auth/user-classification', (r) => r.fulfill(json({ classification, pubkey: OWNER, assistantPubkey: TA })));
    await page.route('**/api/profiles**', (r) => r.fulfill(json({ success: true, profiles: {} })));

    // One handler for the brain reads, dispatched on the path — Playwright
    // resolves overlapping page.route patterns in reverse registration order,
    // and a single dispatcher removes any doubt about which one wins.
    await page.route('**/api/brain/**', (r) => {
      const url = new URL(r.request().url());
      const p = url.pathname;
      if (p === '/api/brain/goals') return r.fulfill(json({ success: true, goals }));
      if (p.startsWith('/api/brain/goals/')) {
        const slug = decodeURIComponent(p.slice('/api/brain/goals/'.length));
        const goal = goals.find((g) => g.slug === slug) || null;
        return r.fulfill(json({ success: true, goal, pointers: [], records: [] }));
      }
      if (p === '/api/brain/proposals') return r.fulfill(json({ success: true, proposals }));
      return r.fulfill(json({ success: true }));
    });
  }

  /** The one goal row whose text carries `name`, asserted unique first (OPEN.md #108). */
  async function goalRow(page, name) {
    const rows = page.locator('.brain-goal-row', { hasText: name });
    await expect(rows, `exactly one goal row must carry the name "${name}"`).toHaveCount(1, { timeout: 15000 });
    return rows.first();
  }
  async function proposalCard(page, goalName) {
    const cards = page.locator('.brain-proposal-card', { hasText: goalName });
    await expect(cards, `exactly one proposal card must nominate "${goalName}"`).toHaveCount(1, { timeout: 15000 });
    return cards.first();
  }

  /**
   * The text of the INNERMOST element(s) carrying `label` — "the estimate's
   * position" in AC4's sense. Returns null when no descendant carries it, so
   * the caller can fail loudly rather than widen to the whole card and
   * accidentally scan a date for digits.
   */
  async function innermostTextCarrying(scope, label) {
    return scope.evaluate((el, lbl) => {
      const hits = [...el.querySelectorAll('*')].filter((n) => (n.textContent || '').includes(lbl));
      if (hits.length === 0) return null;
      const inner = hits.filter((n) => !hits.some((m) => m !== n && n.contains(m)));
      return inner.map((n) => n.textContent).join(' | ');
    }, label);
  }

  /* ───────── B0 — the served bundle must contain the code under test ─────────
   * Content-based, NOT mtime-based. A first draft compared dist/index.html's
   * mtime against the sources' and it was wrong twice over: `git checkout`,
   * `git stash` and a fresh clone all rewrite source mtimes, so a stale bundle
   * can look fresh and a fresh one stale. Asking whether the built bundle
   * actually CONTAINS the module's strings answers the real question — "is the
   * code I am asserting about the code that is running?" — and cannot be fooled
   * by a timestamp.
   */
  test('B0: the control panel is serving a bundle built from the sources under test', async () => {
    const m = await gi();
    expect(fs.existsSync(DIST_INDEX),
      'dist/index.html is missing — the control panel serves <repo>/dist (bin/control-panel.js:124), and ui/ ' +
      'builds there (ui/vite.config.js outDir: "../dist"). Run `cd ui && npm run build`.').toBe(true);

    const assetsDir = path.join(REPO, 'dist/assets');
    expect(fs.existsSync(assetsDir), 'dist/assets is missing — the bundle is incomplete.').toBe(true);
    const bundles = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
    expect(bundles.length, 'no JavaScript bundle in dist/assets to inspect').toBeGreaterThan(0);

    // A string literal survives minification, so the module's own owner-facing
    // copy is a reliable marker that this build includes it.
    const marker = m.PROMPT_UNSET;
    const present = bundles.some((f) => fs.readFileSync(path.join(assetsDir, f), 'utf8').includes(marker));
    expect(present,
      `the served bundle does not contain ${JSON.stringify(marker)}, a string ui/src/utils/goalIntent.js exports. ` +
      'Either the bundle predates your edit — run `cd ui && npm run build`, because a source-only edit is ' +
      'INVISIBLE to a browser test — or no screen imports the module, in which case B1-B6 below say so directly.')
      .toBe(true);
  });

  /* ───────── B1 — Goals list, all four stored ───────── */
  test('B1: on the Goals list a goal with all four shows the estimate, both flags, and the prompt as text', async ({ page }) => {
    const m = await gi();
    await mock(page, { goals: [GOAL_ALL, GOAL_NONE] });
    await page.goto('/tapestry/goals');
    await page.waitForLoadState('networkidle');

    const row = await goalRow(page, GOAL_ALL.name);
    const text = flat(await row.textContent());

    expect(text, `AC1: the estimate must be VISIBLE as a value on the row. Row read: "${text}"`)
      .toMatch(labelled(m.LABEL_ESTIMATE, m.estimateLine(GOAL_ALL.chanceOfSuccess)));
    expect(text, `AC1: the "needs you" flag, stored explicitly as false, must be visible as a value. Row read: "${text}"`)
      .toMatch(labelled(m.LABEL_NEEDS_YOU, m.flagWord(GOAL_ALL.needsHumanInput)));
    expect(text, `AC1: the "too big" flag, stored as true, must be visible as a value. Row read: "${text}"`)
      .toMatch(labelled(m.LABEL_TOO_BIG, m.flagWord(GOAL_ALL.needsBreakdown)));
    expect(m.flagWord(true), 'the two flags in this fixture differ, so the row must show two different words')
      .not.toBe(m.flagWord(false));

    // The prompt AS ITS OWN TEXT. AC1: "A bare presence indicator — a badge, an
    // icon, a 'has prompt' label with none of the text — does not satisfy this."
    // That is a claim about what is rendered, and this is where it is settled.
    const excerpt = m.promptDisplay(LONG_PROMPT).text;
    const opening = flat(excerpt).slice(0, 40);
    expect(opening.length, 'the excerpt fixture must be long enough to recognise').toBeGreaterThan(20);
    expect(text, `AC1: the prompt must appear as an EXCERPT OF THE ACTUAL PROMPT — its own opening characters, ` +
      `not a badge. Expected to find "${opening}". Row read: "${text}"`).toContain(opening);
  });

  /* ───────── B2 — Goals list, none of the four stored ───────── */
  test('B2: on the Goals list a goal with none of them still renders, at the declared defaults, and says the prompt is not set', async ({ page }) => {
    const m = await gi();
    await mock(page, { goals: [GOAL_ALL, GOAL_NONE] });
    await page.goto('/tapestry/goals');
    await page.waitForLoadState('networkidle');

    const row = await goalRow(page, GOAL_NONE.name);
    const text = flat(await row.textContent());

    expect(text, `AC2: a never-set estimate shows the concept's declared default. Row read: "${text}"`)
      .toMatch(labelled(m.LABEL_ESTIMATE, m.estimateLine(null)));
    expect(text, `AC2: a never-set flag shows the declared false. Row read: "${text}"`)
      .toMatch(labelled(m.LABEL_NEEDS_YOU, m.flagWord(null)));
    expect(text, `AC2: and so does the second flag. Row read: "${text}"`)
      .toMatch(labelled(m.LABEL_TOO_BIG, m.flagWord(null)));
    expect(text, `AC2: the prompt declares no default, so it is shown explicitly as NOT SET. Row read: "${text}"`)
      .toContain(flat(m.PROMPT_UNSET));
    expect(text, 'AC2: "Rendering a literal null or undefined … does not satisfy this."')
      .not.toMatch(/\b(null|undefined|NaN)\b/i);
  });

  /* ───────── B3 — Goal detail, the prompt IN FULL ───────── */
  test('B3: on the Goal detail all four are visible and the prompt appears in full, not as an excerpt', async ({ page }) => {
    const m = await gi();
    await mock(page, { goals: [GOAL_ALL, GOAL_NONE] });
    await page.goto(`/tapestry/goals/${GOAL_ALL.slug}`);
    await page.waitForLoadState('networkidle');

    const page_ = page.locator('.brain-goals');
    await expect(page_.first(), 'the goal detail page must render').toBeVisible({ timeout: 15000 });
    const text = flat(await page_.first().textContent());

    expect(text, `AC1: the estimate must be visible on the detail page. Page read: "${text.slice(0, 400)}"`)
      .toMatch(labelled(m.LABEL_ESTIMATE, m.estimateLine(GOAL_ALL.chanceOfSuccess)));
    expect(text, 'AC1: the "needs you" flag, stored explicitly as false, must be visible')
      .toMatch(labelled(m.LABEL_NEEDS_YOU, m.flagWord(GOAL_ALL.needsHumanInput)));
    expect(text, 'AC1: the "too big" flag must be visible')
      .toMatch(labelled(m.LABEL_TOO_BIG, m.flagWord(GOAL_ALL.needsBreakdown)));

    // THE assertion that separates "in full" from "an excerpt". The marker sits
    // deep inside the prompt, far beyond the excerpt bound — so it can only be
    // on screen if the WHOLE prompt is. No source-level instrument can do this.
    const markerAt = LONG_PROMPT.indexOf(DEEP_MARKER);
    expect(markerAt, 'the fixture marker must exist in the prompt').toBeGreaterThan(-1);
    expect(markerAt,
      `the marker must sit BEYOND PROMPT_EXCERPT_MAX (${m.PROMPT_EXCERPT_MAX}) or this test proves nothing — ` +
      'an excerpt would contain it too.').toBeGreaterThan(m.PROMPT_EXCERPT_MAX);
    expect(text,
      `AC1: the prompt appears "in full on the goal detail screen". A marker ${markerAt} characters into the ` +
      `prompt — well past the ${m.PROMPT_EXCERPT_MAX}-character excerpt bound — is missing, so the detail page ` +
      'is showing an excerpt rather than the whole prompt.').toContain(DEEP_MARKER);
  });

  /* ───────── B4 — Goal detail, none of the four stored ───────── */
  test('B4: the Goal detail of a goal with none of them renders the declared defaults and never a literal null', async ({ page }) => {
    const m = await gi();
    await mock(page, { goals: [GOAL_ALL, GOAL_NONE] });
    await page.goto(`/tapestry/goals/${GOAL_NONE.slug}`);
    await page.waitForLoadState('networkidle');

    const root = page.locator('.brain-goals').first();
    await expect(root, 'AC2: the screen renders without error and still shows the goal').toBeVisible({ timeout: 15000 });
    await expect(root, 'AC2: and it still shows the goal itself').toContainText(GOAL_NONE.name);
    const text = flat(await root.textContent());

    expect(text, `AC2: the declared default estimate. Page read: "${text.slice(0, 400)}"`)
      .toMatch(labelled(m.LABEL_ESTIMATE, m.estimateLine(null)));
    expect(text, 'AC2: the declared default for the first flag').toMatch(labelled(m.LABEL_NEEDS_YOU, m.flagWord(null)));
    expect(text, 'AC2: the declared default for the second flag').toMatch(labelled(m.LABEL_TOO_BIG, m.flagWord(null)));
    expect(text, 'AC2: the prompt, which declares no default, is shown explicitly as not set')
      .toContain(flat(m.PROMPT_UNSET));
    expect(text, 'AC2: never a literal null/undefined').not.toMatch(/\b(null|undefined|NaN)\b/i);
  });

  /* ───────── B5 — Proposals card, an owner-recorded estimate ───────── */
  test('B5: on the Proposals card an estimate the owner recorded appears as its number', async ({ page }) => {
    const m = await gi();
    await mock(page, { goals: [GOAL_ALL], proposals: [card(GOAL_ALL)] });
    await page.goto('/tapestry/proposals');
    await page.waitForLoadState('networkidle');

    const c = await proposalCard(page, GOAL_ALL.name);
    const text = flat(await c.textContent());

    expect(text,
      `ADR 0003 d1 — the ratified supersession of second-brain 0006 d13, at its exact width: a value the OWNER ` +
      `recorded may render as its number on this card. Card read: "${text}"`)
      .toMatch(labelled(m.LABEL_ESTIMATE, m.estimateLineOnProposalCard(GOAL_ALL.chanceOfSuccess)));
    expect(text, 'AC1: both flags visible on the card')
      .toMatch(labelled(m.LABEL_NEEDS_YOU, m.flagWord(GOAL_ALL.needsHumanInput)));
    expect(text, 'AC1: and the second flag').toMatch(labelled(m.LABEL_TOO_BIG, m.flagWord(GOAL_ALL.needsBreakdown)));

    const opening = flat(m.promptDisplay(LONG_PROMPT).text).slice(0, 40);
    expect(text, `AC1: the prompt as an excerpt of the actual prompt, not a badge. Expected "${opening}".`)
      .toContain(opening);

    // d1's untouched half: the runners-up carry no number, ever.
    const runners = c.locator('.brain-proposal-runner');
    const runnerCount = await runners.count();
    expect(runnerCount, 'the fixture supplies one passed-over runner-up to inspect').toBeGreaterThan(0);
    for (let i = 0; i < runnerCount; i += 1) {
      const rt = flat(await runners.nth(i).textContent());
      expect(rt, 'ADR 0003 d1: d13\'s reach over passedOver is NOT superseded — attaching any number to a ' +
        `runner-up remains forbidden outright. Runner-up read: "${rt}"`).not.toMatch(/\d/);
    }
  });

  /* ───────── B6 — Proposals card, never recorded: THE decisive assertion ───────── */
  test('B6: on the Proposals card an estimate nobody recorded appears in words, with no digit in its place', async ({ page }) => {
    const m = await gi();
    await mock(page, { goals: [GOAL_NONE], proposals: [card(GOAL_NONE)] });
    await page.goto('/tapestry/proposals');
    await page.waitForLoadState('networkidle');

    const c = await proposalCard(page, GOAL_NONE.name);
    const text = flat(await c.textContent());

    expect(text,
      `ADR 0003 d2: when the owner recorded nothing, the card states the declared default IN PLAIN WORDS. ` +
      `Card read: "${text}"`).toContain(flat(m.ESTIMATE_UNSET_ON_CARD));

    // The decisive one. AC4: "On the Proposals screen the estimate appears as the
    // owner's own recorded value." A screen-applied default is not the owner's
    // value, so no digit may appear where they recorded nothing. Scoped to the
    // innermost element carrying the label so a date elsewhere on the card
    // cannot make this pass or fail by accident.
    const estimateArea = await innermostTextCarrying(c, m.LABEL_ESTIMATE);
    expect(estimateArea,
      `could not isolate the estimate's position on the card: no element carries ${JSON.stringify(m.LABEL_ESTIMATE)}. ` +
      'Either the estimate is not rendered at all (AC1), or it is rendered without its label.').not.toBeNull();
    expect(flat(estimateArea),
      'ADR 0003 d2, at the level where d2 is actually decided: a manufactured 0 next to a real 75 reads as ' +
      '"the owner rates this one zero" — the false attribution second-brain 0006 d13 exists to prevent, and the ' +
      `supersession does not reach it. Estimate area read: "${flat(estimateArea)}"`).not.toMatch(/\d/);

    expect(text, 'AC2: and the prompt is shown explicitly as not set here too').toContain(flat(m.PROMPT_UNSET));
    expect(text, 'AC2: never a literal null/undefined on an owner-facing card').not.toMatch(/\b(null|undefined|NaN)\b/i);
  });

  /* ───────── B7 — AC4 at rendered level ───────── */
  test('B7: the rendered order of the Goals list is the order the server sent, not an order the estimates imply', async ({ page }) => {
    // Deliberately adversarial: the server's order runs LOW estimate first. A
    // sort-by-estimate (descending, the tempting one) flips these two; a token
    // scan cannot see that at all.
    const low = { ...GOAL_NONE, name: 'Alpha — low estimate', slug: 'alpha-low', uuid: `39999:${TA}:alpha-low`, chanceOfSuccess: 1 };
    const high = { ...GOAL_NONE, name: 'Bravo — high estimate', slug: 'bravo-high', uuid: `39999:${TA}:bravo-high`, chanceOfSuccess: 99 };
    const mid = { ...GOAL_NONE, name: 'Charlie — no estimate', slug: 'charlie-none', uuid: `39999:${TA}:charlie-none` };
    const sent = [low, high, mid];

    await mock(page, { goals: sent });
    await page.goto('/tapestry/goals');
    await page.waitForLoadState('networkidle');

    const rows = page.locator('.brain-goal-row');
    await expect(rows, 'all three goals must be listed — nothing may be filtered out by what the four contain (AC4)')
      .toHaveCount(sent.length, { timeout: 15000 });

    const rendered = [];
    for (let i = 0; i < sent.length; i += 1) rendered.push(flat(await rows.nth(i).textContent()));
    const order = sent.map((g) => rendered.findIndex((t) => t.includes(g.name)));
    expect(order, `every sent goal must appear exactly once; rendered rows: ${JSON.stringify(rendered.map((t) => t.slice(0, 40)))}`)
      .not.toContain(-1);
    expect(order,
      'AC4: "which goals appear, and in what order, is identical to before this story." The rendered order must ' +
      `be the server's order [0,1,2]; got ${JSON.stringify(order)}. A sort, filter or grouping keyed on the ` +
      'estimate is the only way this differs.').toEqual([0, 1, 2]);
  });
});
