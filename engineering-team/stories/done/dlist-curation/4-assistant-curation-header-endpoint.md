# Story 4: Author the assistant's curation header for a chosen community DList

**Status:** Done
**Created:** 2026-09-10
**Type:** Feature

## Background
Stories 2–3 ratified the wire: a per-DList Map entry `["<kind>:<d-tag>", <assistant>, <relay>]`
addresses a header `<kind>:<assistant>:<d-tag>` that the user's Tapestry Assistant authors and
maintains, carrying `["b", <community header a-tag>, "inherit-items"]` and the community header's
names and description as copied at creation (`protocols/drafts/assistant-designation.md` § "Per-DList
curation entries"). The header must exist **before** the user signs the Map entry that names it.
The assistant's key is server-held (per-user, minted at signup; `getAssistantKeys(userPubkey)`), so
authoring the header is a server operation — the first code of the DList Curation half of this
book. The DList Curation panel (story 5) calls it, then has the user sign the Map.

Constraints settled at kickoff (`engineering-team/epics/dlist-curation.md` § "Settled at kickoff"):
the header is a letter in the hosting relay, never imported into the hosting instance's Neo4j (a
customer on Alice's instance must not write Alice's graph; the owner is treated the same in v1);
the signed-in user's assistant is the signer, never the instance owner's TA (OPEN.md row 188);
never re-point an existing header's `b` silently; publish to local strfry and the community relay.

What a community header looks like today (fetched from the community relay, kind 39998, self-declared
by a `b` to its own coordinate): tags `d`, `names` (singular, plural), `slug`, `concept-graph`
(the author's own concept-graph coordinate), `json` (word-wrapper: `word` + `conceptHeader` with
the description), and the self-pointer `b`. Not every one of those may be copied.

## User-facing description
As a signed-in user with a provisioned Tapestry Assistant, when I choose a community DList to
curate, I want my assistant to author its curation header for that list on my instance — the
community list's names and description as they stand now, inheriting the community's items, in my
assistant's own namespace — before my Treasure Map is updated to name it, so that my Map never
points at a header that does not exist and my curation never puts duplicate items into the
community's list.

## Acceptance criteria
- [ ] **AC-1 (who may call).** The endpoint requires a signature-verified session (the same rule as
      the Trusted-List endpoints: `session.authenticated === true` and a 64-hex `session.pubkey`;
      otherwise 401). The signer is the **caller's** assistant, resolved from the session pubkey; a
      caller with no provisioned assistant gets a 4xx with a plain message; the instance owner's TA
      is never used as a fallback.
- [ ] **AC-2 (input).** The request names the community header by a-tag. Malformed a-tag → 400.
      Kind other than 39998 → 400 saying 39999-declared headers are not supported yet. A target
      authored by the caller or by the caller's assistant → 400 (the exclusion rule).
- [ ] **AC-3 (the community header is fetched, not trusted from the client).** The server fetches
      the target itself — from the community relay group and local strfry — and accepts it only if
      it is a self-declared shared concept (kind 39998 carrying a `b` to its own coordinate); not
      found → 404. Nothing in the request body supplies the header's content.
- [ ] **AC-4 (the header authored).** A kind-39998 event signed by the caller's assistant with: `d`
      equal to the community header's d-tag; `names`, `slug`, and `json` copied verbatim from the
      community header as fetched; exactly one `b` tag, `["b", <community a-tag>, "inherit-items"]`;
      **no** tag that points into the community author's namespace (their self-pointer `b`, their
      `concept-graph` coordinate); empty `content`; fresh `created_at`.
- [ ] **AC-5 (idempotent, never-clobber).** If `39998:<assistant>:<d-tag>` already exists in local
      strfry: (a) carrying exactly the contract's `b` → success with `existing: true` and no
      republish; (b) carrying a `b` to a different target **or** of a different type → refused (409)
      with the existing `b` returned so the panel can surface it, and nothing published; (c) carrying
      no `b` at all → the existing header is re-signed with the contract's `b` appended and every
      other tag preserved (the firmware seed rule).
- [ ] **AC-6 (publication, reported honestly).** The signed header is written to local strfry, then
      sent to each relay of `settings.aRelays.aDListRelays`, subject to the deployment's
      publish-policy gate (external sends are skipped, and reported as skipped, when local-only).
      The response reports each destination's actual outcome — ok, failed with a message, or skipped
      by the gate — never a blanket success (OPEN.md row 200 is the cautionary precedent).
- [ ] **AC-7 (no graph write).** The endpoint performs no Neo4j write and uses no publish path that
      brain-writes: after a call, the graph holds no node for `39998:<assistant>:<d-tag>` that it did
      not hold before.
- [ ] **AC-8 (what the panel needs back).** The response carries the signed header event, whether it
      pre-existed, and the per-destination outcomes — enough for story 5 to compose the Map entry
      (`39998:<d-tag>`, the assistant pubkey, the relay hint) without a second call.
- [ ] **AC-9 (failure order).** A failed local write returns an error and attempts nothing else. A
      failed relay send after a successful local write is success-with-failures (local is the source
      of truth; the router's community-relay stream carries the header later). Every failure carries
      a message; none corrupts state.

## Concepts touched
- `39998:<TA>:shared-concept` — shared concept (the community self-declared headers are the
  candidates; per-deployment TA pubkey, resolved at runtime)
- `39998:<TA>:tapestry-assistant` — tapestry assistant (the signer; the caller's own, not the
  instance owner's)

## Out of scope
- Updating the Treasure Map (client-side, NIP-07-signed — story 5), revocation (Map-only, story
  5), the panel (5), Map Entries (6).
- Any import of the header into the hosting instance's Neo4j; any resolver for `inherit-items`
  (intake entry 2026-09-10).
- Adding a `pointer` `b` for declared affiliation (the later curation feature's call, ADR 0003).
- 39999-declared community headers; deleting or re-pointing headers; owner-instance special-casing.
- Client-side use of `publishToRelays` (row 200 defect) — this is a server path.

## Open questions
None the PO holds. Decision points for the ADR: route and response shape; fetch order (community
relay first vs local first) and the self-declared check's home; direct relay publish (server-side
pool) vs router-only, and how each destination's outcome is captured; whether the `concept-graph`
tag is omitted or recomputed for the assistant's namespace; reuse of the Trusted-List module's
`publishToStrfry` and `requireAuth` vs a shared helper.

## Deviations
- **Test fixture amended during Phase 4, in the Tester's lane** (its own commit before the
  implementation): the suite's `makeDeps` recorded calls inside its default stubs only, so H4 —
  which overrides the relay fetch to return nothing and then asserts the relays were asked — could
  not be satisfied by any implementation. Recording now wraps whichever seam is in effect. Stricter;
  the implementation follows ADR 0004 verbatim.
- **Escalated at the Phase-4 gate: a standing ADR conflicted with ADR 0004.** The full run tripped
  `publish-export-a-concept` RE1 — `community-reference` ADR 0004's sentinel against any server-side
  relay publisher under `src/api/`. Surfaced with two options; the operator chose to keep the direct
  per-relay send (Option 1, 2026-09-10): ADR 0004 amended to state what it supersedes and why, RE1
  re-scoped in the Tester's lane (commit before the amendment) to exclude this endpoint's directory.
  The Architect's conflict check (workflow 2 step 6) missed it — a ledger row at the review commit.
- **Live verification limited to wiring.** The endpoint's behavior is proven by the injected suite;
  live, the server was restarted with the module and the route answers 401 to an unauthenticated
  request (the default-deny middleware first, the handler's own guard behind it). A live happy path
  needs a NIP-07-verified session the automated tools cannot create, and would publish a real
  header under the dev assistant's key to the public community relay — not done without the
  operator; row 191's posture.

## Linked artifacts
- ADR: `engineering-team/decisions/dlist-curation/0004-assistant-curation-header-endpoint.md`
- Test plan: `engineering-team/stories/dlist-curation/4-assistant-curation-header-endpoint.test-plan.md` (suite: `test/dlist-curation-header-endpoint.test.js`)
- Review: `engineering-team/reviews/dlist-curation/4-assistant-curation-header-endpoint.md`

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
