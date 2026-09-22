# Epic: llms-txt

**Created:** 2026-09-22
**Status:** Done
**Retired:** 2026-09-22 — story 1 Done (review PASS same day), on staging via PR #740 and production via #741 the same day; also synced to the `feat/tags` and `feature-magic-carpet` sandboxes by direct cherry-pick + push (no PR — those branches predate `staging`-first review conventions). Story, ADR, review and test plan moved under `done/llms-txt/`. Book closed the same day.
**Book:** `engineering-team/audits/llms-txt/book.md` (acceptance-frame)
**Provenance:** `engineering-team/stories/_intake.md` § "2026-08-18 — Serve llms.txt on the tapestry fleet (protocols#6)". Open since 2026-08-18; picked up 2026-09-22, directly following the `site-trust-signals` book close.

## Goal

Serve [llms.txt](https://llmstxt.org/) — a root-level, curated markdown map of key documents for visiting AI agents — on all four tapestry-fleet hosts, as a third exact-match document through the plumbing `site-trust-signals` built (`src/utils/siteTrust.js`, ahead of the SPA catch-all).

The adoption path for the estate's trust scores increasingly runs through developers' AI assistants. An agent that fetches `<host>/llms.txt` should be routed on the first hop to the normative specs, `CONCEPTS.md`, and `ECOSYSTEM.md` in `NosFabrica/protocols`, plus this repo's own orientation docs — not left to guess from a contentless SPA shell.

## Stories

1. `stories/done/llms-txt/1-serve-llms-txt-on-the-fleet.md` — the document builder, the route, and the `robots.txt` exemption. **Done** (review PASS 2026-09-22).

## Key facts / guardrails

- **Content is pointers only.** The file almost never changes because it never duplicates text — it links into `NosFabrica/protocols` (canonical) and this repo's own top-level docs. The estate discrepancy rule applies: if `llms.txt` and `ECOSYSTEM.md` ever disagree, `ECOSYSTEM.md` is right.
- **`robots.txt`'s `Disallow: /` and `llms.txt`'s discoverability are different concerns.** One is a search-indexing signal; the other is a deliberate-agent affordance. Blocking `/llms.txt` on non-production hosts because those hosts opt out of *indexing* would conflate the two.
- **Every link must resolve, and stay resolving.** Fold the check into the same renewal ritual that owns `security.txt`'s `Expires` field (OPEN.md row 172), so a link rot doesn't sit silently for a year.
- **Out of scope:** the Product UI fleet, the relay fleet, and the API-host fleet — same defect class as `site-trust-signals`, different repositories, tracked in the book.
