# Build Audit: Neo4j Sizing Override

**Book:** `engineering-team/audits/neo4j-sizing/book.md`
**Date:** 2026-08-28
**Branch / commit range:** `aa2ae2b3..02878a18` on `staging` (PR #578; single story)
**Provenance:** Acceptance-frame
**Confidence:** high — one-story book, every frame bullet verified live on both sides of the
boundary (local container with the override; staging droplet regenerating byte-identical
values through the untouched formula path).

## 1. What shipped

- **Opt-in Neo4j memory override** — `docker/entrypoint.sh` honors
  `BRAINSTORM_NEO4J_{HEAP,CACHE,TX_MAX}_MB` verbatim when set; unset/empty leaves the sizing
  formula untouched and the written config byte-identical —
  `stories/neo4j-sizing/1-entrypoint-memory-override.md`.
- **Compose plumbing** — three empty-default pass-throughs (the `ALLOW_INDEXING` pattern).
- **Executable no-change guarantee** — `test/neo4j-sizing-override.test.js` runs the *real*
  sizing block (stubbed `grep`/`nproc`) and pins staging's live 8038/8038/4019, both reserve
  branches, the 24000MB threshold, override-verbatim, empty≡unset, per-var independence.
- **Local durable profile** — untracked `.env` carries 2048/1024/1024; the crash-loop fix (row
  185) no longer depends on an in-container hotfix that any restart would erase.

## 2. Epics & stories rolled up

### Epic: `neo4j-sizing`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 entrypoint-memory-override | override + plumbing + pins + local profile | Done | `reviews/neo4j-sizing/1-entrypoint-memory-override.md` |

## 3. As-built inventory

- **Runtime:** `docker/entrypoint.sh` — 3 override lines + `if/fi` note after the formula,
  before the config writer; `docker-compose.yml` — 3 env pass-throughs. No server/UI code.
- **Tests:** `test/neo4j-sizing-override.test.js` (9), registered in `test/test.js`; guard
  `entrypoint-template-rendering` in the story's scoped gate.
- **Config surfaces:** local `.env` (untracked) sets the dev profile; droplets set nothing.
- **Domain:** no concepts, no firmware, no wire formats.

## 4. Deviations from intent

None — the frame was realized as written. (Process-shaped notes live in §7.)

**Undocumented work** — none; the diff is exactly the story's blast radius.

## 5. Quality state at close

- Test gate: full `npm test` post-flip — **Overall: PASS, exit 0** (149 suites PASS, 0 FAIL, 31 tests skipped as stack-optional). The first fully green full-suite run on this machine since mid-July — the row-185 fix and this book's override verified together under the gate.
- Scoped gate at story close: sizing suite 9/9 + entrypoint guard 11/11; harness-lint clean.
- Live verification: local container boots with the override active (JVM RSS 2.7GB, was 7.8GB);
  staging's recreated container regenerated exactly 8038/8038/4019 with zero override lines.

## 6. Carry-forward register

- [ ] Opportunistic check after production's next routine deploy: config unchanged, no override
      line (same inert path staging proved; review non-blocking 1).
- [ ] `setup/install-neo4j.sh` (legacy HOST-install path, unused in containers) still carries
      naive MemTotal sizing — candidate cleanup or a pointer comment to the entrypoint.

## 7. Process findings (harness)

Retro basis: `scripts/harness-stats.sh` at close — 178 reviews parsed, 176 final PASS,
kick-back history 32/178 (≈18%).

| Finding | Source | Terminal state |
|---|---|---|
| Review-phase artifacts (review file, story flip) were committed at book close rather than at their own phase boundary — the story branch had already merged for the AC-5 staging proof | this close's retro | declined — AC-5 structurally requires the merge before the review can complete; the review rode the next commit (this close), nothing was lost; a story whose ACs span a deploy boundary may split its review commit this way |
| Ledger row 186 flipped DONE at close (frame bullet 6) with attribution corrected mid-story (live generator = entrypoint, not the legacy install script) | story/impl commits | OPEN.md row **186 → DONE** (this close's commit) |
| **The close gate caught a hermeticity bug in this book's own suite**: full `npm test` loads the repo `.env` into `process.env` (lib/config), so this machine's legitimate dev override leaked into the suite's bash subprocess and flipped the P-pins (6/9) — invisible to the scoped `node -e` gate, which loads no config. Fixed same-session: `runSizing` neutralizes ambient `BRAINSTORM_NEO4J_*` in its base env (empty ≡ unset); verified 9/9 under both clean and deliberately polluted environments. Lesson: suites that spawn subshells must pin every env var they are sensitive to — ambient dotenv state is part of the full-run environment. | this close's first gate run | fixed in the close commit (suite header documents the catch); ports to both flows |

**Light-profile trial record (trial #2, Bug lane):** Gate A = the operator's in-session design
ratification (opt-in override; store-size-driven rejected) + "run the story"; interior =
Implementer + Reviewer per the lane, no judge spawns (lane-correct); Gate B delivered with live
evidence from both container classes; the one human stop held. Findings-per-review: 1
non-blocking (teeth present on a small surface). Combined with trial #1 (tl-treasure-map), the
trial protocol's 2–3-book target is nearly met; the 30-day escaped-defect windows are open for
both.

## Post-flip gate result

- `npm test` after the flip + epic close-out (2026-08-28, run bpjwlx9tq): **Overall: PASS,
  exit 0** — 149 suites PASS, 0 FAIL, 31 skipped; `neo4j-sizing-override` 9/9 in the
  full-run environment (post-hermeticity-fix). First all-green registry since mid-July.
