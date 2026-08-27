#!/usr/bin/env node
/**
 * Dev-only fixture prune (OPEN 182; ADR trusted-lists/0003 §4).
 *
 * Deletes TL-ladder test fixtures from the LOCAL strfry so refresh-all stops
 * grinding through months of test debris. Safety properties:
 *   - refuses to run unless the publish policy is local-only (dev stack);
 *   - matches events ONLY by known fixture slug prefixes in their d-tags;
 *   - deletes ONLY by explicit id lists (never by kind/author alone).
 *
 *   BRAINSTORM_BASE_URL=http://localhost:8778 node scripts/tl-prune-fixtures.js
 *
 * Covered: fixture kind-39999 events (tag definitions, taggings, pins) and
 * the TA-signed kind-30392/30393 TLs derived from them. Meilisearch fixture
 * docs are left in place (harmless; noted in the story).
 */

const { execSync, execFileSync } = require('child_process');

const CONTROL_PANEL_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';

// Known fixture slug prefixes. Extend when a new suite/kit invents one.
// These appear inside d-tags as either the whole slug ("tlkit-...") or framed
// ("profile-tag-<slug>-...", "tag-pin-<slug>", "tl-pin-<o8>-<a8>-<slug>").
const FIXTURE_PREFIXES = [
  'tlkit-', 'wsumkv-', 'wsumfb-', 'tlmm-', 'repro-', 'repro2-',
  // legacy suite fixtures (tl-publication / customize-pin / pin-a-tag eras):
  's11b-', 's12-', 'cpin-',
];

function isFixtureDTag(dTag) {
  return FIXTURE_PREFIXES.some((p) => dTag.includes(p));
}

function scan(filter) {
  const safe = JSON.stringify(filter).replace(/"/g, '\\"');
  const out = execSync(
    `docker exec ${CONTAINER} sh -c 'strfry scan "${safe}" 2>/dev/null'`,
    { maxBuffer: 100 * 1024 * 1024 }).toString();
  const events = [];
  for (const line of out.split('\n')) {
    if (!line) continue;
    try { events.push(JSON.parse(line)); } catch {}
  }
  return events;
}

function deleteIds(ids) {
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const filter = JSON.stringify({ ids: ids.slice(i, i + CHUNK) });
    execFileSync('docker',
      ['exec', CONTAINER, 'strfry', 'delete', '--filter', filter],
      { stdio: 'pipe' });
  }
}

async function main() {
  const policy = await (await fetch(`${CONTROL_PANEL_BASE}/api/publish-policy`)).json();
  if (policy?.allowExternalPublish !== false) {
    throw new Error('publish policy is NOT local-only — refusing to prune (dev-only tool)');
  }

  let total = 0;
  for (const kinds of [[39999], [30392, 30393]]) {
    const events = scan({ kinds });
    const fixtures = events.filter((ev) => {
      const d = (ev.tags || []).find((t) => t[0] === 'd')?.[1] || '';
      return isFixtureDTag(d);
    });
    if (fixtures.length > 0) deleteIds(fixtures.map((ev) => ev.id));
    console.log(`kinds ${kinds.join(',')}: scanned ${events.length}, pruned ${fixtures.length} fixture events`);
    total += fixtures.length;
  }
  console.log(`prune complete: ${total} events deleted`);
}

main().catch((e) => { console.error(`prune failed: ${e.message}`); process.exit(1); });
