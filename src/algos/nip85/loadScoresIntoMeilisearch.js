#!/usr/bin/env node

/**
 * Load Owner's WoT Scores into Meilisearch
 *
 * Reads kind 30382 events from local strfry (authored by the owner's
 * Tapestry Assistant), parses all metric tags, and POSTs them to the
 * Meilisearch load-scores endpoint.
 */

const { execSync } = require('child_process');
const { getConfigFromFile } = require('../../utils/config');
const { getOwnerAssistantPubkey } = require('../../utils/assistantKeys');

const SKIP_TAGS = new Set(['d']); // d-tag is the subject pubkey, not a metric

async function main() {
  // 1. Determine pubkeys
  const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY');
  const delegatedPubkey = getOwnerAssistantPubkey();

  if (!ownerPubkey) {
    console.error('BRAINSTORM_OWNER_PUBKEY not configured');
    process.exit(1);
  }
  if (!delegatedPubkey) {
    console.error('Could not determine TA pubkey (delegatedPubkey)');
    process.exit(1);
  }

  const povSuffix = delegatedPubkey.slice(0, 8);
  console.log(`Owner pubkey: ${ownerPubkey.slice(0, 8)}...`);
  console.log(`Delegated pubkey (TA): ${delegatedPubkey.slice(0, 8)}...`);
  console.log(`POV suffix: ${povSuffix}`);

  // 2. Scan local strfry for kind 30382 events
  const filter = JSON.stringify({ kinds: [30382], authors: [delegatedPubkey] });
  console.log(`Scanning strfry for kind 30382 events...`);

  let rawOutput;
  try {
    rawOutput = execSync(`strfry scan '${filter.replace(/'/g, "'\\''")}'`, {
      encoding: 'utf8',
      maxBuffer: 500 * 1024 * 1024, // 500MB — could be 100K+ events
      timeout: 300000, // 5 min
    }).trim();
  } catch (err) {
    console.error('strfry scan failed:', err.message);
    process.exit(1);
  }

  if (!rawOutput) {
    console.log('No kind 30382 events found in local strfry. Nothing to load.');
    process.exit(0);
  }

  const lines = rawOutput.split('\n').filter(Boolean);
  console.log(`Found ${lines.length} kind 30382 events`);

  // 3. Parse events into scores array
  const scores = [];
  const metricSet = new Set();

  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      const dTag = event.tags?.find(t => t[0] === 'd')?.[1];
      if (!dTag) continue;

      const scoreObj = { pubkey: dTag };

      for (const tag of event.tags) {
        const [tagName, tagValue] = tag;
        if (!SKIP_TAGS.has(tagName) && tagValue !== undefined) {
          const fieldName = `wot_${tagName}_${povSuffix}`;
          scoreObj[fieldName] = parseFloat(tagValue) || 0;
          metricSet.add(tagName);
        }
      }

      scores.push(scoreObj);
    } catch {
      // skip malformed lines
    }
  }

  const metrics = [...metricSet];
  console.log(`Parsed ${scores.length} scores with ${metrics.length} metrics: ${metrics.join(', ')}`);

  if (scores.length === 0) {
    console.log('No valid scores parsed. Nothing to load.');
    process.exit(0);
  }

  // 4. POST to Meilisearch load-scores endpoint
  console.log(`Sending ${scores.length} scores to Meilisearch...`);

  const startTime = Date.now();
  try {
    const resp = await fetch('http://127.0.0.1:7778/api/search/profiles/meili/load-scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        povPubkey: ownerPubkey,
        delegatedPubkey,
        metrics,
        scores,
      }),
    });

    const data = await resp.json();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    if (data.success) {
      console.log(`Meilisearch load complete in ${elapsed}s: ${JSON.stringify(data)}`);
    } else {
      console.error(`Meilisearch load failed after ${elapsed}s:`, data.error || data);
      process.exit(1);
    }
  } catch (err) {
    console.error('Error calling load-scores endpoint:', err.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
