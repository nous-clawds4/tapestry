# Build Audit: Curated DList Update — the assistant copies, with a preview

**Book:** `engineering-team/audits/curated-dlist-update/book.md`
**Date:** 2026-09-17
**Branch / commit range:** `a6acca96..30b76593` on `feat/curated-dlist-update` — 52 commits, 74 files,
+14,605/−354, of which 32 files are code and tests (+6,745/−324). 12 of those files are new: two server
modules, five UI modules, five test suites.
**Provenance:** Acceptance-frame (six bullets, no PRD)
**Confidence:** high for what the branch contains — every frame bullet traces to a story with passing
tests, and the book's five suites plus the six neighbours it re-aimed are green at `30b76593` (see §5).
Low for behaviour against the public network: **no real Update has ever been published.**

> **Nothing has shipped.** `30b76593` is an ancestor of neither `origin/staging` nor `origin/main`; the
> branch is 52 commits ahead of `origin/staging` and 42 behind it. Nothing in this book is on staging,
> nothing is in production, and no event this code composes has ever reached the community relay. The
> epic stays Active for exactly that reason (§6).

> The Build Audit is the **as-built record** — what the product *is* now, factual and source-linked. It
> does not propose changes.

## 1. What shipped

- **The protocol says "copy".** `assistant-designation.md` now specifies curation by copying: the
  curated header links to the shared list with `["b", <shared header>, "pointer"]`, the curated list is
  exactly the items filed under it by `z`, a copy is the assistant's own kind-39999 item carrying NIP-18
  `q` back-references, removal is a NIP-09 deletion request, and one assistant curates a list network-wide.
  OPEN.md rows 259 and 267 are settled in the spec. `stories/done/curated-dlist-update/1-curation-copy-convention.md`.
- **New curated headers carry `pointer`, and the screens say "copy".** The header endpoint writes the
  `pointer` link, recognizes a header written with the older `inherit-items` link as existing ("older")
  instead of broken, and six user-facing strings stopped saying "inherit". "Already copied" is judged by
  `q` alone. `stories/done/curated-dlist-update/2-pointer-header-and-copy-wording.md`.
- **Another assistant's curation opens read-only, with an offer to move it here.** Every row on My Curated
  DLists opens; a list empowered for an assistant that is not mine on this instance opens through the
  curator's eyes, with Update disabled and an inline "curate it here instead" that shows the words before
  anything is signed. `stories/done/curated-dlist-update/3-another-assistants-curation-read-only.md`.
- **A curation method panel with per-candidate verdicts.** The panel names the Scoring Method and point of
  view chosen on Trust Determination, takes an editable cutoff (remembered per list in this browser), and
  shows each candidate's verdict, score and reason — decided by Simple Lists' own scoring rule, now a
  shared module both pages call. `stories/done/curated-dlist-update/4-curation-method-panel.md`.
- **Update list shows what my assistant would do.** A preview built only from reads that completed: the
  method, point of view and cutoff at the top; the items it would copy, refresh, delete and keep; the
  older header link it would upgrade; and why each candidate was skipped. Any failed or capped read makes
  it propose nothing and say what it could not check.
  `stories/done/curated-dlist-update/5-update-list-preview.md`.
- **Update list publishes what I approved.** One approval sends the plan as references (never events) to a
  new endpoint, which re-reads everything, refuses anything stale, signs as the signed-in user's own
  assistant, publishes here and to the DList relays, reads back, and reports per item and per place. A call
  answers within 45 seconds; an answer that is not the endpoint's own is reported as an unknown outcome,
  never as "nothing was published". `stories/done/curated-dlist-update/6-update-list-publishes.md`.
- **Honest relay reads, as a shared capability.** `/api/relay/external` gained an opt-in `strict=1` mode
  backed by a connect-observing reader, so a relay that refuses the connection is reported as unreachable
  rather than as "nothing there". The curation reads and the rank read use it. (Story 5.)

## 2. Epics & stories rolled up

### Epic: `curated-dlist-update` (Status: Open — retirement held until the branch merges; §6)

| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 curation-copy-convention (docs-mode) | the copy convention in the spec: `pointer` header, `copy-` d-tags, `q` back-references, NIP-09 removal, one curating assistant per list | Done | `reviews/done/curated-dlist-update/1-curation-copy-convention.md` — **2 rounds**: CHANGES_REQUESTED, then PASS (ADR 0001 Amendment 1) |
| #2 pointer-header-and-copy-wording | endpoint writes `pointer`, accepts `older`; "copy" in the screens; "already copied" by `q` | Done | `reviews/done/curated-dlist-update/2-pointer-header-and-copy-wording.md` — PASS, 1 round |
| #3 another-assistants-curation-read-only | read-only curation through the curator's pubkey; inline "curate it here instead" | Done | `reviews/done/curated-dlist-update/3-another-assistants-curation-read-only.md` — PASS round 1, then a **second round** for ADR 0003 Amendment 1: PASS |
| #4 curation-method-panel | the shared scoring module, candidate verdicts, the per-list cutoff | Done | `reviews/done/curated-dlist-update/4-curation-method-panel.md` — PASS, 1 round |
| #5 update-list-preview | strict relay reads, the pure `updatePlan`, the preview | Done | `reviews/done/curated-dlist-update/5-update-list-preview.md` — PASS, 1 round (ADR 0005 Amendments 1–2 landed mid-story) |
| #6 update-list-publishes | `POST /api/dlist-curation/update`, the events, the per-place report | Done | `reviews/done/curated-dlist-update/6-update-list-publishes.md` — **2 rounds**: CHANGES_REQUESTED, then PASS (ADR 0006 Amendments 2–3) |

Six ADRs, `decisions/done/curated-dlist-update/0001`–`0006`; 0001 and 0003 carry Amendment 1, 0005 Amendments
1–2, 0006 Amendments 1–3.

## 3. As-built inventory

**User-facing (all under `/tapestry/grapevine`).**
- **My Curated DLists** (`MyCuratedDLists.jsx`) — every empowered row is now a link; the no-assistant line
  reads "you can view these lists here but not curate them".
- **The curated list detail page** (`CuratedDListDetail.jsx`, `CuratedDListHeaders.jsx`,
  `CuratedDListItems.jsx`) — a curator lens (`mine` / `read-only`), the header's link state with an
  "(older link)" note, the **Curation method panel** (method, point of view, cutoff, per-candidate
  verdict + reason), the **Update preview** (`UpdatePreview.jsx`) and its one Publish action, the
  per-item/per-place results, and deletion-request flags with a "couldn't check" line above the table.
- **`CurateHereOffer.jsx`** — the inline offer, its refusal sentences (`no-assistant`, `kind`, `failed`,
  `missing`, `no-pointer`, `deferred`, `target`, `own`), and its two writes, each on an explicit click.
- **DList Curation panel / Treasure Map page** — "copies from", the Replace confirmation's "replaces", the
  reworded 409 sentence.
- **Simple Lists** (`ui/src/pages/lists/DListItems.jsx`) — unchanged scoring, now imported from the shared
  module; its weights warnings also reach `DListRatings.jsx` and `DListItemRatings.jsx` (§4 #13).

**New endpoint — `POST /api/dlist-curation/update`** (`src/api/dlist-curation/update.js`, registered beside
the header route in `src/api/dlist-curation/index.js`):
- **Body:** `{ list, copy: [{original, version}], refresh: [{copy, original, version}], delete: [{copy, id}], upgrade: {dropsMarker}|null }`
  — references with version pins, never events. At most **50 intents** per call (the upgrade counts).
- **Guards, in order:** Origin (host-name compare) → verified session → the *caller's* assistant key →
  body validation. 400 malformed, 403 another user's list, 413 over 50.
- **Reads:** strict, in both places (this instance's strfry and the list's relay) — my header, my list, my
  assistant's deletion requests for this call's addresses, then the shared list. Each read carries
  `limit: 500`; a failed or capped read answers **503 `{ couldntCheck }`** and signs nothing.
- **Staleness:** every intent is re-checked against those reads → **409 `{ stale }`**. A delete or refresh
  target must be one of my assistant's *copies* (carries `q`), so a hand-added item is never touched.
- **Publish:** copies and refreshes, then deletions, then the upgrade; this instance first, then each DList
  relay, at most 4 sends in flight per relay. **45-second call deadline**; a send starts only in the first
  25 s; 10 s reserved for the read-back. **200 `{ success, results }`**, per item and per place.
- **`updateEvents.js`** — pure composition: `copyD`, `composeCopy`, `composeDeletion`, `composeUpgrade`,
  `validateUpdateBody`, `itemRef`. Nothing is built from the request body.

**Relay reads.** `readRelayEvents` in `src/api/_shared/relaySource.js` (the fourth querySync-shaped helper,
deliberately not unified) and `strict=1` on `GET /api/relay/external`
(`src/api/relay/fetchEvents.js`): per-relay answers merged by id, `unreachable` listed, `success: false`
only when no relay could be read.

**Concepts, handles, firmware.** None. No concept definition changed, so **no firmware reinstall** — each
ADR records this explicitly. The only `kind:pubkey:slug` handles in play are DList coordinates
(`39998:<pubkey>:<d>`, `39999:<pubkey>:<d>`), used as addresses, not as concept handles.

**Wire format (the copy convention, ADR 0001).**
- Header: `["b", "39998:<shared author>:<d>", "pointer"]` — one `b`, never re-pointed silently; the older
  `inherit-items` value is recognized and upgraded only through Update's preview.
- Copy: kind **39999** by the assistant, `d = copy-<sha256("<my header's address>\n<the original's reference>")>`,
  exactly one `z` (my curated header), an address `q` for a kind-39999 original plus the exact version's
  `q`, then the carried tags (`name`, `title`, `slug`, `description`, `comments`, `p`, `e`, `t`, `a`).
  Never `json`, `n`, `s`, `b`.
- Removal: kind **5** deletion request by the assistant, naming every version it read (`e`) plus `a`/`k`.
- Event kinds read or written by this book: 39998, 39999, 5, 7 (votes), 30392 (trusted list), 10040
  (Treasure Map), 3 (follow list).

**Tests.** Five new suites — `curated-dlist-update-publish` (69 tests), `-curation-method` (24),
`-update-preview` (34), `-read-only-curation` (13), `-pointer-switch` (12); 152 tests, all registered in
`test/test.js`. Six neighbouring suites were re-aimed: `dlist-curation-header-endpoint`,
`dlist-curation-panel`, `dlist-curation-map-entries`, `my-curated-dlists-page`, `-headers`, `-items`.

**Spec and docs.** `protocols/drafts/assistant-designation.md` (§ "Curation copies", § "Across instances"),
`inherit-from.md`, `stamping.md`, `protocols/README.md`, `protocols/worksheet.md`, `BIBLE.md` (§25, glossary,
§ Assistant Keys), `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md` D11, plus superseded-in-part annotations on
four `done/` ADRs.

## 4. Deviations from intent

Frame bullets are quoted from `book.md`. Rationale is sourced, not re-invented.

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame B5 "Update list works, with a preview" — one capability | Split into story 5 (preview, signs nothing) and story 6 (publishes) at story 5's Planning gate, 2026-09-13 | intentional-change (operator-ratified) | epic § story 5; the preview alone was a shippable, signature-free surface | none — same capability, two gates | — |
| 2 | Frame B2 "a header published with the older `inherit-items` link is upgraded in place, shown to me before my assistant signs" | Story 2 only *recognizes* the older link; the visible upgrade lives in Update's preview and publish (5, 6) | interpretation | story 2 § Out of scope; ADR 0002 Consequences | a user on an older header sees no change until they press Update | — |
| 3 | Same bullet — which rule gates the upgrade when the `b-tag-deferred` sentinel sits beside the older link | Settled at story 6's Planning gate: the header becomes a plain `pointer` and the marker is dropped; the preview says so. No live header has this shape | interpretation (gate decision) | story 2 review Non-blocking 2 → story 6 Open questions 2; ADR 0006 §11 | none observable today | — |
| 4 | ADR 0001 as ratified: "the reference deployment no longer emits `inherit-items`" | Re-timed by **ADR 0001 Amendment 1**: the endpoint stops emitting it *with story 2*; four spec sentences corrected | constraint-discovered | story 1 review Blocking 1; Amendment 1 | none (docs accuracy) | OPEN.md row 311 |
| 5 | ADR 0003 §5: the offer checks that the curating header names a pointer | **ADR 0003 Amendment 1**: it must point at a **kind-39998** header with the **same d-tag**, else a reason and no offer; the page's write count corrected on two `done/` ADRs | added-beyond-scope (operator chose to close before merge) | story 3 review Non-blocking 1–2 | a user can no longer sign a Map entry addressing a header that does not exist | — |
| 6 | Same offer, remaining dead end (R2-2): offered for a header authored by the viewer's own assistant here, then refused by the endpoint | Closed in story 6: the offer is not made; the page says why (`own`) | deferred → resolved | story 3 review round 2 R2-2; story 6 Open questions 3 | no dead-end offer | — |
| 7 | ADR 0005 §7's order (checking → blocked) | **ADR 0005 Amendment 1**: the header decides first, so a header that leaves no shared list to read says why instead of "Checking…" forever | constraint-discovered (Test Design) | ADR 0005 Amendment 1 | AC-4 holds: the preview always says why it proposes nothing | — |
| 8 | Frame B5/AC-5: where the preview proposes nothing because a read failed, the panel says the same | **ADR 0005 Amendment 2**: the panel waits for my list and names its gaps — otherwise a failed read of *my* list left a complete-looking "N of M" beside a preview proposing nothing | constraint-discovered (Implementation gate) | story 5 Deviations; Amendment 2 | the two surfaces can no longer disagree about completeness | — |
| 9 | ADR 0006 §2: a delete's or refresh's target is "my assistant's item"; no read limit named | **ADR 0006 Amendment 1**: the target must carry a `q` (a copy), so Update never touches a hand-added item; every server read carries `limit: 500`, and a 500-long answer is capped → 503 | constraint-discovered (Test Design) | ADR 0006 Amendment 1 | hand-added items are safe from Update | — |
| 10 | ADR 0006 §6: a call "stays well inside nginx's 60-second proxy timeout" | **ADR 0006 Amendment 2**: a real 45-second deadline, a 25-second send cutoff, "not sent: out of time" per place, an **unknown-outcome** state in the page, and the deletion-request read narrowed to this call's addresses | constraint-discovered (Review round 1, Blocking 1) | story 6 review round 1; Amendment 2 | the page can no longer say "Nothing was published." after the server published | OPEN.md rows 299, 301 |
| 11 | Amendment 2's rule: 400/401/403/413 count as refusals *with the endpoint's body* | **ADR 0006 Amendment 3**: **any** 4xx is a refusal, whatever the body — the auth middleware answers a body-less `401 { error }` before the handler | constraint-discovered (Test Design round 2) | Amendment 3 | an expired session no longer reads as "some changes may have been published" | the endpoint must keep answering every 4xx before it signs |
| 12 | Frame B6 "A failed or incomplete read never proposes a deletion" | Required a capability the frame never named: `strict=1` on `/api/relay/external` plus `readRelayEvents`, because the existing endpoint answered an unreachable relay as an empty success | constraint-discovered | OPEN.md row 314 (from story 4's Test Design gate); ADR 0005 §1 | verdicts say "couldn't check", not "skipped" | row 314 stays open for the endpoint's other, non-strict callers |
| 13 | Frame B4 "Which community items qualify is decided the way the Simple Lists panel decides it" — and Simple Lists' own behaviour unchanged | Behaviour did move, twice, in the honest direction: (a) a rank provider slower than ~5 s now reads as **failed** (weights null + warning) where the non-strict read silently took a partial answer; (b) the two new weights warnings now also render on `DListRatings.jsx` and `DListItemRatings.jsx` | interpretation (recorded here at the reviewer's ask) | story 5 review Non-blocking 1–2, "record in the book's audit"; ADR 0005 §5's "scores don't move" holds only for its two named cases | Simple Lists users may see a warning where they previously saw silently partial numbers | — |
| 14 | Same bullet — "moved verbatim" | One intended behaviour change in the shared module: a reaction whose first `e` tag names an inherited property (`__proto__`, `constructor`) used to crash Simple Lists' page and is now ignored | intentional-change | story 4 Deviations; `dlistScore.js` header | a crafted reaction can no longer blank the page | — |
| 15 | Frame constraint "Deletions need relays that honor them … checked before Update relies on it" | Checked by NIP-11 survey, not by a write: this instance's strfry is 1.1.0 (honors `e` and `a`); **the community relay is strfry 1.0.4 and honors only `e`**. Deletions therefore name every version read; a place that still shows a copy is flagged | constraint-discovered | ADR 0006 §10 | an older version replayed to the community relay is accepted again | OPEN.md row 297 (that relay's upgrade, for its operator) |
| 16 | Frame B6 "The method, point of view and cutoff are not written onto the header" | Honored. They live per browser: the method and point of view on the Trust Determination page, the cutoff in `localStorage` keyed by the curated header's coordinate | as specified (known constraint) | book § Known constraints; ADR 0004 §5 | two browsers can propose — and publish — different plans | a Trust Determination Methods concept (a future book) |
| 17 | Frame B6 "Nothing runs on a schedule" | Honored — Update runs only on a press, one approval per preview | as specified | epic § Settled at kickoff | — | a schedule is future work |
| 18 | ADR 0005 §2: the preview's header state comes from the non-strict `useCurationHeaders` read | Story 6 re-reads the header (and every input) for the current epoch before signing; `useListItems` now reports `loading` until the current key's read is in | deferred → resolved | story 5 review Non-blocking 4; story 6 Deviation 8 | a signature is never composed from a read taken before the press | — |
| 19 | ADR 0006 §2: the deletion-request read | Narrowed on the server to this call's addresses (Amendment 2); **the page's own read is unchanged** — every deletion request the assistant ever sent for a kind-39999 item, capped at 500 | deferred | story 6 review round 2 Non-blocking 8 | past 500 requests the page's "deletion requested" flags may be incomplete; Update itself is unaffected | OPEN.md row 299 |
| 20 | — (not in the frame) | The server reads the list's relay from the `aDListRelays` setting; the preview reads a constant. Both default to the same relay | constraint-discovered | story 6 review round 1 Non-blocking 3 | an operator who changes the setting makes every Publish answer 409; fails safe | OPEN.md row 300 |
| 21 | — (not in the frame) | The 45-second deadline is a *composition*: the read phase is bounded by `relaySource.js`'s own constants (~30 s), not by the handler's clock | constraint-discovered | story 6 review round 2 Non-blocking 1 | none today; raising those constants would silently break the bound | OPEN.md row 301 |
| 22 | — (pre-existing, surfaced here) | A deactivated customer's assistant can still sign through both curation endpoints (`getCustomerRelayKeys` never checks status) | constraint-discovered (not introduced) | ADR 0006 Consequences | a deactivated account retains a signing path | OPEN.md row 295 |
| 23 | — (pre-existing, surfaced here) | The Origin guard compares host names, not host and port, because nginx forwards `Host` without the port | interpretation | story 6 Deviation 1; review round 1 Non-blocking 2 (pointer-level) | none against a foreign site; the residual is the panel's CORS and cookie posture | the CORS/cookie hardening task (staging's OPEN.md row 276) |
| 24 | Frame B1 "OPEN.md rows 259 and 267 are settled in the spec" | Both settled; row 267 needed **no protocol change** — other instances show the curation read-only and offer to curate here | as specified | epic § Settled at kickoff; ADR 0001 §8 | — | — |
| 25 | Story 4's read-only page accepted four silent-incompleteness paths and a URL ceiling | Story 5 closed the reachable ones (strict reads, batched votes, capped answers reported, weights that fail). Two remain: the Trusted List read by d-tag from any author, and the rank read's single-GET ceiling at roughly 110 pubkeys | deferred | epic § story 5 carry-forward; ADR 0005 Consequences | a large instance's rank read fails honestly rather than silently | §6 |

**Undocumented work.** **None at file level** — every one of the 32 changed code/test files is named in a
story or an ADR of this book, and the hunk-level extras are each logged in a story's `## Deviations`
(story 1's `inherit-from.md` scope clause; story 2's `TreasureMapTagsPanel.jsx` comment and the retained
BIBLE §25 link; story 3's `explainClosed` → `explainReadOnly` rename and the headers module's comment;
story 4's six interpretation calls; story 5's eleven; story 6's twenty-four). Two bookkeeping gaps, both
docs-only:
- `engineering-team/epics/curated-dlist-update.md` § Decisions lists ADRs 0001–0005; **the ADR 0006
  bullet was never added**, though story 2 set the convention of adding one per ADR (story 2 Deviations).
- The epic's story-5 entry still carries story 6's planning notes as "carry-forward", which is accurate
  history but now reads as open work.

## 5. Quality state at close

**Nothing has shipped.** No staging deploy, no production promotion, no published event. Every result
below is from this machine and this branch.

- **Suites I ran myself at `30b76593`, each through its `run()` export** (single-suite runs only — a full
  `npm test` leaves fixtures on the shared local stack, OPEN.md rows 293–294):

  | Suite | Result |
  |---|---|
  | `curated-dlist-update-publish` | 69 passed, 0 failed |
  | `curated-dlist-update-update-preview` | 34 passed, 0 failed |
  | `curated-dlist-update-curation-method` | 24 passed, 0 failed |
  | `curated-dlist-update-read-only-curation` | 13 passed, 0 failed |
  | `curated-dlist-update-pointer-switch` | 12 passed, 0 failed |
  | `my-curated-dlists-items` / `-headers` / `-page` | 23 / 16 / 19 passed, 0 failed |
  | `dlist-curation-header-endpoint` / `-panel` / `-map-entries` | 29 / 18 / 14 passed, 0 failed |

  271 tests across 11 suites, 0 failures. `bash scripts/harness-lint.sh` → **clean (0 violations)**, with
  the tree's standing waivers only.
- **The recorded full run** (story 6 Deviation 24, at `f0abfb3c`, 2026-09-17): this book's suites pass —
  publish 69/0, update-preview 34/0, curation-method 24/0, pointer-switch 12/0, read-only 13/0 — and the
  neighbours pass (header endpoint 29/0, panel 18/0, map entries 14/0, merge-preserve 16/0, TL panel 19/0,
  My Curated DLists page 19/0, headers 16/0, items 23/0). 56 tests skipped, as in round 1.
  **Known reds, unchanged and none of them this book's:** OPEN.md row 191's four (three `trusted-lists`
  `L0 GUARD` refusals plus the refused prune, because this machine publishes externally by the operator's
  choice) and `summaries-element-count` L5 (red in the pre-change baseline; its ledger row is staging's
  285, which arrives with the merge — this branch has no row for it). `most-pinned-tag-index-publish` is
  flaky here by fixture build-up (row 293).
- **This branch had no gate recorder at the close** (the 2026-09-17 staging merge brought it, hours later). `npm run gate:status` and `engineering-team/README.md` §
  "Running and reading the test gate" exist on `origin/staging`, 42 commits ahead; no run on this branch
  can quote a `gate:status` line, so the records above are prose (OPEN.md row 298).
- **Close-time gate:** full `npm test` over the closed tree (`30b76593` plus this close's docs), 2026-09-17,
  run after the book flip and the epic decision as step 10 requires. Exit 1, on **exactly the known reds and
  nothing else**: OPEN.md row 191's four (three `L0 GUARD` refusals and the refused prune, because this
  machine publishes externally by the operator's choice) and `summaries-element-count` L5. Every suite of
  this book passes — publish 69/0, update-preview 34/0, curation-method 24/0, pointer-switch 12/0, read-only
  13/0 — as do its neighbours: header endpoint 29/0, panel 18/0, map entries 14/0, merge-preserve 16/0, TL
  panel 19/0, My Curated DLists page 19/0, headers 16/0, items 23/0. `most-pinned-tag-index-publish` passed
  (7/0, 1 skipped; row 293's flakiness). 111 suites reported, 55 tests skipped. The branch still has no
  `gate:status` line to quote (row 298), so this record is prose.
- **Live checks that were possible, and were done** (per story, by the Implementer and the Reviewer,
  through the fetch stub against the local container): the read-only page and every refusal sentence; the
  offer's words with nothing sent; the method panel's verdicts against both scoring methods and three
  cutoffs, with Simple Lists byte-compared before and after; the preview's four incomplete-read shapes;
  the endpoint's live guards from inside the container (foreign `Origin` → 403, no session → 401); and
  each publish answer shape (published, partial, stale, couldn't-check, 504-unknown, middleware 401,
  out-of-time) rendered with the stub answering.
- **Live checks that were NOT possible.**
  - **A real Update has never been published.** It writes public events to the community relay, so it
    needs the operator's OK (ADR 0006 §10). **The first real Update is still the live test that the relay
    honors kind-5 deletions** — the read-back reports `gone` or `still-there` per place and the page flags
    the rest, so the design fails visibly rather than silently, but the behaviour is unobserved.
  - A real **Add** or **Replace** through the header endpoint: both need a signature-verified NIP-07
    session, which no automated role has (story 2 review, Harness friction 1).
  - The local `a`-form deletion on a scratch stack (ADR 0006 §10, optional): ruled out — no Docker in the
    implementation brief.
- **Accepted bugs and debt this book logged** — OPEN.md rows **276–280** and **292–301**: the
  run-a-suite-directly gotcha (276), three harness-doc defects (277–279), the unreachable-relay-reads-as-
  empty endpoint (280), the presence probe's EOSE gap (292), the tag-index fixture build-up and the
  Reviewer's full-run cost (293–294), the deactivated-customer signing path (295), the header endpoint's
  local-only never-clobber read (296), the community relay's strfry 1.0.4 deletion support (297), the
  absent gate recorder on this branch (298), the page's growing deletion-request read (299), the two
  relay sources (300), and the deadline's composition (301). ADR-recorded debt beyond those rows: copies
  are snapshots refreshed only by their curator (0001); the two `b` type names live in two modules
  (0002); the offer repeats the panel's sign-and-publish sequence and own lists still read items at the
  community relay rather than the Map entry's hint (0003); `DListRatings`/`DListItemRatings` keep their
  own vote classification, and votes on earlier versions of an edited kind-39999 original are not counted
  (0004); a relay whose own limit is below ours still answers a capped read as complete, and the rank
  read's GET ceiling (0005); no rate limiting, and per-browser settings (0006).

## 6. Carry-forward register

- [x] **Merge chores — done at the 2026-09-17 staging merge,** immediately after this close. This book's
      colliding rows were renumbered and every citation repointed:
      - **276–280 → 310–314:** the run-a-suite gotcha, the three harness-doc rows, and the unreachable-relay
        row. `origin/staging` holds five different items at 276–280 (the auth-hardening follow-ups, the
        deploy-skill gap, the public-branch disclosure, the sandbox-security retirement, and the empty
        `node_modules` mountpoint), and those stay as they are.
      - **304–305 → 315–316,** for the reason the next bullet records.
      - **Repointed in:** the epic, stories 1, 5 and 6, all six reviews, ADRs 0005 and 0006, this audit, and
        `test/curated-dlist-update-update-preview.test.js`, whose D2 docs test matches its row **by number**
        and so had to move with it. Citations that mean *staging's* rows were left alone.
      - **rows 292–309 were minted on this branch, and the collision has already started.** Hours after they
        were filed, at this close, `origin/staging` moved to `e9f4ec61` and now carries **its own 304 and
        305**, so two of this book's new rows collide as well. 292–303 and 306–309 are clear only until
        staging mints again. Rows 295–309 were numbered defensively for exactly this reason (row 307).
      - Citations to repoint live in: the epic, stories 2/3/4/5/6, all six reviews, ADR 0005/0006
        Consequences, this audit, and OPEN.md's own cross-row references (row 207's rule).
- [x] **Epic retired 2026-09-18,** once PR #668 merged the branch into `staging` — the condition
      `workflows/6-book-close.md` step 9 names. Status **Done**, the story/ADR/review folders moved under
      `done/curated-dlist-update/`, and the `L2` waiver dropped.
- [x] **Done with the retirement, 2026-09-18: the docs tests were repointed in the same commit.** 36 files
      carried a path into the moved folders — the five suites among them, plus `OPEN.md`, two `done/`
      ADRs of the previous book, `protocols/drafts/assistant-designation.md`, and two source-file headers.
      Two line-wrapped row citations that the renumber's single-line patterns had missed were caught here
      too. The original note follows, since it is the concrete instance of row 312.

      **When the epic's folders move under `done/`, story 6's suite breaks.**
      `test/curated-dlist-update-publish.test.js` reads this epic's artifacts by path in its D-class docs
      tests (the ADR, its amendments, the story, the test plan). Repoint them in the same commit as the
      `git mv`. **Check the sibling suites for the same pattern** — `curated-dlist-update-update-preview`,
      `-curation-method`, `-read-only-curation` and `-pointer-switch` each carry docs tests too, and
      `harness-lint`'s own suite walks `engineering-team/`. This is the concrete instance of OPEN.md row
      312 (full-path ADR citations break at retirement).
- [x] **The first real Update** — **done 2026-09-18**, on staging, with the operator's OK. Six synthetic
      accounts ran a user story on a new shared concept (`dog-tricks`): one expert declared it and authored
      five items, two co-experts upvoted four, and two adopters pressed Update. At the shipped default cutoff
      of 2 the first adopter copied four of five; at cutoff 1 the second copied all five. Four Updates were
      published in all — copies, a deletion and a refresh — each to this instance and to the community relay.
      What it settled: **kind-5 deletion works** — a copy the method stopped accepting was gone from dcosl
      (strfry 1.0.4, so the `e` form) and from staging's strfry on an independent relay read, not merely
      reported gone (row 297 now carries the evidence; that relay's upgrade closes the replay gap, it does not
      unblock removal). Copies match ADR 0001 exactly (one `z`, `q` = address + version id, a `copy-` d-tag,
      no `json`); a refresh replaces in place at the same address with the new version pinned; a deleted
      copy's original returns to the candidate pool and is re-judged; a repeat Update is idempotent; and a Map
      entry whose relay hint is unreachable **blocked the whole plan**, with the verdicts `incomplete` rather
      than "skipped", though the items were readable locally. The read-only path and "curate it here instead"
      were confirmed for a list whose Map names another assistant, and a real `inherit-items` header plans as
      exactly one `upgrade` intent. **Not covered:** the rendered preview — the run drove the shipped planner
      (`lookupListItems` → `candidateVerdicts` → `updatePlan` → `planIntents`) and the endpoint directly, not
      the page. New rows: 323 (votes sum rather than supersede), 324 (the panel offers an Add that can only
      409).
- [ ] **Non-strict callers of `/api/relay/external`** still read an unreachable relay as empty (row 314),
      and the Treasure Map presence probe still reads a silent relay as "absent" (row 292).
- [ ] **The two remaining silent-incompleteness paths**: the Trusted List read by d-tag from any author (a
      separate task, shared with Simple Lists), and the rank read's single-GET ceiling near 110 pubkeys.
- [ ] **Throttling for large lists** — at the 500-item ceiling one preview opens roughly 13 connections at
      once; send the vote chunks two or three at a time if large lists appear (story 5 review Non-blocking 3).
- [ ] **A schedule for Update**, and **a Trust Determination Methods concept** the header can point at, so
      the method, point of view and cutoff stop being per-browser (both named as future work at kickoff).
- [ ] **Docs bookkeeping** (§4 Undocumented work): the epic's § Decisions is missing its ADR 0006 bullet.
- [ ] **Security follow-ups** inherited rather than introduced: the deactivated-customer signing path (row
      295), the header endpoint's local-only never-clobber read and status-only relay classification (row
      296), and the Origin/CORS/cookie posture (staging's row 276 task).

## 7. Process findings (harness)

**Retro basis — `bash scripts/harness-stats.sh` at `30b76593`:** phase commits **1094**
(story 219 / adr 199 / test 207 / impl 208 / review 261), of which **44 are this epic's** — the largest
attributed epic after `profile` (88), ahead of `harness-self-improvement` (41) and `dlist-curation` (40).
Reviews parsed **215**, final PASS **213**, final CHANGES_REQUESTED **2**, headline kick-back rate **0%**
(CR-final ÷ decided), reviews with kick-back history **40**, re-review churn **3**. Books: **6 open, 47
closed**; this one open **6d**. Cycle-time median **0d**, matched 190 of 241 stories. Direction-mode gates:
approve 94, kick-back 14, halt 6.

| Finding | Source | Terminal state |
|---|---|---|
| **Running a suite file directly can exit 0 without running a test.** 91 of 198 suites have no `require.main` block; six reported a phantom pass in story 1's regression loop. | story 1 Deviations; review 1 Harness friction 4 | **OPEN.md row 310** (filed) |
| **An ADR can prescribe present-tense deployment status that only a later story makes true.** Story 1's AC-7, ADR 0001 §9 and notes 2/4/10 all shipped "no longer emits" while the endpoint still emitted. | review 1 Harness friction 1 | **OPEN.md row 311** (filed) — candidate fix is a line in the Architect's docs-mode guidance and the ADR template |
| **Retiring an epic breaks full-path ADR citations made from outside its folder.** This book added three more that break at retirement. | review 1 Harness friction 2 | **OPEN.md row 312** (filed) — and §6 carries the concrete instance (the story-6 suite's docs tests) |
| **The review template's docs-mode note contradicts 0-intake §3** for storied docs-mode reviews. | review 1 Harness friction 3 | **OPEN.md row 313** (filed) |
| **Nobody owns the live checks a test plan delegates, and half of them cannot be done by any automated role.** The test plan hands rendering and a real Add to "the reviewer's live check"; ADR 0002 hands the same check to the Implementer; the review brief marks live checks optional. A check needing a NIP-07 signature can be done by no automated role at all. Nothing fell through here. | review 2 Harness friction 1 | **OPEN.md row 302** — the test-plan template's "Not covered" items name an owner; the review template gains a "Live checks the test plan delegates (run / not run, why)" line; signature-needing checks are marked *operator only* |
| **Reusing the Tester's satisfiability sketch as the implementation leaves tests and code with one author.** Story 3 copied the sketch in unchanged, so Implementation added no independent reading of the ADR, and the suite could not catch what both missed (its Non-blocking 1 passed every test). Stories 4–6 deleted the sketch and used a separate Implementer agent in its own worktree, which surfaced real interpretation gaps — but by habit, not by rule. | review 3 Harness friction 1; review 4 Harness friction 1; stories 4/5/6 Deviations | **OPEN.md row 303** — when row 264 (the sketch proposal) is adopted, require the sketch to be deleted before Phase 4 and the Implementer to work from the ADR in a fresh context; if a sketch is ever reused, the review brief must flag the tests as co-authored |
| **When a page pre-checks a server call, nobody lists that call's refusals.** The endpoint's refusal list is the checklist for what the page can decide in advance; no phase walked it, so round 1 shipped a dead-end offer (R2-2) and Amendment 1 closed only one of its two causes. | review 3 round 2 Harness friction 1 | **OPEN.md row 315** — the Architect or the Tester enumerates the server call's refusals and says, for each, whether the page decides it or leaves it to the error path |
| **The Reviewer's wiring tells it to commit and to flip the story's status, against a brief that reserves both for the orchestrator.** `.claude/agents/reviewer.md:30,:38` and `.claude/commands/review-changes.md:32,:35` say flip-and-commit; every brief in this book said do neither. Three reviews recorded the conflict. | review 3 Harness friction 2, round 2 Harness friction 2 | **OPEN.md row 316** — the wiring gains "unless the caller reserves the commit and the status flip"; corroborates row 80(a), since a review's candidate ledger rows live only in the review file until someone writes them |
| **A plain `cd` into an agent worktree pins the whole orchestrating session there.** Story 4's Implementation commit was made inside the Implementer's worktree and fast-forwarded onto the book branch (linear, with the operator's OK). No ledger row exists. | review 4 Harness friction 2 | **OPEN.md row 306** — the cycle guidance says to reach a worktree only through `git -C <path>` and absolute paths, never `cd` |
| **This book's OPEN.md rows collide with staging's numbering.** The book reserved from 271 at kickoff; staging minted its own 276–291 meanwhile. Measured today: 276–280 collide, and 292–301 are only provisionally clear. | review 4 Harness friction 3; §6 | **OPEN.md row 307** — mint a book's rows on staging first through a small docs PR, or keep one reservation line in OPEN.md's header on staging. (The renumbering itself is the merge chore in §6, not a harness change.) |
| **The Reviewer role's mandatory full `npm test` now costs the shared local stack.** Every full run leaves two pinned fixture tags; 183 of the tag index's 200 rows are now fixtures, which failed `most-pinned-tag-index-publish`. Reviews of stories 4, 5 and 6 skipped the re-run on their brief's word, not by a rule. | review 5 Harness friction 1; story 5 Deviations | **OPEN.md rows 293 and 294** (filed) — until the teardown lands, a review rests on a recorded full run at the same code plus every suite that reads a changed file |
| **The Reviewer's instructions can be newer than the branch under review.** The skills and agent definitions load from the main checkout (staging-based) and ask for a `gate:status` quote this branch cannot produce. | review 6 Harness friction 1 | **OPEN.md row 298** (filed) |
| **`test/test.js` prints two suites on one output line**, so a per-line count reads 167 where 168 passed — one source of the count gaps seen in three of this book's runs. Verified still present at `test/test.js:1079–1082` (`tag-actions-menu-ui` and `tagging-raw-event-inspector-ui` in one `console.log`). | review 3 round 2 Harness friction 3 | **OPEN.md row 308** — the registry cleanup this book owes; a two-line split, but it touches the shared gate file and belongs in its own commit |
| **The retro's own instrument under-counts in-file rounds.** `harness-stats.sh` reads only the last verdict token, so this book's two CHANGES_REQUESTED rounds (stories 1 and 6) leave the headline kick-back rate at 0%; and churn counts *files*, so rounds kept as sections in one review file — this book's convention, four times — are invisible. Only "reviews with kick-back history" (40 of 215) sees them. | this close's retro, against `scripts/harness-stats.sh:65–95` | **OPEN.md row 309** — either count round headings inside a review file, or rename the headline so it reads as "final-verdict rate" and promote the kick-back-history line |
| Full runs take 46–48 minutes on this machine, against a brief that expected about 10. | review 2 Harness friction 3; review 3 Harness friction 4 | **declined** — it is a measurement, not a defect; the cost half is already row 294 and the live TL suites are its cause |
| CLAUDE.md's House rules still say the repo is bind-mounted into the container; every story had to sync `src/` or the UI build by hand. | reviews 2, 3, 5 Harness friction (corroborations) | **declined (already tracked)** — OPEN.md rows 198, 226 and 253 hold it; no new row |
| A `git archive` snapshot for the tests-fail-first check must include the root docs, or a docs test fails on the pre-change snapshot for an unrelated reason; and this shell has no `timeout`. | review 3 Harness friction 4 (informational) | **declined** — both are local technique, recorded in the review where the next reviewer of this suite will meet them |

**Ratified by the operator at the close gate, 2026-09-17** — the eight new rows and the three declines stand as recorded.

**Does it port to the other flow?** Every finding above is phase-agnostic except the Reviewer-wiring
conflict, which is specific to orchestrated (subagent) runs; a Direction-mode book would hit it through
the same agent definitions and should take the same fix. The sketch-authorship and refusal-enumeration
findings both bear on Direction mode's blinded judging, where a co-authored test suite would weaken the
judge's evidence in the same way it weakened this book's story-3 review.
