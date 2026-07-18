# Story 3: Raw tagging-events inspector for a note's tag chips

**Epic:** tag-event-inspector
**Status:** Approved
**Created:** 2026-07-17
**Type:** Feature

## Background

Story 1 made a tag's **definition** event inspectable (the `⋯` menu on the tag page header). Story 2 made the assertions behind a **profile row's** `+N −M` inspectable (the row's `⋯` menu). This story is the third instance of the pattern the epic exists for, on the third tag surface: the **tag chips under a note**.

Everywhere a note renders — the live feed, the `/event` page, a tag page's Notes tab, a profile's notes — its chips row shows which tags the active POV says the note carries. Hovering a chip opens a popover with the tag's name and description, who applied it, who disputed it, and Apply/Dispute actions. The popover asserts "Applied by 2, Disputed by 1" — and, like the profile rows before Story 2, never shows the signed events those numbers came from. Same three readers as ever, same gap: operators debugging federation (the `cool-web-of-trust` taggings on `tags.brainstorm.world` — two kind-1 notes tagged — are exactly the events an operator would want to eyeball), developers learning the wire format, and readers deciding whether a tagging deserves trust.

Story 2's central fact carries over unchanged: **a chip is not backed by one event.** A nostr event tagging is publishable by anyone; the popover's counts aggregate N applying + M disputing events from N+M distinct authors, and a chip can exist with zero applications (disputes only), or purely from the viewer's own not-yet-POV-counted stance. The original ask said "Show Raw Tagging Event" (singular); the label was deliberately pluralized at planning (operator decision) because the panel's contract is every event behind the numbers.

**Who is affected:** anyone reading a note anywhere in the product, signed in or out.

## User-facing description

As **someone reading a note**, I want to open the raw signed events behind a tag chip on that note, so that I can see who actually asserted what about the note and verify the chip's counts myself instead of trusting the rendering.

## Acceptance criteria

- [ ] **AC-1 (the button, in the popover):** Given a note's tag-chip popover, it contains a button labelled **"Show Raw Tagging Events"** when that chip's panel is hidden and **"Hide Raw Tagging Events"** when shown, alongside the existing Apply/Dispute actions. It is present and **enabled whether or not the viewer is signed in** (Apply/Dispute stay disabled signed-out; inspection has no login gate). Whenever the popover is open, the label reflects the panel's actual current state.

- [ ] **AC-2 (placement, per-chip toggle, stacking):** Given a freshly loaded surface, every panel is hidden and no layout shifts. Selecting "Show Raw Tagging Events" reveals the panel **inside that note's card, below the note's content and above the chips row**, captioned with the tag's name so it stays attributable when panels stack. The toggle is per (note, tag): each chip controls only its own panel; multiple chips' panels on one note may be open at once (stacked in the chips' display order); opening a panel on one note never affects another note. The popover's own open/close behavior (hover, focus, Escape, cursor-leave) is unchanged — clicking the button does not close it.

- [ ] **AC-3 (every event behind the counts, faithfully):** Given a panel for a chip whose popover reads Applied by N / Disputed by M, it renders **exactly the set of assertions those numbers are derived from** — the active POV's WoT-filtered, non-neutral assertions, unioned with the viewer's own assertion when present (the same union rule the chips row itself uses). An ordinary chip therefore yields N+M blocks, applications before disputes, in a stable deterministic order. A chip that exists **only** via the viewer's own stance yields exactly that one event. Each block is captioned with its polarity (applied / disputed) and its **author pubkey**; a viewer-own-but-uncounted block carries the "not counted under this POV" marker. Each block renders the **complete signed event as published** — `id`, `pubkey`, `created_at`, `kind`, `tags`, `content`, `sig` — as formatted, readable JSON, byte-faithful, no field omitted, truncated, or summarized. A reader must be able to count the blocks and get back the popover's numbers.

- [ ] **AC-4 (honest degradation):** Given the events for a chip cannot be produced — none available, or the request fails — selecting the button shows a visible message and opens no panel that could be misread as "nobody asserted this". Given the events are still being retrieved, the viewer gets a visible indication rather than silence or a frozen label. Apply, Dispute, and the rest of the popover keep working throughout; a failure on one chip never affects another chip or note.

- [ ] **AC-5 (uniform across note surfaces):** The affordance behaves identically on every surface that renders a note's tag chips — the feed, the `/event` page, a tag page's Notes tab, and a profile's notes. Verified on at least the tag page's Notes tab plus one other surface.

- [ ] **AC-6 (non-regression and invariants):** Chip navigation, hover-popover behavior, Apply/Dispute (including busy/error handling), the viewer's-own-stance highlight, the Story-15 score trio, and the add-tag (+) flow behave exactly as before, signed in and out. The Story-1 header menu and Story-2 profile-row menu are behavior-unchanged. **Profile pages' own tag chips gain no raw-event affordance** in this story. **No TA pubkey literal is introduced.** **POV correctness:** each event's bytes are POV-invariant — never filtered, annotated, or altered per POV; which events appear is per-POV by construction and is computed at read time from the active POV — never precomputed, denormalized, or stored per POV.

## Product decisions (settled at Planning)

1. **All note surfaces, not just the tag page** (operator). The chips row is one shared affordance; a per-surface split would make the same popover honest on one page and opaque on the next.
2. **Label: "Show/Hide Raw Tagging Events"** (operator) — pluralized from the original ask; "Tagging" disambiguates from the note's own raw JSON and from the tag's definition event (Story 1's subject).
3. **The popover does not close on select.** Story 2's close-on-select was that menu's own convention (a bottom sheet covering its target). This is a hover popover with no such convention: it closes on cursor-leave or Escape, and the button doesn't change that. Emulate the control being extended (epic guardrail, as amended).
4. **Per-chip panels; several may be open at once** (mirrors Story 2 decision 4).
5. **Neutral assertions are excluded** (mirrors Story 2 decision 5) — the panel's contract is "the events behind these numbers", and neutral assertions are in neither number.
6. **Caption carries the author pubkey, not a display name** (Story 2 open question (a), resolved there: pubkey is the bar; a name is a claim the event doesn't make).
7. **Inspection is not login-gated** (consistent with Stories 1–2).

## Concepts touched

- `39998:<this instance's TA>:nostr-event-tag` — **nostr event tagging**: *"an event that applies a specific Tag to a specific event (referenced by the e or a tag)… Publishing is permissionless; whether a tagging counts is computed per point-of-view at read time."* The concept whose elements this panel displays.
- `39998:<this instance's TA>:nostr-event` — **nostr event**: what each block renders; its seven-field definition is the normative field list.
- `39998:<this instance's TA>:tag` — **tag**: the tag whose taggings these are; its definition event is Story 1's subject, not this story's.

Handle pubkeys are per-deployment — resolve at runtime, never hardcode (CLAUDE.md § "Per-deployment TA pubkey").

## Scope notes

- **One capability, not split** — the read path must newly surface complete signed events, and the affordance shows them; either alone has no user-visible outcome (same reasoning as Story 2's scope note).
- **The intake `<RawEventPanel>` trigger fires with this story.** `_intake.md` (2026-07-16) defers extracting a shared raw-event block component "until the third inspection surface — Note rows are the likely next". This is that surface. Whether the shared component is extracted within this story or immediately after is the **Architect's decision** in the ADR; if extracted, Stories 1–2's suites are re-aimed at the shared component, not dropped (per the intake entry), and AC-6's "behavior-unchanged" is the bar the refactor must clear.
- **The other intake trigger (shared `<ActionsMenu>`) does *not* fire** — this story adds a button to an existing popover, not a third `⋯` dropdown. That count stays at two.

## Out of scope

- **Profile pages' own tag chips** (tags-on-a-profile) — the same latent need on a fourth surface, backed by the *profile*-tagging family. Deferred deliberately (operator decision at planning).
- **Copy ID / copy naddr per block** — same deferral as Story 2.
- **A close affordance on the panel itself** — the popover button is the toggle (re-hover the chip to hide); cheaper here than in Story 2 since summoning a popover is a hover, not a menu.
- **Showing assertions outside the POV's WoT** beyond the viewer's own — breaks AC-3's count-the-blocks contract.
- **Pagination, collapsing, or capping large panels.**
- **Syntax highlighting, JSON trees, copy-the-blob buttons.**
- **Client-side signature verification.**
- **Escape-to-close or other `⋯` convention changes**, and the "Note vs Event" vocabulary question — both still open, both cross-cutting.

## Open questions

- **(a) Payload strategy is genuinely open, and Story 2's answer does not transfer — in either direction.** Story 2 measured and chose "ship the assertions with the counts" because its endpoint served one page. The read path behind the chips fires **once per note card on every note surface** — a feed multiplies it. The lazy-on-open shape Story 2 rejected may well win here, and AC-4's loading/failure states exist to make that shape honest. **Recommendation: the Architect re-derives from scratch, measuring, exactly as ADR 0002 did.**
- **(b) Book: new, or an existing open one?** — **SETTLED at the Planning gate: a new book, `audits/note-tagging-inspector/`, under the still-Active epic.** Mirrors Story 2's settled reasoning: a new bounded ask gets a new frame; the `profile-tagging-inspector` book's frame was met and closed; the open `unified-tagging-ui` book's frame ("tag surfaces stop meaning profiles-only, plus note-pins") doesn't cover inspection affordances. An epic may span books.

## Linked artifacts

- ADR: `engineering-team/decisions/tag-event-inspector/0003-note-tagging-raw-events-inspector.md`
- Test plan: `engineering-team/stories/tag-event-inspector/3-note-tagging-raw-events-inspector.test-plan.md`
- Review: (Review phase)
- Book: `engineering-team/audits/note-tagging-inspector/book.md`
