# Story 1: Author names must resolve on pages with many distinct authors

**Status:** Approved
**Created:** 2026-09-08
**Type:** Bug

## Background

Every control-panel surface that shows *who authored a thing* resolves display names through
one shared profile lookup, and that lookup asks for the page's entire pubkey set in a single
request. Past a threshold the request is refused, the names never arrive, and the author cells
fall back to truncated pubkeys — `2f1b310f…` where a display name belongs.

Nothing errors. The refusal is swallowed, no error state is set, and the operator has no
indication that anything failed. This is the same defect class `relay-scan-bounds` #1 fixed —
a request that is correct on small data and wrong on real data — on a different endpoint, and
with a quieter failure. That story found it, measured it, and deliberately left it unfixed;
it survives that book's close as a carry-forward (`audits/relay-scan-bounds/audit.md` §6,
`OPEN.md` row 202) and reaches product as a named symptom in its `prd-seed.md` §6.

**Two separate ceilings, measured on `localhost:7778`** (synthetic 64-hex pubkeys, so the
numbers are exact). Re-measured 2026-09-20 against current `staging`; both ceilings are
unchanged from 2026-09-07:

| pubkeys asked for | URL bytes | result |
|---:|---:|---|
| 50 | 3,292 | succeeds |
| 51 | 3,357 | refused — `max 50 pubkeys per request`, with a readable JSON body |
| 251 | 16,357 | refused, same readable body — the last request the app itself still sees |
| 252 | 16,422 | refused by the HTTP layer before the app runs — **empty body**, nothing to read |
| 4,506 | 292,932 | same empty-bodied rejection |

The first ceiling is a deliberate per-request cap of 50, added to prevent abuse. The second is
the HTTP layer's limit on the size of a request head (16,384 bytes on this deployment) — past
it the request never reaches the application at all, and the caller gets a rejection with no
body to interpret.

### The failure is migrating toward its worse form on its own

`/tapestry/lists/items` issues two lookups: one for a single pubkey, which succeeds, and one
for the page's whole author set, which is refused. Measured twice, twelve days apart, with no
code change to either the page or the lookup in between:

| | 2026-09-07 | 2026-09-20 | the 431 ceiling |
|---|---:|---:|---:|
| distinct authors asked for | 216 | **246** | 252 |
| URL bytes | 14,082 | **16,032** | 16,422 |
| author cells showing a truncated pubkey | 226 | **288** | — |

The page is now **six authors** from crossing from a readable 400 into the empty-bodied 431.
That matters beyond severity: today a client *could* read the refusal and react to it, because
the body names the limit. Past 252 there is no body, the application never runs, and any
handling built on reading the response stops working. Whatever shape the fix takes, it should
not depend on the failure staying in its readable form — it will not.

### Where the fix belongs

The page is not the problem. **41 call sites across 38 files** share this one lookup (up from
38 across 35 on 2026-09-07), and most build their pubkey set from an unbounded row collection —
`users/Index.jsx` merges the Neo4j and relay pubkey sets, and on a deployment with a real graph
that set is very large. On this machine's thin local graph only List Items currently exceeds
the cap; `/tapestry/lists` and `/users` each asked for 1. The other sites are structurally
exposed but not locally reproducible.

`relay-scan-bounds` #1 helped and did not fix it: List Items sent 4,506 authors before that
story bounded the page to its 500 most recent items, and 216 immediately after — roughly 20×
better, still multiples past the cap, and drifting upward as those 500 items come from a wider
pool of authors.

**Who is affected:** anyone reading an author column anywhere in the control panel, on any
deployment whose data has grown past 50 distinct authors on a page. Today that is List Items
on every deployment; on staging and prod it reaches considerably further.

## User-facing description

As an operator reading any control-panel page that shows who authored something, I want every
author to appear by name, so that I can tell at a glance who did what instead of squinting at
truncated pubkeys that tell me nothing.

## Acceptance criteria

- [ ] Given `/tapestry/lists/items` on a deployment whose rows carry more than 50 distinct
      authors (246 on `localhost:7778`, 2026-09-20), when an operator opens it, then every
      author cell whose pubkey has a published profile shows that profile's display name, and
      no cell falls back to a truncated pubkey because a lookup was refused.
- [ ] Given any two different pages that display author names, each carrying at least 1,000
      distinct authors — past both the 50-per-request cap and the ~16 KB request-head ceiling —
      when an operator opens them, then names resolve on both and no lookup request is refused,
      by either the application or the HTTP layer.
- [ ] Given a page carrying 50 or fewer distinct authors, when an operator opens it, then it
      shows the same author names it shows today.
- [ ] Given a profile lookup that genuinely fails — the endpoint unreachable, or returning an
      error, **including an error carrying no readable body** — when the page renders, then the
      operator sees an explicit indication that author names could not be loaded. Truncated
      pubkeys are never presented as if they were the resolved answer.
- [ ] Given a single request that asks for an unbounded number of profiles, when the endpoint
      handles it, then the caller receives either a bounded success or a refusal it can read
      and act on — naming what to do instead. It never receives an empty-bodied rejection,
      which is what a request past the request-head ceiling returns today and what List Items
      is six authors away from triggering.

## Concepts touched

None — this story changes no concept's meaning. It concerns the transport shape of nostr
kind-0 profile-metadata lookups, which is a nostr primitive rather than a Tapestry concept.

The pages affected surface many concepts (`list`, `concept-header`, shared concepts, trusted
lists), but only their *author* columns are involved and none of their semantics change. The
Concept Graph API on this machine answered with 0 concepts on both 2026-09-07 and 2026-09-20
(a known local-stack condition, `OPEN.md` #69), so no handles were resolvable here; the
Architect should resolve them at runtime if the design turns out to need any. The TA pubkey on
this dev instance resolved to `e00ed090…9df36` — per-deployment, never to be hardcoded.

## Out of scope

- **How many rows a page renders,** and therefore how many distinct authors it asks about.
  That was `relay-scan-bounds` territory and its book is closed; this story makes the lookup
  correct for whatever set it is handed.
- **Auditing the 41 call sites one by one.** The fix belongs at the shared lookup, which is
  what makes it hold everywhere. Individual pages are in scope only as verification.
- **The lookup's existing dedupe and per-pubkey caching.** Already present and working; the
  defect is the shape of the request, not the caching.
- **`/api/profiles` skipping its local-relay fallback when the relay race times out.** A real
  and adjacent defect in the same file, but a server-side data-path bug rather than a
  request-shape one, and already owned by the open `assistant-profile` book (`OPEN.md` row 273,
  ADR `assistant-profile/0001` § Consequences). Left there.
- **Empty-bodied rejections on other endpoints.** The request-head ceiling applies to every
  route on the deployment. Only the profile lookup's contract is settled here.
- **Anything about profile content** — avatars, NIP-05 verification, which fields render.
- **The abuse protection's threshold as a policy question.** Whatever shape the fix takes, an
  unbounded single request must still be refused; whether 50 remains the right number is a
  design call, not a product one.

## Open questions

- None blocking. The three fix shapes raised at intake — batching the lookup into
  cap-sized requests, moving it off the querystring, or keeping a cap and signalling it — are
  design choices for Architecture. The story constrains only the outcome: every author
  resolves, real failures are visible (including bodiless ones), and an abusive request still
  gets an interpretable refusal.

## Linked artifacts
- ADR: `engineering-team/decisions/profile-lookup-bounds/0001-chunk-at-the-cap-in-the-shared-hook.md`
- Test plan: `engineering-team/stories/profile-lookup-bounds/1-resolve-author-names-at-any-scale.test-plan.md`
- Review: (filled in after Review phase)
