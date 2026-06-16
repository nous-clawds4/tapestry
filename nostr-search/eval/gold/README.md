# Gold set — hand-judged search-quality queries

This directory holds the **hand-judged** relevance set that the eval harness
scores against (story #7, ADR 0004). Per the story's Done bar, these judgments
are produced by a human — **not** bootstrapped from WoT-derived data (that would
make the metric circular and corrode the very trust signal it measures).

## Entry schema

Each entry (see `nostr-search/eval/schema.js` — the authoritative validator):

```json
{
  "id": "short-stable-id",
  "query": "the search string a user types",
  "observer": { "wotPov": "house", "userPubkey": "<optional 64-hex>" },
  "judgments": [
    { "pubkey": "<64-hex>", "relevant": true },
    { "pubkey": "<64-hex>", "relevant": false }
  ],
  "baseline": 0.0,
  "layered": { "tagLayer": {}, "dlistLayer": {} }
}
```

- `judgments` — your human relevance calls. `relevant: true` = this profile
  *should* surface for this query/observer.
- `baseline` *(optional)* — per-query expected recall; if set, the gate flags
  this query as regressed when its measured recall drops below it.
- `layered` *(optional)* — forward-looking Tag→DList expectations. v1 **accepts
  and ignores** this; never a rejection reason.

## File convention

- **Calibrated set:** non-underscore `*.json` files (e.g. `calibrated.json`).
  These are consumed by `runner.js` and counted toward the AC-5 ≥30 gate.
- **Scaffolding:** `_`-prefixed files (`_examples.json`, `_candidates.json`)
  are **excluded** from the live runner. `_candidates.json` is the worklist:
  queries with empty `judgments` for you to fill in.

## How to produce the calibrated set (the human step)

1. Open `_candidates.json`. For each query, run it on staging/local, decide
   which returned pubkeys are genuinely relevant for that observer, and record
   `judgments`.
2. Move completed entries into a non-underscore file (e.g. `calibrated.json`).
3. `npm test` — the AC-5 test goes green once ≥30 judged entries validate.
4. Run `node nostr-search/eval/runner.js` once to produce the first numbers,
   then set `baseline` + `tolerance` in `nostr-search/eval/baseline.json`.

This step is intentionally yours: the harness can be built autonomously, but
the relevance judgments are the irreplaceable human signal.
