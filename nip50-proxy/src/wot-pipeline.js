/**
 * WoT Pipeline — Server-side orchestrator
 *
 * Replicates the 5-step WoT pipeline from BrainstormSearch.jsx,
 * running entirely server-side so the NIP-50 proxy can auto-trigger
 * score loading for new observers.
 *
 * Steps:
 *   1. Find kind 10040 (local strfry → external relays)
 *   2. Parse rank tag → rankAuthor (delegated pubkey) + rankRelay
 *   3. Count local TAs (kind 30382)
 *   4. Negentropy sync TAs from rankRelay (if none local)
 *   5. Stream TAs, parse metrics, load scores into Meilisearch
 */

import { execSync, spawn } from 'child_process';

const BRAINSTORM_API = process.env.BRAINSTORM_API || 'http://127.0.0.1:7778';
const EXTERNAL_RELAYS = ['wss://relay.primal.net', 'wss://relay.damus.io', 'wss://nos.lol'];
const SCORE_BATCH_SIZE = 5000;
const EXEC_OPTS = { maxBuffer: 50 * 1024 * 1024, timeout: 60000 };

// ── In-progress tracker ──
// Prevents duplicate pipeline runs for the same observer.
const activePipelines = new Map(); // observerPubkey → { status, startedAt, detail }

/**
 * Get the current state of all active/recent pipelines.
 */
export function getPipelineStatus() {
  const entries = {};
  for (const [pubkey, info] of activePipelines) {
    entries[pubkey] = { ...info, elapsed: Date.now() - info.startedAt };
  }
  return { activePipelines: entries, count: activePipelines.size };
}

/**
 * Trigger the pipeline for an observer if not already running.
 * Non-blocking — returns immediately. Pipeline runs in background.
 */
export function triggerPipelineIfNeeded(observerPubkey) {
  if (!observerPubkey || observerPubkey.length !== 64) return;
  if (activePipelines.has(observerPubkey)) {
    console.log(`[wot-pipeline] Pipeline already in progress for ${observerPubkey.slice(0, 12)}...`);
    return;
  }

  // Fire and forget
  runPipelineForObserver(observerPubkey).catch(err => {
    console.error(`[wot-pipeline] Unhandled error for ${observerPubkey.slice(0, 12)}...: ${err.message}`);
  });
}

/**
 * Run the full WoT pipeline for an observer pubkey.
 */
async function runPipelineForObserver(observerPubkey) {
  const tag = observerPubkey.slice(0, 12);
  console.log(`[wot-pipeline] Starting pipeline for ${tag}...`);

  activePipelines.set(observerPubkey, { status: 'starting', startedAt: Date.now(), detail: null });

  try {
    // ── Step 1: Find kind 10040 ──
    activePipelines.set(observerPubkey, { ...activePipelines.get(observerPubkey), status: 'finding-10040' });

    let event10040 = findKind10040Locally(observerPubkey);
    if (!event10040) {
      console.log(`[wot-pipeline] ${tag}: No local kind 10040, checking external relays...`);
      event10040 = await findKind10040External(observerPubkey);
    }

    if (!event10040) {
      console.log(`[wot-pipeline] ${tag}: No kind 10040 found — user has no WoT setup. Done.`);
      return;
    }
    console.log(`[wot-pipeline] ${tag}: Found kind 10040`);

    // ── Step 2: Parse rank tag ──
    activePipelines.set(observerPubkey, { ...activePipelines.get(observerPubkey), status: 'parsing-rank-tag' });

    const allMetrics = (event10040.tags || [])
      .filter(t => t[0]?.startsWith('30382:'))
      .map(t => ({ metric: t[0].split(':')[1], delegatedPubkey: t[1], relayUrl: t[2] }));

    const rankTag = (event10040.tags || []).find(t => t[0] === '30382:rank');
    if (!rankTag || !rankTag[1] || !rankTag[2]) {
      console.log(`[wot-pipeline] ${tag}: No rank tag in kind 10040. Done.`);
      return;
    }

    const rankAuthor = rankTag[1];
    const rankRelay = rankTag[2];
    const metricNames = allMetrics.map(m => m.metric);
    const povSuffix = rankAuthor.slice(0, 8);

    console.log(`[wot-pipeline] ${tag}: rankAuthor=${rankAuthor.slice(0, 12)}... relay=${rankRelay} metrics=[${metricNames.join(',')}]`);

    // ── Step 3: Count local TAs ──
    activePipelines.set(observerPubkey, { ...activePipelines.get(observerPubkey), status: 'counting-TAs', detail: { rankAuthor: rankAuthor.slice(0, 12) } });

    let localCount = countLocalTAs(rankAuthor);
    console.log(`[wot-pipeline] ${tag}: ${localCount} TAs in local relay`);

    // ── Step 4: Negentropy sync (if needed) ──
    if (localCount === 0) {
      activePipelines.set(observerPubkey, { ...activePipelines.get(observerPubkey), status: 'syncing-TAs', detail: { rankRelay } });
      console.log(`[wot-pipeline] ${tag}: No local TAs — syncing from ${rankRelay}...`);

      const syncOk = await negentropySync(rankAuthor, rankRelay);
      if (!syncOk) {
        console.log(`[wot-pipeline] ${tag}: Negentropy sync failed. Done.`);
        return;
      }

      localCount = countLocalTAs(rankAuthor);
      console.log(`[wot-pipeline] ${tag}: After sync: ${localCount} TAs`);

      if (localCount === 0) {
        console.log(`[wot-pipeline] ${tag}: Still no TAs after sync. Done.`);
        return;
      }
    }

    // ── Step 5: Stream TAs, parse metrics, load scores ──
    activePipelines.set(observerPubkey, { ...activePipelines.get(observerPubkey), status: 'loading-scores', detail: { localCount } });
    console.log(`[wot-pipeline] ${tag}: Streaming ${localCount} TAs and loading scores...`);

    const loaded = await streamAndLoadScores(observerPubkey, rankAuthor, metricNames, povSuffix);
    console.log(`[wot-pipeline] ${tag}: Pipeline complete — loaded ${loaded} scores`);

  } finally {
    activePipelines.delete(observerPubkey);
  }
}

// ── Step 1 helpers ──

function findKind10040Locally(pubkey) {
  try {
    const filter = JSON.stringify({ kinds: [10040], authors: [pubkey], limit: 1 });
    const output = execSync(`strfry scan '${filter.replace(/'/g, "'\\''")}'`, EXEC_OPTS).toString().trim();
    if (!output) return null;
    const lines = output.split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (event.kind === 10040) return event;
      } catch { /* skip */ }
    }
  } catch { /* strfry scan failed */ }
  return null;
}

async function findKind10040External(pubkey) {
  try {
    const filter = encodeURIComponent(JSON.stringify({ kinds: [10040], authors: [pubkey], limit: 1 }));
    const relays = encodeURIComponent(EXTERNAL_RELAYS.join(','));
    const resp = await fetch(`${BRAINSTORM_API}/api/relay/external?filter=${filter}&relays=${relays}`);
    const data = await resp.json();
    if (data.success && data.events?.length) {
      return data.events[0];
    }
  } catch (err) {
    console.warn(`[wot-pipeline] External relay query failed: ${err.message}`);
  }
  return null;
}

// ── Step 3 helper ──

function countLocalTAs(rankAuthor) {
  try {
    const filter = JSON.stringify({ kinds: [30382], authors: [rankAuthor] });
    const output = execSync(`strfry scan --count '${filter.replace(/'/g, "'\\''")}'`, EXEC_OPTS).toString().trim();
    return parseInt(output) || 0;
  } catch {
    return 0;
  }
}

// ── Step 4 helper ──

async function negentropySync(rankAuthor, rankRelay) {
  try {
    const resp = await fetch(`${BRAINSTORM_API}/api/strfry/negentropy-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        relay: rankRelay,
        dir: 'down',
        filter: { kinds: [30382], authors: [rankAuthor] },
      }),
    });
    const data = await resp.json();
    if (data.success) return true;
    if (data.active) {
      console.log('[wot-pipeline] Sync already in progress, waiting...');
      // Wait and retry — another sync is running
      await new Promise(r => setTimeout(r, 30000));
      return true; // Assume it completed
    }
    console.error(`[wot-pipeline] Sync failed: ${data.error || 'unknown'}`);
    return false;
  } catch (err) {
    console.error(`[wot-pipeline] Sync request failed: ${err.message}`);
    return false;
  }
}

// ── Step 5: Stream TAs and load scores ──

function streamAndLoadScores(observerPubkey, rankAuthor, metricNames, povSuffix) {
  return new Promise((resolve, reject) => {
    const filter = JSON.stringify({ kinds: [30382], authors: [rankAuthor] });
    const proc = spawn('strfry', ['scan', filter], { stdio: ['ignore', 'pipe', 'ignore'] });

    let buffer = '';
    const scores = [];
    let totalLoaded = 0;

    proc.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete line

      for (const line of lines) {
        if (!line.trim()) continue;
        let event;
        try { event = JSON.parse(line); } catch { continue; }

        const dTag = event.tags?.find(t => t[0] === 'd')?.[1];
        if (!dTag) continue;

        const scoreObj = { pubkey: dTag };
        for (const tag of event.tags) {
          if (metricNames.includes(tag[0])) {
            scoreObj[`wot_${tag[0]}_${povSuffix}`] = parseFloat(tag[1]) || 0;
          }
        }
        scores.push(scoreObj);
      }
    });

    proc.on('close', async (code) => {
      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer);
          const dTag = event.tags?.find(t => t[0] === 'd')?.[1];
          if (dTag) {
            const scoreObj = { pubkey: dTag };
            for (const tag of event.tags) {
              if (metricNames.includes(tag[0])) {
                scoreObj[`wot_${tag[0]}_${povSuffix}`] = parseFloat(tag[1]) || 0;
              }
            }
            scores.push(scoreObj);
          }
        } catch { /* skip */ }
      }

      if (scores.length === 0) {
        console.log('[wot-pipeline] No scores parsed from TAs');
        resolve(0);
        return;
      }

      // Load scores in batches via the Express API
      try {
        for (let i = 0; i < scores.length; i += SCORE_BATCH_SIZE) {
          const batch = scores.slice(i, i + SCORE_BATCH_SIZE);
          const resp = await fetch(`${BRAINSTORM_API}/api/search/profiles/meili/load-scores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              povPubkey: observerPubkey,
              delegatedPubkey: rankAuthor,
              metrics: metricNames,
              scores: batch,
            }),
          });
          const result = await resp.json();
          if (result.success) {
            totalLoaded += batch.length;
          } else {
            console.error(`[wot-pipeline] Batch load failed: ${result.error || 'unknown'}`);
          }
        }
        resolve(totalLoaded);
      } catch (err) {
        console.error(`[wot-pipeline] Score loading failed: ${err.message}`);
        resolve(totalLoaded);
      }
    });

    proc.on('error', (err) => {
      console.error(`[wot-pipeline] strfry scan failed: ${err.message}`);
      resolve(0);
    });
  });
}
