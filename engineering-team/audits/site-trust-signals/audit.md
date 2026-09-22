# Build Audit: Site trust signals

**Book:** `engineering-team/audits/site-trust-signals/book.md`
**Date:** 2026-09-22
**Branch / commit range:** `5b6a33fd` + `bc2f5696` (PR #545 → `staging` as `71ae7511`, promoted to
`main` by #546 as `6bb23226`, all 2026-08-12), then `4dea6825` (PR #547 → `staging` as `d2f9446a`,
since on `main`). All three were cherry-picked to the four sandbox branches of the time. One later
change to the same surface came from outside this book: `3b84677d` (PR #656).
**Provenance:** Acceptance-frame
**Confidence:** high. Every frame bullet can be checked in the diff and against the live hosts, and
all of them were checked during this close. The one soft spot is the frame's host count ("six"),
which the fleet outgrew; see §4 #1.

> The Build Audit is the as-built record: what the product *is* now. It does not propose changes;
> that is the seed's job.

## 1. What shipped

- **Every tapestry-fleet host says who runs it and how to report a vulnerability.**
  `/.well-known/security.txt` (RFC 9116, `text/plain; charset=utf-8`) carries `Contact` (GitHub
  private vulnerability reporting, switched on for the repo at intake), `Expires: 2027-08-11`,
  `Preferred-Languages`, `Policy` (→ `SECURITY.md`), and a `Canonical` that names the deployment
  itself. — `stories/done/site-trust-signals/1-security-txt-and-honest-404s.md`
- **An ownership attestation covering the whole estate.** The file opens with every official
  hostname across the four fleets (Product UI, R&D UI, backend APIs, relays). It is phrased as a
  positive claim and as "a current inventory, not an exhaustive claim".
- **A real `robots.txt`.** Production is indexable. Every other deployment serves `Disallow: /`
  unless it opts in.
- **Honest 404s.** Probe- and asset-shaped paths now return `404 Not found` instead of the SPA
  shell, including percent-encoded variants. That covers any dot-prefixed segment (`/.env`,
  `/.git/config`, unhandled `/.well-known/*`) and a final segment with a known probe extension
  (`.php`, `.sql`, `.env`, `.txt`, …). SPA deep links, `/api/`, real static assets and ACME HTTP-01
  challenges are untouched.
- **`SECURITY.md`** at the repo root: how to report, and the table of hosts this codebase serves.
- **A 28-test suite** (`test/site-trust-signals.test.js`): 15 unit, 5 source sentinels, 8 live HTTP.

## 2. Epics & stories rolled up

### Epic: `site-trust-signals`: **Done**, retired 2026-09-22

| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 security-txt-and-honest-404s | security.txt with the estate attestation, robots.txt, the shape-based 404 rule, SECURITY.md, and the suite (25 tests at review, 28 today) | Done | `reviews/done/site-trust-signals/1-security-txt-and-honest-404s.md`: **PASS**, one blocking finding fixed in the same cycle |

ADR: `decisions/done/site-trust-signals/0036-security-txt-and-honest-404s.md`. It chose Option B, a
shape-based deny rule; `Canonical` from configuration, never from the `Host` header; and a
fail-closed `robots.txt` behind a flag. Phase path: Standard / Feature, all five phases. They were
committed as **one** commit (`5b6a33fd`) rather than at each phase boundary; see §7.

The test plan had been filed at `engineering-team/tests/site-trust-signals/`, the only plan of 205
kept outside its story folder. This close moved it to
`stories/done/site-trust-signals/1-security-txt-and-honest-404s.test-plan.md` and removed the
now-empty `engineering-team/tests/`. The move rewrote 14 inbound references in 8 files, including
the comment-only `Story:`/`ADR:` headers of `src/utils/siteTrust.js` and the suite, so that nothing
points at a pre-`done/` path.

## 3. As-built inventory

**User-facing / endpoints.** All three live in `bin/control-panel.js`. They are registered after
the static middleware and before the session middleware, so a crawler fetching them never mints a
Redis session:

| Surface | Where | Behavior |
|---|---|---|
| `GET /.well-known/security.txt` | `bin/control-panel.js:178` | `text/plain; charset=utf-8`, from `buildSecurityTxt({ domain: process.env.DOMAIN_NAME })` |
| `GET /robots.txt` | `:183` | `text/plain; charset=utf-8`, from `buildRobotsTxt({ allowIndexing: process.env.ALLOW_INDEXING === 'true' })` |
| Deny rule | `:338`, just before the SPA catch-all at `:346` | skips `/api/`; `isBlockedProbePath(req.path)` → `404`, `text/plain`, body `Not found`, no path echo |

**New module.** `src/utils/siteTrust.js` (214 lines) is pure and adds no dependencies:

| Export | Contract |
|---|---|
| `buildSecurityTxt({ domain })` | attestation block, then `Contact`, `Expires`, `Preferred-Languages`, `Policy`; `Canonical` only when `domain` is set and is not `localhost` |
| `buildRobotsTxt({ allowIndexing })` | `Allow: /` only when `allowIndexing` is truthy; otherwise `Disallow: /` |
| `isBlockedProbePath(pathname)` | percent-decodes first (a malformed escape falls back to the raw path); never blocks `/.well-known/acme-challenge/`; blocks any dot-prefixed segment; blocks a final-segment extension on an explicit 18-entry list; passes everything else to the SPA |
| `ESTATE_ATTESTATION`, `EXPIRES` | exported for the suite. The attestation text is copied by hand into `NosFabrica/Brainstorm-UI` and the relay configs |

**Configuration.** `DOMAIN_NAME` already existed and now drives `Canonical`. `ALLOW_INDEXING` is new:
`docker-compose.yml:23` forwards it with a default of `false`, and `.env.example:24` documents it.
The production droplet sets `ALLOW_INDEXING=true`. That was the ADR's one required deploy step, and
production serving `Allow: /` confirms it.

**Domain.** None. No concept handles, no event kinds, no POV-dependent state, no firmware reinstall,
no TA pubkey. The documents state something about the *operator of the server*, identical for every
viewer, so CLAUDE.md's four invariants have nothing to bind to. The story says so explicitly.

**Data & contracts.** Two plain-text documents at fixed paths, and one new response shape (`404`
`Not found` for probe paths). No route under `/api/` was added or changed.

**Tests.** `test/site-trust-signals.test.js`, registered at `test/registry.js:206`: U1–U13 plus U6b
and U6c (unit), S1–S5 (source sentinels), and H1–H8 (live HTTP, skipped without a stack).

## 4. Deviations from intent

| # | Specified (frame) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | "All six tapestry-fleet hosts…"; "Verified live on all six hosts after deploy" | Shipped to all six: both fixes are on the archived `feat/communities` and `feat/curate` branches. Then `communities.` and `curate.` were decommissioned on 2026-09-12. Four hosts exist, and all four were re-verified live during this close | intentional-change (made outside this book) | The droplets were deleted as unused and costly. The same PR trimmed every in-repo host list and added test U6c (PR #656, `3b84677d`) | None: the criterion holds on every host that exists | Host lists **outside** this repo still name the two: ledger row `2026-09-22-estate-inventory-names-dead-hosts` |
| 2 | "`Canonical` rendered for the requesting host" | Rendered from the deployment's configured `DOMAIN_NAME`. The request's `Host` header is never read. Omitted when unset or `localhost` | interpretation | `Host` is attacker-controllable; honoring it would let anyone obtain a file that appears to vouch for a domain the team does not run. A wrong `Canonical` invalidates the file (RFC 9116 §2.5.2) and an absent one does not (ADR 0036, Decision) | None on the fleet: every droplet sets `DOMAIN_NAME`, and each serves its own `Canonical` | — |
| 3 | "the full-estate ownership attestation" (story AC: "listing every official hostname") | As first deployed, the attestation ended by disclaiming any `*.brainstorm.world` or `*.nosfabrica.com` host not on the list, which are the operator's own domains. Corrected the same day to a positive claim plus "a current inventory, not an exhaustive claim" | intentional-change (post-deploy fix) | The owner caught it by reading the deployed file; neither the review nor the suite did (OPEN.md row 175; PR #547, `4dea6825`; guarded by U6b) | The file no longer claims to be exhaustive, so adding a host can no longer make it false | Row 175 (meta: the lesson); row 173 (resolve check) |
| 4 | "production indexable, the five non-production hosts `Disallow: /`" | Indexing is an opt-in flag (`ALLOW_INDEXING`), off by default and set only on production. There are three non-production hosts today | interpretation | Keying on a hostname comparison would hardcode a per-deployment value in shared code (house rule). Defaulting closed stops a new sandbox competing with production in search before anyone configures it (ADR 0036) | None | — |
| 5 | Probe paths "return a genuine **404**" | Shape-based: extensionless nonsense (`/foobar`) still gets the SPA shell with `200` | interpretation (accepted cost) | An allow-list of SPA routes would drift from the React table of 100+ routes, and its failure mode is 404ing a live page (ADR 0036 rejected Option A; re-affirmed at the Test Design gate; review non-blocking 3) | None for users. A scanner probing an extensionless path still sees `200` | Crawlable content (SSR), which is out of scope; see §6 |
| 6 | *(not specified)* | `isBlockedProbePath` never blocks `/.well-known/acme-challenge/*`; pinned by U13 | added-beyond-scope | The dotfile rule matched the ACME HTTP-01 path. cert-manager (k8s) and certbot (droplets) answer that path over plain HTTP, and a 404 there silently fails issuance and renewal (commit message of `bc2f5696`) | None today, because challenges are answered above the app layer. This protects renewal from a future routing change | —; see Undocumented work |

**Undocumented work:**
- The ACME exemption (#6): the early return and its comment in `src/utils/siteTrust.js`, and U13 in
  `test/site-trust-signals.test.js`. It was committed at 00:52 on 2026-08-12, three minutes after
  the commit that carried the story, ADR, test plan and **PASS review** (`5b6a33fd`, 00:49), and it
  merged in the same PR. No story, ADR or review mentions it; its commit message is its only
  rationale. It is correct and tested, but it was never reviewed.

Every other file in the book diff traces to story 1, its review, or row 175: 14 files across
`5b6a33fd`, `bc2f5696` and `4dea6825`, walked file by file. That includes `docker-compose.yml` (the
passthrough the review asked for) and `test/test.js` (suite registration, since moved to
`test/registry.js`). The later change to this surface, `3b84677d`,
trimmed `ESTATE_ATTESTATION` and `SECURITY.md` and added U6c. It carries its own provenance (PR
#656) and is not this book's work.

## 5. Quality state at close

- **Test gate at close.** Run after the book flip and the epic close-out, so it certifies the tree
  this close leaves behind. `npm run gate:status`:

  > `20260922T003420Z-54801-c570 [site-trust-signals-book-close] started 2026-09-22T00:34:20.302Z
  > on 6754a16a+dirty — FAIL, exit 1, 3582 passed, 95 failed, 36 skipped, 219/219 suites; failed:
  > profile-tags, profile-tags-publish, tag-detail, tag-detail-publish, tag-detail-write-publish,
  > tag-index-publish, profile-tag-polish, pin-a-tag, tl-publication-from-pins,
  > tl-publication-from-pins-publish, customize-pin-curation-publish, most-pinned-tag-index-publish,
  > deploy-safety-status, event-less-create-set, capture-a-goal-and-see-it,
  > tapestry-per-concept-detail-views, structures-the-brain-can-trust, break-a-goal-into-pieces,
  > attach-the-world, sessions-read-the-brain, the-proposal-loop, teach-it-what-matters,
  > the-brain-survives, return-the-four-on-every-read-surface,
  > show-the-four-on-the-goal-screens-that-already-exist, recognizable-published-ta-profile,
  > brain-first-tapestry-authoring, tl-membership-method-selector, tl-weighted-sum-method,
  > tl-certainty-method, profile-lookup-bounds, not-yet-shared-filter, concept-count-canonical,
  > summaries-element-count, author-scoped-inspection-roster, setup-status`

  **The verdict is FAIL, and this close does not round that off.** None of the failures can come from
  this close, for five reasons:
  1. **The close changed no executable code.** The only `.js` edits are the two `Story:`/`ADR:`
     header comments.
  2. **None of the 36 failing suites reads a file this close touched.** This was checked mechanically.
     Every reference in their code to `OPEN.md` or `audits/` sits inside an assertion message or a
     test title; none is a file read.
  3. **The book's own suite passed in this run:**
     `site-trust-signals: PASS (28 passed, 0 failed, 0 skipped)`, including all eight live-HTTP tests.
  4. **The live tier ran against a server that does not have the code under test.** It ran against
     `:7778`, and `docker inspect` shows that server bind-mounts the *main* checkout, at `a55b9631`,
     117 commits behind the tree under test. Suites for features merged since then therefore fail
     rather than skip. For example, `setup-status` gets `Cannot GET /api/setup/status`, because its
     endpoint arrived in #737. The Meilisearch-dependent `*-publish` suites fail as they do on every
     local run on this machine.
  5. **The last recorded close shows the same failures.** All 15 failing suites of the
     `nip05-ssrf-guard` close (2026-09-20) are in this set.

  No other gate record exists on this machine, so a suite-by-suite diff against a pristine
  `origin/staging` run was not possible. The comparison above holds by construction, not by baseline.
  CI's `stack-free` job on the close PR is the binding gate.

- **`harness-lint` at close:** clean (0 violations).
- **Test gate during the story** (from the review, 2026-08-12): `npm test` `Overall: PASS`, no
  failing suites, 53 skipped. The site-trust suite ran 25 passed, 0 failed, 0 skipped, and
  `harness-lint` was clean.
- **CI:** the `stack-free` job on PR #545 was green (`SUCCESS`).
- **Live verification at close.** All four hosts were probed during this close:

  | Host | `security.txt` | `Canonical` | `robots.txt` | `/.env` · `/wp-login.php` · `/.well-known/nothing` | `/about` (SPA) |
  |---|---|---|---|---|---|
  | tapestry.brainstorm.world | 200 `text/plain` | own host | `Allow: /` | 404 · 404 · 404 | 200 |
  | staging.brainstorm.world | 200 `text/plain` | own host | `Disallow: /` | 404 · 404 · 404 | 200 |
  | tags.brainstorm.world | 200 `text/plain` | own host | `Disallow: /` | 404 · 404 · 404 | 200 |
  | magic-carpet.brainstorm.world | 200 `text/plain` | own host | `Disallow: /` | 404 · 404 · 404 | 200 |

  All four serve `Expires: 2027-08-11` and the corrected attestation, and none names either
  decommissioned host.
- **Known open issues / accepted:** §4 #5 (extensionless `200`, accepted by the ADR); OPEN.md rows
  172 and 173.
- **Debt from ADR 0036's `Consequences`:**
  - The `ALLOW_INDEXING` deploy step: done, since production serves `Allow: /`.
  - The `Expires` renewal: row 172.
  - A hand-maintained estate list copied across three repositories: row 173, plus this close's new
    cleanup row, which is that risk come true.

## 6. Carry-forward register

Tick sweep (workflow step 5): nothing here was already resolved elsewhere. No earlier audit's §6
carries an item this book resolved: searched every `audits/**/audit.md` for unticked items on
security.txt, robots.txt, honest 404s, the catch-all, or the reputation incident.

- [ ] **`security.txt` expires 2027-08-11.** Test U1 goes red that day, by design. Refresh
      `EXPIRES`, re-verify the estate list, and refresh the copies in `Brainstorm-UI` and the relay
      configs too. (OPEN.md row 172)
- [ ] **The hostname inventory drifts.** Five dead hostnames are referenced in the repo, and a
      check that every `ESTATE_ATTESTATION` host resolves is proposed. (OPEN.md row 173)
- [ ] **Estate host lists outside this repo still name the two decommissioned hosts:** the
      canonical `ECOSYSTEM.md` (NosFabrica/protocols), the Brainstorm-UI attestation copy served
      live on `brainstorm.world` and both nosfabrica.com hosts, and NosFabrica/protocols#6's host
      table. (§4 #1 · ledger row `2026-09-22-estate-inventory-names-dead-hosts`)
- [ ] **Related work outside this book, status at close.** Probed 2026-09-22. The relay and API
      halves are the unfinished part of the incident this book answered:

  | Fleet | Hosts | `security.txt` | Honest 404s | Tracked |
  |---|---|---|---|---|
  | Product UI | brainstorm.world, brainstorm.nosfabrica.com, brainstorm-staging.nosfabrica.com | served, but names the two dead hosts | yes | shipped in NosFabrica/Brainstorm-UI#43; reputation disputes in #45 (open) |
  | Relays | scores., nip85., dcosl.brainstorm.world; nip85., nip85-staging.nosfabrica.com | **no**: every path answers `200 text/html` (the strfry landing page) | **no** | nothing found (`gh search issues --owner NosFabrica "security.txt"`; brainstorm-k8s is private) |
  | Backend APIs | api., search.brainstorm.world; brainstormserver(-staging).nosfabrica.com | **no** (`404`) | yes | nothing found |

- [ ] **llms.txt** is the natural next story on `siteTrust.js`: a third exact-match root document,
      pointers only. See intake 2026-08-18 (`_intake.md:2151`, corrected in this close to four
      hosts) and, estate-wide, NosFabrica/protocols#6. Its story must decide whether the
      non-production hosts' `Disallow: /` should also cover `/llms.txt`.
- [ ] **Crawlable content.** The contentless SPA shell (470 bytes today) is the largest reputation
      signal this book left in place (ADR 0036, Out of scope; §4 #5).
- [ ] **The delisting request** to safescan.io was the owner's to send after this work (story, Out
      of scope). Nothing in this repo records whether it was sent.
- [ ] **PGP-signing `security.txt`** (`Encryption`) is optional under RFC 9116. It was deferred as
      offering little while `Contact` is a GitHub advisory URL (story, Out of scope).

## 7. Process findings (harness)

The retro ran on measurement, using `scripts/harness-stats.sh` at close:
- **Reviews:** 235 parsed, 233 final PASS, 2 final CHANGES_REQUESTED (0 % kick-back rate), 44 with
  kick-back history.
- **Books:** the 56 closed books took a median of **1 day** from open to close, and none took more
  than 12. This one was reported open for **41 days**.
- **Phase commits:** the per-epic count for `site-trust-signals` is **0**. Its commits are titled
  `feat(site-trust)` and `fix(site-trust)`, so the per-epic line cannot see them.

| Finding | Source | Terminal state |
|---|---|---|
| **A source-order sentinel found the `require`, not the call site.** S2 located the rule with `search()`, so it failed against a correct implementation and invited reshaping the code around a broken proxy. | Review, Harness friction 1 | **OPEN.md row 174** (meta, opened by the story) |
| **A published ownership claim shipped false, and no test could have caught it.** Every test asserted that the attestation was *present*, none that it was *true*, and it disclaimed the operator's own domains. | OPEN.md row 175 (post-deploy) | **OPEN.md row 175** (meta) |
| **For a rule-shaped story, the ACs described the happy path, and both defects that mattered were found beyond them.** Neither the percent-encoding bypass (`/%2Eenv` → `200`) nor the missing `ALLOW_INDEXING` passthrough in docker-compose (production would have served `Disallow: /`) violated an AC as written. Nothing in the Tester or Reviewer material asks for bypass probing: no match in `roles/reviewer.md`, `roles/tester.md`, `workflows/5-review.md`, `templates/review-checklist.md`, or the test-plan template's edge cases. | Review, Verdict | **New ledger row `2026-09-22-rule-stories-need-bypass-probing`** (meta) |
| **Completion was detected at review and offered only in chat, and nothing surfaces a finished book**, so this one sat Open for 41 days. The rules leave no trace: `templates/review-checklist.md:66` sends the result to "the chat (human-gated) — never in this file", and a deferred offer means "leave the book `Open`, write nothing" (`workflows/5-review.md`). `/whats-open` lists open books without saying which are finished. The 2026-09-13 triage had to hand-write close packets for this book and for `tl-weighted-certainty`. | Review, "On PASS"; harness-stats Books; triage board | **New ledger row `2026-09-22-finished-books-have-no-close-surface`** (meta) |
| **The ACME exemption landed after the PASS review and was never reviewed** (§4, Undocumented work). | git: `bc2f5696`, three minutes after `5b6a33fd`, same PR | **Declined.** A single small follow-up with its own test and a full rationale in its commit message. It is recorded here so the as-built record is complete. A rule re-reviewing every post-PASS commit would cost more than this instance risked. |
| **All five phases landed in one commit**, despite "Commit at each phase boundary: yes". The per-epic phase-commit count reads 0. Because the review and the implementation shared one commit, a follow-up could land after the review without anything showing it. | git `5b6a33fd`; harness-stats | **Declined.** The full path's commit cadence is already written, in the project settings and in every phase command's commit step, so this is a slip against a stated rule rather than a missing one. The open question about commit cadence is OPEN.md row 212, which covers the abbreviated path, where no cadence is written. |
| **The test plan was filed at `engineering-team/tests/`**, the only one of 205 outside its story folder. | Story, "Linked artifacts" | **Declined.** A one-off. This close moved it to its conventional place and removed the directory, so nothing remains to guard. |
| **The 2026-09-12 decommission trimmed every host list in this repo but none outside it**, and the llms.txt intake entry kept saying "six". | Live probe during this close; `3b84677d` | **Declined as a harness finding.** Decommissioning is an ops procedure, not an engineering-harness phase. The cleanup, and a fix shape that adds a decommission line to `OPERATIONS.md` naming the lists outside the repo, are in ledger row `2026-09-22-estate-inventory-names-dead-hosts`. The intake entry is corrected in this close. |
| **The close's own gate ran its live tier against code it was not testing.** From a worktree, `:7778` serves the main checkout, 117 commits behind the tree under test, so 36 suites fail and none of them can be attributed to the change (§5). | This close's gate run; `docker inspect tapestry` | **Declined as a new row.** It is OPEN.md row 27 (ops, open), and this is one more instance, with the stack now 117 commits behind. |
| **Ports to the other flow?** Asked per finding. Bypass probing ports to Direction mode unchanged: a gate judge audits against the same ACs, so a bypass they don't name passes there too. The finished-book gap belongs to the human-gated flow, because Direction books close in the same run through Stage 3's completion judge. The rest are flow-agnostic. | Retro step 7 | **Declined.** No separate port is needed. The answers are recorded in the two new rows, so the question is visibly answered rather than skipped. |
