# Handoff — Dictionary page (Tapestry)

**Status:** 🔴 OPEN: version 2 (§ 3–4) is not started. Version 1 (§ 2) shipped in PR #763, and has been in production since 2026-09-27 (promotion #766). Its rows were corrected on 2026-09-29 by PR #782 (see the metadata below).

> **Repo metadata. Not part of the handoff text.**
> - **Source.** The Claude Design export `brainstorm_dictionary_design.zip` (`handoff-dictionary/SPEC.md`), 2026-09-27. Everything below the rule is verbatim.
> - **Design reference.** `Brainstorm mock (standalone).html`, from the same export, is not in the repo: it is a 900 KB bundled page. It opens offline; the page is under account menu → Dictionary. On the Mac Studio it sits in the git-excluded `_import/handoff-dictionary/`.
> - **Paths.** The handoff's `repo/protocols/drafts/` is this repo's [`protocols/drafts/`](../protocols/drafts/): [Pins](../protocols/drafts/pins.md) § 8.1 and [DList Header Declaration](../protocols/drafts/dlist-header-declaration.md) § 4. The § 1 code paths are live repo paths.
> - **Version 1 as built.** PR #763's description records what was built, stubbed and decided. The owner's decisions of 2026-09-27:
>   - a direct build, with no harness story or ADR;
>   - Add / Veto stubbed until Pins land (`override: null`, Veto disabled);
>   - the FAQ corrected to what v1 does.
>
>   The page is `ui/src/pages/dictionaries/Concepts.jsx` and `ConceptEntry.jsx`. The arithmetic stays in `src/lib/trustedDictionary.js`, where a GUM₂/GUM₃ TODO marks the § 4 work.
> - **Corrected 2026-09-29 (PR #782): the rows.** The owner: the page lists the reader's own dictionary, exactly what Active b-tags shows under "Mine", as the design's FAQ says ("Every row on this page is a DList header authored by your local Assistant, carrying a b-tag that recognizes at least one other DList header as a shared concept."). Version 1 had shipped the trusted dictionary instead, following § 1's "Version 1 data source" line below. That line is superseded:
>   - The rows come from `GET /api/dictionaries/concepts`, for the person the page resolves as Active b-tags does (the signed-in reader, else the owner).
>   - The trusted dictionary's GUM₁ now only scores each row, for the shared concept the row points to. In the design, a metric and its cutoff are the rule an Assistant will use to clone shared concepts into the dictionary; that automation is not built.
>   - The FAQ is back to the design's wording. Answers describing unbuilt behaviour are put in the future tense or marked "Coming in a later version". The 2026-09-27 decision "the FAQ corrected to what v1 does" rewrote the design's definition of a row, and is withdrawn.
>   - The mock's Private marker (encrypted, local-only concepts) is left for version 2. A kept-private header carries no real b-tag, so it is never a row.
> - **Added 2026-09-30 (PR #789): `/dictionary`.** The owner asked for the same page in the mock's styling, at `/dictionary`, with a Dictionary item beside Dictionaries in the avatar menus.
>   - `ui/src/pages/dictionary/` renders the control panel pages' own bodies (`ConceptsDictionaryBody`, `ConceptEntryBody`) inside the mock's frame and a light skin (`styles.css`: `.bsd-*`, `.dict-skin-light`), so the two pages cannot drift. Its rows open `/dictionary/:coord`.
>   - It keeps the control panel's lede rather than the mock's, which describes the Assistant's automatic upkeep and Veto as working today.
>   - Figtree and IBM Plex Mono are self-hosted in `ui/public/fonts/` (SIL OFL 1.1).
> - **When version 2 ships**, flip the Status to ✅ ADDRESSED. `/whats-open` lists this file while it reads 🔴.

---

**For:** Claude Code, implementing in `nous-clawds4/tapestry`
**Design source:** `Brainstorm Setup Flow v3.dc.html` in this project, bundled standalone as `handoff-dictionary/Brainstorm mock (standalone).html` (it opens offline). In it: account menu → **Dictionary**, plus Dictionary entry and Create New Concept.
**Protocol background:** `repo/protocols/drafts/` (Pins § 8.1 `add-to-dictionary`; DList Header Declaration § 4 `concept-header`).

## 1. What already exists in the repo (read these first)

| Piece | Where | Relevance |
|---|---|---|
| **Dictionaries section (placeholders)** | `ui/src/pages/dictionaries/Placeholders.jsx`; routes in `App.jsx` (`tags`, `dlists`, `concepts`) | **Build here.** `DictionaryConcepts` is this page. The index holds the owner's verbatim model statement. **Do not edit that prose.** |
| **Trusted Dictionary** | `ui/src/pages/shared-concepts/TrustedDictionary.jsx` → `GET /api/trusted-dictionary` (`src/api/adoption/index.js`), arithmetic in `src/lib/trustedDictionary.js` (ADR shared-concepts-adoption/0005) | **Version 1 data source.** It returns `entries` of `{coord, name, author, isMine, sentinelDeferred, qualifyingAuthorCount, totalAuthorCount, totalEventCount}`. Its membership rule is at least N distinct *qualifying* authors (influence above the verified cutoff, from the active point of view) filing items under the header with `z`. Self-filing and the TA don't count. |
| **Self-declared shared concepts** | `ui/src/hooks/useCommunitySharedConcepts.js` | Community headers whose `b` points to their own coordinate. Use it for the "Shared" marker and for find-new-concept search. |
| **Shared by me** | `ui/src/pages/shared-concepts/SharedByMe.jsx` → `GET /api/shared-by-me` | The source for the "Shared by you" row marker and the **Shared by me** filter. |
| **Concept detail / new concept** | `ui/src/pages/concepts/ConceptDetail.jsx`, `NewConcept.jsx` | The entry page should link to the concept detail page. Create New Concept can route to `NewConcept` in version 1. |
| **Kept private** | `sentinelDeferred` / `b-tag-deferred` | Maps onto the mock's **Private** marker. |
| **Point of view** | `usePov()` | Pass `povParams`, as TrustedDictionary does. |

## 2. Version 1 scope (build)

1. **List page** (`/…/dictionaries/concepts`):
   - Rows: singular name, description, item count. Alphabetical by default.
   - **Firmware** badge on firmware concepts.
   - Subtle tint plus a "Shared by you" label on the owner's shared concepts (`isMine` + self-`b`).
   - Grey "Private" label for kept-private (`sentinelDeferred`).
   - A status badge only when the owner has overridden the community: Added / Vetoed.
2. **Search and sort toggle** (magnifier; closed by default):
   - text search over name and description;
   - order: A→Z (default), Z→A, and **GUM₁** ascending and descending (§ 4).
   - **Show** multi-select: All, Firmware, Shared by me, Private. The subject groups (Nostr, Bitcoin, …) are version 2 (§ 3).
   - When the panel is closed, a filter note beside the count shows the active selection.
3. **FAQ**, collapsible and closed by default. Use the mock's copy:
   - What is a Concept? (plain version, then technical);
   - How does my Assistant decide what belongs in this Dictionary? (plain, then technical: **rewrite it to describe the version 1 rule**, § 4);
   - How do I find new concepts?
   - How does the Selection Bar work? (technical; version 2, § 3).
4. **"Don't see what you're looking for?"** above the table: a keyword search over `useCommunitySharedConcepts` rows, marked **Shared**. In version 1, "Add to Dictionary" can open the existing adoption / disposition flow (`DispositionPanel`) instead of publishing a pin.
5. **Create New Concept** button → the existing `NewConcept` page, or a stub.
6. **Entry page:** names, description, item count, sample items, the header coordinate, and the `b` target. Veto / Restore lives here, not in the row.
7. **Layout:** responsive. Reading width about 720px; rows stack on phones; tap targets at least 44px.

## 3. Version 2 and later (stub or leave out)

- **Add to Dictionary / Veto as pinnings** on `add-to-dictionary`, owner over community (Pins § 6). Needs the Pins wire format to land first. Until the pinning-context issue is settled, only generic pins are needed here.
- **GUM₂ / GUM₃ and the cutoff** (the mock's "Dictionary rule" panel on Automated Assistant Tasks) — see § 4.
- **Subject groups in Show** (Nostr, Bitcoin, Biology, …): an entry appears under X when its header is an element of X's superset (class-thread `n`). Needs a curated list of the groups to show.
- **Private concepts** created locally and encrypted (the mock's Private checkbox).
- **Hand-added flag.** The owner's model statement requires a field recording "added by hand", so automated scripts never remove it. That is the `add-to-dictionary` `+` pinning.

## 4. Usage metrics: three, numbered so none is forgotten

| Metric | Definition | Status |
|---|---|---|
| **GUM₁** | Distinct trusted authors (influence above the verified cutoff, from the active point of view) whose items `z` to the header. The header's own author and the TA never count. Threshold default 2. This is `qualifyingAuthorCount` in `src/lib/trustedDictionary.js`. | **Version 1: ship.** Label it "GUM₁ · trusted authors" in the UI. |
| **GUM₂** | The sum of rank scores (from Trusted Assertions) of trusted users whose Assistants' headers `b`-point to the shared concept. | Version 2 |
| **GUM₃** | The rank-weighted sum of `add-to-dictionary` pinnings: apply +, dispute −. | Version 2, after the Pins wire format lands |

- The metric, the cutoff (2 for GUM₁, 1.50 for GUM₂ and GUM₃) and the minimum author rank for concept search (20) are owner settings. The mock puts them on Automated Assistant Tasks → Dictionary rule. **They are not part of the Treasure Map.**
- All three are computed server-side, extending `trustedDictionary.js`. The UI never re-derives the arithmetic.
- **Version 1 requirement:** return a `metric` field (`"gum1"`) with the entries, so GUM₂ and GUM₃ can be added without changing the API shape.

## 5. Out of scope

Treasure Map changes (the Dictionary is not in the Treasure Map for now); the snapshot-publishing flow (keep it on TrustedDictionary); Tags and DLists dictionaries (their placeholders stay).
