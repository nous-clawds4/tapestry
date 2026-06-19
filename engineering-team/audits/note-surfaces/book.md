# Book of Work: Note surfaces (a user's own kind-1 notes on the profile + a /notes page)

**Slug:** note-surfaces
**Status:** Closed
**Opened:** 2026-06-18
**Closed:** 2026-06-19

## Intent anchor
**Acceptance frame (no PRD)** — the operator's ask, restated and confirmed at kickoff. Completion is *judged* against the bullets below.

Source request: the operator's confirmed scope in the planning session of 2026-06-18, promoted from two `_intake.md` entries dated 2026-06-18 ("profile latest note on `/user/:pubkey`" + "per-user notes page, 50 recent kind-1"). The ask: surface a **viewed user's own** kind-1 notes in two new places, built atop the `live-feed` epic's shared note seam (`NoteCard` + `enrichNotes`). Unlike the feed — which shows notes from the accounts a *source identity follows* — there is **no follow list and no point-of-view** here: the selection is simply "kind-1 authored **by** the pubkey being viewed." This book builds both surfaces plus the one shared read path they consume.

### Acceptance frame
- [ ] A **"Content"** section appears at the **bottom** of the user profile page (`/user/:pubkey`), showing that viewed user's **single most-recent kind-1 note** as the existing shared note card. When the user has no locatable note, the section shows an explicit empty state — *"no kind-1 events could be located"* (canonical wording operator-delegated; punctuation non-binding) — and renders **no** card.
- [ ] The Content section includes a **link to `/user/:pubkey/notes`** for that user, present in both the populated and empty states.
- [ ] A new **`/user/:pubkey/notes` page** (a sibling of `/user/:pubkey/follows`) shows that user's **50 most-recent** kind-1 notes, **newest-first**, each with the author's display name, avatar, timestamp, and text; it identifies **whose** notes are shown (the viewed user); and it shows the same empty state when there are none. At a **1280px-wide viewport** it produces **no horizontal overflow**.
- [ ] Both surfaces **reuse the shared note module** — `NoteCard` for per-note presentation and `enrichNotes` for author/mention display — rendering, not re-deriving. The item shape is **identical to the feed's** so `NoteCard` renders it unchanged.
- [ ] **kind-1 only.** Reposts (kind-6) and reactions (kind-7) are excluded; notes by anyone other than the viewed user are excluded. The "Content" label (not "Notes") is deliberate — the section may host other content kinds later, but only kind-1 is in scope now.
- [ ] The change is **additive and read-only**: it adds one read path, one client route/page, one profile section, one shared hook, and a small CSS block. It performs **no writes/publishes** and does not change the existing `/feed`, search, profile pages' other sections, ranking/scoring, or firmware. Remove the additions and the rest of the app behaves exactly as before. **No firmware change** — it defines no concepts.
- [ ] Live on `staging.brainstorm.world` with the staging smoke passing. **Tier-4 (rendered UI) evidence** for final verification: the profile **Content** section rendered, and an anonymous `/user/:pubkey/notes` page rendering the 50-note list, with zero console errors.

### Operator decisions (resolved at Planning)
- The full-list route is **`/user/:pubkey/notes`** (not `/feed`).
- Run the **full per-story harness** (Planning → Architecture → Test → Implementation → Review), not docs-mode or a fast-track.
- Section label **"Content"**, single-note count for the section, the 50 cap for the page, and the empty-state intent were all operator-resolved.

## Epics in this book
- `note-surfaces` — the two read-only surfaces (`engineering-team/epics/note-surfaces.md`) plus the one shared by-author read path that feeds them. Built atop the `live-feed` epic's `NoteCard` + `enrichNotes` seam.

## Provenance
- **Mode:** Acceptance-frame (no PRD)
- **Confidence at close:** **high** — all acceptance-frame bullets met and verified on staging (PR [#319](https://github.com/nous-clawds4/tapestry/pull/319), merge `da269ba8`, deploy run `27796973223`); Tier-4 rendered the profile **Content** section + the 50-note `/user/:pubkey/notes` page with zero console errors. Built end-to-end through the full per-story harness: 3 stories (all Done), 2 ADRs (`0001` read path + `0002` surfaces), 1 review (PASS) after one adversarially-found edge bug was fixed (`80443ba5`). Strictly additive; no firmware change.

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/note-surfaces/audit.md`
- Product feedback: `engineering-team/audits/note-surfaces/prd-seed.md`
