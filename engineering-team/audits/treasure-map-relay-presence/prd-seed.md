# PRD Seed: Treasure Map relay presence & repair

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/treasure-map-relay-presence/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** medium — the *as-built* is high-confidence (verified in production), but the product framing below is inferred from three stories written against one operator's requests, never from user research
**Date:** 2026-09-07

> A reverse-engineered baseline in the product-team PRD shape. A strawman for `/discover`, not a ratified spec. Sections tagged `[FROM FRAME]`, `[INFERRED]`, `[UNKNOWN — product input needed]`.

## 1. Product vision

`[INFERRED]` A user's Treasure Map (kind 10040) is the entry point other people's clients use to discover who they have delegated their trust computation to. Its value is **entirely a function of where it is replicated** — a Map that exists only on your own instance does nothing for anyone. Yet until this book, the product told the user exactly one thing about that: whether the Map was on their *own* relay, the one location no third-party reader consults.

The vision this book implies: **the user should be able to see, and repair, their own discoverability.**

`[UNKNOWN — product input needed]` Whether "discoverability of my delegation" is a first-class product concern the user is expected to manage, or a health property the instance should maintain on their behalf. Everything here assumes the former; the deferred "push to every relay missing it" and the never-built background re-check both point at the latter.

## 2. Personas

`[INFERRED]` from the stories' "As a…" lines — behavior-based, and all three are the same person at different moments:

- **The Map owner checking up on themselves.** Visits the page, wants a yes/no on "is my delegation findable?", and does not want to read ten rows to get it. Served by the collapsed status light.
- **The Map owner who just published a change.** Has used the TL opt-in or the hand-editor and wants to know the change actually landed somewhere. Served by per-relay presence and by version-awareness.
- **The Map owner who finds something wrong.** Served by per-relay sync.

`[UNKNOWN]` The instance **operator** is a distinct persona this book served incidentally (the editable relay group, the removal of dead relays) without ever being modelled. Whether operators want relay-set curation as a product surface is unexamined.

## 3. Scope (as-built)

`[FROM FRAME]` Per-location presence across local strfry + Tapestry instance / trusted-assertion / trusted-list / general-purpose relay groups · relay set from operator-editable configuration, no literals in page code · version-awareness distinguishing the displayed Map from a divergent one · absent distinguished from unreachable · a slow or failing check never degrades the page.

`[INFERRED]` Additionally shipped: per-relay sync in a labelled direction; a collapsed-by-default status light with a severity precedence; keyboard operability; visible version timestamps.

**Explicitly out of scope as shipped:** bulk/"sync everything"; publishing deletions; automatic or background re-checking; any merge smarter than "more recent wins"; relay-to-relay sync; remembering the panel's open state; presence for anything but the kind-10040 Map.

## 4. Domain model

`[INFERRED]`

- **Treasure Map** — a replaceable kind-10040 nostr event owned by a pubkey. **Has no concept-graph handle**, which is itself a finding: the product's central object here is invisible to the concept graph.
- **Relay** — `39998:<TA>:nostr-relay`, grouped into purpose sets. Groups exist **twice**: as `aRelays` settings groups (operator-editable, what this book reads) and as concept-graph element sets (what the page's fallback lookup reads). These have already drifted — the Tapestry instance relays exist only in the former.
- **Presence** — a *relation* between a Map and a relay, valued `present | absent | unreachable`, and when present further qualified `same | older | newer | divergent` against a reference copy. **Never stored** — re-derived on every view, per architecture invariant 3.

## 5. Design rules (as-built)

`[INFERRED]`, none of it previously written down:

- **Name the worst finding, don't count coverage.** One relay serving a stale Map outranks three relays lacking it, because a missing Map means a reader finds nothing while a stale one points them at a delegation the user may have revoked.
- **Never assert an all-clear you haven't earned.** A summary waits while relays are outstanding; a helper refuses `ok` over rows it did not judge.
- **Say what *we* could not do, not what the relay is.** "Couldn't reach" rather than "relay is down" — connect failure is measurably flaky.
- **Label the direction before the click.** Sync says "Send my version" / "Get the newer version", never a bare "Sync".
- **Suppressed affordances explain themselves before they're pressed**, not after (the publish-policy gate).
- **Disclosure idiom:** `useState(false)` + `▾`/`▸`, matching the page's siblings.

`[UNKNOWN]` No style guide governs any of this. The wording and the severity colours were chosen story-by-story and ratified in conversation.

## 6. Carry-forward & open questions

Promoted from audit §6 — the strongest candidates:

- **`publishToRelays` reports every external publish as a success** (OPEN.md row 200). Affects five shipped publish paths. This is the most consequential thing the book found and it is untouched.
- **Two relay-list sources on one page**, already drifted (`follow-ups.md:131`).
- **Push/repair at scale** — "put my Map everywhere it's missing" was deliberately deferred and is the obvious next user-facing step.
- **Read-after-write** assumptions elsewhere (row 201).
- Two Phase-4 test-coverage gaps; `M8` strengthening.

## 7. What product must validate

- [ ] Is relay discoverability a **user** responsibility (current design) or an **instance** responsibility (background repair)? Every deferred item hinges on this.
- [ ] Should the operator be a modelled persona for relay-set curation, or is the Settings surface enough?
- [ ] Is the severity precedence (divergent > missing > unreachable) right for real users, or does an unreachable relay deserve to shout louder? Recorded as a judgement call in story 3, never validated.
- [ ] Should bulk sync exist, and if so with what consent model? One click writing to a dozen relays was deliberately not shipped.
- [ ] Does the Treasure Map deserve a concept-graph handle?
- [ ] Should the panel remember its open/closed state?
