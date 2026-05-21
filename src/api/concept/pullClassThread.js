/**
 * Story #14 / ADR 0010 (mechanism amended by ADR 0011) — Community class-thread pull (Phase B).
 *
 *   POST /api/concept/:handle/pull-community-class-thread  (owner-only via requireOwner)
 *
 * Walks the curator's class-thread closure into the local Neo4j as a foreign
 * sub-graph reachable from the local concept only via the #11 anchor.
 *
 * Mechanism (ADR 0011 §"Phase B walk mechanism"): BFS over kind-39999 events
 *   - `#n` walk (HAS_ELEMENT-inverse, child-claims-parent): events claiming the
 *     current parent uuid via single-char tag `n` become direct elements.
 *   - `#s` walk (IS_A_SUPERSET_OF-inverse): events claiming the parent via `s`
 *     become sub-Sets / sub-Supersets; recurse.
 *   - Back-compat `#z` walk at root iteration only: events z-tagged at the
 *     curator's concept Header. Covers curator's pre-amendment events on
 *     relays without forcing curator-side migration. Wires flat HAS_ELEMENT
 *     from the community Superset (no hierarchy reconstructable from the
 *     descriptor-less event corpus per ADR 0011 §"Context").
 *
 * Edge direction (install.js Pass-1d byte-equivalent):
 *   - HAS_ELEMENT: (parent)-[:HAS_ELEMENT]->(child)         (per install.js:627)
 *   - IS_A_SUPERSET_OF: (parent)-[:IS_A_SUPERSET_OF]->(child) (per install.js:476/569)
 *
 * Trust constraints (ADR 0011 §"Trust constraints", binding):
 *   1. Authorship gate: events whose `pubkey !== curatorPk` are skipped + logged.
 *      Prevents cross-instance election (someone publishing an event with
 *      `['n', '<localTA-Superset-uuid>']` cannot trick Phase B into MERGEing
 *      edges that elect their content into the local class thread).
 *   2. Local-graph isolation: by construction, the walk's queue starts at
 *      the curator's Superset and only recurses on curator-authored Sets
 *      (passing the trust gate). The parent endpoint of every MERGEd edge
 *      is therefore curator-pubkey; no local-TA-pubkey parents ever enter.
 *   3. No editorial relationships: only HAS_ELEMENT and IS_A_SUPERSET_OF
 *      edges are MERGEd (canonical class-thread; no `source` property, no
 *      RECOMMENDED_BY / ENDORSES / DEPENDS_ON or similar).
 *
 * Termination guards (ADR 0011 §"Phase B walk mechanism"):
 *   - Visited-set on uuid (cycles / re-processing).
 *   - Max-depth (env BRAINSTORM_COMMUNITY_PULL_MAX_DEPTH; default 16).
 *   - Max-fetch budget (env BRAINSTORM_COMMUNITY_PULL_MAX_FETCH; default 2000).
 *   - Per-event try/catch — errors logged + counted; never thrown.
 *
 * Response shape (ADR 0011 §"Decision"):
 *   { success, supersetUuid, fetched, materialized, edgesMerged, skipped,
 *     errors[], truncated, depth }
 */

const { runCypher, writeCypher } = require('../../lib/neo4j-driver');
const { buildImportCypher, executeCypher } = require('../neo4j/eventSync');
const firmware = require('../normalize/firmware');

const API_BASE = process.env.TAPESTRY_API_BASE || 'http://localhost:80';

async function apiGet(endpoint, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = qs ? `${API_BASE}${endpoint}?${qs}` : `${API_BASE}${endpoint}`;
  const resp = await fetch(url);
  return resp.json();
}

async function apiPost(endpoint, body) {
  const url = `${API_BASE}${endpoint}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return resp.json();
}

function uuidOf(ev) {
  if (!ev || !Array.isArray(ev.tags)) return null;
  const dTag = (ev.tags.find(t => t[0] === 'd') || [])[1];
  if (!dTag || typeof ev.pubkey !== 'string' || typeof ev.kind !== 'number') return null;
  return `${ev.kind}:${ev.pubkey}:${dTag}`;
}

async function handlePullCommunityClassThread(req, res) {
  try {
    const handle = decodeURIComponent(req.params.handle || '');
    if (!handle) {
      return res.status(400).json({ success: false, error: 'handle is required' });
    }

    // Accept handle as either slug (`nostr-relay`) OR a-tag form
    // (`39998:<localTA>:nostr-relay`). Story #9's export-set endpoint accepts
    // a-tag form; this endpoint accepts both so the UI can call either with
    // the same URL shape it already uses (decodedUuid).
    let slug = handle;
    if (handle.startsWith('39998:')) {
      const parts = handle.split(':');
      if (parts.length >= 3) slug = parts.slice(2).join(':');
    }

    // ── Lookup communityReference from firmware manifest ────────────
    const manifest = firmware.getManifest();
    const entry = (manifest.concepts || []).find(c => c.slug === slug);
    if (!entry || !entry.communityReference) {
      return res.status(400).json({
        success: false,
        error: `no communityReference for handle "${handle}" — Phase B pull is only available for concepts carrying communityReference in the firmware manifest`,
      });
    }

    const cr = entry.communityReference;
    const parts = String(cr.headerATag || '').split(':');
    if (parts.length < 3 || parts[0] !== '39998') {
      return res.status(400).json({
        success: false,
        error: `malformed communityReference.headerATag "${cr.headerATag}"`,
      });
    }
    const curatorPk = parts[1];
    const conceptDTag = parts.slice(2).join(':');
    const curatorHeaderUuid = `39998:${curatorPk}:${conceptDTag}`;
    const communitySupersetUuid = `39999:${curatorPk}:${conceptDTag}-superset`;
    const curatorSetConceptUuid = `39998:${curatorPk}:set`;
    const relays = (cr.relayHints || []).join(',');

    if (!relays) {
      return res.status(400).json({
        success: false,
        error: `no relayHints in communityReference for "${handle}"`,
      });
    }

    // ── Verify #11 anchor exists locally ────────────────────────────
    const anchorRows = await runCypher(
      `MATCH (s:Superset {uuid:$u}) RETURN s.uuid AS uuid LIMIT 1`,
      { u: communitySupersetUuid }
    );
    if (!anchorRows.length) {
      return res.status(400).json({
        success: false,
        error: `#11 anchor missing — community Superset ${communitySupersetUuid} not present in local Neo4j. Run firmware install first (POST /api/firmware/install) to wire the #11 anchor before invoking Phase B.`,
      });
    }

    // ── Termination guards ──────────────────────────────────────────
    const maxDepth = parseInt(process.env.BRAINSTORM_COMMUNITY_PULL_MAX_DEPTH, 10) || 16;
    const maxFetch = parseInt(process.env.BRAINSTORM_COMMUNITY_PULL_MAX_FETCH, 10) || 2000;

    // ── BFS walk state ──────────────────────────────────────────────
    const visited = new Set([communitySupersetUuid]);
    let queue = [communitySupersetUuid];
    let depth = 0;
    const stats = {
      fetched: 0,
      materialized: 0,
      edgesMerged: 0,
      skipped: 0,
      errors: [],
    };

    while (queue.length > 0 && depth < maxDepth && stats.fetched < maxFetch) {
      const nextQueue = [];

      for (const parentUuid of queue) {
        if (stats.fetched >= maxFetch) break;

        // (a) #n walk: direct elements claiming this parent via n-tag
        let nMembers = [];
        try {
          const r = await apiGet('/api/relay/external', {
            filter: JSON.stringify({ kinds: [39999], '#n': [parentUuid] }),
            relays,
          });
          nMembers = (r && Array.isArray(r.events)) ? r.events : [];
        } catch (err) {
          stats.errors.push({ step: 'fetch-n', parent: parentUuid, message: err.message });
        }

        // (b) #s walk: direct sub-Sets/Supersets claiming this parent via s-tag
        let sMembers = [];
        try {
          const r = await apiGet('/api/relay/external', {
            filter: JSON.stringify({ kinds: [39999], '#s': [parentUuid] }),
            relays,
          });
          sMembers = (r && Array.isArray(r.events)) ? r.events : [];
        } catch (err) {
          stats.errors.push({ step: 'fetch-s', parent: parentUuid, message: err.message });
        }

        // (c) Back-compat #z walk (root iteration only): events z-tagged at
        // the curator's concept Header. Covers pre-amendment curator events
        // without forcing curator-side migration. Wires flat HAS_ELEMENT.
        let zMembers = [];
        if (depth === 0) {
          try {
            const r = await apiGet('/api/relay/external', {
              filter: JSON.stringify({
                kinds: [39999],
                authors: [curatorPk],
                '#z': [curatorHeaderUuid],
              }),
              relays,
            });
            zMembers = (r && Array.isArray(r.events)) ? r.events : [];
          } catch (err) {
            stats.errors.push({ step: 'fetch-z-backcompat', parent: parentUuid, message: err.message });
          }
        }

        // Process in order: s (hierarchy claims) → n (element claims) → z (back-compat flat).
        // visited-set locks in the first-claim per event; ordering ensures hierarchy
        // wins where the curator has migrated to emit s tags.
        const batches = [
          { origin: 's', events: sMembers },
          { origin: 'n', events: nMembers },
          { origin: 'z', events: zMembers },
        ];

        for (const { origin, events } of batches) {
          for (const ev of events) {
            if (stats.fetched >= maxFetch) break;
            const memberUuid = uuidOf(ev);
            if (!memberUuid) continue;
            if (visited.has(memberUuid)) continue;
            visited.add(memberUuid);
            stats.fetched++;

            // ── Trust gate (ADR 0011 §"Trust constraints" §1, binding) ──
            // Refuse to materialize events whose pubkey !== curatorPk.
            // Prevents cross-instance election.
            if (ev.pubkey !== curatorPk) {
              stats.skipped++;
              stats.errors.push({
                step: 'trust-gate',
                uuid: memberUuid,
                reason: 'non-curator author',
              });
              continue;
            }

            // ── Publish + materialize (per-event graceful) ──
            try {
              await apiPost('/api/strfry/publish', { event: ev });
              await executeCypher(buildImportCypher(ev));
              stats.materialized++;
            } catch (err) {
              stats.errors.push({ step: 'materialize', uuid: memberUuid, message: err.message });
              continue;
            }

            // ── Classify (z-tag = curator's :set concept Header → Set) ──
            // ADR 0011 classification rule: `isSet ⇔ event has z-tag = 39998:<curatorPk>:set`.
            const isSet = (ev.tags || []).some(
              t => t[0] === 'z' && t[1] === curatorSetConceptUuid
            );

            // ── Canonical edge MERGE (parent → child per pass-1d) ──
            // Direction:
            //   n / z origin → (parent)-[:HAS_ELEMENT]->(child)
            //   s origin     → (parent)-[:IS_A_SUPERSET_OF]->(child)
            // For z origin, parent is the community Superset (flat root membership).
            try {
              if (origin === 'n' || origin === 'z') {
                const parentForEdge = origin === 'z' ? communitySupersetUuid : parentUuid;
                await writeCypher(
                  `MATCH (p {uuid:$p}),(c {uuid:$c})
                   WHERE p:Superset OR p:Set
                   MERGE (p)-[:HAS_ELEMENT]->(c)`,
                  { p: parentForEdge, c: memberUuid }
                );
              } else if (origin === 's') {
                await writeCypher(
                  `MATCH (p {uuid:$p}),(c {uuid:$c})
                   WHERE p:Superset OR p:Set
                   MERGE (p)-[:IS_A_SUPERSET_OF]->(c)`,
                  { p: parentUuid, c: memberUuid }
                );
              }
              stats.edgesMerged++;
            } catch (err) {
              stats.errors.push({ step: 'edge', uuid: memberUuid, message: err.message });
            }

            // ── If Set: SET :Set label + enqueue for recursion ──
            // Sets may have further #n/#s children at the next depth.
            if (isSet) {
              try {
                await writeCypher(
                  `MATCH (n:NostrEvent {uuid:$u}) SET n:Set`,
                  { u: memberUuid }
                );
              } catch (err) {
                stats.errors.push({ step: 'set-label', uuid: memberUuid, message: err.message });
              }
              nextQueue.push(memberUuid);
            }
          }
          if (stats.fetched >= maxFetch) break;
        }
      }

      queue = nextQueue;
      depth++;
    }

    const truncated = stats.fetched >= maxFetch;
    return res.json({
      success: true,
      supersetUuid: communitySupersetUuid,
      fetched: stats.fetched,
      materialized: stats.materialized,
      edgesMerged: stats.edgesMerged,
      skipped: stats.skipped,
      errors: stats.errors,
      truncated,
      depth,
    });
  } catch (err) {
    console.error('[concept/pull-community-class-thread]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { handlePullCommunityClassThread };
