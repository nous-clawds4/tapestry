# Story 4: Scheduled task to refresh Meilisearch profiles and House PoV WoT scores

**Status:** Approved
**Created:** 2026-05-13
**Type:** Feature

## Background

The Brainstorm search experience depends on two pieces of state being kept fresh in Meilisearch:

1. **Kind-0 (profile) data** — the searchable corpus. Today this is refreshed by `runBulkIngest()` in `nostr-search/src/bulk-ingest.js`, called on a 24h cadence from `nostr-search/src/startup.js`. Operators have no UI control over this cadence.
2. **House PoV WoT scores** — per-profile WoT trust scores from the House perspective, derived from kind 30382 (Trusted Assertions) events published by House. Today the only loader into Meilisearch is `src/algos/nip85/loadScoresIntoMeilisearch.sh`, hardcoded to the Owner's pubkey — there is no scheduled task that keeps House's scores fresh.

The existing "Update All Scores for Owner" panel is the closest precedent: a toggle + days/hours schedule for a recurring task that (among other things) computes and loads Owner's scores into Meilisearch. It does not address House (a different remote pubkey on this node), and it does not refresh kind-0 profile data.

Because House is a remote pubkey, this node cannot publish kind 10040 or 30382 on House's behalf — we can only sync House's externally-published events into local strfry. Per project stance, the latest kind 30382 events are the single source of truth for House's scores (Neo4j is not), so the task does not recompute scores — it ensures the latest TAs are present locally and then loads them into Meilisearch.

## User-facing description

**As an operator of a Brainstorm instance**, I want a Scheduled Tasks panel that, when enabled, periodically (a) refreshes kind-0 profile data in Meilisearch and (b) refreshes House PoV WoT scores in Meilisearch from the latest House-published Trusted Assertions, **so that** search results stay current with the latest profiles and reflect the latest House-perspective trust signals without manual intervention.

## Acceptance criteria

- [ ] On Home > Settings > Relays > Scheduled Tasks tab, a **new panel titled "Refresh Meilisearch profiles & House PoV scores"** appears below the existing "Update All Scores for Owner" panel.
- [ ] The new panel has an **enable/disable toggle**, default **disabled** on a fresh deploy.
- [ ] The new panel has **"Run every __ days, __ hours"** inputs matching the existing panel's UX, with the same minimum-interval validation (≥ 1 hour).
- [ ] When the operator enables the panel and saves a schedule, the task runs on that cadence; the panel surfaces **next-run** and **last-run** times consistent with the existing panel.
- [ ] When the operator disables the panel, the task stops firing on the next scheduler tick.
- [ ] Toggle state and schedule values **persist across container restarts** — toggling on, then redeploying, results in the panel still on with the same schedule.
- [ ] When the task fires with **House PoV configured** (`grapevine.searchPreferences.povPubkey` and `delegatedPubkey` both set), it:
  - Ensures the latest House kind 10040 (Treasure Map) and kind 30382 (Trusted Assertions) events are present in local strfry,
  - Refreshes kind-0 profile data in Meilisearch, and
  - Loads House's WoT scores into Meilisearch (scoped to House's pubkeys, not Owner's).
- [ ] When the task fires with **House PoV not configured** (povPubkey unset in Search Preferences), the task does **not** fail the entire run — it still refreshes kind-0 profiles, logs a structured warning that the score-load step was skipped, and surfaces the warning in the panel's run history.
- [ ] When House PoV is unset, the panel **displays a pre-run status banner** with text along the lines of "House PoV is not configured — the score-refresh half will be skipped until you set it in Search Preferences." The banner links to Home > My Grapevine > Search Preferences. The banner disappears once povPubkey is configured.
- [ ] The new panel has a **recent execution history** display matching the existing panel's history table.
- [ ] The existing "Update All Scores for Owner" panel continues to work unchanged — its toggle, schedule, run history, and underlying task chain are not regressed.
- [ ] Documentation: a brief note in `BIBLE.md` or `docs/CONFIGURATION.md` describes the new scheduled task and its dependency on (a) House PoV being configured in Search Preferences and (b) the `treasureMaps` router preset being enabled (or one-shot 10040 syncs being done) so the local 10040/30382 corpus has House's events.

## Concepts touched

To be resolved by the Architect via `/api/concept-graph/summaries`:

- Kind 10040 (TA Treasure Map / NIP-85)
- Kind 30382 (Trusted Assertion / NIP-85)
- House PoV (Point of View)
- Owner / Owner PoV
- Tapestry Assistant (TA) pubkey / delegated signer
- Meilisearch profile index
- Scheduled Tasks subsystem (existing)
- strfry-router preset system (existing — see story #2)

## Out of scope

- **Recomputing House's scores locally.** Per project stance, kind 30382 events are the source of truth.
- **Publishing kind 10040 or kind 30382 on House's behalf.** House is a remote pubkey.
- **Changes to the existing "Update All Scores for Owner" task or panel** beyond what's needed to avoid regression.
- **Disabling the built-in 24h profile re-ingest in `nostr-search/src/startup.js`.** It keeps running on its own cadence; this task adds an *additional* operator-controlled refresh. Reconciliation deferred to a separate story.
- **A generalized N-task UI refactor of the Scheduled Tasks tab.** The Architect may need to generalize the scheduler module internally, but no user-facing UI overhaul.
- **A House PoV preset / shortcut UI for configuring the pubkey.** Search Preferences page already owns that; this panel consumes what's already configured there.
- **Author allowlists, custom relay overrides, or per-task throttling** beyond enable/disable + days/hours.

## Open questions

None at draft time — initial uncertainty (unset-PoV behavior, panel title, pre-run banner) resolved with the operator before approval.

## Linked artifacts

- ADR: `engineering-team/decisions/0003-scheduled-search-and-house-scores-refresh.md`
- Test plan: `engineering-team/stories/4-scheduled-search-and-house-scores-refresh.test-plan.md`
- Review: `engineering-team/reviews/4-scheduled-search-and-house-scores-refresh.md` (PASS after one-line URL fix; see Re-review section)
