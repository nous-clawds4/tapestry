# Book of Work: Event page (single kind-1 view)

**Slug:** event-page
**Status:** Closed
**Opened:** 2026-06-18
**Closed:** 2026-06-19

## Intent anchor
**Acceptance frame (no PRD)** — the operator's ask, restated and confirmed at kickoff. Completion is *judged* against the bullets below.

Source request: the operator's request in the planning session of 2026-06-18 (no prior `_intake.md` entry; opened immediately after the `note-surfaces` epic shipped to staging). The raw ask: flesh out the placeholder `/event` page into a working single-event view, **kind-1 only**. This book builds the `/event` view and the backend read path it consumes. It builds on the shared note seam (`NoteCard` + `enrichNotes`) and the relay-set resolution pattern established by `live-feed` / `note-surfaces`.

### Acceptance frame
- [ ] The placeholder `/event` page becomes a working **single-event view, kind-1 only**, reachable with **no login** (anonymous `GET /event` → 200, never a login wall), strictly additive (with the new view removed the app is unchanged), and producing **no horizontal overflow** at a 1280px-wide viewport.
- [ ] Six URL parameters are supported — **`nevent`, `id`, `naddr`, `pubkey`, `npub`, `nprofile`** — with precedence in **that order**. Given more than one valid parameter, the page resolves using the **first valid** by that order. A **supported** parameter whose value is **malformed** is reported on-page as **invalid** (identifying which parameter); parameter **names outside the six** are **silently ignored**.
- [ ] When **no valid parameter** is present, the page shows a **search field** prompting for one of the six formats. Pasting one of the six → resolves exactly as the equivalent URL parameter; a string matching **none** of the six → a **"not a recognized format"** notice (the field remains for a retry).
- [ ] **`nevent`/`id`** → fetch the event: a non-kind-1 → **"kind ‹N› not yet supported"**; an event that fails verification → **"does not validate"** (a distinct outcome); a valid kind-1 → **rendered like `/feed`** (the shared note card).
- [ ] **`pubkey`/`npub`/`nprofile`** → that author's **most-recent kind-1** (rendered like the feed), or **"no kind-1 note found"**.
- [ ] **`naddr`** → **"kind ‹N› not yet supported"** taken from the coordinate — **no fetch** (addressable events are always kind 30000–39999, never kind-1).
- [ ] Every fetch consults a **relay union**: embedded relay hints (`nevent`/`nprofile`) **+** the author's NIP-65 (kind-10002) **outbox** write relays when resolvable **+** the instance's **well-known** general-purpose relay set (resolved by slug relative to this instance's own Tapestry Assistant — never a hardcoded identifier), else the fixed fallback `relay.primal.net`, `nos.lol`, `relay.damus.io`.
- [ ] The change is **additive and read-only**: it reworks one placeholder page and adds its supporting endpoint; it performs **no writes/publishes** and does not change the feed, profiles, search, ranking, or **firmware**.
- [ ] Live on `staging.brainstorm.world/event` with the staging smoke test passing, including **Tier-4 rendered** evidence: a reference `nevent` → a kind-1 NoteCard, a bare `/event` → the search field, an `naddr` → "kind ‹N› not yet supported", and an author lookup → that author's most-recent note.

**Operator decisions at kickoff** (the frame's two delegated calls): the six-parameter **precedence order** (`nevent` › `id` › `naddr` › `pubkey` › `npub` › `nprofile`); and — at the review gate — to **deliver the distinct "does not validate" outcome** rather than document its fold-into-"not found". All other implementation choices (endpoint shape, the client/server decode split, the relay-sourcing extraction, component structure, CSS reuse) are the Architect's/Implementer's, not the operator's.

## Epics in this book
- `event-page` — the public `/event` view plus the read-only `GET /api/event` read path that resolves a kind-1 by id or by author across the relay union, verifies, kind-gates, and enriches into the shared note shape. Epic: `engineering-team/epics/event-page.md`.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** **high** — all 9 acceptance-frame bullets met and verified on staging (PR [#320](https://github.com/nous-clawds4/tapestry/pull/320), merge `a4ae90bc`, deploy run `27801707588`). Built end-to-end through the per-story harness (Planning → Architecture → Test → Implementation → Review): 3 stories, 2 ADRs, 1 Reviewer CHANGES_REQUESTED → 2 real correctness findings fixed and re-verified (commit `f227fa22`) → PASS. Strictly additive; **no firmware change**.

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/event-page/audit.md`
- Product feedback: `engineering-team/audits/event-page/prd-seed.md`
