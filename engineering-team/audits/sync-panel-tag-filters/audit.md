# Build Audit: Single-letter tag filters in the Negentropy Sync panel

**Book:** `engineering-team/audits/sync-panel-tag-filters/book.md`
**Date:** 2026-07-15
**Branch / commit range:** `9c40ba80..08d0b5c0` (feature branch `feat/sync-panel-tag-filters`, squash-free ladder `c9f3e132..63fb9610`, merged to staging via PR #355)
**Provenance:** Acceptance-frame (eager-open missed at intake; backfilled same-day at review — OPEN.md #29)
**Confidence:** high (single session, ask → story → ship → staging-verify traceable end to end)

> The Build Audit is the **as-built record** — what the product *is* now, factual and source-linked. It does not propose changes; that's `prd-seed.md`.

## 1. What shipped

- **Operators can add single-letter tag filters to the Negentropy Sync command builder** — a new **Tag Filters** group (between Authors and Time Range) where a filter is entered as one ASCII letter plus one-or-more comma-separated values; added filters render as removable rows and compose into the one filter JSON that drives Command Preview, Count, and Start. — `stories/relay-management/1-sync-panel-tag-filters.md`
- **`p`/`e`/`a` values are format-checked at entry** (uppercase counterparts identically): p/e take 64-hex (case-folded) or `npub`/`nprofile`/`note`/`nevent` (decoded to hex); a takes `kind:pubkey:identifier` or `naddr` (decoded). One bad value blocks the whole add with an inline error naming it. Other letters take arbitrary non-empty strings. — same story, ACs 5–7
- **The server now honors `"#<letter>"` filter keys end-to-end** — previously `buildFilterObj` whitelisted only `kinds`/`authors`/`since`/`until` and silently dropped tag keys, so even hand-crafted requests never reached `strfry sync`. Non-tag unknown keys are still dropped (regression-guarded). — same story, AC-8; ADR `decisions/relay-management/0001`

## 2. Epics & stories rolled up

### Epic: `relay-management` (opened by this book; remains Active)
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 sync-panel-tag-filters | Tag Filters sub-panel + pure validation core + server whitelist extension | Done | `reviews/relay-management/1-sync-panel-tag-filters.md` (PASS, 2026-07-15) |

## 3. As-built inventory

**User-facing**
- `NegentropySync` panel (`ui/src/pages/settings/RelaySettings.jsx`) gains the **Tag Filters** settings-group: `TagFilterEditor` (module-scope component) with `#` + one-letter input (maxLength 1) + comma-separated values input + **Add** (Enter also adds), inline blocking error box, one row per letter (`#x` mono chip · joined values · ✕ remove), all disabled while a sync runs.
- Composition: `filterObj['#' + letter] = values` at the panel's single composition point — preview string, Count call, and Start (SSE) all inherit with no handler changes.

**Domain**
- No concepts touched, no schema change, **no firmware reinstall**. The panel is deliberately concept-unaware: a `#z` value is an opaque string (epic guardrail). No TA-pubkey use anywhere in the diff.

**Data & contracts**
- `ui/src/utils/tagFilterValidation.js` (new, pure ESM): `validateTagLetter`, `normalizeTagValue`, `parseTagValues` (split/trim/drop-empties/dedupe-first-wins/≥1), `mergeTagFilter` (case-sensitive letter merge, append+dedupe, pure).
- `src/api/strfry/negentropySync.js`: `TAG_FILTER_KEY_RE = /^#[a-zA-Z]$/`; `buildFilterObj` copies matching keys whose value sanitizes to a non-empty array of non-empty strings; everything else still dropped. Pure helpers (`buildFilterObj`, `buildCommand`, `buildPreviewCommand`) now exported for direct test execution. **No route changes** — same four `/api/strfry/negentropy-sync/*` endpoints.
- Values reach the spawned process as argv array (no shell); JSON.stringify escapes control chars — injection-safe by construction.
- Tests: `test/sync-panel-tag-filters.test.js` (20 tests: 7 executed-ESM validation, 6 executed-CJS backend, 5 source-level JSX, 2 regression sentinels) wired into `test/test.js` at the house's five registration points. Stack-free by design (runs in CI's `stack-free` job).

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame: letter + values, p/e/a checked | Same, **plus** approved defaults: uppercase `P`/`E`/`A` validated identically; duplicate-letter add merges+dedupes; bech32 accepted and normalized to hex/coordinate | intentional-change (operator-approved at story gate) | story Open questions §defaults (approved 2026-07-15) | Operators can paste npub/nevent/naddr directly; re-adding a letter appends values | — |
| 2 | Frame bullet 3: preview reflects filters | Also rebuilt the **server** filter whitelist — without it the executed sync would silently ignore tag filters | constraint-discovered (server reconstructs the filter; unknown keys dropped) | ADR 0001 §Context; explore findings at planning | The feature actually *works* — preview and execution can't drift | — |
| 3 | Values: "one or more strings" | Comma-separated entry ⇒ values containing commas are inexpressible | constraint-discovered (input format) | story Out of scope (accepted; no single-letter tag convention needs commas) | Negligible | Revisit only if a real value class needs commas |
| 4 | (validation locus unstated) | Format validation client-side only; server enforces *shape* (key regex + string arrays), not value format | interpretation (parity with Authors; strfry treats values as opaque) | ADR 0001 §Decision + §Consequences | Malformed values from non-UI clients mismatch harmlessly; never injure | Revisit if non-UI clients start driving these endpoints |
| 5 | (verification locus unstated) | Browser verification via isolated dev harness (owner gate blocks agent sign-in; local Docker serves the stale shared checkout); live Count/Start deferred to staging | constraint-discovered (environment) | story `## Deviations` (Implementer, 2026-07-15) | None — staging smoke closed the gap same-day: live UI count `#z`=12 vs unfiltered 400 vs nonsense 0 | — (resolved at staging) |

**Undocumented work:** none — every diff hunk traces to the story/ADR/test plan (verified in review). The only out-of-band commits are the process artifacts themselves (book-open backfill, OPEN.md #29).

## 5. Quality state at close

- **Test gate at close:** story suite 20/20; CI `stack-free` **passed on PR #355** (the binding gate). Full local `npm test` shows the **pre-existing environmental `Overall: FAIL`** — 11 tag/pin/TL stack-dependent suites failing against the stale/empty local Docker stack, **identical counts on a pristine `origin/staging` baseline** (differential re-run at review: `profile-tags` 10/3 on both) — ledgered as OPEN.md #27, practice per `reviews/nip-reorg/*`.
- **Staging state:** deploy run 29460802673 (92s) at merge `08d0b5c0`; smoke clean (Tiers 1–5). Live proof: served bundle carries the four new UI strings; `/api/strfry/negentropy-sync/count` discriminates (`#z`=real-handle → 12, nonsense → 0, unfiltered kind-39999 → 400); owner-session UI walk added `#z`, previewed the exact command, and counted 12 from the real page. Console clean.
- **Known open issues:** none from this book. Adjacent pre-existing: dcosl relay lacks NIP-45 COUNT (`maxFilterLimitCount` unset) so *remote* counts against it show the existing unsupported-notice — orthogonal, correctly surfaced.
- **Debt (ADR Consequences):** server whitelist grows by exactly one key class; future filter fields still need deliberate adds (by design). GET query-string bounds very large value lists (parity with Authors; EventSource forces GET). Single-quote-bearing values render an ugly *display* preview; argv stays correct.

## 6. Carry-forward register

- [ ] **Router Management tag filters** — the sibling feature: per-stream tag filters in the persistent strfry-router config (the panel one tab left). Directly serves the ledgered tags-federation ops plan (OPEN.md #25: a `#z`-filtered both-direction dcosl stream). Triaged: `stories/_intake.md` 2026-07-15 entry; next-phase scoping in `prd-seed.md` §6–7. *(from this close's ask)*
- [ ] Promote the staging-held feature to prod when the operator is ready (OPEN.md #30). *(release sequencing)*
- [ ] Optional UX: strip a leading `#` typed into the letter box (review non-blocking #1).
- [ ] Deferred by story Out of scope: saved filter presets / persistence; in-place value editing; concept-handle autocomplete (tempting for tag-federation); semantic validation for free letters.
- [ ] Ops nicety (adjacent, pre-existing): set `maxFilterLimitCount` on dcosl's strfry to enable remote NIP-45 counts (surfaced by Count's remote leg; also noted in OPEN.md #25's orbit).

## 7. Process findings (harness)

Retro run 2026-07-15 against `scripts/harness-stats.sh` (484 phase commits · 91 reviews · kick-back 2% · books 12 closed/2 open · median cycle 0d — healthy; no threshold findings). Every lesson below carries exactly one terminal state; no fourth state.

| Finding | Source | Terminal state |
|---|---|---|
| `/plan-feature` entry skips the Phase-0 eager book-open; completion detection at review found no anchor | review § Harness friction; this book's open was backfilled | **OPEN.md row #29** (meta, 2026-07-15) — candidate fix named there (step-0 in `plan-feature.md` or routing-table note) |
| Local full `npm test` `Overall: FAIL` ambiguity re-encountered; ~30 min burned re-proving the environmental cause before recalling the ledger | Implementer phase (this session); OPEN.md #27 pre-existing | **Declined as new row** — already ledgered as #27 with the differential-baseline practice; this occurrence recorded there implicitly (2nd confirmation), and the session auto-memory was sharpened so future sessions pattern-match `Overall: FAIL` immediately. Escalation path for #27 itself is the fix (per meta-escalation thresholds). |
| Owner-gated UI can't be browser-verified by an agent (NIP-07 signer required); verified via temporary in-worktree dev harness (temp export, reverted pre-commit), documented in story `## Deviations` | story Deviations (process-shaped) | **Declined** — pattern is recorded in the story + this audit; too narrow for a harness doc after one occurrence. If a second gated-UI story hits this, promote to a documented verification pattern (candidate home: `docs/SMOKE_TEST.md` sibling or tester role notes). |
| Worktree dev servers: `.claude/launch.json` `cwd` must be repo-relative — worktree serving needs `npm --prefix <abs-worktree>/ui run dev` | Implementer phase (this session) | **Declined for repo** — local agent-tooling knowledge, not project harness; captured in session auto-memory (parallel-session worktree memory). |

Portability check (Direction ↔ human-gated): #29 ports — a Direction-mode book entering via `/plan-feature` would hit the same missing-anchor state at its Stage-0 preflight; the candidate fix in #29 covers both flows.
