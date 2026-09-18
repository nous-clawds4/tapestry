# ADR 0004: The curation method — Simple Lists' scoring rule as one shared pure module, candidates' votes from both sources, verdicts on the candidate rows

**Status:** Accepted (§2's one filter per source, §3's "`useTrustWeights` unchanged", §4's words for a failed vote source and §7's reading of "the shared list read cleanly" superseded by `curated-dlist-update` ADR 0005)
**Date:** 2026-09-12
**Story:** `engineering-team/stories/done/curated-dlist-update/4-curation-method-panel.md`
**Supersedes in part:** `my-curated-dlists` ADR 0003 (AC-4 and sub-decision 8: the Curation method panel as a
text-only placeholder) — Decision §8.

> **Superseded in part (2026-09-13):** the votes are read in chunks of 50 ids, and a relay answer at the vote limit counts as capped (§2); `useTrustWeights` reports an unsuccessful rank read, and a point of view with no follow list here, as errors (§3); a failed vote source reads "the votes on this instance's strfry" or "the votes on the community relay", not "this instance's strfry" or "the community relay" (§4, Amendment 2); and a shared list read from only one source, or cut off, makes the verdicts' summary incomplete (§7) — `curated-dlist-update` ADR 0005.

## Context

The story's acceptance criteria, in short:
- **AC-1** the Curation method panel (closed on every load) shows:
  - the Scoring Method and point of view chosen on Trust Determination, with a link there to change them;
  - an editable cutoff, default 2, remembered per list in this browser (Planning-gate decision 1);
  - a line saying these apply in this browser and are not written onto the list.
- **AC-2** each candidate carries a verdict and its reason — the score against the cutoff, and the votes that
  made it. The panel carries the summary "N of M qualify" (decision 3: the verdicts sit on the candidate rows).
- **AC-3** a candidate's score and verdict equal what Simple Lists' Generate Trusted List panel computes from the
  same inputs. A kind-39999 candidate's votes are those on its current version (decision 2).
- **AC-4** votes come from this instance's strfry and the community relay together, each vote once. A failed read
  of votes or weights gives "couldn't check", never "doesn't qualify".
- **AC-5** nothing else moves:
  - Simple Lists is unchanged;
  - Trust Determination is only read;
  - read-only lists show no method and no verdicts;
  - nothing is written.

**Facts from the code (read this session).**
- **Simple Lists' rule is inline** in `ui/src/pages/lists/DListItems.jsx`:
  - `isUpvote` / `isDownvote` (`:32–40`) classify a reaction by its trimmed content.
  - `reactionsPerItem` (`:199–214`) credits each kind-7 reaction to its first `e` tag.
  - The `trustScores` memo (`:248–347`) builds `{ score, breakdown }` per item:
    - the author's implicit upvote counts at the author's weight, cancelled to 0 when the author's first reaction
      is a downvote. In that case each of the author's reactions adds a zero `explicit-downvote` row;
    - an explicit `+` from the author is noted as a duplicate;
    - every other reactor adds ±weight, and an "other" reaction adds 0;
    - a null weight is skipped, noted "Trust weight unknown".
  - `TrustedListPanel` (`:822–1123`) qualifies at `score != null && score >= cutoff` (`:852`), with the cutoff
    defaulting to 2 (`:826`).
  - Reactions are de-duplicated by event id only (`:173–179`), and read from one source at a time (the "Ratings
    Source", `:143–188`).
  - No test pins any of this.
- **Weights: `useTrustWeights(pubkeys)`** (`ui/src/hooks/useTrustWeights.js`).
  - It reads `povPubkey`, `scoringMethod` and `trustedListId` from `TrustContext`, and returns `{ weights, loading,
    error, povPubkey, scoringMethod }`.
  - A whole-read failure sets `error`, with every weight null — for example a missing Treasure Map, a missing
    `30382:rank` tag, a failed assertion fetch, or no Trusted List selected (`:65–87`, `:138–145`, `:155–177`).
  - An individual null means only "no assertion for this pubkey".
  - With no point of view, the weights are `{}` (`:28–31`).
  - The effect is keyed on the `pubkeys` array's identity (`:213`), so callers must memoize it.
- **`TrustContext`** (`ui/src/context/TrustContext.jsx`) keeps the selection in localStorage
  (`tapestry_trust_method`, per browser). `SCORING_METHODS` gives the labels. The point of view defaults to the
  owner once the config loads (`:53–58`).
- **The curation page:**
  - `CurationMethodPanel()` (`ui/src/pages/grapevine/CuratedDListItems.jsx`) is a text-only disclosure.
  - `ItemsSection` reads the curated list, and reads the shared list only while "Also show candidates to copy" is
    on. Its rows come from `curatedItemRows`, whose `candidate` rows carry each shared item's `routeId`.
  - The detail page mounts the method panel only for my own lists (`CuratedDListDetail.jsx`, story 3).
- **Existing shapes:**
  - `queryRelayBounded` returns `{ events, count, total, truncated, limit }` (`ui/src/api/relay.js`);
  - `/api/relay/external` returns `{ success, events }`;
  - `useProfiles(pubkeys)` returns `{ [pubkey]: profile|null }`.
- **Pins (the Tester's re-aims, Phase 3):**
  - `test/my-curated-dlists-items.test.js` S3 (`:293–304`) is titled "the method panel is text only". Its
    assertions (a disabled Update without a handler, "isn't built yet", the words upvotes/downvotes) can still
    hold.
  - S1 and S7 (the panel's name and placement), and story 3's S2 (the panel inside a conditional branch), stay
    true.
- **Drift:** the branch is 13 commits behind `origin/staging`, and none of them touches these files.

**Concepts.** None change. Orientation: `39998:<TA>:list`, `39998:<TA>:tapestry-assistant`. Votes (kind 7) and the
Trust Determination settings have no concept handles.

**POV reflex checks.**
- *Who is this true for?* This viewer — their Scoring Method, point of view and cutoff, in this browser. Another
  viewer or browser can see different verdicts. That is the story's intent, and it is said on the panel.
- *Where does trust come from?* From the viewer's chosen Scoring Method, computed from the chosen point of view at
  read time. Nothing is administered.
- *Could anyone else publish their own version?* Yes. Votes from anyone are read ungated and weighed at read time.
- *What changes when the POV changes?* The verdicts are recomputed on the next load. Nothing is stored except the
  cutoff number, per list, in this browser.

Principle 4: no graph write; the page stays read-only.

## Options considered

### Option A — One shared pure scoring module; the curation page reads votes from both sources and computes verdicts in its utility (chosen)
- Simple Lists' four steps move verbatim into a new zero-import module: classify a reaction, credit reactions to
  items, score an item, qualify a score. `DListItems.jsx` calls it, and its behaviour is unchanged.
- The curation util gains a dependency-injected votes lookup (both sources, merged by event id), a
  weights-readiness rule, a pure verdict assembler, and the cutoff helpers.
- The items section shows the verdicts on the candidate rows. The cutoff and the summary live on the detail page,
  which passes them to the panel and to the items section.
- **Pros.**
  - The rule has one owner, so "decided exactly as Simple Lists decides" holds by construction.
  - Every new rule is a pure function a Node suite can pin.
  - Story 3's structure — the lazy shared read, the items section's hooks — is untouched.
- **Cons.** Simple Lists' page changes, though only by calling the extracted functions. The characterization tests
  guard that it computes the same.

### Option B — Copy the rule into the curation util
- **Pros.** Simple Lists is untouched.
- **Cons.** Two copies of the same rule drift, and AC-3 would rest on nothing. Rejected.

### Option C — A server-side scoring API
- **Cons.** The rule and its inputs are client-side and per browser (`TrustContext`). Moving them couples the server
  to one browser's settings, and it is a much larger change. Rejected.

### Option D — Compute the verdicts on the detail page
- The shared read and the candidates switch would move up to the page.
- **Cons.** It restructures story 3's items section, whose shared read is deliberately lazy and inside the section.
  Rejected.

### Option E — Share Simple Lists' `TrustBreakdown` component too
- **Cons.** It widens Simple Lists' diff. Deferred: the curation page renders a compact reason from the same
  breakdown entries.

## Decision

We chose **Option A**.

1. **The shared rule — `ui/src/utils/dlistScore.js`** (new; pure, zero-import, never throws). It holds Simple
   Lists' code, moved verbatim:
   - `classifyReaction(content)` → `'upvote' | 'downvote' | 'other'` (`isUpvote` / `isDownvote`, `:32–40`);
   - `reactionsByItem(reactionEvents, itemIds)` → `{ [itemId]: [{ pubkey, type, id, content }] }`. Each reaction
     is credited to its first `e` tag, only for the given ids, in the given order (`:199–214`);
   - `scoreItem(authorPubkey, itemReactions, weights)` → `{ score, breakdown }` — the `trustScores` memo's body
     (`:252–344`), with the same entries (`pubkey, role, type, weight, contribution, note`), the same notes and
     the same order;
   - `qualifies(score, cutoff)` → `score != null && score >= cutoff` (`:852`).

   `DListItems.jsx` imports all four in place of its inline code. Its reads, controls, cutoff, Ratings Source,
   breakdown table and publish are unchanged (AC-5).
2. **Candidates' votes — `lookupItemVotes(ids, { scanLocal, fetchRelay }, relay)` in `ui/src/utils/treasureMap.js`**
   (dependency-injected; never rejects).
   - It sends one filter, `{ kinds: [7], '#e': ids, limit: VOTES_LIMIT }`, to each source:
     - local via `scanLocal` (`queryRelayBounded`);
     - the relay via `fetchRelay`, when it is a ws/wss URL.
   - It keeps kind-7 events, merged by event id (local first, then the relay's additions), so each vote counts
     once.
   - It returns `{ events, local: 'ok'|'failed', relay: 'ok'|'failed'|'skipped', truncated }`.
   - `VOTES_LIMIT = 5000`. A truncated local read is an incomplete read (AC-4).
   - A new hook, `useItemVotes(ids, relay)` (`ui/src/hooks/useItemVotes.js`), binds it the way `useListItems`
     binds `lookupListItems`, keyed on the ids and the relay.
3. **Weights.** `useTrustWeights(pubkeys)` is used unchanged, with the candidates' authors and their voters in a
   memoized, content-keyed array. A pure `weightsState({ weights, loading, error, pubkeys })` in `treasureMap.js`
   reads it:
   - `failed` when `error` is set (the whole read failed);
   - `ready` when it is not loading and every pubkey has an own key in `weights` (an individual null is a
     legitimate "unknown");
   - otherwise `checking` — including no point of view yet, and the render before the hook's first resolve. So
     it is never "doesn't qualify" by accident.
4. **The verdicts — a pure `candidateVerdicts({ candidates, votes, weights, cutoff })` in `treasureMap.js`.**
   - **Its inputs.** `candidates` are the shared items shown as candidates. `votes` is `lookupItemVotes`' result, or
     null while it is pending. `weights` is `{ state, values, error }`.
   - **Checking.** Votes pending, or weights `checking` → every candidate `checking`.
   - **Couldn't check.** Either source failed, or the local read was truncated, or the weights `failed` → every
     candidate `unchecked`. The reason names what couldn't be read: "this instance's strfry", the community relay,
     "more votes than one read returns", or the weights' error.
   - **Otherwise,** per candidate: `scoreItem(candidate.pubkey, reactionsByItem(votes.events, [candidate.id])[
     candidate.id], weights.values)` gives `{ score, breakdown }`. The verdict is `qualifies` when `qualifies(score,
     cutoff)`, else `skipped`.
     - Votes are matched by the candidate's current event id, which is decision 2 for kind-39999 originals.
     - The author's "first reaction" follows the merged order.
   - **It returns** `{ byRouteId: { [routeId]: { verdict, score, breakdown, reason } }, summary: { state:
     'checking'|'complete'|'incomplete', qualifying, total, reason } }`.
5. **The cutoff — `useCurationCutoff(listCoord)`** (`ui/src/hooks/useCurationCutoff.js`, new), with pure helpers in
   `treasureMap.js`.
   - `CUTOFF_DEFAULT = 2`, and `cutoffStorageKey(coord)` → `tapestry_curation_cutoff:<coord>`, keyed by my curated
     header's coordinate.
   - `readStoredCutoff(raw)` → the stored number, or 2 when the value is missing or invalid.
   - Every storage access is wrapped in try/catch; storage unavailable → the default, unsaved.
   - The input parses as Simple Lists' does: `parseFloat(v) || 0`, step 0.1.
   - With a null coordinate (not my own list) it returns the default and never touches storage.
6. **The detail page** (`CuratedDListDetail.jsx`).
   - Before the early return: `const [cutoff, setCutoff] = useCurationCutoff(open && !readOnly ? access.row.coord :
     null)` and `const [verdictSummary, setVerdictSummary] = useState(null)`.
   - My own lists: `<CurationMethodPanel cutoff={cutoff} onCutoffChange={setCutoff} summary={verdictSummary} />`
     and `<ItemsSection … cutoff={cutoff} onVerdictSummary={setVerdictSummary} />`.
   - Read-only lists: exactly as story 3 left them — no panel, no cutoff, no verdicts (AC-5).
7. **The panel and the rows** (`CuratedDListItems.jsx`).
   - **`CurationMethodPanel({ cutoff, onCutoffChange, summary })`** is still closed on every load. Opened, it shows:
     - "Scoring Method: `<label>`" (from `useTrust()` and `SCORING_METHODS`), with " · `<trustedListId>`" for
       the Trusted List method;
     - "Point of view: `<name>` · `<short pubkey>`" (`useProfiles`);
     - "Change them on Trust Determination →" (`/tapestry/grapevine/trust-determination`);
     - "Cutoff (≥)", a number input;
     - one sentence on the rule: "A candidate qualifies when its score reaches the cutoff: its author's implicit
       upvote plus the trust-weighted upvotes, minus the trust-weighted downvotes.";
     - "These apply in this browser and are not written onto the list.";
     - the summary: "⏳ Checking…", "`N` of `M` candidates qualify", "Verdicts incomplete — couldn't check
       `<reason>`", or, when candidates are not shown, "Turn on "Also show candidates to copy" to see which
       qualify."
   - **`ItemsSection`** gains `cutoff` and `onVerdictSummary`. On my own lists, while candidates are shown and the
     shared list read cleanly:
     - it reads the candidates' votes with `useItemVotes(candidateIds, communityRelay)`, gated like the shared read;
     - it gets the weights, and assembles `candidateVerdicts`;
     - it adds a Verdict cell on candidate rows: "✓ qualifies · `<score>` ≥ `<cutoff>`", "✗ skipped · `<score>` <
       `<cutoff>`", "⏳ checking…" or "⚠️ couldn't check";
     - a click expands the reason: Voter · Vote · Weight · Contribution · Note, from the breakdown;
     - it reports the summary up (`{ state: 'hidden' }` when candidates are not shown).

     Read-only lists (`curator` 'other') get no verdict cell, and no votes or weights are read.
8. **Superseded in part:** `my-curated-dlists` ADR 0003 — AC-4 and sub-decision 8, the method panel as a text-only
   placeholder. It gets a Status parenthetical and a one-line note citing `curated-dlist-update` ADR 0004 by short
   name.

## Consequences
- **Enables** story 5: Update copies exactly the `qualifies` set that `candidateVerdicts` computes, with the list's
  stored cutoff, and its preview can name the method, the point of view and the cutoff.
- **Constrains.** Simple Lists' rule becomes a shared contract, pinned by tests. A change to it now changes both
  pages, by design.
- **Debt, recorded:**
  - `DListRatings.jsx` and `DListItemRatings.jsx` keep their own copies of the vote classification; they only
    count votes;
  - votes on earlier versions of an edited kind-39999 original are not counted, on either page (decision 2);
  - the author's "first reaction" depends on the order in which reactions arrive — a corner case only when an
    author reacted both ways to their own item;
  - a vote read over `VOTES_LIMIT` is "couldn't check" rather than paged.
- **Firmware reinstall required?** No — no concept definitions change.

## Implementation notes

1. **`ui/src/utils/dlistScore.js`** (new) — Decision §1. It moves the code verbatim, with a comment pointing to
   `DListItems.jsx` as its first consumer.
2. **`ui/src/pages/lists/DListItems.jsx`**
   - Import the four functions.
   - Remove `isUpvote` and `isDownvote`.
   - `reactionsPerItem` becomes `reactionsByItem(reactions, itemIds)`.
   - The `trustScores` memo maps `items` through `scoreItem(item.pubkey, reactionsPerItem[item.id] || [],
     trustWeights)`.
   - `qualifiedItems` filters with `qualifies(item.score, cutoff)`.
   - Nothing else changes.
3. **`ui/src/utils/treasureMap.js`** — `VOTES_LIMIT`, `lookupItemVotes`, `weightsState`, `candidateVerdicts`,
   `CUTOFF_DEFAULT`, `cutoffStorageKey` and `readStoredCutoff` (Decision §2–§5). It imports the scoring functions
   from `./dlistScore.js`; the `.js` extension keeps Node suites resolving it.
4. **`ui/src/hooks/useItemVotes.js`** (new) and **`ui/src/hooks/useCurationCutoff.js`** (new) — Decision §2, §5.
5. **`ui/src/pages/grapevine/CuratedDListDetail.jsx`** — Decision §6. The two hooks go before the early return,
   with the rules of hooks and story 2's lookups first.
6. **`ui/src/pages/grapevine/CuratedDListItems.jsx`** — Decision §7. The Update placeholder is unchanged (story 5).
7. **`engineering-team/decisions/done/my-curated-dlists/0003-items-method-and-update.md`** — Decision §8.
8. **Local check (cycle-local).**
   - Sign in through the fetch stub as a viewer whose own assistant is `253d40c4…`, so `dog-breed` is my list, and
     turn on candidates. The two local items should show verdicts.
   - Vary Trust Determination: "Trust Everyone" gives each author's implicit upvote a weight of 1, so the score is
     1 — skipped at cutoff 2, qualifies at 1. The default Trusted Assertions, without a Treasure Map for the point
     of view, gives "couldn't check".
   - Trust Determination's settings are this browser's localStorage, so changing them is harmless.
   - Simple Lists' items page for the same list must show the same scores as before.

**Testable seams (the Tester's call, Phase 3).**
- **`dlistScore.js`** — a characterization table derived from `DListItems.jsx` `:248–347` as it stands, before the
  extraction:
  - `classifyReaction`'s table;
  - `reactionsByItem`: the first `e` only, unknown targets dropped, order kept;
  - `scoreItem`:
    - the implicit upvote at the author's weight;
    - the author's self-downvote cancelling it, with its zero rows;
    - the author's explicit `+` noted as a duplicate;
    - others ±weight, and "other" 0;
    - a null weight "unknown" with no contribution;
    - two reactions with different ids counting twice;
  - `qualifies`: inclusive.
- **Structural (Simple Lists):**
  - `DListItems.jsx` imports the four and no longer defines the inline rule;
  - its controls and cutoff default are unchanged.
- **`treasureMap.js`:**
  - `lookupItemVotes` — both sources, the merge by id, the statuses, truncation, a non-ws relay skipped, never
    rejects;
  - `weightsState`;
  - `candidateVerdicts` — checking, `unchecked` with each reason, qualifies and skipped at the boundary, the
    summary, current-id matching;
  - the cutoff helpers.
- **Structural (curation):**
  - the detail page's two hooks come before the early return, with props for own lists only;
  - the panel's lines and link;
  - the verdict cell only on candidate rows of own lists;
  - `useItemVotes` gated on the candidates switch;
  - read-only lists unchanged.
- **Re-aims:** `my-curated-dlists-items` S3's title (the panel is no longer text only).

Regression is the full `npm test`. Known reds: OPEN.md rows 191 and 261. Run single suites through
`require('./test/<name>.test.js').run()`.

## Out of scope
- Update list and its preview (story 5).
- Any change to Simple Lists beyond calling the shared functions: its Ratings Source, its publish, its breakdown
  table.
- The other vote classifiers (`DListRatings`, `DListItemRatings`).
- Counting votes on earlier versions of an edited original.
- Writing the method or the cutoff onto the header.
- The `/api/trusted-list/publish` authorization (a separate task).
