/**
 * ta-avatar #1: In-app badged TA avatar.
 *
 * Story: engineering-team/stories/ta-avatar/1-in-app-badged-ta-avatar.md
 * ADR:   engineering-team/decisions/ta-avatar/0001-shared-avatar-with-ta-badge-overlay.md
 * Browser half: tests/brainstorm/ta-badged-avatar.spec.js (B class — where the ACs are settled).
 *
 * ── What this class can and cannot prove ─────────────────────────────────
 * The Node harness has no JSX transpile and react-dom lives only in the ui/ Vite
 * workspace, so this file asserts on ui/src SOURCE TEXT (the house pattern — see
 * test/note-surfaces-ui.test.js's header for the canonical rationale).
 *
 * A source scan proves a token is IN A FILE. It cannot prove a badge reaches a
 * SCREEN — every acceptance criterion here is about what a viewer sees, and the
 * goal-intent-fields #3 kick-back (Gate 3, 2026-07-27: "green suite, invisible
 * feature") is the standing precedent that this class alone is not enough. So the
 * split is deliberate and stated:
 *
 *   S (here)  — the ratified STRUCTURE exists: the component, the asset, the
 *               classes, the delegation, the runtime TA lookup. Fails now.
 *   R (here)  — regression sentinels for what the ADR promised NOT to disturb.
 *               These PASS before and after; they fail only on collateral damage.
 *   B (there) — the ACs themselves, in a browser, against mocked network.
 *
 * These S tests FAIL today: ui/src/components/Avatar.jsx and ui/public/ta-badge.svg
 * do not exist, AuthorCell still renders a bare <img>, and ConfigContext exposes no
 * owner profile.
 */

const fs = require('fs');
const path = require('path');

const UI = path.resolve(__dirname, '../ui');
const AVATAR = path.join(UI, 'src/components/Avatar.jsx');
const AUTHOR_CELL = path.join(UI, 'src/components/AuthorCell.jsx');
const USER_DETAIL = path.join(UI, 'src/pages/users/UserDetail.jsx');
const CONFIG_CTX = path.join(UI, 'src/context/ConfigContext.jsx');
const STYLES = path.join(UI, 'src/styles.css');
const BADGE = path.join(UI, 'public/ta-badge.svg');
const BRAND = path.join(UI, 'public/brainstorm.svg');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

/** Every .jsx under ui/src — the call-site census R1 re-derives rather than trusts. */
function jsxFiles(dir, acc = []) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) jsxFiles(p, acc);
    else if (e.name.endsWith('.jsx')) acc.push(p);
  }
  return acc;
}

/** Each `<AuthorCell … />` element in a source string, whole tag. */
function authorCellTags(src) {
  return src.match(/<AuthorCell\b[^>]*\/?>/g) || [];
}

const HEX64 = /['"`][0-9a-f]{64}['"`]/i;

// ─────────────────────────────────────────────────────────────────────────
// S — the ratified structure
// ─────────────────────────────────────────────────────────────────────────

test('S1: a shared Avatar component exists and takes the ADR\'s prop contract', () => {
  const src = safeRead(AVATAR);
  assert(src.length > 0,
    'ui/src/components/Avatar.jsx does not exist. ADR 0001 chose Option A — one shared component that owns ' +
    'the picture-candidate chain, the letter tier and the TA badge — precisely so AC3 and AC4 are satisfied ' +
    'once rather than re-implemented per surface.');
  assert(/export\s+default\s+function\s+Avatar\s*\(/.test(src),
    'Avatar.jsx must default-export a function component named Avatar (ADR §Implementation notes).');
  const sig = (src.match(/export\s+default\s+function\s+Avatar\s*\(([^)]*)\)/) || [])[1] || '';
  for (const prop of ['pubkey', 'profile', 'size']) {
    assert(new RegExp(`\\b${prop}\\b`).test(sig),
      `Avatar must accept \`${prop}\` — the ADR pins the signature { pubkey, profile, size } so AuthorCell can ` +
      `delegate without changing any of its call sites. Signature found: (${sig.trim()})`);
  }
});

test('S2: Avatar resolves the TA (and owner) at runtime from config, and hardcodes no pubkey', () => {
  const src = safeRead(AVATAR);
  assert(src.length > 0, 'ui/src/components/Avatar.jsx does not exist — see S1.');
  assert(/useConfig\s*\(/.test(src),
    'Avatar must read identity from useConfig() — the sanctioned client-side runtime lookup ' +
    '(CLAUDE.md § "Per-deployment TA pubkey — NEVER hardcode").');
  assert(/\btaPubkey\b/.test(src),
    'Avatar must compare the rendered pubkey against useConfig().taPubkey to decide whether to badge.');
  assert(/\bownerProfile\b/.test(src),
    'Avatar must read the owner\'s profile from config (ADR sub-decision A1) — it is what supplies the owner\'s ' +
    'picture under the badge; a per-Avatar useProfiles([owner]) was rejected because useProfiles has no ' +
    'in-flight dedupe and a table of TA rows would fire one request per row.');
  assert(!HEX64.test(src),
    'Avatar.jsx contains a 64-hex string literal. The TA pubkey is created per deployment and is recreated ' +
    'across container rebuilds (OPEN.md rows 44/71/127 recorded three different values on this machine alone). ' +
    'A literal here silently un-badges every non-dev deployment.');
});

test('S3: Avatar renders the badge overlay from the dedicated asset, under the ADR\'s class names', () => {
  const src = safeRead(AVATAR);
  assert(src.length > 0, 'ui/src/components/Avatar.jsx does not exist — see S1.');
  assert(/avatar-wrap/.test(src),
    'Avatar must render the positioned wrapper .avatar-wrap — Option C (a CSS ::after badge on the existing ' +
    '<img>) was rejected because replaced elements generate no pseudo-element boxes, so a wrapper is required.');
  assert(/avatar-ta-badge/.test(src),
    'Avatar must render the badge element .avatar-ta-badge (ADR §Implementation notes).');
  assert(/\/ta-badge\.svg/.test(src),
    'the badge must be the dedicated /ta-badge.svg asset, not /brainstorm.svg — the brand file is a ' +
    'transparent-background export whose purple brain disappears against a dark row at badge size.');
});

test('S4: Avatar has the failover mechanism and the letter tier the fallback criteria depend on', () => {
  const src = safeRead(AVATAR);
  assert(src.length > 0, 'ui/src/components/Avatar.jsx does not exist — see S1.');
  assert(/onError/.test(src),
    'Avatar must handle image load failure (onError). AC4 — "a lettered placeholder appears instead of the ' +
    'broken-image glyph" — has no mechanism without it; AuthorCell has never had one.');
  assert(/avatar-initial/.test(src),
    'Avatar must render the letter tier .avatar-initial. AC3 forbids the empty grey disc that ' +
    '.author-avatar-placeholder renders today.');
});

test('S5: ConfigContext resolves the owner profile once and publishes it', () => {
  const src = safeRead(CONFIG_CTX);
  assert(src.length > 0, 'ui/src/context/ConfigContext.jsx missing — unexpected.');
  assert(/ownerProfile/.test(src),
    'ConfigContext must expose ownerProfile (ADR sub-decision A1) — instance identity is already this file\'s ' +
    'job, and resolving it here costs one request app-wide instead of one per TA row.');
  assert(/\/api\/profiles/.test(src),
    'ConfigContext must fetch the owner\'s kind-0 from /api/profiles to populate ownerProfile.');
  const provided = (src.match(/value=\{\{([^}]*)\}\}/) || [])[1] || '';
  assert(/ownerProfile/.test(provided),
    `ownerProfile must be published on the provider value or no consumer can read it. Provider value found: {${provided.trim()}}`);
});

test('S6: AuthorCell delegates its avatar to Avatar and no longer renders a bare, error-blind <img>', () => {
  const src = safeRead(AUTHOR_CELL);
  assert(src.length > 0, 'ui/src/components/AuthorCell.jsx missing — unexpected.');
  assert(/import\s+Avatar\s+from/.test(src) && /<Avatar\b/.test(src),
    'AuthorCell must import and render Avatar. This one delegation is what lights up all of the story\'s table ' +
    'surfaces at once; Option B (badging inline here) was rejected for duplicating the overlay at every other ' +
    'avatar site.');
  assert(!/className="author-avatar"/.test(src),
    'AuthorCell must no longer render the bare <img className="author-avatar"> — that element has no onError ' +
    'handler and is the source of AC4\'s broken-image glyph.');
  assert(!/author-avatar-placeholder/.test(src),
    'AuthorCell must no longer render the empty .author-avatar-placeholder disc — AC3 replaces it with a ' +
    'lettered, badge-bearing placeholder.');
});

test('S7: the TA\'s own user page renders the same component at its header size', () => {
  const src = safeRead(USER_DETAIL);
  assert(src.length > 0, 'ui/src/pages/users/UserDetail.jsx missing — unexpected.');
  assert(/import\s+Avatar\s+from/.test(src) && /<Avatar\b/.test(src),
    'AC5: the user page header must render Avatar, so /tapestry/users/<taPubkey> — the click-through target of ' +
    'every AuthorCell — carries the same badged avatar.');
  const tag = (src.match(/<Avatar\b[^>]*>/) || [''])[0];
  assert(/size=\{?\s*64/.test(tag),
    `the header Avatar must be rendered at the existing 64px header size (styles.css .user-detail-avatar). Found: ${tag || '(no <Avatar> tag)'}`);
});

test('S8: the badge asset exists, is the brand mark on a filled disc, and carries no vectorizer residue', () => {
  const svg = safeRead(BADGE);
  assert(svg.length > 0,
    'ui/public/ta-badge.svg does not exist. The ADR derives it from ui/public/brainstorm.svg: a filled disc plus ' +
    'the two real paths (brain recolored white, bolt kept orange).');
  assert(/<circle\b/.test(svg),
    'ta-badge.svg must draw a filled disc — the badge sits on a photo, and the brand file\'s transparent ' +
    'background is exactly why it cannot be used directly.');
  assert(/#9546ed/i.test(svg), 'the disc must carry the brand purple #9546ed.');
  assert(/#ff914d/i.test(svg), 'the lightning bolt must keep the brand orange #ff914d.');
  assert(/#fff\b|#ffffff/i.test(svg),
    'the brain path must be recolored white so the mark reads against the purple disc.');
  assert(!/<filter\b/i.test(svg) && !/<mask\b/i.test(svg),
    'ta-badge.svg must not carry brainstorm.svg\'s filter/mask residue (it exists only to paint a ~4.5-unit ' +
    'artifact blob at 1% opacity).');
  // Both real paths must actually be present, keyed on their own opening coordinates.
  const brand = safeRead(BRAND);
  assert(brand.length > 0, 'ui/public/brainstorm.svg missing — unexpected; it is the artwork source.');
  assert(/M 147\.13/.test(svg),
    'the bolt path from brainstorm.svg (opening "M 147.132812 144.953125") must be present in the badge.');
  assert(/M 196\.02/.test(svg),
    'the brain path from brainstorm.svg (opening "M 196.023438 68.183594") must be present in the badge.');
});

test('S9: the avatar CSS family exists, and the row-height compensation stayed context-local', () => {
  const css = safeRead(STYLES);
  assert(css.length > 0, 'ui/src/styles.css missing — unexpected.');
  for (const cls of ['.avatar-wrap', '.avatar-img', '.avatar-initial', '.avatar-ta-badge']) {
    assert(new RegExp(`\\${cls}\\s*[,{]`).test(css), `styles.css must define ${cls} (ADR §Implementation notes).`);
  }
  const wrap = (css.match(/\.avatar-wrap\s*\{[^}]*\}/) || [''])[0];
  assert(/position:\s*relative/.test(wrap),
    `.avatar-wrap must be position: relative or the absolutely-positioned badge escapes the avatar. Found: ${wrap || '(rule not found)'}`);
  const badge = (css.match(/\.avatar-ta-badge\s*\{[^}]*\}/) || [''])[0];
  assert(/position:\s*absolute/.test(badge),
    `.avatar-ta-badge must be absolutely positioned over the avatar. Found: ${badge || '(rule not found)'}`);
  assert(/min-width/.test(badge),
    'the badge needs a minimum size floor — at small avatars a percentage-sized mark stops being legible ' +
    '(ADR: 14px).');
  assert(/\.author-cell\s+\.avatar-wrap\s*\{[^}]*margin:\s*-8px/.test(css),
    'the -8px row-height compensation must live on `.author-cell .avatar-wrap`, not inside the shared component ' +
    '— it exists so a 40px circle fits a 10px-padded table row, which is true of tables and of nothing else.');
});

// ─────────────────────────────────────────────────────────────────────────
// R — what the ADR promised not to disturb (pass before AND after)
// ─────────────────────────────────────────────────────────────────────────

test('R1: every AuthorCell call site still passes pubkey + profiles, and none was churned', () => {
  const files = jsxFiles(path.join(UI, 'src'));
  assert(files.length > 0, 'no .jsx files found under ui/src — the census is broken, not the code.');
  const sites = [];
  for (const f of files) for (const tag of authorCellTags(safeRead(f))) sites.push({ f, tag });
  assert(sites.length >= 33,
    `AuthorCell call sites dropped to ${sites.length}; ${33} were present when this story was designed. The ADR ` +
    'preserves the signature precisely so no call site changes — a drop means one was rewritten or deleted.');
  for (const { f, tag } of sites) {
    assert(/\bpubkey=/.test(tag) && /\bprofiles=/.test(tag),
      `${path.relative(UI, f)} — every AuthorCell call site must keep passing pubkey and profiles: ${tag}`);
  }
});

test('R2: AuthorCell keeps its exported contract (the delegation is internal, not a new API)', () => {
  const src = safeRead(AUTHOR_CELL);
  const sig = (src.match(/export\s+default\s+function\s+AuthorCell\s*\(([^)]*)\)/) || [])[1] || '';
  assert(sig.length > 0, 'AuthorCell must remain a default-exported function component.');
  for (const prop of ['pubkey', 'profiles', 'size']) {
    assert(new RegExp(`\\b${prop}\\b`).test(sig),
      `AuthorCell must keep accepting \`${prop}\` — 33 call sites depend on it. Signature found: (${sig.trim()})`);
  }
  assert(/author-cell/.test(src) && /author-name/.test(src),
    'AuthorCell must keep its .author-cell / .author-name markup and its click-through behavior.');
});

test('R3: the 🤖 text affordance in the author-filter dropdowns is untouched', () => {
  const files = jsxFiles(path.join(UI, 'src'));
  const robots = files.filter((f) => /🤖/.test(safeRead(f)));
  assert(robots.length >= 7,
    `only ${robots.length} files still carry the 🤖 author-filter affordance; 7 did when this story was designed. ` +
    'The epic guardrail keeps it: an <option> element cannot render an image, so the badge augments those ' +
    'surfaces rather than replacing their text cue.');
});

test('R4: the superseded .author-avatar rules are left in place rather than deleted', () => {
  const css = safeRead(STYLES);
  assert(/\.author-avatar\s*\{/.test(css) && /\.author-avatar-placeholder\s*\{/.test(css),
    'ADR §Consequences: .author-avatar / .author-avatar-placeholder go inert but are LEFT IN PLACE — other rules ' +
    'and source sentinels may reference them, and removing them is a separate cleanup.');
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
    catch (err) { console.log(`  ✗ ${t.name}`); console.log(`      ${err.message}`); fail++; }
  }
  return { pass, fail };
}

module.exports = { run };
