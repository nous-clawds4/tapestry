# Review: Story 1 — Browse a DList with header-driven item fields

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-09
**Diff:** `git diff a9906c86~1 9bf005eb` (commits a9906c86 story → 8f5fce93 design → 15425522 test → 9bf005eb impl) on `feat/dlist-item-tagging`
**Profile:** Light (trial) — Gate B, full rigor. Tier assigned after writing: **full-depth** (new user-facing surface, six new files, not a mechanical change).

## Quality gates (run by reviewer, not trusted)

| Gate | Command | Result |
|---|---|---|
| Scoped gate — story suite | `BRAINSTORM_BASE_URL=http://localhost:8778 direnv exec . node -e "require('./test/dlist-browse.test.js').run()…"` (brace-redirect, exit captured) | **23 pass / 0 fail / 0 skipped, EXIT=0** — U1–U12, S1–S6, R1–R5 all green |
| Scoped gate — guard suite | same for `test/strfry-write-assertion-bracket.test.js` | **6 pass / 0 fail, EXIT=0** |
| Lint | `direnv exec .. npx eslint` (from `ui/`) on the 5 new files + `App.jsx` | **0 problems, EXIT=0** |
| Full `npm test` (discretionary under Light) | `BRAINSTORM_BASE_URL=http://localhost:8778 direnv exec . npm test` | See "Full-suite result" below |
| Browser (headless Chromium vs :8778, built `dist/`) | own probe script (copied to repo root, run, deleted) | see evidence table — **zero `pageerror` / console errors** across 7 navigations |
| Typecheck / build tooling | _Not configured — skipped (house rule: none added)._ | — |

### Full-suite result
`Overall: FAIL` (EXIT=1, ~35 min wall-clock, 82 skipped). **`dlist-browse suite: PASS (23 passed, 0 failed, 0 skipped)`** — the suite this diff registers is green inside the full run. Twenty other suites report failures; all are **pre-existing and unrelated to this diff**, attributed as follows:
- `harness-lint` (2 failed) — the only lint violation is `L11 CLAUDE.md — 212 lines, cap 190`; that is the *uncommitted* local `CLAUDE.md` edit (HEAD is exactly 190 lines, the cap). Run directly (`scripts/harness-lint.sh`): the new review file, the Done-flipped story, the book and epic files produce no violation.
- `tag-detail`, `tl-publication-from-pins`, `most-pinned-tag-index-publish`, `recognizable-published-ta-profile` — server-side `/api/profile-tags`, `/api/trusted-list` and TA-profile contracts (`by-id tag.rawEvent …`, `refresh-pinned-tag rejects an unauthenticated call`, pin-count publish flows); this diff touches no `src/` file (`git diff a9906c86~1 9bf005eb --stat -- src/` is empty).
- `open-ranking-rank` / `open-ranking-followers-muters` — `C2: the REAL open-ranking SDK validateCapabilities()` (external SDK / network).
- `capture-a-goal-and-see-it`, `structures-the-brain-can-trust`, `break-a-goal-into-pieces`, `attach-the-world`, `sessions-read-the-brain`, `the-proposal-loop`, `teach-it-what-matters`, `the-brain-survives`, `operational-direction`, `store-the-four`, `return-the-four`, `show-the-four` — the `/api/brain/*` suites (goal/hygiene/host-side 401/403 gates); live-graph and auth-middleware dependent, no overlap with `ui/src`.

Per Light, the full suite is not this story's judge gate; it is recorded here as the regression check the reviewer chose to run. Nothing in it moved because of this diff.

## Gate-A classification — ratified

**Design note (not ADR) — ratified.** Walked the irreversibility triggers in `workflows/light-profile.md` § Gate A against the diff: no wire format or event shape is *written* (the util only reads `required`/`optional`/`recommended`/`allowed`/`field-type`; the `field-type` convention is logged as worksheet W17 rather than ruled on); no auth/trust default (rendering is POV-agnostic, every author visible — principle 2); no schema or firmware change (no concept definitions touched, no reinstall needed); no new dependency (`nostr-tools`/`nip19` and `react-router-dom` are existing UI deps); no cross-repo contract; no server routing/middleware/headers (two client-side routes only; `src/` untouched — verified `git diff … --stat -- src/` is empty); no value that exists in more than one repo. The note names modules/endpoints concretely, names two real rejected alternatives, and its blast radius matches the diff except for one stray file (finding N-2).

## Evidence table

| # | Claim | How verified | Result |
|---|---|---|---|
| E-a | `/list/39998%3A<pk>%3Agithub-accounts` (encoded coord, the form `/lists` links to) renders | headless probe | 7 rows, 7 `github.com` links, `github-username *` header, "Showing 7 of 7" |
| E-b | `/list/naddr1…` (naddr encoded by `nip19.naddrEncode`) renders the same list | headless probe | 7 rows, 7 links, same header block |
| E-c | `/list/39998:abc` (malformed) → AC-7 message, no crash | headless probe | "This list is not on this relay." + echoed ref; no errors |
| E-d | `/list/39998:111…1:nope` (absent header) → AC-7 message | headless probe | same message; no errors |
| E-e | `/lists` index lists every header on local strfry with count | headless probe + `strfry scan --count '{"kinds":[9998,39998]}'` | index emits 284 `/list/…` hrefs; relay holds **284** headers; `github-accounts` shows "7 items" (relay `#z` count = 7) |
| E-f | Index row click → list page | headless probe | lands on the encoded URL, 7 rows |
| E-g | Paste box with an naddr → navigates to the coordinate form | headless probe | `/list/39998%3A…%3Agithub-accounts`, 7 rows |
| E-h | Header author + names + description shown | headless probe | "GitHub Accounts / One item is a GitHub Account — A list of github handles/accounts / list by Avi Burra · `39998:…:github-accounts`" |
| E-i | Operator `/tapestry/lists` pages byte-identical | `git diff … --stat -- ui/src/pages/lists/` empty; R1–R3 green | untouched |
| E-j | `test/test.js` conjunction | diff: `dlistBrowseResult.fail === 0 &&` added to `overallOk`, summary line + skipped-reduce entry added | wired |
| E-k | No TA-pubkey literal in new UI files | S6 + own grep | none (fixture `HEADER_PK` in the test is the list author, not the TA — allowed) |
| E-l | Scan endpoint honors `until`/`limit` for paging | `scan.js:81-84` passes the filter to `strfry scan` verbatim and stops at `limit`; `SCAN_MAX_EVENTS = 20000` | paging filter reaches strfry unchanged |
| E-m | `item-counts` key == `headerCoord()` output | `itemCounts.js:65-71` builds `39998:<pk>:<d>` / `ev.id` — identical composition | keys match (and E-e confirms live) |

## AC verdict table

| AC | Handles | Test result | Independent check | Verdict |
|---|---|---|---|---|
| AC-1 names/description/author by coordinate | U1, U3, S3, S4, S5 | pass | E-a, E-b, E-g, E-h | **Met** |
| AC-2 every `#z` item, one row, author + age | U2, S1, S2, S4 | pass | E-a (7 of 7, `#z` count = 7), avatars/names resolved | **Met** |
| AC-3 one column per declared field, header order, required marked, "missing" mark | U4, U7, U12, S1, S2, S6 | pass | E-a shows `github-username *`; `is-required` styled `var(--text)` vs muted; `bs-dlist-missing` span | **Met** |
| AC-4 unknown type → text; github-username → link | U4, U9, U10, U7, S2 | pass | E-a: 7 `https://github.com/<handle>` anchors, `target=_blank rel=noreferrer` | **Met** |
| AC-5 bounded first page, "showing N of M", unknown ≠ 0, next page | S4, R4 | pass | `List.jsx:119-120,166-171`; E-l; no >50 list on the relay to exercise paging live — static reasoning only (see N-3) | **Met** (paging behavior not browser-verified; stall edge noted) |
| AC-6 index reaches every header with name + count | S3, S5 | pass | E-e: 284/284, counts joined | **Met** |
| AC-7 absent header → plain message, no crash | U1, U12, S4 | pass | E-c, E-d; also `parsed === null` short-circuit at `List.jsx:66` | **Met** |
| AC-8 kind-7 counts still visible | U11, S2, S4, R1 | pass | E-a shows `▲0 ▼0` per row; operator page untouched (E-i) | **Met** |

## Spec adherence
- [x] Every acceptance criterion has a passing test (table above).
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story — with two small exceptions logged under Deviations by the Implementer ("(scan was bounded)" suffix; `hasMore` rule) that are refinements of AC-5, not new features. One out-of-story file is in the diff (N-2).

## ADR / Design-note adherence
- [x] Files changed match the note's blast radius — `App.jsx`, `styles.css` (append-only, verified), `test/test.js`, plus the six new files. Extra: `.envrc` (N-2), `OPEN.md` row 252 (renumbered at the staging sync) and `protocols/worksheet.md` W17 (both harness/spec bookkeeping the note itself calls for).
- [x] Layering respected: `DListItemsTable`/`DListItemRow` have no fetch/route knowledge (S1 asserts it and the source confirms); pages own fetching; util is React-free ESM.
- [x] No new dependencies.
- [~] `parseFieldDecls` omits the note's `description` key — Implementer deviation; the stated justification is wrong (N-1) but the omission has no AC impact.

## Concept-graph integrity
- [x] No concept handles are composed by this diff; the story's "Concepts touched" is orientation only. No `kind:pubkey:slug` handle is built or parsed in the new code.
- [x] No concept definitions changed → no firmware reinstall needed.
- [x] New code reads NIP tags on list events, not concept definitions — `/summaries` orientation is N/A for this surface.

## Things tests can't catch
- [x] No secrets in committed files (`.envrc` is `use nix`, one line).
- [x] No leftover debug logging / `console.log` in the new UI files.
- [x] No commented-out code.
- [x] Error paths: header lookup, items scan, item-counts, kind-7 scan each caught; `parseListRef` never throws (U1/U12 + E-c).
- [~] Concurrency: `loadVotes` is unguarded (N-4) — benign for `voteCounts`, mildly wrong for `votesFailed`.
- [x] Security: the only constructed URL is `https://github.com/<handle>` behind a strict handle regex (U9); `target=_blank` carries `rel=noreferrer`; all header/item strings render through React text nodes / attributes (escaped); the scan filter is JSON → argv, no shell.

## House rules check
- [x] Concept Graph API authority respected (nothing re-derived from BIBLE).
- [x] No new lint/typecheck/build tooling. (`.envrc` is a direnv hook for the existing `shell.nix`, not tooling — but see N-2.)
- [x] TA pubkey: no literal (S6); `Avatar` resolves its own config.

## Probes requested at Gate B (answers)

1. **`loadVotes` without a `cancelled` guard.** Real but low-impact. `List.jsx:43-60` — `setVoteCounts` merges by item id, so a stale page's counts landing in the new page's map are inert (rows key by `item.id`; an id shared across two lists would carry identical reactions anyway). The one observable wrong outcome: a stale scan that *rejects* after route change flips `votesFailed` to `true` on the new page, and nothing ever resets it, so a healthy page shows `—` in every vote cell. Same latch: after `loadMore`, a page-1 failure keeps page-2 votes at `—` even when page 2's scan succeeded. Non-blocking (N-4).
2. **"One item is a GitHub Account — …"** Taste, not defect: AC-1 asks for singular + plural + description and all three are on screen. The sentence is grammatical but reads like a schema note; "Each item is a GitHub Account" or dropping the frame and printing the description alone would read better. Non-blocking (N-6).
3. **Undeclared item tags hidden (E1).** The E1 reading is right for *columns*: a column set derived only from the header's declarations is exactly what the story asks for, and inventing columns from item tags would let any item author reshape the table. But `description` on the `github-accounts` items is not an "undeclared field" — `protocols/nips/decentralized-lists.md:47` defines `name`, `title`, `slug`, `description`, `comments` as universal optional item tags that need no header declaration. Story 3's item card (and arguably a row hover/expansion) should render those NIP-level tags when present; leaving them out of the *row* here is acceptable. Recorded as N-5 for story 3's PO.
4. **`parseListRef` / paging.** naddr and `%3A` both verified live (E-a, E-b, E-g). react-router 7's `useParams` returns the decoded segment, and the util also accepts `d` values containing colons (U1). Paging: `until` is inclusive in nostr filters, so the oldest-timestamp items come back and are de-duped by id (E6) — correct for the normal case. The stall case is >50 items sharing one `created_at` (a scripted bulk publish is exactly how that happens): page 2 at `until=T, limit=50` returns items at `T` that may all be already seen, `fresh` is empty, `truncated`/`items.length < total` keeps `hasMore` true, and "Next page" loops forever without progress. Not reachable on today's relay (largest list is far under 50) — non-blocking (N-3), but a `fresh.length === 0 → hasMore = false` guard is a one-liner story 2 could carry.
5. **No nav link to `/lists`.** Acceptable for this story: AC-6 is about what the index reaches, not how the index itself is reached, and the Deviation is honest that the fix lives outside the blast radius. It must not survive to book close, though — the acceptance frame says "from an in-app list of DLists", which implies the list of DLists is discoverable. Follow-up row (N-7).
6. **Collateral.** Operator pages and `src/` untouched (E-i); `test/test.js` conjunction, summary line and skipped-reduce all wired (E-j). One collateral not in the note: `.envrc` (N-2).

## Findings

### Blocking
None.

### Non-blocking
1. **`ui/src/utils/dlistFields.js:76-96` + story Deviations ("`parseFieldDecls` returns `{ name, requirement, type }`")** — the deviation's premise is wrong. The Implementer dropped the Design note's `description` key because "no header tag defines a per-field description", but `protocols/nips/decentralized-lists.md:35` (working copy) defines exactly that: an optional third element on `required`/`allowed`/`recommended`/`disallowed` tags is a human-readable field description. The util reads `t[1]` and never looks at `t[2]`, so a header that uses the NIP form loses its self-description on this surface (the `github-accounts` header has none, hence no AC impact). Optional improvement: `description: typeof t[2] === 'string' ? t[2] : null`, and use it in the `<th title>` instead of `requirement · type`. Correct the Deviations text either way.
2. **`.envrc` (added in design commit 8f5fce93)** — one line, `use nix`, outside the declared blast radius, not mentioned in any commit message or the story, and absent from `origin/staging`. Harmless content (it hooks the existing `shell.nix`, which CLAUDE.md already says direnv loads), but it is undocumented scope creep in a phase commit — and if it is meant to be tracked, the `.direnv/` ignore line currently sitting *uncommitted* in `.gitignore` should ride with it. Operator's call: keep (and commit the ignore) or drop from the branch.
3. **`ui/src/pages/List.jsx:93-109`** — paging can stall when more than one page of items share a `created_at` (see probe 4). Optional improvement: when `fresh.length === 0` treat the list as exhausted (`setTruncated(false)` and a local `exhausted` flag that forces `hasMore = false`), or page on `(created_at, id)`.
4. **`ui/src/pages/List.jsx:43-60, 160`** — `loadVotes` is fire-and-forget: a stale rejection after route change latches `votesFailed = true` for the new page, and a successful later scan never clears it. Optional improvement: pass the effect's `cancelled` ref (or a request token) into `loadVotes`, and `setVotesFailed(false)` on success.
5. **Story 3 input (`DListItemRow`/item card)** — `name`/`title`/`slug`/`description`/`comments` are NIP-level optional item tags (`decentralized-lists.md:47`), not header-declared fields; the item card should show them when present rather than treating them as undeclared. No change asked here.
6. **`ui/src/pages/List.jsx:141-144`** — subtitle phrasing "One item is a <singular> — <description>" is stilted. Taste; suggested "Each item is a …" or description alone.
7. **Discoverability of `/lists`** — no in-app link (Deviations). Needs an OPEN.md row or a line in story 2/4's scope so it is closed before book close; otherwise the frame's "from an in-app list of DLists" is only true for people who know the URL.
8. **`ui/src/pages/Lists.jsx:30`** — the index uses `queryRelay` (unbounded, discards `truncated`) for the header scan. Fine today (284 headers vs `SCAN_MAX_EVENTS = 20000`), but the page cannot say "showing N of M" if a relay ever exceeds the cap, unlike the list page. Optional: `queryRelayBounded` + the same count line.

### Harness friction *(each becomes an OPEN.md `meta` row)*
1. None new. OPEN #219 (session-start probe fooled by strfry on :7778) was filed in this diff and is the only friction hit; the `:8778` note in the task brief was correct.

## Verdict
**PASS**

Full coverage of AC-1..8 by the scoped suite, scoped gate re-run green, lint clean, live browser evidence for every URL form the story names, operator surface untouched, Design-note classification ratified. The eight non-blocking findings are follow-ups (N-1, N-3, N-4 are cheap and should ride with story 2; N-5 is story 3's; N-2 and N-7 are operator decisions).

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place (`engineering-team/stories/dlist-item-tagging/1-browse-a-dlist-with-header-driven-fields.md`).
- [x] Completion detection performed — reported in chat, not here. The book is **not** complete: frame bullets "Tag an item", "Find tagged items from the tag", "Pins & Trusted Lists cover items", and "Publish discipline" remain open (stories 2–4). No `/close-book` offer.
