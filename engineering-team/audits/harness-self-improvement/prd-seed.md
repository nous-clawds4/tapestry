# PRD Seed: The Self-Improving Harness

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/harness-self-improvement/audit.md`
**Anchor:** acceptance frame in `book.md` (operator-confirmed at kickoff)
**Confidence:** high
**Date:** 2026-07-04

> Reverse-engineered baseline in PRD shape for an unusual "product": the development harness itself. The users are this repo's contributors (human + Claude sessions). The product team adopts this as the starting point if a future phase evolves the process machinery further.

## 1. Product vision

`[FROM FRAME]` A development harness that improves as it is used: no process lesson can die silently (every one terminates in a ratified change, a tracked inbox row, or a recorded decline), drift cannot outlive the next session start undetected (a hook runs the invariant lint before any work; acting on it stays human), and process claims are checkable numbers instead of impressions. `[FROM FRAME]` Constraint honored throughout: **no new lesson surfaces** — one inbox (OPEN.md `meta`), one change record (CHANGELOG), one guard (lint).

## 2. Personas

`[FROM FRAME]` **The operator** — ratifies every gate; wants proposals argued from evidence and lessons that resurface themselves. `[FROM FRAME]` **The fresh session** (human or Claude, any machine, stack-present or absent) — needs orientation proportional to its task, a working stack-absent path, and the harness's health served to it rather than fetched by discipline. `[INFERRED]` **The remote/CI session** — the stack-absent persona's hard case; every mechanism runs on bash + git + coreutils, no network, no stack.

## 3. Scope (as-built)

`[FROM FRAME]` The five-stage loop — capture (`meta` rows) → route (book-close retro, no fourth state) → enforce (lint L1–L11 + waivers) → ratify (CHANGELOG + def-paths + L10) → measure (stats) — plus enforcement-matching-claims (SessionStart digest, agent permission scoping, honest rewording) and session-start economics (pointer table, fallback ladder, budget caps L11). `[FROM FRAME]` Explicitly out: CI (R-E3, blocked on suite hermeticity), new lesson surfaces of any kind.

## 4. Domain model

`[INFERRED]` **Lesson** (`meta` row: ages, clusters, escalates at lib-defined thresholds; terminal states: ratified commit / open row / declined). **Harness definition** (the def-path set — self-listing; changes demand a CHANGELOG row with an *origin*). **Invariant** (a lint check; violations are waivable only with a citation). **Budget** (a line cap on an always-loaded file; raising one is itself a recorded harness change). **Book** (intent anchor → stories → close → retro). No nostr concepts touched — this domain lives entirely in the repo.

## 5. Design rules (as-built)

`[INFERRED]` Facts live in exactly one machine-read place; other surfaces quote-and-point (thresholds → `collect-meta.sh`; caps + budget rule → `harness-budgets.txt`; verdict rule → `review-verdict.awk`; "the harness" → `harness-def-paths.txt`). Instruments never gate (stats, digest, escalation: always exit 0); only the lint gates, and only outside hooks. Enforcement claims state exactly what the platform enforces — "requires approval under default permission modes," never "literally cannot." Every mechanism must run stack-absent.

## 6. Carry-forward & open questions

Promoted from audit §6: the CI job (row 13 — the loop's biggest remaining manual dependency); BSD-date fallback (row 19); live-feed disposition (row 16); ROADMAP/OPERATIONS refresh (rows 14–15, now higher-cost because the pointer table sends readers there).

## 7. What product must validate

- [ ] `[UNKNOWN]` Is the *product team's* mirrored retro (Phase-7 gate) actually being exercised? This book validated the engineering side live; the product mirror shipped in story 3 but has had no live run.
- [ ] `[INFERRED]` The escalation thresholds (≥3 / >30d) were chosen by the review, not measured — after a quarter of real use, check the stats: do they fire often enough to matter, rarely enough to stay credible?
- [ ] `[UNKNOWN]` Multi-contributor semantics (review §4.6: attribution, merge conflicts on the ledger) were consciously out of frame — decide whether the next process phase takes them.
