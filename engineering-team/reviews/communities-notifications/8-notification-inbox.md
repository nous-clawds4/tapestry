# Review: Story communities-notifications/8 — Notification inbox

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-06
**Diff:** working-tree (uncommitted). New: `ui-communities/src/lib/notifications.js`, `ui-communities/src/hooks/useNotifications.js`, `ui-communities/src/pages/NotificationInbox.jsx` (+ `.module.css`). Modified: `ui-communities/src/events/fetch.js`, `ui-communities/src/App.jsx`, `ui-communities/src/components/Header.jsx` (+ `.module.css`), `test/notification-inbox.test.js`, `test/test.js`.

## Quality gates (run by reviewer, not trusted)

- [x] `node test/test.js` — **PASS**. Overall PASS; notification-inbox suite 12/12; all other suites green, no regressions.
- [x] `npx eslint src/lib/notifications.js src/hooks/useNotifications.js src/pages/NotificationInbox.jsx src/App.jsx src/components/Header.jsx src/events/fetch.js` — **exit 0** (verified via explicit `$?`).
- [ ] _Typecheck not configured — skipped (JS-without-build, per house rules)._
- [ ] _Build not configured for this review — skipped._

## Spec adherence
- [x] AC1 (quiet new-marker when something new + unseen, pref-gated) — `hasNew` (notifications.js:49) + `useNotifications` gate (useNotifications.js:25–27); dot in Header.jsx:166–171. Tested T8/T1/T11.
- [x] AC2 (one plain sentence: actor / occasion / circle / time) — `notificationSentence` (notifications.js:55–62) + inbox row (NotificationInbox.jsx:51–67). Tested T9. **Caveat:** see Blocking #1 — in practice the circle is always null for reply/new-post rows, so the sentence degrades to the no-circle fallback ("…replied to you" / "New posts in a circle you’re in"). The *unit* test passes because it injects a populated circle index directly; the wired path never populates it.
- [x] AC3 (opening clears marker; items link to source) — `markSeen` on mount (NotificationInbox.jsx:19–21), `Link to /community/{slug}` (NotificationInbox.jsx:62–64). Tested T12. **Caveat:** `sourceSlug` is always null in the wired path (Blocking #1) → reply/new-post rows render as a non-link `<span>`, so "each item links to its source" is not actually met for the two circle-scoped occasions.
- [x] AC4 (off occasions produce no items and never mark) — pure gate in `buildNotifications` (notifications.js:22/29/36) + hook early-return-before-fetch (useNotifications.js:25–27). Tested T2/T8. **Verified the sovereignty property holds**: when signed-out or all prefs off, `load()` returns before any `fetchNotificationSources` call — the default opted-out state costs nothing.
- [x] AC5 (empty state copy; error + retry) — empty copy verbatim (NotificationInbox.jsx:44–48), `role="alert"` error + Retry → `reloadNotifications` (NotificationInbox.jsx:37–42). Hook distinguishes `error` from empty via `status` (useNotifications.js:18,44–45). Tested T12.
- [x] AC6 (dot not count + text equivalent; no nag/urgency) — 7px `--accent` dot, `aria-hidden`, paired sr-only "new updates" (Header.jsx:167–170, Header.module.css:226–245). No numeric badge anywhere. Copy carries no urgency. Matches design-guide principle 8 and a11y line 90.

## ADR adherence
- [x] Files changed match ADR-0038's implementation notes (pure core + thin fetchers + app-level hook + Header dot + inbox route + token CSS).
- [x] The three derivations match the ADR filters: vouch = kind-39999 `#p=viewer` filtered to `z` nostr-user-tag + `polarity==='1'` (notifications.js:90–95); reply = kind-1111 `#p=viewer` filtered to has-`e` (notifications.js:97–99); new-posts = kind-1111 `#A=joinedATags` (notifications.js:83–84, 101–102). Projection (actor=pubkey, target from `p`, aTag from `A`) correct.
- [x] Exclude-own + priority dedup correct: own events skipped (`actor === viewer` / `target !== viewer`); replies pushed before new-posts so a shared id dedups to `reply` (notifications.js:28–42, `seen` Set). Tested T3/T6.
- [x] `now` purity: no `Date.now()` in render. `markSeen` stamps inside a callback (notifications.js:72); `relativeTime` is called in render but reads `Date.now()` internally — that is the existing shared helper, not new render-time clock logic introduced here. Acceptable and consistent with the rest of the app.
- [x] `fetch.js` export widening sound: `USE_MOCK`, `FETCH_TIMEOUT_MS`, `collectFromRelay` are export-promoted with no behavior change to existing fetchers (diff is `const` → `export const`, `async function` → `export async function` only). `collectFromRelay` is a legitimate shared relay primitive; not a leak of anything that should stay private.
- [x] App-level wiring: `useNotifications` runs in AppShell (App.jsx:144), feeds Header `hasNew` (App.jsx:177) and the inbox via outlet ctx (App.jsx:148–152). Set-after-unmount guarded by `cancelled` (useNotifications.js:23,44–46). Effect deps `[viewer, signedIn, joinedKey, nonce]` re-run on identity switch, sign-in, joined-set change, and reload — correct.
- [x] Real-source tests exercise shipped code: T1–T9 extract-and-eval the genuine exported functions via `loadExport`. `MAX_ITEMS` inlined into `buildNotifications` (notifications.js:16) so it evaluates standalone — sound; the inlined value matches the ADR's "cap to a sane N (e.g. 50)".

## Concept-graph integrity
- [x] Handles are in `kind:pubkey:slug` form (`circleATag`, ADR-0036). Coordinates built via the shared helper, not re-derived.
- [x] No concept definitions changed → no firmware reinstall.
- [x] No BIBLE.md re-reading introduced.

## Things tests can't catch
- [x] No secrets committed.
- [x] No leftover debug logging / `console.log` in the new files.
- [x] No commented-out code.
- [x] Error paths handled (hook `status: 'error'` → inbox alert + retry; `getLastSeen`/`markSeen` localStorage wrapped in try/catch).
- [x] Concurrency: `cancelled` flag prevents set-after-unmount; `reload` nonce serializes re-fetch through the effect.
- [x] Security: read-only viewer surface, no outbound writes; relay filters are constructed from the viewer pubkey + joined coordinates, no injection surface.
- [ ] **Edge case gap — see Blocking #1.** A notification whose circle isn't in the joined index degrades gracefully (sentence fallback, non-link span) — but because the index is *always* empty in the wired path, this "graceful degradation" is the permanent state for every reply and new-post, not an edge case.

## House rules check
- [x] Concept Graph API authority respected (no new domain concepts).
- [x] No new lint/typecheck/build tooling.
- [x] Token-based CSS; no hardcoded palette beyond the existing `rgba(224,86,107,...)` error wash already used elsewhere in the codebase.

## Findings

### Blocking
1. **`ui-communities/src/hooks/useNotifications.js:30–36` (root cause: `ui-communities/src/api/client.js:300–313`)** — The hook resolves joined circles via `getJoinedCommunitySummaries(slugs, viewer)` and feeds each summary straight to `circleATag(c)`. But `getJoinedCommunitySummaries` projects a fixed shape (`slug, name, description, tags, image, accent, language, memberCount, trustedHere, activity, members, joined`) that **omits both `model` and `founder`** — the two fields `circleATag` requires. With `model` undefined, `circleATag` falls to kind `'39999'`; with `founder`/`curator`/`viewerFallback` all undefined, it returns `null`. Result: for every joined circle, `circleATag(c)` is `null`, so:
   - `joinedATags` is always `[]` → the new-posts relay query is gated off entirely (`joinedATags.length ? collect(...) : Promise.resolve()`, notifications.js:84). **The "new posts in your circles" occasion never fires in production**, defeating one of the three derivations (Story AC2/AC3, ADR "three occasions").
   - `circleIndex` is always empty → reply items get `circle: null` and `sourceSlug: null` (notifications.js:32–33). Reply sentences drop the circle name (design guide line 31 shows the circle is expected: "maya vouched for you in Sunset Hikers") and reply rows render as a **non-link `<span>`** (NotificationInbox.jsx:62–64), so AC3 "each item links to its source" is not met for replies either.

   The unit tests pass only because T4/T5/T6 inject a pre-populated `circleIndex` Map directly into the pure `buildNotifications`; nothing tests the hook's `circleATag` projection, so the gap is invisible at the gate. Note this is exactly why Discover (`Discover.jsx:51,58–69`) gets away with the same call: there the bare summaries are deduped *behind* the API list (`getCommunities`) which carries `model`/`founder`, so `circleATag` runs on the richer object. The notification hook calls `getJoinedCommunitySummaries` standalone, so nothing masks the missing fields.

   **Asked change:** make the joined coordinates resolvable. Either (a) add `model` and `founder` to the `getJoinedCommunitySummaries` projection at `client.js:300–313` (smallest fix; also hardens Discover), or (b) in the hook, fetch full circle records (e.g. `getCommunity` per slug, as the summary helper already does internally) before calling `circleATag`. Then add a hook-level (or integration) test that asserts a joined declaration circle yields a non-null `aTag` and that a new-post in that circle surfaces — the current suite cannot catch this regression.

### Non-blocking
1. **`ui-communities/src/lib/notifications.js:60`** — the new-post no-circle fallback "New posts in a circle you’re in" exists, which is good defensive copy; but once Blocking #1 is fixed it should rarely render. Leave it — it's the correct fallback for the genuine edge case (a joined slug that fails to resolve). No change needed.
2. **`ui-communities/src/pages/NotificationInbox.jsx:52`** — display name uses `npubShort(actor)` only; there is no profile-name resolution, so every actor reads as `npub1abcd…wxyz`. The ADR says "actor display name via the existing profile/`npubShort` helpers" — `npubShort` alone is within the documented v1 floor, but a profile-name lookup would read far more humanely ("maya vouched for you"). Acceptable for v1; flag for a follow-up if profile resolution is cheap to thread through. Optional.
3. **`ui-communities/src/lib/notifications.js:76`** — `fetchNotificationSources` queries with `limit: 100/100/200` and no `since`; lookback is bounded only by limit, exactly as the ADR documents ("lookback bounded by query `limit`"). Fine for v1; noting it as a known scope line, not a gap.

## Guardrails / v1 simplifications check
- token CSS — yes; honest copy — yes; vouch items omit circle (tag-scoped) — yes, matches ADR Consequences; links target the circle page (no per-post permalink) — yes; fetch-on-load not real-time — yes; one last-seen marker — yes. All match the ADR's documented scope. **The one item that is NOT a documented simplification but a defect** is the empty `circleIndex`/`joinedATags` (Blocking #1): the ADR says "your circles = joined", which is supposed to *work* off the local joined set; it currently resolves to nothing.

## Verdict
**CHANGES REQUESTED** (initial review — superseded by re-review below)

The pure core (gating, exclude-own, priority dedup, sort, sentence, marker) is clean, well-tested against real source, and faithfully implements the sovereignty properties; the hook's pref-gated early-return-before-fetch is correct; a11y and copy meet principle 8 and the style guide; lint and the full suite are green. But one wiring defect (Blocking #1) silently disables the "new posts in your circles" occasion and strips circle name + source link from reply rows, because `getJoinedCommunitySummaries` drops the `model`/`founder` fields `circleATag` needs. Two of the three advertised occasions are degraded in the real app while the unit tests stay green (they inject the circle index directly). Fix the joined-coordinate resolution and add a test that would have caught it, then this is a PASS.

---

## Re-review — 2026-06-06

**Trigger:** Implementer applied a fix for Blocking #1. Re-audited the fix and ran all gates fresh.

### Blocking #1 — RESOLVED
- **Fix (chosen option (a), the smallest + Discover-hardening one).** `getJoinedCommunitySummaries` (`ui-communities/src/api/client.js:300–318`) now projects `model: c.model || null`, `founder: c.founder || null`, and `curator: c.curator || null` (with an explanatory comment). The source these come from — `getCommunity` → `realGetCommunity` — already carries `model`/`founder`/`curator` (declaration records, bespoke relay records, and the API path that defaults `model: 'bespoke'`), so the projection now populates the fields `circleATag` requires.
- **Coordinate now resolves.** `circleATag` (`circle.js:8–16`) on a `getJoinedCommunitySummaries`-shaped declaration circle (`model:'declaration'`, `founder`, `slug`) returns `39998:<founder>:<slug>` (non-null). In the hook (`useNotifications.js:33–36`) that means `joinedATags` is non-empty → the new-posts `#A` query fires (gated on `joinedATags.length` at notifications.js), and `circleIndex` is populated → reply rows recover their circle name + `/community/{slug}` source link. The exact two degradations called out in Blocking #1 are reversed.

### Regression tests — genuinely catch the original gap
- **T13** (`circleATag` contract) asserts the declaration shape → `39998:founder:slug` and the missing-`model`/`founder` shape → `null` ("the gap that silenced new-posts"). It exercises the real exported `circleATag` via `loadExport`. Matches `circle.js` behavior exactly.
- **T14** (source-guard) asserts the client projection carries `model: c.model` and `founder: c.founder`. **Verified it would have failed against the pre-fix code:** `git show HEAD:ui-communities/src/api/client.js` contains no `model: c.model` projection anywhere, so the `model:\s*c\.model` assertion fails pre-fix. T14 is a true regression guard, not a tautology.

### Gates (run fresh by reviewer)
- [x] `node test/test.js` — **Overall PASS**; **notification-inbox 14/14** (was 12/12; +T13/T14); all other suites green, no regressions.
- [x] `npx eslint src/api/client.js src/lib/notifications.js src/hooks/useNotifications.js src/pages/NotificationInbox.jsx` — **exit 0** (verified via `$?`).

### Additive-only check for existing consumers
The diff to `client.js` adds three fields and changes nothing else. Other callers of `getJoinedCommunitySummaries` — `Discover.jsx`, `MyCircles.jsx` — receive a strict superset of the prior shape; no field renamed or removed. Discover already worked (it deduped behind the richer `getCommunities` list), so the added fields are harmless there. Behavior change is additive only.

### Non-blocking notes — re-confirmed, still non-blocking
1. New-post no-circle fallback copy (`notifications.js:60`) — unchanged; correct defensive fallback for a genuinely unresolvable joined slug. Within v1 scope.
2. Actor display via `npubShort` only (`NotificationInbox.jsx:52`) — unchanged; within the documented v1 floor. Optional follow-up.
3. No `since` lookback bound (`fetchNotificationSources`, bounded by `limit`) — unchanged; exactly as the ADR documents. Known scope line, not a gap.

## Final verdict
**PASS** — Blocking #1 is resolved at the root (`getJoinedCommunitySummaries` projection), the two affected occasions (new-posts + reply circle link) now work in the wired path, the new tests (T13/T14) would have caught the original gap, all gates are green (suite PASS / 14-14 notification-inbox / eslint 0), and the change is additive-only for existing consumers. The three non-blocking notes remain within documented v1 scope. Story → Done.

→ Story: [`engineering-team/stories/communities-notifications/8-notification-inbox.md`](../../stories/communities-notifications/8-notification-inbox.md) (Status: Done)
