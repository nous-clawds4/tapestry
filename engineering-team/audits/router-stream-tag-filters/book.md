# Book of Work: Tag filters for Router Management streams

**Slug:** router-stream-tag-filters
**Status:** Closed (2026-07-16)
**Opened:** 2026-07-15 (eagerly at intake — the OPEN.md #29 remedy applied this time)
**Closed:** 2026-07-16

## Intent anchor

**Acceptance frame (no PRD)** — the operator's 2026-07-15 ask, restated below and confirmed by the 2026-07-15 kickoff message that started this book ("Let's build the Router Management tag-filter feature (relay-management story #2). Start from the triaged intake entry dated 2026-07-15…"). Anchor inputs, per that kickoff: the intake entry (`stories/_intake.md` 2026-07-15, which carries the verbatim ask), `audits/sync-panel-tag-filters/prd-seed.md` §6–7 (the sibling book's return edge), and OPEN.md #25 (the `#z`-filtered dcosl router-stream plan this serves).

**Raw ask (verbatim, 2026-07-15, on ratifying the sync-panel book):**

> Before we close it, I am inclined to say that we ought to add a similar feature to the Router Management panel of https://staging.brainstorm.world/tapestry/settings/relays .

### Acceptance frame

- [x] The **Router Management panel** (Relay Settings page) gains the *similar feature* to what the Negentropy Sync panel shipped in `stories/relay-management/1-sync-panel-tag-filters.md`: an operator can add **one or more single-letter tag filters** (`"#x": ["v1","v2"]`) to a router stream — letter + one-or-more values, entered one at a time; `p`/`e`/`a` (and uppercase) values format-checked with bech32 (`npub`/`nprofile`/`note`/`nevent`/`naddr`) normalization; other letters free-form.
- [x] **Persistent-config semantics honored end-to-end:** router streams are always-on config, not a one-shot command — tag filters entered in the stream add/edit UI are saved into that stream's filter in the deployed strfry-router config, survive the save → router-restart cycle, and round-trip back into the UI when the stream is re-opened for editing.
- [x] **The motivating case is expressible from the UI** (OPEN.md #25): an operator can configure a dcosl stream whose filter carries `{"kinds":[39999],"#z":[<canonical handles>]}` — point-and-click, no container shell.
- [x] Product questions the sibling book left open (prd-seed §7 bullet 1) are **settled during Planning, not silently defaulted**: per-stream scoping, interplay with preset streams (dcosl/WoT/profiles… carry kinds-only filters today), and save/restart UX.

**Done looks like:** story #2 of epic `relay-management` passes review and ships to `staging`; the running router's config carries operator-entered tag filters; the `#z` dcosl stream is UI-expressible.

## Epics in this book

- `relay-management` — story #2 (`stories/relay-management/2-router-stream-tag-filters.md`). Sibling ask to the closed `sync-panel-tag-filters` book, deliberately a **new book** per the intake triage.

## Session mode — standing gate authorization (2026-07-15)

*This is **not** an armed `## Direction mode` pre-registration (no experiment hypothesis, deadline, or scoring; the operator wrote none and this session cannot self-arm one — `roles/director.md` requires the operator to write or ratify it). It records the narrower thing the operator actually granted.*

The kickoff message instructs: *"run the full five-phase harness starting with /plan-feature"*, *"Ship via /cycle-staging when the review passes; I'll decide on prod and the tags branch after staging verification."* The session therefore advances the per-story phase gates **without per-gate operator check-ins**, answering each gate from the anchor inputs above, under these controls:

- **Judge insurance (borrowed from the Direction-mode protocol):** a fresh blinded `gate-judge` audits Gates 1, 2, 3, and 5 before the session advances; **KICK_BACK is binding**; Gate 4 is verified mechanically by the session. Judges get only rubric + artifact paths + this book's acceptance frame, per the blinding rules.
- **Decision journal:** `journal.md` beside this file, append-only — every gate decision, judge verdict, answered question, and deviation.
- **Reserved for the operator (never this session):** anything past staging (prod promotion, `main`, the tags branch), and ratifying this book complete — the close is *offered* after staging verification, not run.
- **Halt-and-surface:** any product question the anchor inputs do not decide (beyond the three prd-seed §7 questions expressly delegated to Planning), any staging breakage not caused by this work, any gate thrashing (3 consecutive kick-backs at one gate).
- **Pre-authorized deviations (from the kickoff itself):** work happens in a dedicated worktree off `origin/staging` (`feat/router-stream-tag-filters`; shared checkout untouched); **no `/cycle-local` Docker deploy** (the local stack bind-mounts the shared checkout — OPEN.md #27); the binding pre-staging gates are the story suite + full-suite **differential baseline vs `58314b7c`** + CI `stack-free`, then `/cycle-staging` smoke.

## Close

Sole story Done (PASS first review; one ratified ADR amendment; blinded judges APPROVE at Gates 1/2/3/5). Shipped 2026-07-16 to **staging** (PR #361, deploy green, five-tier smoke clean), **prod** (PR #362, operator-ratified same day, smoke clean), and **feat/tags** (PR #363, auto-deploy verified on tags.brainstorm.world). Every acceptance-frame bullet satisfied — bullet 2's physical restart leg verified by executed state/emit tests + five live post-ship router restarts (streams byte-intact on all three instances); the operator-entered live round-trip remains an offered option (audit §4 dev 5). Operator ratified the close 2026-07-16. Artifacts: [`audit.md`](./audit.md) + [`prd-seed.md`](./prd-seed.md) (retro dispositions in audit §7; carry-forward in audit §6 / seed §6–7). Full gate-by-gate record: [`journal.md`](./journal.md). Confidence: **high**.

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** high

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/router-stream-tag-filters/audit.md`
- Product feedback: `engineering-team/audits/router-stream-tag-filters/prd-seed.md`
