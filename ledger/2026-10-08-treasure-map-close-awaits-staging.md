# The treasure-map-edit book's close is on its feature branch, not yet on `staging`

**Id:** 2026-10-08-treasure-map-close-awaits-staging
**Type:** cleanup
**Opened:** 2026-10-08 (treasure-map-edit book close)
**Status:** DONE
**Done:** 2026-10-08 — the close reached `staging` in PR #822 (`b3cc8ae8`) and `main` in the promotion PR
#823 (`4c91c9f3`, deploy run 37860767117). `feat/treasure-map-edit` is deleted locally and on `origin`, with the
owner's yes.

The book's code reached `staging` through PR #821 (merged as `f0a4c59d`). Its close commit (`book-close:
treasure-map-edit`) and the handoff refresh after it landed afterwards on `feat/treasure-map-edit`. That commit holds
the audit, the seed, the book flipped to Closed, the epic moved under `done/` and these ledger edits. Until it reaches
`staging`, a session reading `staging` sees the book Open and the epic Active, and `/whats-open` lists it as open.

**Fix shape.** A docs-only PR from `feat/treasure-map-edit` to `staging` (`/cycle-staging`; no code changes, so the
deploy changes nothing served). Once merged, set this row DONE, and delete `feat/treasure-map-edit` locally and on
`origin` with the owner's yes, once the book is on `main` too.

**Pointer:** `engineering-team/audits/treasure-map-edit/audit.md`; `docs/TREASURE_MAP_EDIT_HANDOFF.md` § 0.
