# Test Plan: Story 3 — The stamped composite avatar, published to nostr

**Story:** `engineering-team/stories/ta-avatar/3-stamped-composite-avatar-on-nostr.md`
**ADR:** `engineering-team/decisions/ta-avatar/0003-owner-composited-avatar-hosted-by-the-instance.md`
**Date:** 2026-08-07

**Test files:**
- `test/stamped-composite-avatar.test.js` — 15 tests (**U** ×6, **S** ×7, **H** ×2). Registered in
  `test/test.js` (gates the exit code; own summary line + H-class execution line).
- `tests/brainstorm/ta-composite-avatar.spec.js` — 5 tests (**B**, Playwright). AC1 and AC5 are
  settled here.

---

## Why this story needs both classes

Story 2 needed no browser class because its criteria were about what a server *proposes*. This story
splits cleanly down the middle:

- **The server half** — an owner-gated proxy, a content-addressed store, a static mount — is logic
  and configuration, and the store step is pure enough to *execute* in a temp directory. That is
  where ADR **D3** lives, and D3 is the decision this story most needs to get right.
- **The browser half** — AC1's "a preview of their picture stamped with the brand mark on one
  corner" — is a claim about pixels. Every load-bearing word (their *picture*; the mark is *on* it;
  it is in a *corner*) is invisible to a source scan, which sees a canvas and a `drawImage` and
  cannot distinguish a correct composite from a blank square. Same lesson as `goal-intent-fields` #3.

## The assertion this plan is built around

**`B1` samples the rendered pixels.** The mocked owner avatar is solid **white**; the badge is brand
purple **#9546ed**. A correct composite therefore has a white middle and a purple bottom-right
corner. Three separate wrong implementations fail three different assertions:

| what got built | which assertion catches it |
|---|---|
| blank / badge-only canvas | the **centre** is not white — "must show the OWNER'S PICTURE" |
| owner's picture, no mark drawn | the **bottom-right** has no purple — "the mark must be stamped" |
| mark drawn full-bleed over the face | the **top-left** *is* purple — "the mark sits on one corner" |

The fixture PNG is generated in-spec (`zlib` + `crc32`) so the colours are exact rather than
whatever a stock asset happens to contain.

## Coverage map

| Criterion | Test | Level |
|---|---|---|
| **AC1** — preview of their picture, stamped on one corner, **before** publishing | `B1` (pixel-sampled, three ways) and `B2` (generating issues **no** POST to `/api/assistant/avatar` or `/publish-profile`) | browser |
| **AC2** — published picture is a URL hosted by the instance, publicly served | `B3` (accepting puts the returned instance URL into the picture field), `S7` (the URL is gated on story 2's `isPubliclyReachable`, not a second predicate), `S5` (the directory is actually mounted), `H2` | browser + source + live |
| **AC3** — survives redeploy; a published picture never silently dies | **`U4`** (the previous composite is still on disk after a regenerate) and `S5` (the mount points at the **persisted volume**, not a path inside the image) | unit + source |
| **AC4** — regenerating replaces the old; re-publishing points at the new | `U4` (different content → different name, new file present), `U2`/`U6` (content-addressed naming is what makes the new URL new) | unit |
| **AC5** — no owner picture → the branded fallback is offered, not a failure | `B4` (the panel says so **and** story 2's `/ta-avatar.png` is what it reaches for; no error state) | browser |
| **AC6** — refused to anyone who is not the owner | `S1` (two independent `isOwner` gates + 403), `H1` (anonymous gets 401/403 on both endpoints) | source + live |
| ADR **D2** — the proxy takes no URL from the caller | `S2` (no `req.query/body/params` URL is read; the URL comes from the owner's kind 0) | source |
| ADR **D2** — the fetch is bounded | `S3` (timeout, `image/*` allow-list, size cap beyond content-length, http(s) only) | source |
| ADR **D3** — never delete a prior composite | **`U4`** (behavior) + `S4` (a sentinel against a later "tidy-up" delete) | unit + source |
| Wiring | `S6` (both routes registered), `U5` (non-PNG rejected on **magic bytes**, nothing written) | source + unit |

## Edge cases covered

- [x] **Idempotence** — storing identical bytes twice yields one file with the same name (`U3`).
- [x] **Collision safety** — the name is the content hash, so different composites never overwrite (`U6`).
- [x] **Non-PNG input** — rejected on bytes, not on the caller's declared mime, and **nothing is written** (`U5`); everything in that directory is served publicly.
- [x] **Directory listing** — `H2` guards against an index being exposed on the new public mount.
- [x] **Preview ≠ publish** — `B2` watches actual network traffic, not UI state.
- [x] **The mark's position** — asserted as *present bottom-right AND absent top-left*, so a full-bleed mark fails.
- [x] **Stale-bundle trap** — `B0` fails loudly if the served build predates the edit.
- [ ] **Not covered — deliberately:** automatic regeneration when the owner's avatar changes; a retention policy for accumulated composites; customer-assistant composites; and OPEN.md #148's RFC1918 gap, which ADR D4 inherits on purpose so one fix serves both stories.

## Test infrastructure

- **Runner:** Node built-in (`npm test`) + existing Playwright. No new frameworks.
- **One testability ask:** `src/api/assistant/avatar.js` must export **`storeCompositeAvatar(buffer, opts)`** accepting `opts.baseDir`. `/var/lib/brainstorm` does not exist on a dev host or on CI, and without an override D3 could only be checked by scanning for the *absence* of an unlink — which proves nothing about behavior. `U5` also expects it to **throw** on a non-PNG buffer.
- **One DOM contract:** the preview carries the class **`.ta-composite-preview`** (canvas or img — `B1` handles either, drawing an img into an offscreen canvas before sampling, so the implementation is not constrained).
- **The H class SKIPs rather than fails when the route is absent.** These describe a *deployed* instance; the reachable one during development is `localhost:7778`, which serves the **shared checkout** and can never reflect this worktree (ta-avatar #2 documented the same constraint). `run()` announces loudly that live coverage did not run, and `TAPESTRY_REQUIRE_LIVE=1` turns that into a failure. Driving is done by U, S and B; **H is the post-deploy instrument.**
- **Fixtures:** all in-spec. Every API is route-mocked, including the proxy, so **no live avatar host is contacted** and no stack is required.

## How to run

```bash
npm test
```

```bash
cd ui && npm run build && npx vite preview --port 4173 --strictPort
```

```bash
BRAINSTORM_SERVER_ACCESSIBLE=true BRAINSTORM_BASE_URL=http://localhost:4173 npx playwright test tests/brainstorm/ta-composite-avatar.spec.js --project=chromium
```

After deploy, to execute the H class:

```bash
BRAINSTORM_BASE_URL=https://staging.brainstorm.world node -e "require('./test/stamped-composite-avatar.test.js').run()"
```

## Verification — confirmed RED on 2026-08-07 at `490e7f95`

**Server half — 0 passed, 13 failed, 2 skipped.** Every failure names the missing artefact:

```
  FAIL  U1: src/api/assistant/avatar.js does not exist …
  FAIL  U4: regenerating does NOT delete the previous composite (ADR D3 — AC3 vs AC4)
  FAIL  S2: the proxy takes no URL from the request (ADR D2)
  FAIL  S5: the generated directory is served, and only that directory
  SKIP  H1 / H2
  stamped-composite-avatar: H-class 0 executed / 2 skipped
  !! LIVE COVERAGE DID NOT RUN — the reachable instance does not serve this story
```

**Browser half — 5 failed**, against a freshly built bundle served at `:4173`:

```
  B0  Error: the served bundle does not contain "ta-composite-preview" …
  B1  Error: AC1: the editor must offer a way to generate the badged avatar — element(s) not found
  B2/B3/B4  TimeoutError: locator.click — no such button
```

**Failing for the right reasons — verified, not assumed.** I probed the mocked page directly: the
Assistant Profile panel **renders fully** (`.settings-group` present, 6 input fields, buttons
`["Publish profile","Reset to defaults"]`), with **no** generate control and **no**
`.ta-composite-preview`. So the fixture — auth, config, and the assistant status mock — is sound, and
the suite is failing on the absent feature rather than on a page that never loaded. That probe also
corrected the plan: `about` renders as a *textarea*, so the picture field is not at the input index
`PROFILE_FIELDS`' order implies; `B3` scans every field's value instead of pinning an index.
