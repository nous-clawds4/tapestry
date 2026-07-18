# Book of Work: Inspect the nostr events behind a note's tagging

**Slug:** note-tagging-inspector
**Status:** Open
**Opened:** 2026-07-17 (eagerly at intake, per workflows/0-intake.md step 4)
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)** — the operator's 2026-07-17 ask, captured verbatim below in the same conversation and confirmed through a drafted-and-approved story. Anchor inputs: the raw ask; the live surface it names (`https://tags.brainstorm.world/tag/cool-web-of-trust/92aa94e7433e2e1e4277c44d493de4a03b0c7ab9f2fec76cac8f94d585cf8918`, plus a screenshot of its chip popover); the two sibling affordances it extends (`tag-event-inspector` book story #1 — the tag definition event; `profile-tagging-inspector` book story #2 — the events behind a profile row's `+N −M`); and the decisions the operator settled at Planning (recorded under "Decisions taken into the frame"). Story #3 of epic `tag-event-inspector` (`stories/tag-event-inspector/3-note-tagging-raw-events-inspector.md`, approved and committed pre-arming) is the frame's story-level elaboration.

**This is a new book; the `tag-event-inspector` and `profile-tagging-inspector` books stay closed.** Both frames were met and remain met. This book covers a capability neither mentions: the events behind a **note's** tagging — the third object type (`nostr-event-tag`, not `tag`, not `nostr-user-tag`), on a different affordance (the chip popover, not a `⋯` menu), across every note surface rather than one page. The epic `tag-event-inspector` is shared and Active — an epic may span books (this is its third).

**Raw ask (verbatim excerpts, 2026-07-17):**

> We just completed features […] that allow me to view two types of raw nostr events: the event that defines a Tag […]; and the event that applies a tag to a pubkey […]. What we have not yet done is to build the feature that allows me to visualize the raw nostr event that applies a tag to a content event, such as a kind 1 content event. […] An example of a tag that has been applied to Notes is the `Cool Web of Trust` tag […] (I have switched from staging.brainstorm.world to tags.brainstorm.world because the tags instance has not only the `Cool Web of Trust` tag, but also has the events which applied the Cool Web of Trust tag to 2 kind 1 events). I would like now to build that feature.
>
> […] currently, if I hover over the Cool Web of Trust panel below one of the tagged events, I see a panel with information about the Cool Web of Trust tag, with the identity of the user who applied it […], and buttons to Apply or Dispute it. I would like our new feature to include an additional button alongside the Apply or Dispute buttons to "Show Raw Tagging Event" (or "Hide Raw Tagging Event"). The panel with the raw event should be immediately below the tagged kind 1 event itself, but above the panel that shows the tag(s) applied to that kind 1 event.

### The ask's singular premise, corrected before the frame was written

The ask says *"the raw nostr event that applies a tag to a content event"* — singular, and its example popover reads "APPLIED BY 1". As with the profile book before it, **there is no single such event in general**: a nostr event tagging is publishable by anyone, so a chip's counts aggregate N applying + M disputing events from N+M distinct authors, and a chip can be backed by disputes alone, or purely by the viewer's own not-yet-counted stance. The operator was shown this at Planning and chose the all-events reading, pluralizing the button label. **The frame below is written against the corrected premise**, so the close reconciles against what was meant and confirmed, not against a sentence whose singular form was an artifact of a one-applier example.

### Decisions taken into the frame (operator, at Planning, 2026-07-17)

1. **Surfaces: all note surfaces** — the feed, the `/event` page, a tag page's Notes tab, a profile's notes. The chip popover is one shared affordance; a per-surface split would make the same popover honest on one page and opaque on the next. (Operator chose this over "tag page only" and over "every chip everywhere including profile pages".)
2. **Label: "Show Raw Tagging Events" / "Hide Raw Tagging Events"** — pluralized from the ask; "Tagging" disambiguates from the note's own raw JSON and from the tag's definition event.
3. **Placement as asked:** the panel sits inside the note's card, below the note's content and above the chips row; per (note, tag); several chips' panels may be open at once.
4. **Profile pages' own tag chips are out of scope** — the same latent need on a fourth surface, backed by the profile-tagging family; deferred deliberately.

### Acceptance frame

- [x] **1. The raw signed events behind a note's tag chip are viewable in-product.** From the chip's hover popover, a reader can open a panel and read each assertion as the signed event as published — `id`, `pubkey`, `created_at`, `kind`, `tags`, `content`, `sig` — as formatted JSON, byte-faithful, not a summary.
- [x] **2. The panel shows *every* event behind the chip's counts, not one.** The active POV's WoT-filtered non-neutral assertions unioned with the viewer's own when present; applications before disputes; each block identifiable by polarity and author pubkey without parsing JSON by eye; a viewer-own-but-uncounted block marked as not counted under the POV. A reader can count the blocks and get back the popover's numbers.
- [x] **3. Hidden by default; toggles from the popover; works signed out.** A "Show Raw Tagging Events" / "Hide Raw Tagging Events" button beside Apply/Dispute, label reflecting current state, enabled without login; the panel renders between the note's body and the chips row, captioned with the tag's name; the toggle is per (note, tag) and panels may stack.
- [x] **4. Uniform across note surfaces, with nothing regressed.** The affordance behaves identically wherever a note's chips render (feed, `/event`, tag-page Notes tab, profile notes). Chip/popover interactions, Apply/Dispute, the Story-1 and Story-2 inspectors, and profile pages' own tag chips (which gain no affordance) behave as before.
- [x] **5. Live on `staging.brainstorm.world` with the five-tier smoke passing**, Tier-4 evidence per the pre-registered evidence design below.

**Evidence design (pre-registered against measured data reality).** Measured at open (2026-07-17): staging surfaces **zero** event-type taggings — `for-tag` for `cool-web-of-trust` (tagAuthor `e5272de9…`) returns `total: 0` on staging vs `total: 2` on `tags.brainstorm.world`, and staging's unified tags index carries no event-type rows. The Director holds no signing keys (and staging mutations beyond the deploy are forbidden), so staging cannot be seeded by this run. Therefore:

- **Populated-panel proof (Tier 4) is journaled from the local stack:** seeded local taggings, a screenshot or DOM extract showing an open panel with ≥ 2 blocks including at least one dispute or one uncounted marker where seedable, exercised via the real UI.
- **Staging evidence:** deploy + five-tier smoke clean; the read path behind the panel answering well-formed for a probe target (honest emptiness — a valid empty response, not an error); existing tag surfaces unregressed.
- **Upgrade clause:** if at evidence time any event-type tagging *is* visible on staging, a read-only populated Tier-4 check on it replaces the honest-empty probe.

**Done looks like:** story #3 passes review and ships to `staging`; the operator can open a tagged note on an instance that has note-tagging data and read every signed assertion behind a chip. Promotion beyond `staging` — to `feat/tags` / `tags.brainstorm.world` (where the `cool-web-of-trust` data actually lives) or to production — is **the operator's call, not this run's**.

## Epics in this book

- `tag-event-inspector` — story #3 (`stories/tag-event-inspector/3-note-tagging-raw-events-inspector.md`). Epic Active; spans three books (`tag-event-inspector` closed, `profile-tagging-inspector` closed, this one). Its POV guardrail (bytes invariant / set per-POV) and "emulate the menu you are extending" amendment — both added at the #2 reopen — govern this story unchanged.

## Direction mode (delegated-gates run) — pre-registered

This book runs under the Director harness — [`/direct-feature`](../../../.claude/skills/direct-feature/SKILL.md) + [`engineering-team/roles/director.md`](../../roles/director.md): Claude answers the per-story phase gates under blinded gate-judge rubrics and supervises the deploy chain through staging. This section is the run's **pre-registration**. Once armed, nothing in it may be weakened mid-run; proposed changes go to the journal for the post-mortem.

**Purpose.** A **delivery run with delegated gates** — the operator's 2026-07-17 instruction: *"can you take over as Director and carry this feature through all the way to cycle-staging?"* Unlike the flagship autonomy experiment (`task-timeline`), operator interaction mid-run does not void this run: answering surfaced questions, ratifications, or even direct takeover are journaled honestly and the run continues or hands over gracefully. The integrity mechanics run at full strength regardless — blinded judges, binding KICK_BACKs, the staging ceiling, the append-only journal.

### Arming (operator only — the Director may not arm)

Adapted to the chat medium: **the operator ratifies this section explicitly in conversation**; the Director then records the arming by filling the lines below in a commit touching only this subsection, quoting the operator's ratification verbatim in the journal's arming entry. The decision is the operator's; the recording is clerical.

- **Armed:** Yes — 2026-07-17T23:14:36Z
- **Deadline:** 2026-07-20T23:14:36Z
- **Baseline:** `89c3964f589d50e24c2ad8635584531f2322205b` (`origin/staging` at arming)
- **Pinned governing versions:** `engineering-team/roles/director.md` @ `bdbc8cf6` · `.claude/skills/direct-feature/SKILL.md` @ `1d9f9b86` · `.claude/agents/gate-judge.md` @ `3a2657b2`

A missing or ambiguous Armed/Deadline line means the book is not armed; the Director must refuse to run.

### Pre-arming state (disclosed; part of what the operator ratifies)

This book opens with work already done **with the real operator at the gate** — the opposite of contamination:

- **Story #3 was planned, iterated, and approved by the operator in chat (2026-07-17)**, committed at `58ba13a4` with two product decisions answered by the operator through a structured question (surfaces; label). **Gate 1 is therefore already answered — by the principal the gate-judge merely proxies for.** The run begins at Phase 2 (Architecture). Any story created mid-run (fix-forward included) runs all five phases with a judged Gate 1.
- This `book.md` was authored and committed pre-arming, and the operator's ratification of it *is* the arming.

Both exist on the feature branch at arming by design; they void nothing.

### Baseline semantics (`npm test`)

The full local suite is known to show environmental failures on this machine regardless of code state (OPEN.md #27 family — Meili-enrichment and settings-mutation suites; the local graph is near-empty). Stage 0 records the exact full-suite result at the baseline commit — the same command Gate 4 reruns identically. The binding bar is **differential**: no new failures versus the recorded baseline, plus the stack-free CI gate (`test.yml`) green on the PR. A red baseline halts the run only if the failing set differs from the known environmental set.

### Autonomy ceiling — staging

Forbidden, no exceptions: `/cycle-prod`; `/cycle-full`; any PR based on `main` or push/merge to `main` (including reverts); push or merge to the sandbox long-lived branches (`feature-magic-carpet`, `feat/pubkey-tagging-target`, `feat/communities`, `feat/curate`) — **and `feat/tags`, added explicitly for this run:** it auto-deploys `tags.brainstorm.world`, the very instance holding this feature's live data, and promotion there is the operator's post-close call; any prod mutation, droplet SSH, deployed-droplet config edit, or BullBoard mutating action on a deployed droplet; triggering, as verification, any task whose `taskRegistry.json` entry carries `resourceClass: "neo4j-heavy"`, plus `reconcileAll`. **Any breach is an automatic run failure**, regardless of feature state.

**Staging mutations: none beyond the deploy itself.** The Director holds no signing keys and never handles credentials; seeding staging is out of reach by design (see the evidence design). The **local stack is unrestricted** within `/cycle-local` semantics: seeding local taggings via the product's own write paths or `nak` with disposable test keys is permitted and journaled.

### Reserved for the real operator (never the Director's)

Arming this run; ratifying completion (the "yes" to `/close-book`); instructing rollback after a failure; anything past staging (including `feat/tags` promotion); ratifying proposed goalpost amendments.

### Budgets / stopping rules

Full definitions: role file → "Stopping rules". The numbers: the deadline above; 3 consecutive kick-backs at the same gate of the same story (judge KICK_BACKs; at Gate 5, Reviewer CHANGES_REQUESTED counts); more than 2 ADR amendments on one story after its Gate-2 APPROVE; the book's total story count (fix-forward included) exceeding **5** — halt *before* approving the sixth; ceiling breach (auto-fail); external interference. Tripping any rule halts the run loudly.

### Open design decisions delegated to the Director

Story #3's product decisions are settled; its open question (a) — payload strategy — is **the Architect's**, decided in the ADR, not a Director question. Delegated to the Director (resolve as "simplest that satisfies the frame", journaled): presentation minutiae the frame doesn't pin — exact caption wording, loading/error message wording, stacking-order details, styling reuse. **This list is exhaustive** — any other question the frame doesn't decide in quotable terms is frame-changing and halts the run.

### Success

A completion report with bullet-by-bullet evidence per the evidence design — audited by a final gate-judge (skill, Stage 3) — is journaled and committed, and the completion offer is made, **before the deadline**; and the operator subsequently ratifies it. Ratification latency after a timely offer does not fail the run; operator rejection of the offer does.

### Failure and outcome classification

- Offer not made by the deadline → **failure**.
- Operator rejects the completion offer → **failure**.
- Ceiling breach → **failure**, immediate, regardless of feature state.
- Deadline passes during a halt caused by Stopping rules 2–4 → **failure**.
- Deadline passes during a Stopping-rule-6 halt (external interference) → **run void** — not informative.
- Armed but never started → **run void**.
- Operator interaction or takeover mid-run → **not a failure by itself** (delivery run, not an autonomy experiment); journaled; any gate the operator answers directly is recorded as operator-answered.
- Frame bullet 5 is scored at evidence time; staging breakage by external cause after the evidence is journaled does not retroactively fail it.

### Rollback (on failure)

Executed **only on the operator's explicit instruction** after reviewing the HALT/failure journal entry — the same instruction authorizes the failure-mode `/close-book`. Steps, executable by either party:

1. Identify the book's staging merge PR(s) from `journal.md` (cross-check: `gh pr list --repo nous-clawds4/tapestry --base staging --search note-tagging-inspector --state merged`).
2. Revert branch off `origin/staging`; `git revert -m 1 <merge-sha>` for each merge, newest first; normal revert PR to `staging` per `/cycle-staging` (plain merge; every `gh` command carries `--repo nous-clawds4/tapestry`; never force-push — staging is shared); watch `deploy-staging.yml`.
3. Verify: Tier 1–2 smoke on `staging.brainstorm.world` plus one named assertion that the chip popover no longer offers the raw-tagging-events button.
4. Keep all harness artifacts — stories, ADRs, reviews, journal.
5. Close the book via `/close-book` with the audit recording the failure honestly; the return edge works for failures too.

**Decision journal:** `engineering-team/audits/note-tagging-inspector/journal.md` — append-only, committed at every phase boundary.

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at open:** **high** — the ask is captured verbatim in-session (not reconstructed); the two scope decisions were put to the operator explicitly and answered; the frame's one deliberate departure from the ask's literal words (singular → all events) is documented above with the operator's confirmation. The data-reality constraint on staging evidence is measured, not assumed.
- **Confidence at close:** *(to be filled by `/close-book`)*

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/note-tagging-inspector/audit.md`
- Product feedback: `engineering-team/audits/note-tagging-inspector/prd-seed.md`
