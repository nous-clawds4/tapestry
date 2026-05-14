/**
 * Story #6: Brainstorm Communities UI scaffold (Slice 0).
 *
 * These tests pin the substrate the ADR locks in:
 *   - Parallel `ui-communities/` Vite app exists with the expected layout
 *   - Brand palette and self-hosted fonts are declared in tokens.css / fonts.css
 *   - The prototype's generic theming (#a855f7, tweaks-panel, ember/moss directions)
 *     does not ship
 *   - The Dockerfile builds ui-communities/ in parallel with ui/
 *   - bin/control-panel.js serves dist-communities/ on the communities host
 *   - .github/workflows/deploy-communities.yml exists with the correct secrets and trigger
 *   - The UX-vocab glossary is honored (Vouch / Raise a concern, not Endorse/Veto)
 *   - The mirror count stat is not surfaced
 *
 * Style mirrors test/strfry-router-first-boot-config.test.js — source-regex over
 * file content, hand-rolled assertions, registered in test/test.js.
 *
 * See engineering-team/stories/6-communities-ui-scaffold.test-plan.md
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const UC = path.join(ROOT, 'ui-communities');

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function readIfExists(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function walk(dir, predicate) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist-communities') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, predicate));
    else if (!predicate || predicate(full)) out.push(full);
  }
  return out;
}

/* ────────────────────────────────────────────────────────────
 * T0 — Directory layout
 * ──────────────────────────────────────────────────────────── */

test('ui-communities/ directory exists with package.json, vite.config.js, and eslint.config.js', () => {
  assert(fs.existsSync(UC), `expected ${UC} to exist`);
  for (const f of ['package.json', 'vite.config.js', 'eslint.config.js', 'index.html']) {
    assert(fs.existsSync(path.join(UC, f)), `expected ui-communities/${f} to exist`);
  }
});

test('ui-communities/package.json declares name "ui-communities" and build/lint scripts', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(UC, 'package.json'), 'utf8'));
  assert(pkg.name === 'ui-communities', `expected name "ui-communities", got "${pkg.name}"`);
  for (const s of ['dev', 'build', 'lint']) {
    assert(pkg.scripts && pkg.scripts[s], `expected scripts.${s} in ui-communities/package.json`);
  }
  // React 19 + Vite 7 + React Router 7 — same major versions as ui/
  for (const dep of ['react', 'react-dom', 'react-router-dom']) {
    assert(pkg.dependencies && pkg.dependencies[dep], `expected dependency ${dep} in ui-communities/package.json`);
  }
});

test('ui-communities/vite.config.js outputs to ../dist-communities and proxies /api → :8080', () => {
  const cfg = fs.readFileSync(path.join(UC, 'vite.config.js'), 'utf8');
  assert(/outDir:\s*['"]\.\.\/dist-communities['"]/.test(cfg),
    'vite.config.js must set build.outDir to "../dist-communities"');
  assert(/proxy[\s\S]{0,80}\/api[\s\S]{0,120}target:\s*['"]http:\/\/localhost:8080['"]/.test(cfg),
    'vite.config.js must proxy /api → http://localhost:8080');
  // Different port from ui/ (5173) so both dev servers can run side-by-side
  assert(/port:\s*5174/.test(cfg), 'vite.config.js dev server must listen on port 5174 (ui/ owns 5173)');
});

/* ────────────────────────────────────────────────────────────
 * Brand palette + typography (AC-1, AC-2, AC-3, AC-4)
 * ──────────────────────────────────────────────────────────── */

test('ui-communities/src/styles/tokens.css declares the locked Brainstorm brand palette', () => {
  const tokens = fs.readFileSync(path.join(UC, 'src/styles/tokens.css'), 'utf8');
  // Brand colors (sampled from official PNGs — see project_communities_brand.md)
  assert(/--brand:\s*#662d91/i.test(tokens), 'tokens.css must declare --brand: #662d91 (royal purple)');
  assert(/--accent:\s*#ba20ba/i.test(tokens), 'tokens.css must declare --accent: #ba20ba (magenta)');
  assert(/--highlight:\s*#fbb03b/i.test(tokens), 'tokens.css must declare --highlight: #fbb03b (marigold)');
  // Surface ramp
  for (const tok of ['--bg', '--bg-surface', '--bg-elevated', '--text', '--text-muted', '--border']) {
    assert(new RegExp(`${tok}\\s*:`).test(tokens), `tokens.css must declare ${tok}`);
  }
  // Motion presets (ADR §"Motion specifics")
  assert(/--ease-out-cubic\s*:/.test(tokens), 'tokens.css must declare --ease-out-cubic');
  assert(/--ease-overshoot\s*:/.test(tokens), 'tokens.css must declare --ease-overshoot');
  for (const tok of ['--dur-fast', '--dur-medium']) {
    assert(new RegExp(`${tok}\\s*:`).test(tokens), `tokens.css must declare ${tok}`);
  }
  // Spacing scale (4/8/12/16/24/32/48/64)
  for (const i of [1, 2, 3, 4, 5, 6, 7, 8]) {
    assert(new RegExp(`--space-${i}\\s*:`).test(tokens), `tokens.css must declare --space-${i}`);
  }
});

test('ui-communities/src/styles/fonts.css declares MuseoModerno + DM Sans self-hosted with font-display: swap', () => {
  const fonts = fs.readFileSync(path.join(UC, 'src/styles/fonts.css'), 'utf8');
  assert(/@font-face[\s\S]*?MuseoModerno/.test(fonts), 'fonts.css must declare @font-face for MuseoModerno');
  assert(/@font-face[\s\S]*?(DM\s*Sans|DMSans)/i.test(fonts), 'fonts.css must declare @font-face for DM Sans');
  // Self-hosted: url(/fonts/...) — not fonts.googleapis.com
  assert(/url\((?:"|')?\/fonts\//.test(fonts), 'fonts.css must reference /fonts/* (self-hosted), not a CDN');
  assert(!/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(fonts),
    'fonts.css must not reference Google Fonts (must be bundled)');
  // font-display: swap so a missing font never produces FOIT
  const swapCount = (fonts.match(/font-display:\s*swap/gi) || []).length;
  assert(swapCount >= 2, 'fonts.css must use font-display: swap on each @font-face declaration');
});

test('ui-communities/public/fonts contains the MuseoModerno variable font files', () => {
  const fontsDir = path.join(UC, 'public/fonts');
  assert(fs.existsSync(fontsDir), 'ui-communities/public/fonts must exist (self-hosted typography)');
  const present = fs.readdirSync(fontsDir);
  const hasMM = present.some(f => /MuseoModerno.*\.ttf$/i.test(f));
  assert(hasMM, `ui-communities/public/fonts must contain a MuseoModerno TTF; got: ${present.join(', ')}`);
});

test('ui-communities/index.html does not load fonts from a Google Fonts CDN', () => {
  const html = fs.readFileSync(path.join(UC, 'index.html'), 'utf8');
  assert(!/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html),
    'index.html must not contain Google Fonts CDN <link>s — fonts are bundled');
});

test('no #a855f7 (prototype lavender) appears anywhere in ui-communities/src', () => {
  const files = walk(path.join(UC, 'src'));
  const offenders = [];
  for (const f of files) {
    const src = readIfExists(f);
    if (src && /#a855f7/i.test(src)) offenders.push(path.relative(ROOT, f));
  }
  assert(offenders.length === 0,
    `prototype lavender #a855f7 must not ship — found in: ${offenders.join(', ')}`);
});

test('no tweaks-panel or design-canvas module ships in ui-communities/src', () => {
  const files = walk(path.join(UC, 'src'));
  const offenders = files
    .filter(f => /tweaks-?panel|design-canvas/i.test(path.basename(f)))
    .map(f => path.relative(ROOT, f));
  assert(offenders.length === 0,
    `prototype dev tooling must not ship; remove: ${offenders.join(', ')}`);
});

test('no ember/moss theme variables ship — only the brand-grounded dark palette', () => {
  const tokens = fs.readFileSync(path.join(UC, 'src/styles/tokens.css'), 'utf8');
  assert(!/\[data-direction\s*=\s*['"]?(ember|moss|neon)['"]?\]/i.test(tokens),
    'tokens.css must not have the prototype\'s [data-direction="ember|moss|neon"] blocks');
});

/* ────────────────────────────────────────────────────────────
 * Component shape (AC-1 mark, AC-9 your-view callout, AC-11 cross-product link)
 * ──────────────────────────────────────────────────────────── */

test('Header component renders the BrainstormMark SVG (no placeholder "B" tile)', () => {
  const header = fs.readFileSync(path.join(UC, 'src/components/Header.jsx'), 'utf8');
  assert(/BrainstormMark/.test(header),
    'Header.jsx must import + render <BrainstormMark /> from src/components/');
  // Specifically reject the prototype's placeholder "B" tile pattern
  assert(!/['"`]B['"`]\s*<\/(div|span)>/i.test(header) &&
         !/\bborderRadius:\s*8.*background:\s*['"]var\(--accent\)['"]/.test(header),
    'Header.jsx must not render the prototype\'s placeholder letter-B tile — use BrainstormMark instead');
});

test('BrainstormMark component vendors the brand SVG and exposes a lockup variant', () => {
  const mark = fs.readFileSync(path.join(UC, 'src/components/BrainstormMark.jsx'), 'utf8');
  // Either inline SVG OR an import of the vendored asset
  const inlinesSvg = /<svg[\s\S]+<\/svg>/.test(mark);
  const importsAsset = /import\s+\w+\s+from\s+['"](\.\.\/)+assets\/brand\/brainstorm-(mark|lockup)\.svg['"]/.test(mark);
  assert(inlinesSvg || importsAsset,
    'BrainstormMark.jsx must inline the SVG or import the vendored asset from src/assets/brand/');
  assert(/variant/.test(mark),
    'BrainstormMark must accept a `variant` prop (mark | lockup) so the header can pick the lockup form');
});

test('ViewCallout module emits the canonical "your view" projection-pattern copy', () => {
  const callout = fs.readFileSync(path.join(UC, 'src/components/ViewCallout.jsx'), 'utf8');
  assert(/your view/i.test(callout) && /personal to you/i.test(callout),
    'ViewCallout.jsx must surface "Your view" framing + clarify edits are personal to the viewer');
});

test('Header includes an anchor to brainstorm.world that opens in a new tab', () => {
  const header = fs.readFileSync(path.join(UC, 'src/components/Header.jsx'), 'utf8');
  assert(/https:\/\/brainstorm\.world/.test(header),
    'Header must include a link to https://brainstorm.world for cross-product navigation');
  assert(/target=['"]_blank['"][\s\S]*rel=['"][^'"]*noopener/i.test(header) ||
         /rel=['"][^'"]*noopener[\s\S]*target=['"]_blank['"]/i.test(header),
    'Cross-product link must use target="_blank" rel="noopener"');
});

/* ────────────────────────────────────────────────────────────
 * Hygiene: mock data, glossary, no leftover prototype strings (AC-13, AC-14, AC-15)
 * ──────────────────────────────────────────────────────────── */

test('no component renders the mirror / Independent hosts stat in shipped UI (v1.1 deferral)', () => {
  // mockData.js MAY retain the `mirrors` field; the prohibition is on it being SURFACED.
  // Scan components/pages for the user-visible strings or for `.mirrors` JSX expressions.
  const files = walk(path.join(UC, 'src')).filter(f =>
    /\.(jsx|tsx)$/.test(f) && !/mockData/i.test(path.basename(f)));
  const offenders = [];
  for (const f of files) {
    const src = readIfExists(f);
    if (!src) continue;
    if (/Independent hosts|\bmirrors?\b\s*(?:host|count)/i.test(src) ||
        /\{[^}]*\.mirrors[^}]*\}/.test(src)) {
      offenders.push(path.relative(ROOT, f));
    }
  }
  assert(offenders.length === 0,
    `mirror/Independent-hosts stat must not be surfaced in v1; found in: ${offenders.join(', ')}`);
});

test('shipped UI strings use Vouch + Raise a concern + Founding voices + Trusted here (no Endorse/Veto)', () => {
  const files = walk(path.join(UC, 'src')).filter(f =>
    /\.(jsx|tsx)$/.test(f) && !/(glossary|mockData)/i.test(path.basename(f)));
  let sawVouch = false, sawConcern = false, sawFounding = false, sawTrustedHere = false;
  const offenders = [];
  for (const f of files) {
    const src = readIfExists(f);
    if (!src) continue;
    if (/\bVouch\b/.test(src)) sawVouch = true;
    if (/Raise a concern/i.test(src)) sawConcern = true;
    if (/Founding voices?/i.test(src)) sawFounding = true;
    if (/Trusted here/i.test(src)) sawTrustedHere = true;
    if (/\b(Endorse|Veto)\b/.test(src)) offenders.push(path.relative(ROOT, f));
  }
  assert(sawVouch, 'shipped UI must include the "Vouch" action label');
  assert(sawConcern, 'shipped UI must include the "Raise a concern" action label');
  assert(sawFounding, 'shipped UI must include "Founding voices" in the create flow');
  assert(sawTrustedHere, 'shipped UI must include "Trusted here" stat label');
  assert(offenders.length === 0,
    `user-facing "Endorse"/"Veto" leak — keep these as protocol terms in glossary.js only. Offenders: ${offenders.join(', ')}`);
});

test('glossary.js maps Vouch/Concern to protocol terms endorse/veto', () => {
  const gl = fs.readFileSync(path.join(UC, 'src/lib/glossary.js'), 'utf8');
  assert(/vouch[\s\S]{0,80}endorse/i.test(gl),
    'glossary.js must map vouch → endorse');
  assert(/concern[\s\S]{0,80}veto/i.test(gl),
    'glossary.js must map concern → veto');
});

test('no lorem/TODO/FIXME/EDITMODE markers ship in ui-communities/src', () => {
  const files = walk(path.join(UC, 'src'));
  const offenders = [];
  for (const f of files) {
    const src = readIfExists(f);
    if (!src) continue;
    if (/\blorem\b|\bTODO\b|\bFIXME\b|EDITMODE-BEGIN|EDITMODE-END/i.test(src)) {
      offenders.push(path.relative(ROOT, f));
    }
  }
  assert(offenders.length === 0,
    `placeholder markers found — remove before shipping: ${offenders.join(', ')}`);
});

test('mock data lives in a JS module (not JSX) and exports community/member/tag shapes', () => {
  const mock = fs.readFileSync(path.join(UC, 'src/data/mockData.js'), 'utf8');
  assert(/export\s+const\s+communities/.test(mock), 'mockData.js must export `communities`');
  assert(/export\s+const\s+members/.test(mock) || /export\s+const\s+MEMBERS/.test(mock),
    'mockData.js must export `members` (or MEMBERS)');
  assert(/export\s+const\s+tags/.test(mock) || /export\s+const\s+TAGS/.test(mock),
    'mockData.js must export `tags` (or TAGS)');
});

/* ────────────────────────────────────────────────────────────
 * Inline-style discipline (AC-20)
 * ──────────────────────────────────────────────────────────── */

test('component files do not inline literal palette hex codes (must use CSS variables)', () => {
  // Components may use `style={{ ... }}` for genuinely dynamic values (e.g. width: ${m.trust*100}%),
  // but the brand palette hex codes must NOT appear in component files — they live in tokens.css.
  const BRAND_HEXES = /#(662d91|ba20ba|d234d2|7d44ad|fbb03b|0a0612|120a1c|1a1126)/i;
  const files = walk(path.join(UC, 'src/components'))
    .concat(walk(path.join(UC, 'src/pages')))
    .filter(f => /\.(jsx|tsx)$/.test(f));
  const offenders = [];
  for (const f of files) {
    const src = readIfExists(f);
    if (src && BRAND_HEXES.test(src)) offenders.push(path.relative(ROOT, f));
  }
  assert(offenders.length === 0,
    `brand-palette hex literals in components — move to tokens.css and reference via var(--*): ${offenders.join(', ')}`);
});

test('CommunityCard renders a checkmark glyph alongside the success color when joined (color is not the only state cue)', () => {
  const card = fs.readFileSync(path.join(UC, 'src/components/CommunityCard.jsx'), 'utf8');
  // Either an SVG check path or a unicode glyph alongside the joined branch
  assert(/joined[\s\S]{0,400}(<svg[\s\S]*?stroke=[\s\S]*?M\s*20\s*6|✓|check)/i.test(card) ||
         /You belong here/.test(card),
    'CommunityCard must visibly mark joined state with a glyph (not color alone)');
});

test('StepProgress renders a check glyph at completed steps (color is not the only cue)', () => {
  const step = fs.readFileSync(path.join(UC, 'src/components/StepProgress.jsx'), 'utf8');
  assert(/✓|<svg/.test(step),
    'StepProgress must render a check glyph at completed steps, not rely on fill color alone');
});

/* ────────────────────────────────────────────────────────────
 * Express mount (AC-22)
 * ──────────────────────────────────────────────────────────── */

test('bin/control-panel.js registers dist-communities and the SPA fallback is host-aware', () => {
  const src = fs.readFileSync(path.join(ROOT, 'bin/control-panel.js'), 'utf8');
  assert(/express\.static\([\s\S]{0,80}['"`]\.\.\/dist-communities['"`]/.test(src),
    'control-panel.js must register express.static for "../dist-communities"');
  // SPA fallback gates on hostname
  assert(/communities\./.test(src) && /hostname/.test(src),
    'control-panel.js SPA fallback must inspect req.hostname and route communities.* to dist-communities/index.html');
  assert(/dist-communities[\s\S]{0,40}index\.html/.test(src),
    'control-panel.js must serve dist-communities/index.html on the communities host');
});

/* ────────────────────────────────────────────────────────────
 * Dockerfile delta (AC-24)
 * ──────────────────────────────────────────────────────────── */

test('Dockerfile builds ui-communities/ in parallel with ui/', () => {
  const df = fs.readFileSync(path.join(ROOT, 'Dockerfile'), 'utf8');
  assert(/COPY\s+ui-communities\/package\.json\s+ui-communities\/package-lock\.json/.test(df),
    'Dockerfile must COPY ui-communities/package.json + package-lock.json (cache layer)');
  assert(/cd\s+\/usr\/local\/lib\/node_modules\/brainstorm\/ui-communities\s+&&\s+npm\s+ci/.test(df),
    'Dockerfile must `npm ci` in /usr/local/lib/node_modules/brainstorm/ui-communities');
  assert(/cd\s+\/usr\/local\/lib\/node_modules\/brainstorm\/ui-communities\s+&&\s+npm\s+run\s+build/.test(df),
    'Dockerfile must run `npm run build` for ui-communities/');
});

/* ────────────────────────────────────────────────────────────
 * Deploy workflow (AC-23)
 * ──────────────────────────────────────────────────────────── */

test('.github/workflows/deploy-communities.yml exists with feat/communities trigger + COMMUNITIES secrets', () => {
  const wf = fs.readFileSync(path.join(ROOT, '.github/workflows/deploy-communities.yml'), 'utf8');
  assert(/branches:\s*\[\s*feat\/communities\s*\]/.test(wf) ||
         /branches:[\s\S]*?-\s*feat\/communities/.test(wf),
    'deploy-communities.yml must trigger on push to feat/communities only');
  for (const secret of ['DEPLOY_HOST_COMMUNITIES', 'DEPLOY_USER_COMMUNITIES', 'DEPLOY_SSH_KEY_COMMUNITIES']) {
    assert(new RegExp(`secrets\\.${secret}`).test(wf),
      `deploy-communities.yml must reference secrets.${secret}`);
  }
  // Same SSH-action pattern as deploy-staging.yml
  assert(/appleboy\/ssh-action/.test(wf),
    'deploy-communities.yml must use the appleboy/ssh-action pattern (matches other workflows)');
  assert(/docker\s+compose\s+up\s+-d\s+--build/.test(wf),
    'deploy-communities.yml must run docker compose up -d --build');
});

/* ────────────────────────────────────────────────────────────
 * .gitignore for dist-communities/
 * ──────────────────────────────────────────────────────────── */

test('.gitignore excludes dist-communities/ (mirrors existing dist/ pattern)', () => {
  const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  assert(/^dist-communities\/?\s*$/m.test(gi) || /\ndist-communities\/?\s*\n/.test(gi),
    '.gitignore must exclude dist-communities/');
});

/* ────────────────────────────────────────────────────────────
 * Runner
 * ──────────────────────────────────────────────────────────── */

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      pass++;
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      fail++;
    }
  }
  return { pass, fail };
}

module.exports = { run };
