# Story 2: Sync the Treasure Map with one relay

**Status:** Approved
**Created:** 2026-09-07
**Type:** Feature

## Background

Story 1 made the gaps visible: the presence panel now shows, per relay, whether it holds the Map
being displayed, a different version, nothing at all, or could not be reached. On the local dev
instance that surfaced 6 of 12 locations holding a copy — and no way to do anything about the
other six.

Seeing a gap you cannot close is a weak place to leave a user. The information is only worth
having if it leads somewhere, and the obvious next move — "this relay is missing my Map, put it
there" — is exactly what the panel currently cannot do. Story 1 deferred this deliberately
("Repairing coverage… this story reports; it does not fix"); this story takes it up.

The same affordance covers the more interesting case. Because kind 10040 is **replaceable**, a
relay can hold a *different* version of the Map — and a relay serving a stale one silently
advertises a delegation the user has already changed. Converging that relay on the current version
is the repair that matters most, and it is the same button.

Two properties make this smaller and safer than it sounds, and the criteria below lock both in:

- **Nothing is signed.** The Map is already a signed event. Moving it between relays is transport,
  not authorship — so no signer prompt, and no opportunity to alter what the user published.
- **Nothing is deleted.** The older copy is superseded by the receiving relay's own
  replaceable-event handling. This feature publishes no deletions, ever.

Affected: any user whose Map is missing from, or stale on, a relay other people read.

## User-facing description

As a Brainstorm user looking at where my Treasure Map lives, I want to sync it with a particular
relay in one click, so that a relay that is missing my Map or serving an out-of-date one ends up
holding the current version — without my having to hand-edit or re-publish anything.

## Acceptance criteria

- [ ] **The action appears only where there is something to do, and says which way it goes.**
      Given a relay row, when that relay's state differs from local strfry's, then the row offers a
      sync action whose label states the direction — sending the local version out to that relay,
      or bringing that relay's newer version back here. Given a relay already holding the same
      version as local, a relay that could not be reached, or a relay where neither side holds a
      Map, then the row offers no sync action.

- [ ] **Sending converges the relay.** Given local strfry holds the Map and the relay holds an
      older version or none, when the user syncs that row, then the existing signed event is
      published to that relay — with no signer prompt — and the row then re-checks and reports the
      relay's new state. Given the publish fails, then the row says so and no other row's state
      changes.

- [ ] **Bringing a newer version back converges local, and the page follows.** Given the relay
      holds a version more recent than local strfry's, when the user syncs that row, then that
      version is stored in local strfry and the page re-reads the Map, so the user is not left
      looking at a copy that has just been superseded. Given the import fails, then the row says
      so and the displayed Map is unchanged.

- [ ] **Nothing is ever deleted.** No deletion event of any kind is published on any path of this
      feature. The older copy is discarded by the receiving relay's replaceable-event handling, or
      not at all — a relay that chooses to keep both is that relay's business, and the row simply
      reports what it finds on the next check.

- [ ] **The deployment's publish policy is honored.** Given the instance is configured to keep
      publishing local-only, when a row's sync would send the Map out to an external relay, then
      that action is unavailable and the row states that external publishing is switched off for
      this instance. Bringing a version *into* local strfry stays available, since it publishes
      nothing outward.

## Concepts touched

- `39998:<TA>:nostr-relay` — nostr relay. Unchanged by this story; the relay set and its
  operator-editable groups are story 1's, reused as-is.
- The kind-10040 Treasure Map has no concept-graph handle (confirmed against
  `/api/concept-graph/summaries` during story 1). Name it in plain language.

## Out of scope

- **Bulk sync.** No "sync everything" button. One relay, one click, one outcome the user chose —
  a single action that writes to a dozen relays at once deserves its own story and its own
  consent conversation.
- **Publishing deletions.** Explicitly barred by criterion 4, and not a hidden future step of this
  story.
- **Automatic or background sync.** Nothing happens without a click.
- **Any merge or reconciliation smarter than "the more recent one wins."** No combining entries
  from two versions; no field-level merge. If a user wants a blend, that is what the existing
  hand-editor is for.
- **Syncing anything other than the displayed kind-10040** — not assertions, not Trusted Lists,
  not profiles.
- **Relay-to-relay sync.** Every sync has local strfry on one side.
- The local strfry row's existing **Import to local strfry** button (story 1, inherited from the
  original page) keeps its current behavior and is not merged with this action. They are close
  cousins — that one imports the *displayed* event when local has nothing; this one imports *a
  particular relay's* newer event — and the Architect should decide whether they can share a path
  without changing what the existing button does.

## Open questions

*(None blocking.)* Two judgement calls made while drafting, flagged so they can be overridden
cheaply rather than discovered later:

1. **No confirmation dialog.** Bringing a newer version back does replace what local strfry serves,
   which is not trivially undone. It is judged safe to do on one click because the incoming event
   is the user's own signed Map and is by definition their more recent one — and because the button
   states the direction before it is pressed. If that reads as too casual, a confirm step is a
   small change.
2. **Nothing is added to the local strfry row itself.** Local is one side of every sync, so it has
   no counterpart to sync *with*.

## Linked artifacts

- ADR: `engineering-team/decisions/treasure-map-relay-presence/0002-per-relay-map-sync.md`
- Test plan: `engineering-team/stories/treasure-map-relay-presence/2-per-relay-map-sync.test-plan.md`
- Review: (filled in after Review phase)
