# ADR 0001: One shared selected-POV resolver governs every tag surface

**Status:** Accepted
**Date:** 2026-07-08
**Story:** `engineering-team/stories/pov-selectable-tag-surfaces/1-honor-selected-pov-on-tag-surfaces.md`

## Context

Brainstorm's model is "pick from a few offered POVs, or your own." **Search already honors the
selection.** The tag surfaces do not: some thread a *login-binary* POV (my POV if logged in, else
house — ignoring the menu selection), and one threads *no* POV at all (always house). Story 1 makes
**one explicit POV choice govern search and every in-app tag surface, consistently**, using only
read parameters the backend already accepts.

### Verified current state (code, not intake — the intake is partly stale)

The intake claimed the tag reads are "hardcoded to house POV." That is only true for the *event-tag*
surface. The tag-**page** surfaces are worse: they are *login-binary* (a logged-in user always sees
their **own** POV regardless of the menu). Per-surface reality:

| Surface (client) | Endpoint | POV param sent today | Source of that value | Backend accepts `wotPov`+`userPubkey`? |
|---|---|---|---|---|
| Tags on a note — `ui/src/hooks/useEventTags.js` | `/api/event-tags/for-event` | **none** (only `viewerPubkey`) | — | **Yes** (`handleForEvent`→`buildTrustPredicate`, `src/api/event-tags/index.js:127`) |
| Tags directory — `ui/src/hooks/useTagIndex.js` | `/api/tags/index` | login-binary: `user?.pubkey ? {user,userPubkey} : house` | `useAuth().user` | Yes (`handleTagIndex`) |
| Tag detail rows — `ui/src/hooks/useTagDetail.js` | `/api/profile-tags/profiles-tagged` | login-binary | `useAuth().user` | Yes (`resolvePov`, `src/api/profile-tags/index.js:1028`) |
| Profile's tags — `ui/src/hooks/useProfileTags.js` | `/api/profile-tags/tags-for-profile` | login-binary | `useAuth().user` | Yes (`resolvePov`, `:260`/`:336`) |
| "Tagged by" activity — `ui/src/hooks/useAuthoredTagging.js` | `/api/profile-tags/authored-by` | login-binary | `useAuth().user` | Yes (`resolvePov`, `:887`) |
| Tag-page profile search — `ui/src/components/TagPageSearch.jsx` | `/api/search/profiles/meili` | login-binary | `user` prop | Yes (`resolvePov`, meili proxy) |
| **Search (reference)** — `ui/src/pages/BrainstormSearch.jsx:834` | `/api/search/profiles/meili` | **selected**: `pov === 'user' ? {user,userPubkey} : house` | local `pov` state (persisted) | Yes |

**How search resolves the selection (the rule the tag surfaces must reuse).** `BrainstormSearch`
holds `pov` state (∈ `{'user','nosfabrica'}`; default `'nosfabrica'`), loaded fast from
`localStorage['bs_pov_'+pubkey]` then from `GET /api/user-prefs` (`preferences.pov`), and persisted
back to both on change (`:139`, `:147`, `:159–170`). At read time it collapses to two branches
(`:834`): `pov === 'user' ? wotPov=user&userPubkey=<me> : wotPov=house`.

**Critical finding — "named POV" is not a third backend branch (yet).** `resolvePov({wotPov,
userPubkey})` (`src/api/_shared/pov.js:46`) has exactly **two** branches: `wotPov==='user' &&
userPubkey` → the user's delegate from their prefs file; **everything else → the house delegate**.
There is no `'nosfabrica'` (or any named) branch. On this deployment `nosfabrica` *is* the house
delegate, so selecting "nosfabrica" and selecting "house" resolve to the **same** read. The three
logical POVs the story names (house / named / own) therefore map to **two** backend resolutions
today: `{house | named} → wotPov=house` and `{own} → wotPov=user`. This is exactly why the AC "logged
in + selected nosfabrica → see nosfabrica's trust, not my own" is satisfiable now: nosfabrica ≡ house
here, and mirroring search's two-branch rule fixes the login-binary bug that today forces "own."

The named-POV **resolution path** the story asks us to confirm thus exists **only for the currently
offered named POV** (because it aliases house). A named POV whose delegate is *not* the house delegate
has **no** resolution path — adding one requires a server-side named→delegate map in `resolvePov`,
which is the "provisioning new offered POVs" epic explicitly **out of scope** here.

### The core gap and the design question

Search and the tag hooks **derive the POV independently and differently** — selected vs login-binary.
There is no shared client-side "selected POV → read params" resolver, and no shared holder of the
selected value: `pov` lives inside `BrainstormSearch`'s component state, unreachable from the tag
pages (different routes). Making "one selection governs everything" **structurally true** (not true by
each surface happening to agree) is the whole point of this story.

### Constraints (CLAUDE.md — non-negotiable)

- **Read-time only.** No new per-POV columns; the backend already carries `wot_rank_<suffix>` and
  accepts the param. Filter at read time.
- **No TA/named-POV pubkey literals in the client.** The client sends only `wotPov` + the logged-in
  user's own `userPubkey`; the delegate pubkey is resolved server-side from prefs (`resolvePov`). The
  client resolver is pubkey-free except for the viewer's own key (from `useAuth`).
- JS-without-build; no new tooling; match existing patterns.
- Do not change the write path or any read API's contract.

## Options considered

### Option A — Shared `PovContext` (single source of the selection) + a pure resolver util *(chosen)*

1. **Pure util** `ui/src/utils/povReadParams.js` — `resolvePovReadParams({ pov, userPubkey })` →
   `{ wotPov: 'user'|'house', userPubkey? }`. The *single* home of the resolution rule (a faithful
   copy of search's `:834` rule): `pov === 'user' && userPubkey` → `{wotPov:'user', userPubkey}`; else
   `{wotPov:'house'}`.
2. **`PovContext`** (`ui/src/context/PovContext.jsx`) owns the selected `pov` value + its persistence
   (lifted verbatim from `BrainstormSearch`: same `localStorage['bs_pov_'+pubkey]` fast-path, same
   `GET/PUT /api/user-prefs` `preferences.pov`, same `'nosfabrica'` default, keyed on `useAuth().user`).
   Exposes `{ selectedPov, setSelectedPov, povParams }` where `povParams = resolvePovReadParams({ pov:
   selectedPov, userPubkey: user?.pubkey })`.
3. Every tag hook/component consumes `usePov().povParams` and spreads it into its request params,
   **replacing** the login-binary block (5 surfaces) or **adding** params where none existed
   (`useEventTags`).
4. `BrainstormSearch` consumes `usePov()` for `pov`/`setPov` instead of local `useState`, and its
   read-param construction calls the same `resolvePovReadParams` util — so search and tags share both
   the *value* and the *rule*. One writer, one reader path.

- **Pros:** "One selection governs everything" is **structural** — one value, one rule, one persistence
  writer. Reactive: switching in the menu updates tag surfaces on their next mount. Pure util is a
  clean test seam. No backend change.
- **Cons:** Touches `BrainstormSearch` (a large file) to lift its `pov` state into the provider — the
  main regression surface. Mitigated by lifting the load/persist logic *verbatim* (byte-compatible
  key + prefs shape).

### Option B — Shared pure resolver util only; each tag hook independently re-reads the pref

Ship the `povReadParams` util; each tag hook reads the persisted pref itself (small `usePersistedPov`
or direct `localStorage`), search adopts the util but keeps its own state.

- **Pros:** No `BrainstormSearch` state refactor; lower blast radius.
- **Cons:** N independent readers of the pref → "one selection governs" holds only by every reader
  agreeing on the key/shape — **convention, not structure** (the failure mode the story warns against).
  Duplicated load logic; no single reactive source; two persistence writers if any tag surface ever
  gains its own switch. **Rejected** — violates "make it structurally true."

### Option C — Per-hook replication of search's inline rule

Copy `user?.pubkey && pov==='user' ? … : house` into each hook, reading `localStorage['bs_pov_…']`
directly.

- **Pros:** Smallest diff.
- **Cons:** Pure convention, duplicated rule in 6 places, drift-prone, no shared seam to test.
  **Rejected outright.**

## Decision

We chose **Option A**. It is the only option that makes "one explicit choice governs search and every
tag surface" *structurally* true — a single selected-POV value (one persistence writer), resolved by a
single pure rule, consumed by every surface. It honors POV-first / filter-at-read-time (params only;
no denormalization), introduces no pubkey literals, and needs **no backend change**. The cost — a
bounded, mechanical refactor of `BrainstormSearch`'s `pov` state into the provider — is the price of
convergence being real rather than conventional.

Note we deliberately do **not** reuse `TrustContext` (`ui/src/context/TrustContext.jsx`): it models a
*different* axis — the dashboard's trust-scoring-**method** + an owner-defaulted `povPubkey` — not the
search `{house|nosfabrica|user}` label persisted to `/api/user-prefs.preferences.pov`. Overloading it
would conflate two POV notions and risk regressing the dashboard.

## Consequences

- **Enables:** the tag analog of search's selectable POV — "view tags through the selected POV's eyes,"
  consistently across all five surfaces. Sets up Story 2 (honest state for an unprovisioned selected
  POV) to guard a single, well-defined threading point rather than six scattered ones.
- **Constrains / honest limits:** with the currently offered POVs, the client resolver has two
  branches (own vs house-or-named), because the *server* `resolvePov` has two. A named POV whose
  delegate differs from the house delegate will still resolve to house until the provisioning epic
  teaches `resolvePov` a named→delegate map. This ADR does not add that map. The `PovContext` is
  designed so `selectedPov` can later carry a distinct named value without reworking consumers.
- **Reactivity scope:** "switching updates the view" is satisfied on the **next mount** of a tag
  surface (the menu lives on the search route; navigating to a tag page remounts and re-reads). No
  live cross-route push is in scope.
- **Follow-ups / debt:** the unprovisioned-POV `trustPredicateFor` "count everyone" fallback
  (`src/api/event-tags/index.js:114`) is untouched here — that is **Story 2**. Applicability stays
  instance-global (out of scope).
- **NIP-85 alignment (added 2026-07-09, operator).** The "provisioning epic" this ADR defers is now
  concretely scoped: **NIP-85 Trusted Assertions are the POV interop layer**, and the per-customer
  pipeline (service key → per-POV scores → kind-30382 publish → `wot_rank_<serviceKeySuffix>` Meili
  columns → recurring schedule) **already exists** in-repo — see the 2026-07-09 `_intake.md` entry
  ("NIP-85 is the POV interop layer"), gaps (a)–(f). Two consequences for THIS epic:
  (1) the future named-POV branch in `resolvePov` should resolve a named POV to a **customer service
  key** (whose suffix names the Meili columns the customer pipeline already loads) — `PovContext`'s
  named-value extensibility has that concrete target;
  (2) **Story 2's "provisioned" definition** should be derived from the same machinery: a selected
  POV is provisioned iff its resolved `povSuffix` has real `wot_rank_<suffix>` columns (which is
  exactly what the customer pipeline creates) — not from any separate registry.
- **Firmware reinstall required?** **No.** No concept/schema/definition change — read-time parameter
  threading only.

## Implementation notes

**New — pure util (the test seam):**
- `ui/src/utils/povReadParams.js` — export `resolvePovReadParams({ pov, userPubkey })`:
  - `pov === 'user' && /^[0-9a-f]{64}$/.test(userPubkey)` → `{ wotPov: 'user', userPubkey }`
  - otherwise → `{ wotPov: 'house' }` (own is impossible without a viewer key; named/house both → house)

**New — context (single source of the selection):**
- `ui/src/context/PovContext.jsx` — `PovProvider` + `usePov()`. Owns `selectedPov`
  (default `'nosfabrica'`, keyed on `useAuth().user?.pubkey`); load = `localStorage['bs_pov_'+pubkey]`
  fast-path then `GET /api/user-prefs` (`preferences.pov`, accept only `'user'|'nosfabrica'`); persist
  on `setSelectedPov` to both `localStorage['bs_pov_'+pubkey]` and `PUT /api/user-prefs` `{ pov }` —
  **lift this verbatim** from `BrainstormSearch.jsx:137–170` so search behavior is preserved. Expose
  `povParams = resolvePovReadParams({ pov: selectedPov, userPubkey: user?.pubkey })`. Logged-out → no
  user → `{ wotPov:'house' }`. Mount `PovProvider` at the app root (alongside `AuthProvider`/
  `ConfigProvider`).

**Changed — tag surfaces (spread `usePov().povParams`, delete the login-binary block):**
- `ui/src/hooks/useEventTags.js` — add `const { povParams } = usePov();` and set the params from it
  (this surface currently sends **only** `viewerPubkey`; keep `viewerPubkey` for the `mine` channel and
  add `wotPov`[+`userPubkey`]). Include `povParams.wotPov` (+`userPubkey`) in the effect deps.
- `ui/src/hooks/useTagIndex.js` — replace the `if (user?.pubkey) {wotPov:'user',…} else {house}` block
  (`:67–74`) with spreading `povParams`; keep `viewerPubkey`/`authoredBy`/`pinnedByMe` as-is; add pov
  fields to deps.
- `ui/src/hooks/useTagDetail.js` — replace the block at `:77–83` with `povParams`; keep `viewerPubkey`.
- `ui/src/hooks/useAuthoredTagging.js` — replace `:26–31` with `povParams`.
- `ui/src/hooks/useProfileTags.js` — replace `:46–51` with `povParams` (read path only; the write/
  publish path is untouched).
- `ui/src/components/TagPageSearch.jsx` — replace `:53–58` with `povParams` (call `usePov()` directly;
  add pov fields to the effect deps).

**Changed — search (converge onto the same value + rule, minimal):**
- `ui/src/pages/BrainstormSearch.jsx` — source `pov`/`setPov` from `usePov()` instead of local
  `useState('nosfabrica')` (`:784`); the existing prefs load/persist effects move into `PovProvider`
  (their setter calls become `setSelectedPov`). Replace the inline read rule at `:834–836` with
  `resolvePovReadParams({ pov, userPubkey: user?.pubkey })`. `povSwitching`/`myWotReady`/auto-select
  logic is unchanged (auto-select becomes `setSelectedPov('user')`).

**Backend:** none. `for-event`, `for-tag`, `tags/index`, `profile-tags/{tags-for-profile,
profiles-tagged,authored-by}` all already parse `wotPov`+`userPubkey` via `resolvePov`. Verified.

### Read-time-only / no-regression confirmation

- Every change passes parameters the endpoints **already accept**; no columns, no write-path, no
  denormalized "trusted set." Consistent with filter-at-read-time.
- Search does not regress: it keeps the identical two-branch outcome (`pov==='user'?user:house`),
  now expressed through the shared util over the same persisted value.

### Testability seams (for the Tester)

- **Pure `resolvePovReadParams` (crux):** `{pov:'user', userPubkey:<hex>}` → `{wotPov:'user',
  userPubkey}`; `{pov:'nosfabrica', userPubkey:<hex>}` → `{wotPov:'house'}` (own suppressed);
  `{pov:'house'}` → `{wotPov:'house'}`; `{pov:'user'}` with no/invalid userPubkey → `{wotPov:'house'}`.
- **Source-contract:** each of the six surfaces imports/spreads the shared params and **no longer
  contains** the `user?.pubkey ? 'user' : 'house'` inline literal; `useEventTags` now emits `wotPov`.
- **Context:** given a persisted `preferences.pov`, `usePov().selectedPov` reflects it and `povParams`
  derives via the util; logged-out → `{wotPov:'house'}`.
- **(Optional integration):** with a selection set, a tag surface's outgoing request carries
  `wotPov=house` even while logged in (the anti-regression for the login-binary bug).

## Out of scope

- Unprovisioned-POV honest state / the `trustPredicateFor` "count everyone" fallback — **Story 2**.
- Applicability picker POV-awareness — stays instance-global.
- Provisioning new offered POVs and teaching `resolvePov` a named→delegate map (a named POV distinct
  from house) — separate epic.
- Any change to the tag write/publish path or to backend read-API contracts.
