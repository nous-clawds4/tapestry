# ADR Re-Folder Reconciliation Proposal (three branches)

**Status:** 🔵 PROPOSAL — folder assignments + merge order only. **No file moves performed.** Awaiting ratification by user + David + Vinney.
**Author:** engineering (gap-analysis follow-up)
**Date:** 2026-06-05
**Approach:** **re-folder, not renumber** (per directive). Each unmigrated branch's flat ADRs move into per-epic folders; per-epic numbering makes cross-epic number clashes disappear without changing a single ADR number.

---

## 0. Why re-folder beats renumber

The collisions are all in the **flat** namespace `engineering-team/decisions/NNNN-*.md`. `staging` already migrated every ADR into per-epic folders (the #236 scheme): `community-reference/`, `profile/`, `search-and-router/`, `task-queue-scheduler/`. Two branches were forked **before** that reorg and still carry flat ADRs:

- **`feat/communities`** (this branch) — flat `0004–0010` (the Brainstorm Communities *app* build).
- **`feat/pubkey-tagging-target`** (Vinney) — flat `0001–0021` (profile-tagging / pins / nostr-user-tag) **plus** four flat copies of already-migrated ADRs.

Once each flat ADR lands in an epic folder, `profile/0019` and `task-queue-scheduler/0019` coexist with zero conflict. **Verified result: no renumbering is required anywhere** — every flat ADR maps to a folder at its existing number with no intra-folder clash.

---

## 1. `staging` — the canonical base (already migrated, no action)

| Folder | Numbers present |
|---|---|
| `community-reference/` | 0004–0011, 0027 |
| `profile/` | 0026 |
| `search-and-router/` | 0002, 0003 |
| `task-queue-scheduler/` | 0012–0025 |

This is the target shape. Everything below folds **into** these folders (or into one new folder), at existing numbers.

---

## 2. `feat/communities` (this branch) — flat 0004–0010 → **new epic `brainstorm-communities/`**

These document the **bespoke Communities app model — now FROZEN** (kind-39999 community-record + endorsement/veto signal + `computeGrCommunityScores`). They are *not* `community-reference` (that epic is the concept-import substrate). They get their own folder for historical/record purposes; the eventual Communities Protocol rewrite (atop `nostr-user-tag`) will be a *new* epic that supersedes this one.

| Flat (today) | → Folder/number (proposed) |
|---|---|
| `0004-ui-communities-scaffold.md` | `brainstorm-communities/0004-ui-communities-scaffold.md` |
| `0005-firmware-v1.1.0-finalization.md` | `brainstorm-communities/0005-firmware-v1.1.0-finalization.md` |
| `0006-gr-community-scoring-and-api.md` | `brainstorm-communities/0006-gr-community-scoring-and-api.md` |
| `0007-discover-swaps-mock-data-for-api.md` | `brainstorm-communities/0007-discover-swaps-mock-data-for-api.md` |
| `0008-nip07-signin-and-writes.md` | `brainstorm-communities/0008-nip07-signin-and-writes.md` |
| `0009-create-flow-publishes.md` | `brainstorm-communities/0009-create-flow-publishes.md` |
| `0010-participate-kind1-reads-writes.md` | `brainstorm-communities/0010-participate-kind1-reads-writes.md` |

No intra-folder clash (0004–0010 unique). Needs a matching `engineering-team/epics/brainstorm-communities.md`. **Decision for ratification:** confirm the epic slug (`brainstorm-communities` vs `communities-app`) and that this folder is understood as the *frozen* bespoke model.

---

## 3. `feat/pubkey-tagging-target` (Vinney) — flat 0001–0021 → mostly `profile/`

### 3a. Profile-tagging epic → `profile/` (staging `profile/` has only `0026` → all land collision-free)

| Flat (today) | → `profile/` | Note |
|---|---|---|
| `0001-profile-tag-architecture.md` | `profile/0001-…` | ★ **nostr-user-tag** — load-bearing for Communities membership |
| `0002-tag-detail-page-read.md` | `profile/0002-…` | |
| `0003-tag-index-page.md` | `profile/0003-…` | |
| `0004-tag-detail-page-write.md` | `profile/0004-…` | |
| `0005-authored-tagging-on-profile.md` | `profile/0005-…` | |
| `0006-profile-tag-polish-omni-search-pov.md` | `profile/0006-…` | |
| `0009-pin-a-tag.md` | `profile/0009-…` | |
| `0010-tl-publication-from-pins.md` | `profile/0010-…` | |
| `0011-customize-pin-curation.md` | `profile/0011-…` | |
| `0012-most-pinned-tag-index.md` | `profile/0012-…` | |
| `0014-tag-detail-curated-view-and-pin-polish.md` | `profile/0014-…` | |
| `0015-restore-historical-data-and-fix-tl-author-filter.md` | `profile/0015-…` | |
| `0016-curated-mobile-affordances-and-pin-state-polish.md` | `profile/0016-…` | |
| `0017-nip51-list-export-from-pins.md` | `profile/0017-…` | |
| `0018-pin-detail-into-tag-pinned-tab.md` | `profile/0018-…` | |
| `0019-collapse-into-export-concept.md` | `profile/0019-…` | (was colliding w/ `task-queue-scheduler/0019` in flat space — **resolved by foldering**) |
| `0020-follow-pack-export-target.md` | `profile/0020-…` | (resolved vs `task-queue-scheduler/0020`) |
| `0021-login-failure-surfacing-and-tag-result-collapse.md` | `profile/0021-…` | (resolved vs `task-queue-scheduler/0021`) |

### 3b. Ambiguous — Vinney to confirm `profile/` vs `search-and-router/`

| Flat | Candidate folders | Note |
|---|---|---|
| `0007-search-result-parity.md` | `profile/0007` **or** `search-and-router/0007` | collision-free either way |
| `0008-search-results-url.md` | `profile/0008` **or** `search-and-router/0008` | collision-free either way |

### 3c. Flat copies of already-migrated ADRs → fold into existing folder at same number (**content-reconcile, not renumber**)

These four already exist in `staging`'s folders at the same number+slug — Vinney's are pre-#236 flat copies. Fold in; if content drifted, reconcile to staging's canonical version. **No number change.**

| Flat (Vinney) | Existing on staging | Action |
|---|---|---|
| `0002-treasure-maps-router-preset.md` | `search-and-router/0002-treasure-maps-router-preset.md` | keep staging's; verify no drift |
| `0003-scheduled-search-and-house-scores-refresh.md` | `search-and-router/0003-scheduled-search-and-house-scores-refresh.md` | keep staging's; verify no drift |
| `0004-publish-export-a-concept.md` | `community-reference/0004-publish-export-a-concept.md` | keep staging's; verify no drift |
| `0005-community-reference-nostr-relay-stub.md` | `community-reference/0005-community-reference-nostr-relay-stub.md` | keep staging's; verify no drift |

> Note: Vinney's branch even has **intra-branch** flat dups (two `0002`s, two `0003`s, two `0004`s, two `0005`s) — e.g. `0002-tag-detail-page-read` vs `0002-treasure-maps-router-preset`. Foldering splits them into `profile/0002` vs `search-and-router/0002`. This is the clearest demonstration that re-folder fully resolves the namespace.

---

## 4. Merge order (proposed)

1. **`staging`** is the base — epic-folder scheme already in place. Nothing to do.
2. **§26 "Resolved Definition" + ADR (substrate, branch-independent).** Author on a small branch off `staging`, into `community-reference/` (or a dedicated `resolved-definition/` epic). Merge **first** — conflict-free, foundational, unblocks nothing but anchors the Communities lineage. *(This is the `/plan-feature` work now in flight.)*
3. **Vinney's `feat/pubkey-tagging-target`.** Apply §3 re-folder + content-reconcile the four §3c dups, then either (a) merge the whole branch, or (b) **carve out just the `nostr-user-tag` core** (`profile/0001` + its schema/code) to `staging` first. Either path **unblocks Communities v1 membership** — this is the gating dependency.
4. **`feat/communities`.** Apply §2 re-folder into the new `brainstorm-communities/` epic. The app code stays **frozen** (bespoke model); only the ADR re-folder is hygiene. The Communities Protocol rewrite (atop `nostr-user-tag`) lands later as a new epic that supersedes `brainstorm-communities/`.

---

## 5. Open decisions for ratification

1. **New epic slug** for this branch's app ADRs: `brainstorm-communities` (proposed) vs `communities-app`. Confirm it's the *frozen* bespoke model, distinct from `community-reference` (substrate).
2. **Vinney 0007/0008** → `profile/` or `search-and-router/` (his call; collision-free either way).
3. **Four duplicate ADRs (§3c):** confirm "keep staging's canonical, discard Vinney's flat copy" unless a real content delta is found.
4. **Delivery shape for step 3:** full-branch merge vs carve-out of the `nostr-user-tag` core. Communities membership is blocked until that core reaches `staging`.

**Bottom line:** re-folder alone resolves 100% of the number collisions across all three branches — **zero renumbering**. The only residual work is (a) one new epic folder + epic doc, (b) content-reconciling four duplicate ADRs, and (c) the org-level delivery decision on the `nostr-user-tag` core.
