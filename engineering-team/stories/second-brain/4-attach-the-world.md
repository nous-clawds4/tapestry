# Story 4: Attach the world — pointers and the goal's page

**Status:** Approved
**Created:** 2026-07-23
**Type:** Feature
**Epic:** `second-brain` (#4) · PRD §5.3, §5.8, §6

## Background
A goal is only as useful as the material it depends on — the file, the vault note, the nostr thread, the repo, the article. Today those live scattered across the owner's tools and the goal has no memory of them. **The brain organizes knowledge; it never contains it** (PRD §5.3): a goal should *point at* its resources, each opening in its native home, and show at a glance whether each pointer is still fresh. And the owner should never have to assemble a goal's story across surfaces — intent, its pointers, and its record belong **on one spine** (design guide principle 3). This story adds External Resource pointers and grows the existing minimal Goal detail (shipped in story 3, `/tapestry/goals/:slug`) into that one-spine page.

Affected: the Delegating Owner (keeps a goal's working set attached and current) and the Fresh-Context Session (lands on a goal and finds its resources without hunting).

## User-facing description
As the owner, I want to attach the resources a goal depends on — with a kind, a locator, and a title — and see them on the goal's page with an at-a-glance freshness line, so that every goal carries its own working set and I can open any resource in its native home without the brain ever swallowing the content.

## Acceptance criteria
Testable from the outside (input → observable behavior). Canonical owner-facing strings are **verbatim** from the style/design guides. Per the planning gate (2026-07-23): attaching and verifying are **conversation / owner-gated writes** (the story-1 capture and story-3 decomposition pattern) — local-only, validated, gated; the Goal detail is the **display** surface, with **no new "add pointer" or "verify" UI form** in this story.

- [ ] **AC1 — Attach a resource.** Given a goal, when the owner attaches a resource with a **kind** (one of: `file`, `vault note`, `nostr event`, `repository`, `web address`), a **locator**, and a **title** (with **why-kept** and **keywords** optional), then the resource is recorded against that goal and appears on its Goal detail. Missing kind, locator, or title is refused; only the locator + metadata are stored — no external content is copied into the brain. The write is gated (owner / loopback) and local-only (no outbound sync), like the story-1/3 write primitives.
- [ ] **AC2 — Pointer card renders per the design guide.** Given a goal with a resource, when the Goal detail renders, then each pointer shows: the **kind marker** (`file` / `vault` / `event` / `repo` / `web`, uppercase-muted typography, no icons), the **title** as an accent link, a **locator preview** (truncated middle), and a **freshness line** worded exactly per the style guide — `verified N days ago` (current, muted), `not verified in N days` (stale, `--orange`), `unreachable at last check` (`--red`); an optional **why-kept** as one italic line. Freshness is carried by the word, color only reinforcing.
- [ ] **AC3 — Open native, never embed.** Given a pointer card, when the owner activates its title, then the resource opens in its native home (new tab / OS handler); nothing is embedded, previewed, or copied into the brain.
- [ ] **AC4 — Freshness is derived; verifying updates it.** Given a resource with a last-verified date, when the Goal detail renders, then its freshness standing (`current` / `stale` / `unreachable`) is **derived at read time** (a pure function of verification age + last outcome, never stored as a flag) — parallel to how goal standing is derived. When the owner verifies a resource, then its last-verified date is updated (and its standing may be recorded `unreachable`), and freshness re-derives accordingly. **Verify is an asserted re-check** — the owner or a session on the owner's behalf attests to the resource's state; the system never fetches, crawls, or pings the resource (no outbound network egress; PRD §7.4).
- [ ] **AC5 — One-spine Goal detail.** Given a goal, when the owner opens its detail, then the page presents, top-to-bottom on one spine (wireframe §2): **intent** (name, standing, capture/parent metadata, `Done means:` / `Stays inside:` — the story-3 block, unchanged), then the **pointers** section, then the goal's **record entries** section. A goal with no pointers shows the empty state verbatim: `Nothing attached yet — resources this goal needs will appear here.`
- [ ] **AC6 — Record entries render append-only.** Given a goal's record section, when it renders, then each entry is a dated, chronological fact (type word one of `proposed / approved / skipped / worked / noted`) with a one-sentence summary and **no edit or delete affordance on any entry, ever** (PRD §7.2; design guide "the ledger is the ledger"). Story 4 delivers the record-section **rendering + append-only contract** (validated against fixtures and the empty state); the **producers** of live entries are stories 5–7 (work records, proposals, priority signals), so in live use the section is empty until story 5 — that is expected, not a gap.
- [ ] **AC7 — Copy discipline & no regression.** Every owner-facing string added here (kind markers, freshness lines, empty state, any record-entry chrome) passes the banned-jargon scan (*element, kind, schema, event, pubkey, superset, concept header, persona, acceptance criteria, lease, payload, endpoint*) and comes verbatim from the guides; the story-3 Goal detail intent block and the story-1/3 Goals tree continue to pass their suites, amended only where this story legitimately extends them (plan sibling re-pins at Test Design, per the story-2/3 lesson).

## Concepts touched
- `39998:<TA>:tapestry-owner-goal` — **Goal** (existing; `<TA>` resolved at runtime, never hardcoded). A goal gains attached resources; its detail page becomes the one spine.
- **External Resource** — **new concept**, runtime-created on the graph's established pointer-element pattern (PRD §6): title, locator-kind, locator, why-kept, keywords, noted-on, last-verified. *(Confirmed absent from the live graph — 0 hits for resource/pointer/external via `/api/concept-graph/summaries`. The Architect resolves the handle + bootstrap sequence; note the story-3 fold means `save-schema` now auto-reconciles the primary property in the same call.)*
- Relationship **Goal → points at → External Resource** — **record-based**, following the story-3 decomposition precedent (durable intent lives in the goal/resource record, rendered from records, not an edge walk). This story does **not** extend the relationship-primitive whitelist; `HAS_SUBGOAL`-style materialized edges arrive only via the relationship-primitives book's documented cardinality-safe path.

## Out of scope
- **Record producers** — proposals (story 6), work records / session read loop (story 5), priority signals (story 7). Story 4 *renders* the record section; it does not create proposal/work/signal entries.
- **Active reachability checking** — no crawling, fetching, or pinging of resources. `unreachable` is an asserted verification outcome, not a live probe result.
- **New relationship-whitelist edges** — no `HAS_RESOURCE`/edge-materialization; the goal↔resource linkage is record-based (see Concepts).
- **Category filter** and goal **rename / abandon** — already-deferred epic coverage gaps (epic §"Known coverage gaps"); untouched here.
- **Proposal queue** (the third v1 view) — story 6.
- **Editing or detaching** an attached resource's metadata beyond the append-only verify update — corrections are new facts (PRD §7.2); a full edit/detach flow, if wanted later, is a separate scoped decision.

## Open questions
Resolved at the planning gate (2026-07-23): (Q1) record-entries rendering ships in story 4, live-empty until story 5; (Q2) attach & verify are conversation/owner-gated writes with the detail page as display-only, no new UI form; (Q3) verify = asserted re-check, no network egress.

Remaining, deferred to the Architect / design (a value, not an intent decision):
1. **Staleness threshold** — the day-count that flips a resource `current` → `stale` (and whether it is fixed, per-kind, or configurable). Left unpinned here rather than inventing a number; the freshness wording (`verified N days ago` / `not verified in N days`) is fixed regardless.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
