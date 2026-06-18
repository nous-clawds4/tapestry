# b-tag concept shape — where things stand and what needs to be done

_Investigation of the b-tag / `communityReference` state across origin branches, and the plan to
yield the b-tag firmware shape without falling into the stub trap. 2026-06-16._

I checked everywhere. The headline: **it's a build, not a port. Nothing to reconcile from
Communities, because Communities has the exact same gap.**

## State across branches (definitive)

| Piece | Status |
|---|---|
| b-tag **spec** | Done — ADRs 0027/0029/0030 (all Accepted) + `protocols/drafts/inherit-from.md` (the wire format, already in our tree via staging) |
| b-tag **emitter** (publishing `["b", …]`) | **Nonexistent** — no `['b',…]` emission anywhere, on any branch |
| b-tag **resolver/derivation** (`INHERITS_FROM` / `REFERENCES{source:'b-tag'}`) | **Nonexistent** — `INHERITS_FROM` is in zero `src/` files |
| install-pass behavior | **Still the stub everywhere**, including `feat/communities`: `pass_communityReferences` does `MERGE …REFERENCES… SET r.source='firmware-community'` (install.js:1223-1224) |
| manifest `communityReference` | Only `nostr-relay` carries one (the deployed stub pilot); tag concepts don't, on any branch |

(The one file that looked b-tag-ish, `src/lib/tapestry-resolve.js`, is an unrelated LMDB
pointer-resolver — false positive.)

So ADR 0030's "target install semantics (ratified; **not yet wired**)" is literally true: nobody
wired it. There's nothing on `feat/communities` to port.

## The stub trap, stated exactly

The current install MERGEs `REFERENCES{source:'firmware-community'}` for *any* manifest concept
carrying a `communityReference`. So **if you add `communityReference` to the tag concepts against
today's install code, you get the legacy stub for them — not the b-tag.** That's the trap. You
avoid it by building the emitter + derivation *first*, and only *then* touching the manifest.

## What needs to be done (the build), in order

Grounded in ADR 0030 §2/§4 + ADR 0029 §3:

1. **Emitter — change `pass_communityReferences`** (install.js): for each manifest concept with a
   `communityReference`, after fetch + optional `knownGoodEventId` pin-verify, **republish the
   TA-authored local header with `["b", "<headerATag>", "pointer"]` appended** (TA-signed;
   idempotent; **never-clobber** — skip if the header already carries any `b`).
2. **Derivation — Pass-3 / eventSync:** materialize a header's `b` tag into an edge —
   `pointer`/absent → `(child)-[:REFERENCES {source:'b-tag'}]->(parent)`; `inherit` →
   `(child)-[:INHERITS_FROM]->(parent)`. (You only need pointer now, but build the
   registry-correct branch.)
3. **Retire the stub for b-carrying headers:** don't MERGE the `firmware-community` stub when a `b`
   is present; the edge derives from the published event. Pre-existing stubs stay harmless
   (consumers filter on `source`).
4. **Now add the manifest entries** — `communityReference {headerATag:"39998:82b75e47…:<slug>",
   relayHints:["wss://dcosl.brainstorm.world"], knownGoodEventId:<id>}` for
   `tag`/`nostr-user-tag`/`tag-pinning`. *Only after 1–3.*
5. **Publish all three community bundles to DCoSL** (the install's fetch target) — `nostr-user-tag`
   is done; do `tag` + `tag-pinning` too, and capture each `knownGoodEventId` so install pins the
   right header.
6. **Reinstall** → header gains pointer-`b` → derives `REFERENCES{source:'b-tag'}` → the
   resolution/pull resolves the community header locally → the orphaned parent link finally loads.

## The strategic point — build it once, on the shared line

The b-tag emitter + derivation is a **shared primitive**: Communities' affiliation pointer and the
tag-concept federation are the *same* mechanism. ADR 0030 itself gates the install-pass on "the
three-branch reconciliation" — meaning it's meant to be implemented **once on the shared line
(staging)**, not forked onto the tag branch. So steps 1–3 are a *joint foundation* with Avi; steps
4–6 are a thin per-concept layer on top. Building it twice is the thing to avoid.

(Keep the **multi-z item part** — "one z to local, one to community" on the items themselves — out
of this. That's worksheet W11, undesigned, and it touches the assertion writer we just shipped
(ADR-0022 hybrid e+a). Separate track.)

## Recommendation / next steps

- Treat this as the **ADR-0030 + ADR-0029 implementation** (emitter + derivation +
  stub-retirement), built as a shared foundation, then applied to the tag concepts.
- **First message to Avi** isn't "I'll fix firmware" — it's: _"the b-tag emitter/derivation is
  unbuilt on every branch; let's agree who implements the shared primitive (ADR 0030 §2 + ADR 0029
  §3) and that it lands on staging, then Tags and Communities both seed their manifests on top."_
- Capture with `/plan-feature` under the `community-reference` epic once ownership is settled —
  story shape: _"implement pointer-`b` firmware seed + b-tag→edge derivation (retire the
  firmware-community stub); seed `tag`/`nostr-user-tag`/`tag-pinning` against the canonical
  `82b75e47…` headers on DCoSL."_

**Net:** you can't get the b-tag shape by editing firmware — the emitter and derivation don't exist
yet, anywhere. The real work is building that shared primitive (once, with Communities, on
staging), and the stub trap is avoided by doing steps 1–3 before step 4.

## Reference

- ADR 0027 — `b` tag, the inherit-from primitive (`engineering-team/decisions/community-reference/0027-inherit-from-tag-b.md`)
- ADR 0029 — `b` type registry, `pointer` | `inherit` (`…/0029-b-type-registry.md`)
- ADR 0030 — `communityReference` v2, seed not stub (`…/0030-communityreference-seed-not-stub.md`)
- Wire spec — `protocols/drafts/inherit-from.md`
- Current stub install pass — `src/firmware/install.js` → `pass_communityReferences` (~line 998; stub MERGE ~1223)
- Canonical tag authority coordinate — `82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833` (the legacy/ADR-0015 literal; dev-box TA)
