# Build Audit: A recognizable Tapestry Assistant avatar

**Book:** `engineering-team/audits/ta-avatar/book.md`
**Date:** 2026-08-07
**Branch / commit range:** the book's own commits on `origin/staging` — `b8e7c6d5`..`1ed52d9b` (PRs #504, #506, #507)
**Provenance:** Acceptance-frame *(no PRD; frame confirmed with the owner at kickoff, 2026-08-06)*
**Confidence:** **high** — the anchor was captured eagerly before any code, all three stories carry
ADRs, test plans and PASS reviews, and every acceptance-frame bullet was verified on a deployed
instance rather than inferred from the diff.

## 1. What shipped

- **The assistant is recognizable at a glance inside Tapestry** — wherever it appears as an author it
  renders the *instance owner's* avatar wearing the brain-and-lightning mark, and hovering (or
  reading via assistive technology) says "Tapestry Assistant of &lt;owner&gt;" — `stories/ta-avatar/1-in-app-badged-ta-avatar.md`
- **Dead avatar URLs no longer show a broken-image glyph for anyone** — a fix that fell out of the
  same work and applies to every author, not just the assistant — `stories/ta-avatar/1-in-app-badged-ta-avatar.md`
- **The assistant's published nostr profile is recognizable to third-party clients** — its defaults
  now carry an owner-linked name ("&lt;owner&gt;'s Tapestry Assistant") and a branded picture hosted by
  the instance — `stories/ta-avatar/2-recognizable-published-ta-profile.md`
- **The owner can stamp their own avatar with the mark and publish it** — generate, preview, accept,
  publish; the published picture is served by the instance and survives redeploys —
  `stories/ta-avatar/3-stamped-composite-avatar-on-nostr.md`
- **Every missing ingredient degrades to something branded and honest** — no owner picture, no public
  address, a picture that 404s: each produces a named fallback, never a blank disc or a dead link —
  all three stories

## 2. Epics & stories rolled up

### Epic: `ta-avatar`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 in-app-badged-ta-avatar | Shared `Avatar` component; `AuthorCell` delegates, lighting up 33 call sites unchanged; owner profile resolved once in `ConfigContext`; `ta-badge.svg` | Done | `reviews/ta-avatar/1-in-app-badged-ta-avatar.md` (PASS) |
| #2 recognizable-published-ta-profile | Owner-linked default name + branded `ta-avatar.png`, gated on a new `isPubliclyReachable()` | Done | `reviews/ta-avatar/2-recognizable-published-ta-profile.md` (PASS) |
| #3 stamped-composite-avatar-on-nostr | Owner-gated avatar proxy, browser-canvas composite + preview, content-addressed store, `/generated` mount | Done | `reviews/ta-avatar/3-stamped-composite-avatar-on-nostr.md` (PASS, round 2) |

All three merged to `staging`: PR #504 (`2f13856d`), PR #506 (`ea80dd02`), PR #507 (`9a1df654`).
**Nothing has been promoted to `main`.**

## 3. As-built inventory

**User-facing**
- Every table rendering `AuthorCell` (33 call sites, 28 files) — badged assistant avatar, lettered
  fallback, `onError` failover.
- `/tapestry/users/:pubkey` — badged 64px header avatar; the assistant's own page now titles itself
  "Tapestry Assistant" instead of a truncated pubkey.
- `/tapestry/settings/assistant` — a "Generate badged avatar" action, an inline preview, an accept
  step, and a branded-fallback offer.
- Static assets at the site root: `/ta-badge.svg` (overlay chip), `/ta-avatar.png` (512×512 branded
  image, 16863 bytes).
- `/generated/<file>` — **the repository's first directory that is both persisted and web-served.**

**Domain**
- **No concepts touched, in any of the three stories.** Confirmed against the live concept graph at
  each Architecture phase (48 concepts). The `image` concept exists but models images as
  knowledge-graph nodes, not files on a volume, and was explicitly rejected as inapplicable in
  ADRs 0002 and 0003. **No firmware reinstall was required at any point.**

**Data & contracts**
- `GET /api/assistant/owner-avatar` — owner-gated, **takes no URL parameter**; reads the picture URL
  from the owner's own kind-0 server-side.
- `POST /api/assistant/avatar` — owner-gated multipart upload; stores `ta-avatar-<hash8>.png`.
- `GET /api/assistant/status` — `defaults` now carry an owner-linked `name`/`display_name` and a
  `picture` URL when the instance is publicly reachable.
- Published **kind-0** content is unchanged in shape; only the *values* the instance proposes changed.
- Storage: `/var/lib/brainstorm/generated/` on the `tapestry-data` named volume.

## 4. Deviations from intent

| # | Specified (frame bullet) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | "the owner's avatar stamped with the mark" (frame ¶1) | In-app the badge is composited **at render time**, not baked | interpretation | A live overlay stays correct when the owner changes their avatar and is crisp at any size; the baked composite is reserved for the published picture where a live overlay is impossible — ADR 0001 §Decision | None — the viewer sees the same thing | — |
| 2 | "the brain-with-a-lightning-bolt … off to one side" | Two derived assets, not the logo file itself | constraint-discovered | `brainstorm.svg` is a transparent-background export whose purple brain vanishes on a dark row at badge size — ADR 0001 §Options B | None | — |
| 3 | (implicit) the published picture could reuse the SVG we already serve | A committed **PNG** | constraint-discovered | Native nostr clients load avatars through pipelines that don't decode SVG without opt-in (Coil, Kingfisher) and avatar proxies commonly refuse it; it would have looked right in our tests and stayed blank in Damus/Amethyst — ADR 0002 §Options B | Decisive for the frame's second bullet | — |
| 4 | "the instance has no public address → nothing dead is published" (frame ¶3) | A routability predicate, not an emptiness check | constraint-discovered | ADR 0002 asserted "AC4 is free"; **it was wrong** — `getInstanceDomain()` falls back to the relay host, so a dev instance reports `https://localhost:7777`, truthy and ≠ `'localhost'`. Found by the Tester before implementation; story 2 Deviations #1 | Prevents publishing a loopback URL that resolves to the *reader's* machine | **OPEN.md #148** — the predicate admits RFC1918 |
| 5 | "a published picture never silently dies" (story 3 AC3) vs "regenerating replaces the old" (AC4) | Old composites are **kept**; names are content-addressed | interpretation | The two criteria conflict: the currently published kind-0 still names the old URL until re-publish, so deleting kills the live profile's picture in that window — ADR 0003 D3 | None visible; costs disk | Retention policy (§6) |
| 6 | (not in the frame) the proxy's shape | Parameterless; reads the owner's kind-0 server-side | intentional-change | An endpoint accepting a URL is a general-purpose arbitrary-fetch primitive — ADR 0003 D2 | None | — |
| 7 | ADR 0003 D2 "at most one redirect"; "`image/*` allow-list" | One hop with each hop re-validated; **raster-only**, SVG refused | intentional-change | Review round 1 returned both as blocking: the redirect bound had been silently dropped, and `image/svg+xml` echoed from our own origin is a same-origin script-execution vector — story 3 Deviations #4 + review round 2 | None | — |
| 8 | (not in the frame) automatic upkeep | Regeneration is a manual owner action | deferred | Story 3 §Out of scope | Composite goes stale if the owner changes their avatar | §6 |

**Undocumented work** — one item, flagged honestly:

- `test/show-the-four-on-the-goal-screens-that-already-exist.test.js` (commit `a9ab0d8b`) — this book
  retired **another epic's** test assertion: `show-the-four` S11 pinned the *total* count of CSS
  custom properties in `styles.css`, and story 1's one new property (`--avatar-ring`) turned that
  suite red. No story or ADR covers the change. Its provenance is a **user decision recorded in the
  session** during story 1's staging cycle, and it is the same defect class OPEN.md #143 already
  named, whose sibling pins PR #501 had retired two hours earlier. S11's intent-bearing assertion
  (nothing named for prompt/estimate/intent/chance/needs/flag) was kept. Recorded here because the
  gap between "docs say shipped" and "diff shows shipped" is itself a finding.

## 5. Quality state at close

- **Test gate at close: repo-wide `npm test` over the final state → `Overall: FAIL`, 64 skipped.**
  Run after the book flip and the epic close-out, per workflow step 10. It took roughly 35 minutes.
  **Seven suites failed, and exactly one of them belongs to this book:**

  | Failing suite | Book | Reading |
  |---|---|---|
  | `recognizable-published-ta-profile` 11/2 | **this book** | the two failures are `H1` and `H5` — the documented environmental pair. They query `localhost:7778`, which serves the *shared* checkout; against the deployed instance the same suite is **13/13** (below). |
  | `brain-first-tapestry-authoring` 12/7 | tapestries | live-stack suite |
  | `b-coverage-audit-and-disposition` 20/6 | shared-concepts-adoption | live-stack suite |
  | `adoption-candidates-queue` 13/6 | shared-concepts-adoption | live-stack suite; 404s on `/api/adoption-queue`, absent from the stale local stack |
  | `inverse-queue-publish-candidates` 11/5 | shared-concepts-adoption | live-stack suite |
  | `publish-time-default-stamping` 12/2 | shared-concepts-adoption | live-stack suite |
  | `trusted-dictionary` 11/5 | shared-concepts-adoption | live-stack suite |

  Six of the seven are other books' live-stack suites failing for the same environmental reason, and
  `stamped-composite-avatar` passed **13/0** (+2 H skipped by design). This is exactly the pattern
  **OPEN.md #27** records: a developer host's full run is not a usable signal, because the stack it
  polls is a different checkout. **No failure in this run is attributable to a defect in this book.**

  *Instrumentation note, recorded because it nearly cost an inaccurate audit:* the run was captured
  through `| tail -16`, so only the final summary survived and the file read as empty until the
  process exited. An earlier draft of this section stated the run "did not complete" — it had, just
  outside the polling window. Capture the whole log, not a tail, when the log **is** the evidence.

  The gates this close actually rests on:
  - **CI `stack-free`** — green on all three PRs (#504, #506, #507); this is the binding gate and it
    exercises the whole suite in a hermetic environment.
  - **The three per-story suites**, run against the deployed instance — see the staging evidence below.
  - **`harness-lint`** — clean over the final state, *after* the flip and the epic move (L2 pairs a
    Closed book with Done epics, so ordering matters and was followed).
- **Verified on the deployed instance** (staging, after PR #507) — this is the evidence behind §1:
  - story 1 suite **13/0**; story 2 suite **13/13** with **H-class 5 executed / 0 skipped**; story 3
    suite **15/15** with **H-class 2 executed / 0 skipped**. The H-classes had *never executed
    anywhere* before deploy — they are structurally incapable of passing against a checkout that
    isn't serving the code.
  - `/ta-avatar.png` → 16863 bytes, `image/png`. `/ta-badge.svg` → real SVG body.
  - `/api/assistant/status` defaults → `"david's Tapestry Assistant"`, picture
    `https://staging.brainstorm.world/ta-avatar.png`; `hasProfile: true` and **unchanged**, confirming
    an already-published profile is untouched until the owner re-publishes.
  - Anonymous `GET /api/assistant/owner-avatar` → **403**; anonymous `POST /api/assistant/avatar` →
    **401** (the global default-deny for mutations firing ahead of the handler's own gate);
    `/generated/` → 200 with **no directory listing**.
- **Known open issues:** OPEN.md #146, #147, #148 (see §6). None blocks use.
- **Debt logged by ADRs:** old composites accumulate (0003 D3, intentional); the badge is not applied
  to avatar surfaces outside `AuthorCell`/`UserDetail` (0001); `useProfiles` still has no in-flight
  dedupe (0001, explicitly not fixed here).

## 6. Carry-forward register

- [ ] **The users directory shows the assistant unbadged** — `ui/src/pages/users/Index.jsx` hand-rolls
      `AuthorCell`'s markup instead of using it, so it also keeps the broken-image bug. Jarring because
      clicking through *is* badged. (OPEN.md **#147**, from §4 / review 1 finding 3)
- [ ] **`isPubliclyReachable` admits RFC1918** — a LAN-hosted instance would publish a dead avatar URL
      into a signed, relay-replicated kind-0. The test's independent mirror predicate shares the blind
      spot, so both must move together. (OPEN.md **#148**, from §4 #4)
- [ ] **Retention policy for accumulated composites** — kept deliberately (§4 #5); bounded in practice
      by how rarely an owner regenerates, but unbounded in principle.
- [ ] **Automatic regeneration when the owner's avatar changes** — task-scheduler territory (§4 #8).
- [ ] **Customer-assistant composites and badging** — deferred by stories 1 and 3; the proxy is defined
      in terms of *the owner's* kind-0, so generalizing is not free.
- [ ] **Migrate the remaining one-off avatar `<img>` sites** to the shared component (NoteCard,
      BrainstormProfile, search, user menu, TagChip, PinnedListPanel) — ADR 0001 §Consequences.
- [ ] **The customer branch's `'a customer'` name fallback** publishes *"a customer's Tapestry
      Assistant"* — visibly inconsistent with the owner branch after story 2. (ADR 0002 §Consequences)
- [ ] **Nothing is on prod.** All three stories are staging-only; promotion is a separate decision.

## 7. Process findings (harness)

Retro run on measurement: `scripts/harness-stats.sh` at close reports 170 `story:` / 152 `adr:` /
158 `test:` / 156 `impl:` / 192 `review:` phase commits repo-wide. This book contributed 17 phase
commits across three stories and one review round trip.

| Finding | Source | Terminal state |
|---|---|---|
| The vite **dev server** cannot load the CJS `event-tagging` tree, so `npm run dev` renders blank on every route; only the production build is configured for it | story 1 Implementer deviation / session | **OPEN.md row 146** |
| `git stash push -q <path>` silently no-ops on a committed change, and the following `pop` took a **co-tenant session's** stash and conflicted `_intake.md`; the with/without differential it produced was a tautology | review 2 §Harness friction | **OPEN.md row 149** — with the replacement practice (`git checkout <base> -- <path>`) recorded; used successfully in reviews 2 and 3 |
| Absolute-count test pins keep rotting under unrelated additive features — `show-the-four` S11 was the second instance after OPEN.md #143's route/nav pins | story 1 staging cycle | **Declined** as a new row: OPEN.md #143 already names the class and was marked DONE when the sibling pins were retired; S11's retirement (commit `a9ab0d8b`) closes the last known instance. A third recurrence should reopen #143 rather than open a fourth row. |
| An ADR's stated mechanism can be wrong in a way only a test finds — ADR 0002's "AC4 is free" would have published loopback URLs | story 2 test plan + Deviations #1 | **Declined** as a harness change: the harness worked exactly as designed — Test Design caught it before Implementation, which is the phase boundary's purpose. Recorded here as evidence the ordering earns its cost. |
| A review verdict word written into a story's Review pointer trips `harness-lint` **L14** (verdict outcomes belong in the run journal) | story 3 staging cycle | **Declined** as a harness change: the lint rule fired correctly and the artifact was corrected (commit `9631dc1d`). Worth knowing that the Reviewer's own story-pointer wording is lint-governed. |
| Capturing a long test run through `\| tail -N` hides progress *and* discards the evidence: the file reads empty until the process exits, and only the tail survives. It produced a draft of §5 asserting the run "did not complete" when it had | this close, §5 instrumentation note | **Declined** as a harness change — it is an operator technique, not a harness defect, and §5 now records the corrected result plus the rule (capture the whole log when the log is the evidence). Related to but distinct from OPEN.md #27, which is about the run's *reliability*, not its capture. |
| **Does any of this port between flows (Direction ↔ human-gated)?** | — | The stash hazard (#149) and the count-pin rot are flow-independent and already recorded as such. Nothing here is Direction-specific; this book ran fully human-gated. |

---

*This audit records what the product **is**. Recommendations for what to do next live in
`prd-seed.md`, which the product team reads as input, not as decisions.*
