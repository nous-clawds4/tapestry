# Acceptance script — tagging in the Jumble fork

Manual end-to-end verification. Prereqs: two Nostr identities with NIP-07 signers (call them
**A** and **B**), the app running against the kit's default config (dcosl tag relay), and relay
connectivity confirmed (GO.md §6 step 1 — the console smoke query shows existing tags).

Check every box. "Chip" = the tag UI element on a note/profile.

## 1. Viewing existing tags

- [ ] A profile known to be tagged on the reference instances (browse tags.brainstorm.world to
      find one) shows the same tags as chips on its Jumble profile page.
- [ ] A note known to be tagged shows its tags as chips in the feed card AND in the thread view.
- [ ] Chip counts equal net apply−dispute from the reference instance's tag page for the same tag
      (allow small deltas from relay propagation / trust-mode differences — investigate anything
      large).
- [ ] A feed page with many notes issues batched tag queries (network tab: no per-note REQ storm).
- [ ] With tag relays unreachable (temporarily set a bogus tagRelay, user relays without tag
      events), the app renders normally — no crashes, no spinners wedged; tags simply absent.

## 2. Applying an existing tag

- [ ] As A, open the tag picker on a note: existing tags load, search-by-name filters them.
- [ ] The picker separates **Content tags** and **Profile tags**; a tag known to be
      event-applicable (check the reference instance) appears under Content.
- [ ] Apply an existing tag to a note → publish succeeds → the chip appears immediately
      (optimistic/`mine`), and survives a full reload (read back from relay).
- [ ] Wire check (GO.md §7): the assertion's descriptor z resolves to a real header; d-tag,
      z-handles, polarity all correct.
- [ ] Apply an existing tag to a profile → chip appears on the profile page, survives reload;
      wire check the `p`/`a`/`e`/z/content shape.
- [ ] As B, viewing the same note/profile: A's tag is visible with count 1 (house-trust
      permitting; if B can't see it, check trust.ensure/predicate before suspecting the publish).
- [ ] Applying the same tag again as A does NOT duplicate (replaceable d-tag; count stays 1).

## 3. Disputing

- [ ] As B, open A's tag chip → stance popover shows the count and Apply/Dispute.
- [ ] B disputes → net count drops (2 viewers: A sees 1−1; chip renders per the ≤0 rule with B's
      own stance visible to B).
- [ ] B switches dispute → apply: the stance REPLACES (relay shows one assertion from B, latest
      polarity +1; count now 2).
- [ ] A disputes a tag on a profile; same replace semantics on the profile surface.

## 4. Creating a new tag on the fly

- [ ] As A, search the picker for a nonsense string → "Create tag" offered → create + apply to a
      **note** in one flow. Relay now has: tag-element (with `tag-for-nostr-event` hint z),
      tagging header, assertion — all three, correct shapes (GO.md §7).
- [ ] The new tag immediately appears in the picker's list (and under Content tags) for B.
- [ ] As B, apply A's new tag to a different note → exactly ONE publish (the assertion — header
      reused, none minted). Verify on relay: no second header authored by B.
- [ ] As A, create a new tag on a **profile** in one flow → tag-element (with
      `tag-for-nostr-pubkey` hint) + assertion; both correct.
- [ ] Cancel the signer mid-flow (reject the 2nd/3rd signature) → no dangling assertion on the
      relay; UI reports the partial result honestly.

## 5. Tag pages

- [ ] Clicking any tag chip navigates to that tag's page; name + description shown.
- [ ] **Notes** view lists the notes tagged in §2/§4, rendered as normal Jumble notes,
      most-recently-tagged first. A disputed-below-zero note is absent.
- [ ] **People** view lists the profile tagged in §2.
- [ ] A tag with existing usage on the reference instances shows a populated page (cold-start
      via dcosl works).
- [ ] Deep-linking the tag-page URL directly (fresh load) works.

## 6. Trust behavior

- [ ] With trust mode `house-ta`: an asserter WITH a house 30382 below `minRank`/beyond `maxHops`
      does not count toward chip totals (fabricate by tightening minRank in config, reload) —
      but the viewer's OWN stance still renders via `mine`.
- [ ] Network tab: 30382 REQs are batched `authors + #d` lookups only — never an open-ended
      kinds:[30382] subscription.
- [ ] Trust-source unreachable → app degrades to counting everyone (per `unknownPolicy`),
      no errors surfaced to the user.

## 7. Hygiene

- [ ] Tag relay list is editable in Settings and persists.
- [ ] No 64-hex pubkey literals in source (grep) — config only.
- [ ] No requests to `tags.brainstorm.world/api/*` from the browser (network tab).
- [ ] Build is clean; existing Jumble tests still pass.
