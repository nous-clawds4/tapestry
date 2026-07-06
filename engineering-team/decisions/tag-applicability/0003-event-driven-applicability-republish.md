# ADR 0003: Event-driven applicability republish — diff-guard + debounced client-notify + slow backstop

**Status:** Accepted
**Date:** 2026-07-06
**Story:** `engineering-team/stories/tag-applicability/4-event-driven-applicability-republish.md`
**Relates to:** ADR tag-applicability/0001 (the lists + `refreshApplicabilityLists`), `protocols/drafts/trusted-lists.md` (kind-30394)

## Context

The published kind-30394 applicability lists are for **external consumers** (our picker computes live
via `/api/tags/applicability` — always fresh, not on this path). They must track the tag vocabulary
without a busy polling timer. Membership (the SET of member tags) changes only on two mutations:
a **tag is created** with a context hint, or a **tag is first applied** to a target of a context type
(graduating it via USAGE). Re-applies change counts/order, not membership.

The write path is **client-side** (`publishOrThrow` → relays; `useEventTagging` / `useProfileTags`),
so the server doesn't see the tag/tagging publish. There is already a proven "client publishes → calls
a user-authed refresh endpoint → server republishes the TA-signed TL" pattern: **pin refresh-on-pin**
(`refresh-pinned-tag`, `handleRefreshOnePinnedTag` → `requireAuth`; called from `useRefreshPin.js`).

### Constraints
- **Churn-free.** No new list event when membership is unchanged.
- **Non-blocking.** The tagging UX must not wait on or fail from the trigger.
- **Convergent for external taggings.** Permissionless publishing (invariant #2) means taggings arrive
  from clients that never call our trigger — a backstop must eventually reconcile.
- Additive: picker read path, pubkey/note TLs, kind-30003 export untouched. No new dependency.

## Options considered

### Option A — diff-guard + debounced client-notify + slow backstop *(chosen)*

1. **Diff-guard in `refreshApplicabilityLists` (the keystone).** Before publishing each list, read the
   currently-published kind-30394 event (`scanStrfry({kinds:[KIND], '#d':[dTag]})`, latest by
   `created_at`) and compare its member **SET** (the `a`-tag values) to the freshly-computed set;
   **skip the publish when the set is unchanged.** This makes *every* caller — the event trigger and
   the backstop — churn-free: call them liberally, unchanged ⇒ no event. Returns per-list
   `{ republished | skipped }`.
   - **Diff on the SET, not the ordered list.** Republish captures *membership* changes only (create /
     first-in-context use); usage-count reordering does **not** republish (that would re-churn on every
     apply). Ordering/count freshness in the published snapshot rides the backstop. (The picker doesn't
     read this list, so live ranking is unaffected.)

2. **In-process debounced scheduler** — a factory `createApplicabilityScheduler({ refresh, windowMs })`
   → `{ schedule() }`. `schedule()` coalesces all calls within `windowMs` (~10s) into **one** `refresh()`
   run and guards against overlap (a call mid-run re-schedules one trailing run). The control panel is a
   single node process, so in-memory state is sufficient. One app singleton wires `refresh =
   refreshApplicabilityLists`.

3. **User-authed notify endpoint** — `POST /api/trusted-list/notify-applicability` (`requireAuth`,
   mirroring `refresh-pinned-tag`) calls `scheduler.schedule()` and returns `202` immediately. Debounce
   + diff-guard absorb abuse. The existing **loopback** `refresh-applicability-lists` stays for
   cron/manual (immediate, undebounced).

4. **Client fires it best-effort** — a `notifyTagApplicability()` util (fire-and-forget `fetch` POST,
   errors swallowed) called from the mutation success paths: `useProfileTags` `createTag` + `applyTag`
   (pubkey), and `useEventTagging` apply + new-tag create (event). Never blocks/awaited in the UX path.

5. **Slow backstop** — extend `scheduled-tasks/freshInstallEntries` to also seed `refreshApplicabilityLists`
   (`enabled:false`, `intervalHours:1`). Churn-free via the diff-guard, so hourly just reconciles external
   taggings. (Fresh-install seed only, per the existing convention — existing deployments enable it in
   the control panel.)

- **Pros:** reuses the proven pin-notify pattern; diff-guard kills churn for *all* callers; instant for
  app mutations, eventually-consistent for external; no new dependency/infra; picker untouched.
- **Cons:** in-process debounce is lost on a mid-window restart (next mutation or the backstop recovers);
  published *ordering/counts* are backstop-fresh, not instant (acceptable — membership is instant; picker
  uses live compute).

### Option B — server-side strfry subscription/watch
Watch strfry for new kind-39999 tag-elements + taggings (ours **and** external) and debounce-republish.
Fully event-driven, catches external taggings instantly. **Rejected:** a persistent subscription is more
infrastructure than the goal needs; the hourly backstop already reconciles external taggings.

### Option C — read-through on the picker
Rebuild the TL when a page requests it and it's stale. **Rejected:** the picker reads the live endpoint,
not the published TL — nothing hot reads it — and publishing on a GET is a write-on-read needing a lock.

## Decision

**Option A.** Diff-guard (set-compare) in `refreshApplicabilityLists`; an in-process debounced scheduler;
a user-authed `notify-applicability` endpoint the client fires best-effort after create/apply; and the
existing `refreshApplicabilityLists` task seeded as a disabled hourly backstop. Instant for app-driven
membership changes, eventually-consistent for external taggings, churn-free throughout.

## Consequences
- **Enables:** external consumers see membership changes promptly; no redundant snapshot events.
- **Freshness split:** *membership* is instant (on app mutation); *ordering/counts* and *external*
  taggings are backstop-fresh (hourly). Acceptable — the picker uses live compute; external consumers
  get correct membership immediately.
- **Restart edge:** a pending debounced run dropped on restart is recovered by the next mutation or the
  backstop.
- **POV:** the published lists are house-POV (unchanged); this story only changes *when* they republish.
- **Firmware reinstall?** No.

## Implementation notes
- **`src/api/trustedList/refreshApplicabilityLists.js`** — add the set-diff guard around each `publishTL`
  (read current via the injected `scanStrfry`, compare sorted `a`-values); thread a `republished` flag
  into the returned `out[]`. Keep the deps seam (tests inject `scanStrfry`/`publishTL`).
- **`src/api/trustedList/applicabilityScheduler.js`** (new) — `createApplicabilityScheduler({ refresh, windowMs = 10000 })`
  → `{ schedule }`, coalescing + overlap-guarded. Pure of transport; unit-testable with a spy `refresh`
  and a tiny `windowMs`.
- **`src/api/trustedList/index.js`** — construct one scheduler singleton (`refresh = () => require('./refreshApplicabilityLists').refreshApplicabilityLists()`);
  add `POST /api/trusted-list/notify-applicability` (`requireAuth` → `schedule()` → `202`).
- **`ui/src/utils/notifyTagApplicability.js`** (new) — `fetch('/api/trusted-list/notify-applicability', {method:'POST'})`,
  `.catch(()=>{})`; called (not awaited) from `useProfileTags` create/apply + `useEventTagging` apply/create.
- **`src/api/scheduled-tasks/index.js`** — `freshInstallEntries` returns the existing `refreshPinnedTagTLs`
  seed **plus** a `refreshApplicabilityLists` seed (`enabled:false, intervalHours:1`).
- **Testability:** diff-guard (existing 30394 with same set ⇒ no publish; different set ⇒ publish);
  scheduler (3 rapid `schedule()` ⇒ one `refresh`; mid-run call ⇒ one trailing run); endpoint sentinel
  (registered, `requireAuth`, calls `schedule`); client sentinel (mutation paths call the util); backstop
  sentinel (`freshInstallEntries` includes `refreshApplicabilityLists`, disabled, hours).

## Out of scope
- Instant freshness for external taggings (backstop is eventual); a strfry watch; the note/pin TLs; any
  change to the picker read path or the HINT ∪ USAGE computation.
