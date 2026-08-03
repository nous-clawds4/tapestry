# Acceptance script — tagging integrated (core, UI-agnostic)

Verification that the tagging **machinery** is correctly integrated, with **no assumptions about
what UI exists**. Every check here is observable from a dev console, the network tab, or a raw
relay query — "surface" below means *whatever the host renders the data with*, even if that's a
`console.table`. A per-target kit layers its own UI-coupled acceptance doc on top; this one
still applies verbatim underneath it.

Sections mirror the capability ladder in `INTEGRATION.md` §5 — check a section when you build
that rung. C0–C2 are the floor for any integration; C3–C5 require a signer; skip sections for
rungs you deliberately didn't build (and say so in your summary).

Prereqs: the app running against the kit's `CONFIG.json`; for C3+ two Nostr identities with
signers (call them **A** and **B**). Relay-side verification = fetch the event back with any
Nostr client/CLI (e.g. `nak req`) from a configured tag relay.

## C0 — Service layer online

- [ ] `fetchTagEvents(filterTagElements({zHandlePubkeys}))` returns a substantial list of
      existing tags (names log correctly). Zero results = relay connectivity problem; stop here.
- [ ] `fetchApplicabilityLists(...)` returns the house-published content/profile lists.
- [ ] `trust.ensure([...])` with a handful of pubkeys taken from live tagging asserters
      resolves, and at least some entries come back scored (rank/hops) — proving 30382s are
      being read via `trustRelays` (including the retired-key corpus; see config comments).
- [ ] All tag reads/writes in the network tab go to `tagRelays ∪ user relays`; trust reads go
      to `trustRelays`. No requests to any Brainstorm instance's `/api/*` from the client.
- [ ] No 64-hex pubkey literals in the integration's source (grep) — config only.

## C1 — Read tags on pubkeys

- [ ] A pubkey known to be tagged on the reference instances (browse tags.brainstorm.world to
      find one) yields the same tags, with net counts matching the reference instance's view
      (allow small deltas from relay propagation / trust-mode differences — investigate
      anything large).
- [ ] Tag names resolve (tag-elements fetched by `a`-coordinate and cached — repeat reads hit
      the cache, not the relay).
- [ ] Replaceable dedupe works: feeding the classifier duplicate/stale events (same
      `(kind, pubkey, d)`, older `created_at`) doesn't change counts.

## C2 — Read tags on events

- [ ] An event known to be tagged yields its tags with correct net counts.
- [ ] Reads over a list of N events issue **batched** queries (network tab: one REQ with
      `'#e': [ids]` per chunk, no per-event REQ storm).
- [ ] Headers resolve: no `unverifiable` assertions for known-good reference-instance taggings
      (spot-check; `unverifiable` in dev logs means your header fetch missed a relay).

## C3 — Apply an existing tag

- [ ] As A, apply an existing tag to an **event** → publish accepted by ≥1 relay → the C2 read
      now includes it; A's own stance is present via the `mine` channel immediately.
- [ ] Wire check (INTEGRATION.md §6): the assertion's descriptor z resolves to a real header;
      d-tag, z-handles, polarity all correct.
- [ ] As A, apply an existing tag to a **pubkey** → C1 read includes it; wire check the
      `p`/`a`/`e`/z/content shape.
- [ ] As B, reading the same targets: A's tag is visible with count 1 (house-trust permitting;
      if B can't see it, check `trust.ensure`/predicate before suspecting the publish).
- [ ] Applying the same tag again as A does NOT duplicate (replaceable d-tag; relay holds one
      assertion; count stays 1).
- [ ] Applicability separation available to any picker: the content/profile split from
      `fetchApplicabilityLists` classifies a known event-applicable tag correctly, and the
      fallback (`deriveApplicabilityMembers` / hint-z scan) engages when the lists are emptied.

## C4 — Dispute / stance toggle

- [ ] B disputes A's tag → net count drops; B's own dispute stance visible to B via `mine`
      even where the net-≤0 rule hides the tag.
- [ ] B switches dispute → apply: the stance REPLACES (relay shows ONE assertion from B, latest
      polarity +1) — never a second event.
- [ ] Same replace semantics verified on a profile-tag stance.

## C5 — Create a new tag on the fly

- [ ] As A, mint-and-apply a new tag to an **event** in one flow. Relay now has all three:
      tag-element (with `tag-for-nostr-event` hint z), tagging header, assertion — correct
      shapes per INTEGRATION.md §6.
- [ ] The new tag is immediately discoverable by B (`filterTagElements` pickup).
- [ ] As B, apply A's new tag to a different event → exactly ONE publish (the assertion —
      header reused, none minted). Verify on relay: no second header authored by B.
- [ ] As A, mint-and-apply a new tag to a **pubkey** in one flow → tag-element (with
      `tag-for-nostr-pubkey` hint) + assertion; both correct.
- [ ] Cancel the signer mid-flow (reject the 2nd/3rd signature) → no dangling assertion on the
      relay; the partial result (`{published, failedAt}`) is reported honestly.

## C6 — Tag → targets

- [ ] For a tag used in C3/C5: the forward read returns the tagged events (grouped by target,
      most-recently-tagged first available) and the tagged pubkeys.
- [ ] A target disputed below net-0 is absent from the forward read.
- [ ] A tag with existing usage on the reference instances returns a populated result
      (cold-start via the hub works).

## C7 — Trust hardening + degraded mode

- [ ] Network tab: 30382 REQs are batched `authors + '#d'` lookups only — never an open-ended
      `kinds:[30382]` subscription — and they go to `trustRelays`, not only the hub.
- [ ] Crank `minRank` very high (e.g. 99999) in config and reload: every SCORED asserter's
      taggings drop out of counts (unscored ones still count via `unknownPolicy`) — and the
      viewer's OWN stance still surfaces via `mine`. Restore config afterward.
- [ ] Tag relays unreachable (bogus `tagRelays` entry, user relays without tag events) → the
      app runs normally — no crashes, no wedged loading states; tags simply absent.
- [ ] Trust relays unreachable → counts degrade to `unknownPolicy` (count-everyone), no errors
      surfaced to the user; restoring connectivity and re-triggering reads recovers scores
      (failed chunks retried, not negatively cached).

## Hygiene (any integration)

- [ ] The tag-relay list is editable where INTEGRATION.md §3 put it (Settings if the host has
      one) and persists.
- [ ] Host build is clean; existing host tests still pass.
