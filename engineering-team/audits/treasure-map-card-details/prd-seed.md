# PRD Seed: Treasure Map — card attention and details

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/treasure-map-card-details/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high — a two-story book built against a confirmed frame and four recorded owner decisions.
**Date:** 2026-10-08

> This is a **reverse-engineered baseline** in the product-team PRD shape, built from what shipped. It is a *strawman for the product team*, not a ratified spec. Every section is tagged — `[FROM FRAME]` (grounded in the kickoff acceptance frame), `[INFERRED]` (read off the as-built system), or `[UNKNOWN — product input needed]`.

## 1. Product vision
`[FROM FRAME]` The Manage your Treasure Map page should tell a person, at a glance, which kinds of insight have
nobody looking after them, and let them see, without reading JSON, exactly which Assistants and relays stand behind
each category.
`[INFERRED]` It is a step toward the promised Advanced page, done per category. It answers "what does *Mixed* mean
here?" and "who are my backups?" where the question arises, instead of on a separate page.

## 2. Personas
`[INFERRED]` A signed-in Brainstorm user managing their own Treasure Map: someone who has set up one or more
Assistants and wants to check or change who publishes their Scores, Lists and Concepts. The pill is for the person who
didn't know a category was empty. The details panel is for the person who wants to know why a card says "Mixed" before
they edit it.

## 3. Scope (as-built)
- `[FROM FRAME]` A "Needs attention" pill on any card with no Assistant, in `/assistant`'s words and shape, in the
  page's light amber. It hides while a pick for that card is pending in Edit mode.
- `[FROM FRAME]` A "Show details" toggle on every card, opening a panel that lists each counted entry: key as written,
  Assistant (avatar and name), relay or "No relay", "Backup" for later Assistants on the same key, and the labels
  "Individually assigned" and "Everything else".
- `[FROM FRAME]` In Edit mode the panel follows the draft (owner's decision 4).
- `[INFERRED]` A panel lists only what its card counts. Ignored entries (`*:…`, a `*` covered by a family entry) and
  unknown kinds appear in no panel.
- `[INFERRED]` "No entries yet." when nothing counts, including when no Map was found.

## 4. Domain model
`[INFERRED]` No new entities. A **category** (Scores, Lists, Concepts) is covered by **entries** of the person's
kind-10040 Treasure Map. An entry is a **key** (e.g. `30382:rank`, `3038x:tag:X`, `39998`), grouped across spellings,
plus an ordered list of **Assistants**, each with a relay hint. The first Assistant is the Preferred one and the rest
are **backups**. An entry is the category's **own** (a whole kind, family or standard score) or an **individually
assigned duty** (one Tag, Pin, DList or Concept list). The **everything entry** `*` covers what nothing more specific
does.

## 5. Design rules (as-built)
- `[INFERRED]` An attention marker must be readable on its background (at least 4.5:1). The pill is; the page's older
  chips and faint lines are not yet (ledger `2026-10-09-treasure-map-muted-text-contrast`).
- `[INFERRED]` A card and its details never disagree: both come from one counting rule.
- `[INFERRED]` Disclosures are real buttons that say which card they belong to, and open a named region.
- `[UNKNOWN — product input needed]` Whether keys should also be shown in plain words (`30382:rank` → "Rank"). The
  owner chose "the key as written" for this version.

## 6. Carry-forward & open questions
From the build audit §6:
- Plain-language names for keys in the panel.
- The page's muted text and chips under 4.5:1.
- Open panels closing when a newer Map adds an unseen backup (rare).
- The full Advanced page: ignored entries, unknown kinds, finer control of backups (carried from the earlier Treasure
  Map books).
- Whether the draft grammar should name a bare `39999` (from the hotfix that rode with this book).

## 7. What product must validate
- [ ] Should the pill also count toward the Assistant alert in the top bar? It is out of scope today (story 1 AC-7).
- [ ] Should the pill be a control, e.g. opening Edit with that card's picker? Today it is a label.
- [ ] Plain-language key names in the panel, and whether to keep the raw key beside them.
- [ ] Should ignored entries show in the panels (greyed, "not used"), or only on the Advanced page?
