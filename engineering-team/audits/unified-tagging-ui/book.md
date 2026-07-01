# Book: Unified Tagging UI + Write pass

**Status:** Open
**Opened:** 2026-06-30
**Intent anchor (acceptance frame):** Turn the unified tag *universe* (built server-side in Stories 9–11) into a coherent app experience, and add the one missing write capability (note-pins) — so the tag surfaces stop meaning "profiles only," shipped as ONE non-confusing step (operator: don't ship a partially-unified UI). Done = `/tags`, the tag-detail page, and profiles' "Tagging Activity" all reflect notes + profiles; pinning works for note-tags too; then the deploy chain (explicit go).

## Foundation already shipped (server/core, reviewed, all local/unpushed)
- Story 9 — unified tag index (`/api/tags/index`), PASS.
- Story 10 — search, subsumed by 9.
- Story 11 — `/api/event-tags/notes-by-author`, PASS.
- Pure core: `normalizeTaggings` + `taggingMembers` registry + `indexByTag` + `taggingsByAsserter`.

## Decomposition (build order — lowest-risk / highest-value first; ship at the end)
1. ✅ **Story 13 — Unified `/tags` directory (UI + endpoint controls).** DONE + PASS (impl a1db7918). `/tags` → `/api/tags/index`; sorts/pins/filters preserved; note tags shown.
2. ⚠️ **Story 14 — Profile "Tagging Activity" spans notes (REWORK).** First impl shipped a *separate* "NOTES TAGGED" section — **superseded** (operator 2026-07-01): fold the note-taggings **into** the existing collapsed "Tagging Activity" toggle, **intermixed** with profile-taggings. See story 14.
3. **Story 15 — Notes tab View Options at full parity with Profiles.** The tag-detail Notes tab must use the **same** View-options control as Profiles (same component/position/look), curated-default vs expanded, text filter, and **full sort parity** (recent/applied/disputed/most-backed/divisive). *(Not the lighter custom control Story 8 shipped.)*
4. **Story 16 — "+ Tag a Note" modal.** A "+ Tag a Note" button on the Notes tab (mirror "+ Tag someone") → a modal with an **Event-ID search** (reuse `useEventResolve`/`/event` resolver) that resolves the note in-modal with **Apply/Dispute** (via `useEventTagging`). Reference `TagSomeoneModal` UX.
5. **Story 12 — Generalized (target-typed) pinning.** The note-pin affordance + a kind-30003 bookmark-set materializer (note analog of the kind-30392 TL / kind-30000 export), reusing `for-tag` + the registry projection. Biggest; write + UI. Starts at Architecture with 2–3 operator decisions (generalize-vs-parallel; kind-30003; default note curation).
6. **Ship** — local → staging → (explicit go) prod.

> **UI-pass refinements (operator, 2026-07-01):** stories 14 (rework → intermix), 15 (Notes-tab control parity, full sort parity — a tagging is `(tag,target,polarity,asserter)` regardless of type, so every Profiles sort has a note meaning), 16 (+ Tag a Note / Event-ID modal). Do these **before** Story 12. All manual-verified UI. Live per-type endpoints stay untouched (Phase 1).

## Return edge
On close, write `audit.md` (as-built) + `prd-addendum.md` (deltas). The unified-taggings design/ADR (0009) + this book are the record.
