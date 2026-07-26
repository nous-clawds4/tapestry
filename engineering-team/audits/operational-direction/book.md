# Book of Work: Operational Direction

**Slug:** operational-direction
**Status:** Closed
**Opened:** 2026-07-26 — **retroactively.** See § Provenance: this manifest was written *after* the work shipped to production, so it did not function as an eager anchor.
**Closed:** 2026-07-26 — closed at book scope after the story reached production (promotion PR #470, `911b8855`). Close artifacts: [`audit.md`](./audit.md) (confidence: **high on intent, medium on completion**) · [`prd-seed.md`](./prd-seed.md). Retro dispositions in audit §7; six `meta` rows filed (OPEN.md #105–110). **Gate at close was RED on two pre-existing `OPEN.md` #102 failures unrelated to this book** — audit §5.1.

## Intent anchor

**Acceptance frame (no PRD)** — and unusually for a retroactively-opened book, the anchor was **not reconstructed**. It is transcribed verbatim from an owner-authored goal that predates every commit in this book:

- **Goal:** `hand-work-to-the-engineering-team-without-arming-a-book`
- **UUID:** `39999:<TA>:hand-work-to-the-engineering-team-without-arming-a-book-1903378a` (`<TA>` resolved at runtime — never hardcoded)
- **Origin:** `owner`
- **Estimate at capture:** `chanceOfSuccess: 50`

The goal carries a ~4,000-word owner-written `prompt` plus a `deliverable` and a `boundary`. The frame below is derived from those two fields **by the exact mapping this book's own deliverable ratified** — `deliverable → success criteria`, `boundary → ceiling`, `statement → the ask` (ADR `operational-direction/0001` d6). This book is therefore the first whose terms are goal-derived rather than hand-authored, which is what it was built to make possible.

**Verified at close, not assumed.** The goal's `deliverable` and `boundary` are **byte-identical** to the text read at session start, before any commit — `termsMatch` returns `{match: true, changed: []}`.

> **A finding the anchor produced by accident.** The goal's `created_at` is **2026-07-26T02:59:03Z**, which is **23 minutes after** this book's first commit (`bc804339`, 2026-07-26T02:36:05Z). The element was re-signed mid-book with **no change to `deliverable` or `boundary`**. That is precisely the benign-re-sign case the owner's d9.2 condition anticipated: a timestamp-only staleness check (ADR 0002 d12, `isAnchorStale`) would have flagged this very goal as stale, while the verbatim-text comparison the owner required (`termsMatch`) correctly clears it. Real-world evidence for the design decision, discovered by reading the anchor rather than trusting it.

### Acceptance frame

Derived from the goal's `deliverable` and `boundary` **verbatim** — written from the owner's words, deliberately **not** from the shipped diff, so the close can compare the two honestly.

**From the deliverable** — *"A goal that says what done produces, what it stays inside, and who should do it can be handed to the engineering team without anyone hand-writing a pre-registration — with the staging ceiling, the stopping rules, the blinded judges, and the owner ratifying completion all still in force."*

- [ ] A goal stating what done produces, what it stays inside, and who should do it can be handed to the engineering team **without anyone hand-writing a pre-registration**.
- [ ] **The staging ceiling** remains in force for such a run.
- [ ] **All six stopping rules** remain in force.
- [ ] **Blinded gate judges**, with journaled verdicts, remain in force.
- [ ] **The owner alone ratifies completion.**

**From the boundary** — *"The existing armed Direction mode stays exactly as it is, for when the harness itself is being tested. Nothing changes about the five engineering phases. Staging remains the ceiling, and nothing here lets an agent ratify its own completion."*

- [ ] The existing **armed Direction mode is unchanged** — no rule removed, weakened, or made conditional.
- [ ] **Nothing changes about the five engineering phases.**
- [ ] **Nothing lets an agent ratify its own completion.**

**Knowingly surrendered, per the owner's brief** — stated in the artifacts rather than quietly dropped:

- [ ] The **baseline commit** and the **pinned governing versions** are deliberately not captured in operational mode, and the artifacts say so and say why (reproducibility traded for operational cost; retained in armed mode).

## Epics in this book

- `operational-direction` — the second Direction on-ramp: goal-derived run terms, the eligibility read, and the governing-doc changes.

## Provenance

- **Mode:** Acceptance-frame *(anchor transcribed from a pre-existing owner goal — **not** reconstructed from `_intake.md` + git)*
- **Confidence at close:** **high on intent fidelity · medium on completion** — deliberately two judgments, not one average. The anchor is verbatim and predates the work; the capability is enabled but has never been exercised (audit §0, §4 D5).

### What this book's retroactive opening does and does not give us — stated plainly

**What holds.** The intent anchor is genuine, owner-authored, timestamped, and predates every commit. Its text is verifiably unchanged. So completion can be judged against something that was **not** reverse-engineered from what shipped — which is the failure mode a retroactive book usually invites, and the reason `workflows/6-book-close.md` step 1 assigns reconstructed books `confidence = low`. That penalty is not warranted here, and the reason is recorded above rather than assumed away.

**What does not hold, and cannot be fixed after the fact.** An eager anchor exists to **gate the work while it happens** — to be the thing a mid-flight session is measured against, and the thing that makes "is this book complete?" answerable across sessions. This manifest did none of that. It was written after production deploy. The three review rounds, the two CHANGES_REQUESTED verdicts, and the story's own Done flip all happened **without** this file existing. Its value is as an audit anchor, not as a control that was ever exercised.

**One consequence worth naming.** Under the very rules this book shipped, this goal would **not** be eligible for an operational Direction run: it carries no `approved` proposal fact, so `GET /api/brain/direction/hand-work-to-the-engineering-team-without-arming-a-book` returns `no-anchor-in-range` — verified live on local, staging, and production. The book can be *written* with goal-derived terms; it could not have been *run* under the mode it created. Closing that loop requires an owner `make-proposal` + `approve-proposal` pair on this goal, which is a separate act and is not performed here.

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/operational-direction/audit.md`
- Product feedback: `engineering-team/audits/operational-direction/prd-seed.md`
