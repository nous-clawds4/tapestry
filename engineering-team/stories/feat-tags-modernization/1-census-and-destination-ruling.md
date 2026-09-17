# Story 1: Census and destination ruling

**Status:** Done
**Created:** 2026-09-17
**Type:** Doc *(docs-mode; performed and ratified in session 2026-09-17, recorded here)*

## What was asked
Enumerate the 54 commits on `feat/tags` that `staging` lacks; for each one-sided feature, the
operator rules **promote to staging** or **tags-only**. This decides whether the pin stack is
integrated once or twice.

## Census (method: `git cherry origin/staging origin/feat/tags` + content checks on the merged tree)
| Feature on feat/tags | Also on staging in substance? | Ruling |
|---|---|---|
| `contextual-pins` (stories 1–3, ADR 0001, guides) | **No** — the only substantively unique feature | **Promote** (D1) |
| `sandbox-security` #2 (Sept prod security port) | Yes — `auth.js`, `siteTrust.js` byte-identical; nsec page removed on both | nothing to do |
| `security-auth-exposure` #1/#2 | Yes — book exists on both; legacy `run-query` route gone on both | nothing to do |
| `site-trust-signals`, `relay-scan-bounds`, About page, developers NIP-85 link | Yes | nothing to do |
| Firmware Explorer JSON-viewer toggle | Subsumed — staging's refactor (`CoreNodeViews`) carries a viewer/raw toggle | nothing to do |

## Acceptance
- [x] Every one-sided feature has a ruling (above).
- [x] Security parity verified on the merged tree, not assumed: `auth.js` identical to staging;
      nsec sign-in page absent; `publishEvent.js` carries both the signature check and the
      brain-write hook; legacy `GET /api/neo4j/run-query` not routed.

## Linked artifacts
- Book decision log: `engineering-team/audits/feat-tags-modernization/book.md` § Decision log (D1).
- Merge commit: `1f4fa6f7` (step-1 bulk merge) + `4d4c093e` (interim export).
