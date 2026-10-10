# Book of Work: Who may run a negentropy sync, and the access holes found on the way

**Slug:** negentropy-sync-access
**Status:** Open
**Opened:** 2026-10-10
**Closed:** —
**Gating:** **Human-gated.** A live access-control fix; the owner answers every gate. No Direction mode.

## Intent anchor

**Acceptance frame (no PRD)**: the owner's decisions of 2026-10-10, taken on ledger row
`2026-10-09-negentropy-sync-access-scope` (opened by book `assistant-outbox-relays`'s close). Completion is *judged*
against the bullets below.

The owner's words: "The negentropy sync should be able to be managed by the owner and by admins." Then, asked about the
three pages that sync a point of view for an ordinary signed-in person: keep that narrow sync. Asked how to ship, given
that one sync route was reachable without signing in on production: hotfix now, with the story and ADR written right after.
Asked about the saved presets: owner and admins.

### Acceptance frame

- [x] The owner, an admin, or a direct-local caller (the loopback task scripts) may run any negentropy sync.
- [x] Any other signed-in person may run only the point-of-view sync: download one author's kind 30382 Trusted
      Assertions, as Brainstorm Search, Search Preferences and Brainstorm Settings send it.
- [x] Everyone else is refused: 401 when not signed in, 403 when signed in. No sync route answers an anonymous visitor.
- [x] The saved sync presets are managed by the owner and admins (already true: their guard's `isOwner` is the
      owner-or-admin alias).
- [x] Shipped to production as a hotfix (PR #837) and to `staging` (`dc318717`), with the story and ADR recorded after.
- [x] **Story 5 (found by story 4's review):** the central auth check judges a path however it is capitalized, as
      Express routes it. Shipped as a hotfix (PR #839).
- [x] **Story 6 (found by story 4's review):** starting a registered task and changing what runs on a schedule are for
      the owner, admins and direct-local callers; the saved presets list is guarded like the sync status. Shipped as a
      hotfix (PR #840). With it, bullet 2 holds for the task routes too.
- [x] **Story 7 (found by story 4's review round 2):** a HEAD request is judged as its GET is. Shipped as a hotfix
      (PR #841).

## Epics in this book

- `security-auth-exposure` — stories 4–7 (the epic stays Done; this book carries their active-work signal, as
  `audits/auth-signature-verification/` did for story 3).

## Decisions taken at intake (2026-10-10)

1. **Who.** Owner and admins (and direct-local callers) run syncs. *(Owner.)*
2. **The POV sync stays open to signed-in people**, narrowly: `dir: "down"`, `filter` exactly
   `{ kinds: [30382], authors: [<one lowercase hex pubkey>] }`. *(Owner, recommended option.)*
3. **Ship as a hotfix**, record after. *(Owner, recommended option.)*
4. **Presets: owner and admins.** *(Owner.)* No code change was needed.
5. **Which relays** (any `ws(s)://` address or public ones only) was not decided. Owner and admins are trusted with
   any relay, as with the relay router; whether the POV sync should be limited to public relays is carried as ledger
   row `2026-10-10-pov-sync-relay-scope`.
6. **Capitalized paths (story 5): hotfix now, middleware fix only.** *(Owner, recommended options.)* Case-sensitive
   routing as a second safeguard is ledger row `2026-10-10-case-sensitive-routing`.
7. **Task control (story 6): owner, admins and direct-local callers, as a hotfix.** *(Owner, recommended option.)*
8. **The saved presets list: guarded like the sync status.** *(Owner.)*
9. **HEAD requests (story 7): hotfix now.** *(Owner, recommended option.)*
10. **The remaining admin actions with no owner check of their own** (`_intake.md` 2026-07-21): an exhaustive sweep
    as its own story, not piecemeal hotfixes. *(Owner.)* Not part of this book's frame.

## Artifacts

- Story: `engineering-team/stories/security-auth-exposure/4-negentropy-sync-owner-and-admins.md` (+ `.test-plan.md`)
- ADR: `engineering-team/decisions/security-auth-exposure/0004-one-guard-for-negentropy-syncs.md`
- Stories 5–7: `engineering-team/stories/security-auth-exposure/5-paths-judged-case-insensitively.md`,
  `6-task-control-owner-and-admins.md`, `7-head-judged-as-get.md` (+ `.test-plan.md` each)
- Reviews: `engineering-team/reviews/security-auth-exposure/4-…`, `5-…`, `6-…` (and `7-…` once written)
