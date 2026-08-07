# Review: Story 3 — The stamped composite avatar, published to nostr

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-07
**Diff:** `git diff feat/ta-published-profile...HEAD` (commit `00d5e562`, branch `feat/ta-composite-avatar`)
**Story:** `engineering-team/stories/ta-avatar/3-stamped-composite-avatar-on-nostr.md`
**ADR:** `engineering-team/decisions/ta-avatar/0003-owner-composited-avatar-hosted-by-the-instance.md`
**Test plan:** `engineering-team/stories/ta-avatar/3-stamped-composite-avatar-on-nostr.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] **Server class** — `node -e "require('./test/stamped-composite-avatar.test.js').run()"` → **13 passed, 0 failed, 2 skipped** (H1/H2 skip because the reachable instance does not serve this story — by design, and announced).
- [x] **Browser class** — rebuilt `ui/` myself and served it at `:4173`: **5 passed**. The pixel assertions genuinely run; I confirmed the composite by eye as well as by test.
- [x] **Differential regression** — using the safe method from OPEN.md #149 (`git checkout <base> -- <path>`, never `git stash`): `in-app-badged-ta-avatar` **13/0**, `recognizable-published-ta-profile` **11/2**, `admin-tools-dashboard-panel` **9/0** — **identical with and without** this change. Story 2's two failures are its own known-environmental `H1`/`H5`. Co-tenant stashes verified untouched afterwards.
- [x] `harness-lint` clean; `node --check` clean on all four changed JS files; both new modules load with no circular-require breakage (`avatar.js` → `assistant/index.js` is one-directional).
- [ ] _Lint / typecheck / build not configured — skipped._

## Spec adherence

| AC | Verified how | Result |
|---|---|---|
| **AC1** — preview of their picture, stamped on one corner, before publishing | `B1` pixel-samples three ways (centre is the owner's picture, bottom-right carries the mark, top-left does not); `B2` watches the network and confirms no POST fires on generate | ✓ |
| **AC2** — published picture is an instance-hosted URL, publicly served | `B3`, `S5`, `S7` | ✓ |
| **AC3** — survives redeploy; a published picture never dies | `U4` (behavioural) + the mount points at the persisted volume | ✓ |
| **AC4** — regenerate replaces; re-publish points at the new one | `U2`/`U4`/`U6` — content-addressed naming | ✓ |
| **AC5** — no owner picture → branded fallback offered, not a failure | `B4` | ✓ |
| **AC6** — refused to anyone but the owner | `S1`, `H1` (skipped locally); **and** I verified the layered gate independently — see below | ✓ |

**AC6, checked properly rather than by reading the handler.** Both handlers carry
`if (!isOwner(req) && !req.localTrusted) → 403`. Above them, `src/middleware/auth.js:448-457` denies
*every* unauthenticated mutation except an exact-match allowlist of `/api/neo4j/query` and
`/api/strfry/publish`; `app.use(authMiddleware)` is at `bin/control-panel.js:265` and the API routes
mount at `:289`, so the global gate genuinely runs first. An anonymous `POST /api/assistant/avatar`
is therefore 401'd before `multer` allocates anything.

## ADR adherence

- [x] Files match the ADR: new `src/api/assistant/avatar.js`, two routes in `src/api/index.js:537-538`,
      the `/generated` mount in `bin/control-panel.js`, and the editor changes.
- [x] **D2 (parameterless proxy) — honoured.** `handleOwnerAvatar` reads nothing from
      `req.query/body/params`; the URL comes from `getOwnerKind0PictureUrl(ownerPubkey)`.
- [x] **D3 (never delete) — honoured, and proven behaviourally.** `storeCompositeAvatar` writes only
      when the target is absent, and `U4` stores two different composites and asserts both survive.
      This was the decision most likely to be got wrong, and it is right.
- [x] **D4 (one reachability rule) — honoured.** `avatar.js` imports `isPubliclyReachable` from
      `assistant/index.js` rather than forking a predicate.
- [x] No new dependencies (`multer` was already present). No lint/typecheck tooling.
- [x] The three logged deviations are accurate and all three are improvements or neutral.
- [ ] **D2's redirect bound — NOT honoured, and not logged.** See blocking finding 1.

## Concept-graph integrity

- [x] No handles in the diff; no concept definitions changed → **no firmware reinstall**.

## Things tests can't catch

- [x] **No secrets, no debug logging, no commented-out code, no 64-hex literals.**
- [x] **Path traversal** — filenames are server-generated from a content hash; the caller never
      supplies a path. `express.static` resolves within its root. The mount sets `index: false`, so no
      directory listing.
- [x] **Cache correctness** — `maxAge: '7d'` is safe *because* the names are content-addressed; a
      regenerate yields a new URL rather than a stale hit.
- [x] **The size cap is enforced where it matters.** `readBounded` (`:133-144`) checks
      `content-length` *and* counts the streamed body, so a chunked response — which declares no
      length — is still bounded. This is the part most implementations get wrong.
- [x] **Canvas taint** — the source is fetched same-origin through the proxy, so `toBlob()` cannot
      throw `SecurityError`. Verified in practice by the browser class passing.
- [ ] **Two issues on the outbound fetch** — findings 1 and 2.

## House rules check

- [x] Concept Graph authority respected; no new tooling; TA pubkey untouched (resolved at runtime elsewhere).

## Findings

### Blocking

1. **`src/api/assistant/avatar.js:183` — the ADR's redirect bound was dropped, silently.** ADR 0003
   D2 specifies "**at most one redirect**" among the proxy's guards. The code passes
   `redirect: 'follow'`, which is Node's default of **up to 20**. This is not a logged deviation —
   the story logs three others, so this reads as an oversight rather than a considered change.
   It matters because redirects are the one part of this fetch where **a third party chooses the
   destination**: the owner publishes a picture URL, but the host at the far end decides where the
   chain ends, including at `127.0.0.1`, an RFC1918 address, or `169.254.169.254`. The blast radius
   is genuinely small — the endpoint is owner-only, and the owner already has instance access — which
   is why this is a small ask rather than a redesign. *Ask:* either set `redirect: 'manual'` and
   follow at most one hop (validating the hop's destination the same way the initial URL is
   validated), or keep `follow` and record it in the story's Deviations with the reasoning, so the
   ADR and the code stop disagreeing. Note a co-tenant session has an SSRF-guard draft parked for the
   sibling `nip05` fetch (`stash@{1}`), so a shared guard may be the better long-term home.

2. **`src/api/assistant/avatar.js:194` — `image/svg+xml` passes the allow-list and is echoed back
   from our own origin.** `type.startsWith('image/')` admits SVG, and `:203-205` sets that
   content-type on the response verbatim. SVG can carry `<script>`, so a picture URL that serves SVG
   makes `GET /api/assistant/owner-avatar` a same-origin script-execution vector against the control
   panel for anyone who navigates to it directly. In-app usage is safe (the editor loads it via
   `new Image()`, where scripts do not run) and the endpoint is owner-gated, so this needs the owner
   to visit the URL directly with an attacker-influenced picture host — narrow, but it is the classic
   footgun and the fix is one line. *Ask:* refuse `image/svg+xml` (the composite source only needs
   raster formats), or send `Content-Disposition: attachment` / a sandbox CSP on this response.

Both are in one function and together are a few lines. Nothing else in the diff is blocked.

### Non-blocking

1. **An authenticated non-owner reaches `multer` before the 403.** The global default-deny stops
   anonymous callers (verified above), but a signed-in non-owner passes it and buffers up to 2 MB in
   memory before `handleUploadAvatar:223` refuses them. Bounded and session-gated, so low severity.
   *Optional:* put the owner check in front of `uploadMiddleware` at `src/api/index.js:538` so the
   gate precedes the body parse.
2. **A `multer` limit breach is not handled.** Exceeding `fileSize` rejects into Express's default
   error handler (an HTML 500) rather than the JSON shape every other branch returns. Cosmetic.
3. **Old composites accumulate with no cleanup**, exactly as ADR D3 intends — recorded so the
   book-close sees it as a known, chosen consequence rather than an oversight.

### Harness friction

None this story. The OPEN.md #149 practice (checkout-the-base rather than `git stash`) worked
cleanly, and the co-tenant stashes were verified intact afterwards.

## Verdict

**CHANGES_REQUESTED**

This is a strong implementation and the verdict is narrow: **two lines in one function**, both on the
outbound fetch, and I want them fixed rather than inherited because this is the repo's first
outbound-fetch primitive and its first persisted-and-web-served directory — the precedents set here
will be copied.

Everything else passes on evidence I gathered myself: all six acceptance criteria, both gates
(13/0 server, 5/5 browser, run against a build I made), a clean differential against three sibling
suites, and the layered owner gate confirmed at the middleware level rather than taken from the
handler. **D3 — the decision this story was most likely to get wrong — is right, and is proven by
behaviour rather than by a source scan.**

Finding 1 is blocking mainly because it is an *unlogged* departure from a bound the ADR states: the
next reader will trust the ADR. Either honour it or record it. Finding 2 is a one-line hardening on
the same function, so it costs nothing to do in the same pass.

## On CHANGES_REQUESTED

Kick back to `/implement-feature` with the two asks above. The story stays `Approved`; no completion
detection is run on a non-passing review.
