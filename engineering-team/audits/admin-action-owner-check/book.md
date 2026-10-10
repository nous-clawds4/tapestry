# Book of Work: Every admin action checks who is asking — the sweep

**Slug:** admin-action-owner-check
**Status:** Open
**Opened:** 2026-10-10
**Closed:** —
**Gating:** **Human-gated.** A live access-control change on every deployed instance; the owner answers every gate.
No Direction mode.

## Intent anchor

**Acceptance frame (no PRD)**: the owner's decision of 2026-10-10, taken in book `negentropy-sync-access`
(decisions 10–11) and restated here. Completion is *judged* against the bullets below.

The owner's words: "sweep first, as a story", rather than piecemeal hotfixes. The ask: find every action that someone
other than the owner or an admin can reach today, under any method, and close the whole class at once, with a guard
that keeps the next new action from being found open by a review. Three stories in one day (`security-auth-exposure`
5, 6 and 7) each found a hole that the hand-kept lists had missed, which is why the owner asked for the class and not
for more members.

**Confirmation:** confirmed by the owner at story 8's Planning gate (2026-10-10), together with the answers to (a)–(e).

### Acceptance frame

*(Ticked only after the review that re-derives each bullet from the code — ledger
`2026-10-10-frame-ticked-before-review`.)*

- [ ] **Every route has been looked at and sorted.** Every route the instance serves, under any method (GET and HEAD
      included) and inside or outside the API prefix, is classed as a read, an action for the owner's side, or an action
      the owner has opened to signed-in people or to visitors. Nothing is left unsorted.
- [ ] **Actions are the owner's side's unless the owner opened them.** Every action not on the approved allowlist
      refuses everyone except the owner, admins and the instance's own scripts (direct-local callers): 401 when not
      signed in, 403 when signed in. This holds whatever method reaches the route and however its path is spelled.
- [ ] **What everyone else may do is written down, once.** The allowlist of actions open to ordinary signed-in people
      (and, within it, to visitors) is explicit and kept in one place. The Architecture proposes it, and the owner
      approves it before any fix is built.
- [ ] **Nothing the owner's side does breaks.** The owner, admins and the instance's own scripts keep every action.
      Public reads stay public, and anyone may still publish an event they signed themselves.
- [ ] **The next new action can't slip in.** The test gate fails, naming the route, when an action is added without a
      guard or an allowlist entry, GET routes included.
- [ ] **What people who can't act see** is as the owner decides (story 8, open question b).
- [ ] **Shipped wherever it is live:** production, `staging`, and both long-lived sandboxes (`feat/tags`,
      `feature-magic-carpet`) in the same round (ledger `2026-10-10-sandboxes-got-security-fixes`). No route this book
      fixes is named in public before its fix is in production.

## Epics in this book

- `security-auth-exposure` — story 8. The epic **stays Done**. This open book carries the active-work signal, as
  `audits/auth-signature-verification/` did for story 3 and `audits/negentropy-sync-access/` did for stories 4–7
  (OPEN.md row 268).

## Ground rules for this book

1. **Disclosure.** The repo is public, and members of this class are still open on production. No story, ADR, test
   plan, review, ledger row or commit message names a still-open route, file, line or handler. They describe members
   only by class: "admin actions without an owner check of their own", "GET routes that act or start heavy work". The
   inventory with names is the Architecture's working material. It is committed only together with the fixes it lists,
   or after they ship. Whoever commits text for this book first searches it for route paths and checks each one it
   finds against the routes already closed (ledger `2026-10-10-review-files-committed-unscreened`).
2. **No claim the search didn't make.** A record says "every", "only" or "no other" only where a search backs it, and
   the Reviewer re-derives the inventory from the code, not from the list (ledger
   `2026-10-10-after-the-fact-record-misses-siblings`).
3. **Per-phase commits stay on**, within rule 1. The named inventory waits for its fixes. Everything else commits at
   its phase boundary as usual.

## Decisions carried in (already taken)

1. **Sweep first, as its own story, not piecemeal hotfixes.** *(Owner, 2026-10-10; book `negentropy-sync-access`
   decision 10.)*
2. **The plan was kept after two more facts:** a committed review names several open members in public, and an
   owner-only path is served by a GET that can act. *(Owner, 2026-10-10; book `negentropy-sync-access` decision 11.)*
3. **Visitors' default-deny for mutations stands**, with its two public exceptions: publishing an event the caller
   signed themselves, and the public graph query, whose writes are already limited to the owner's side (ADRs
   `security-auth-exposure/0001` and `0002`).
4. **Direct-local callers stay trusted:** the instance's own loopback scripts, its scheduled jobs and the
   firmware-install bridge (ADR `security-auth-exposure/0002`).
5. **The point-of-view sync stays open to signed-in people, narrowly** *(owner; book `negentropy-sync-access`
   decision 2)*. **Task control is for the owner, admins and direct-local callers** *(owner; same book, decision 7)*.
6. **Batch 0, shipped ahead of the Architecture gate.** While sizing the inventory, the Architect found request values
   reaching a shell string in a few handlers. The owner chose a hotfix everywhere at once, and the Architecture gate
   waited for it. It shipped 2026-10-10 to `staging`, production (PR #844), `feat/tags` (#845) and
   `feature-magic-carpet` (#846). Record: ledger `2026-10-10-request-values-reached-a-shell`. *(Owner, 2026-10-10.)*

## Decisions to take (owner)

At Planning, in story 8's Open questions (**all answered 2026-10-10**; the answers are recorded in story 8):

- **(a)** Which actions, if any, ordinary signed-in people, customers and visitors should keep (seed
  `audits/negentropy-sync-access/prd-seed.md` §7, first question).
- **(b)** What people who can't act should see: hidden, disabled with an explanation, or the bare 403.
- **(c)** Whether task status, history and schedules stay public reads.
- **(d)** One release, or batches shipped as the inventory finds them.
- **(e)** Whether "admin" is the owner's equal for all of these (OPEN.md row 269).
- **Confirm the acceptance frame above.** Done.

Answers in short: (a) owner's side by default, allowlist entries approved one by one; (b) the bare 403 now, the UI
in a follow-up story; (c) task reads stay public; (d) the inventory's size first, then batches or one release;
(e) admins equal the owner by default, doubtful actions decided one by one.

At Architecture:

- **Approve the allowlist**, entry by entry.
- **Approve the classification of anything the Architect marks as a judgment call**: a route whose class isn't clear
  from what it does.

## Sources

- `engineering-team/stories/_intake.md`, entry 2026-07-21 "Security: gate authenticated-non-owner access to admin
  mutations (security-auth-exposure phase 2)", with its 2026-09-30 and two 2026-10-10 addenda.
- `engineering-team/audits/negentropy-sync-access/` — `book.md` decisions 10–11; `audit.md` §4 #7–8, §5 (debt) and
  §6 #1, #4–7; `prd-seed.md` §7.
- `engineering-team/audits/security-auth-exposure/audit.md` §5–6 and `prd-seed.md` §7.
- ADR `security-auth-exposure/0002` (default-deny for mutations; its out-of-scope item on signed-in non-owners) and
  ADR `security-auth-exposure/0004` (a new sync route must remember its guard).
- OPEN.md rows 268, 269 and 276 (F4/F5).

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/admin-action-owner-check/audit.md`
- Product feedback: `engineering-team/audits/admin-action-owner-check/prd-seed.md`
