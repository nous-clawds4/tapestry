# Story 1: Single-letter tag filters in the Negentropy Sync panel

**Epic:** relay-management
**Status:** Approved
**Created:** 2026-07-15
**Type:** Feature

## Background

The Negentropy Sync panel on the Relay Settings page (`/tapestry/settings/relays`, "Sync" tab) builds and runs `strfry sync` commands against a chosen relay. Operators can currently shape the filter by **relay, direction, event kinds, authors, and time range** — but not by **tags**, even though tag-scoped filters are exactly what real sync jobs need. Concrete example: federating the tags family between instances means syncing `{"kinds":[39999],"#z":["<canonical handle>"]}` — the shared dcosl relay holds ~1.28M kind-39999 events of which only ~451 are tags-family (2026-07 census), so a kind-only sync over-pulls by ~2,800×. Today a tag-scoped sync must be hand-typed in a shell inside the container.

Two gaps close together in this story:

1. **UI:** the panel offers no way to add `"#<letter>": [values]` entries to the filter.
2. **Server:** the sync/count endpoints honor only `kinds`, `authors`, `since`, and `until` from the submitted filter — any other key is silently dropped before the command is built. Even a hand-crafted request carrying tag filters never reaches `strfry sync`. Tag filters must be honored **end-to-end**: preview → count → executed sync.

## User-facing description

As an **instance operator**, I want to add one or more single-letter tag filters to the negentropy sync filter — each entered as a letter plus one or more values (e.g. `#x: ["foo1","foo2"]`, `#y: ["bar"]`) — so that I can sync precisely the tagged slice of events I care about instead of over-pulling by kind alone.

Filters are added one at a time. Values for `p`/`e`/`a` tags are format-checked at entry so a typo'd pubkey or event id is caught before a sync runs against a live relay; other letters take arbitrary strings (there is nothing to check).

## Acceptance criteria

- [ ] **AC-1 (add a tag filter):** Given the sync panel, when the operator enters tag letter `x` with values `foo1, foo2` (comma-separated) and adds it, then the filter appears in the panel's added-filters list and the Command Preview's filter JSON contains `"#x":["foo1","foo2"]`.
- [ ] **AC-2 (composes with existing panels):** Given kinds/authors/time-range selections and added tag filters `#x` and `#y`, when the preview renders, then its filter JSON contains all of them together (`kinds`, `authors`, `since`/`until`, `"#x"`, `"#y"`). Tag filters compose with — never replace — the other panels' contributions.
- [ ] **AC-3 (remove):** Given added tag filters `#x` and `#y`, when the operator removes `#x`, then `"#x"` disappears from the list and preview while `"#y"` and all non-tag filter parts are untouched.
- [ ] **AC-4 (tag-name rules):** The tag-name input accepts exactly one ASCII letter (`a–z`, `A–Z`). Anything else (empty, multi-character, digit, symbol) cannot be added, with a visible reason. Adding a letter that already has a filter **merges** the new values into the existing entry (deduplicated), never creating a duplicate `"#x"` key.
- [ ] **AC-5 (p/e validation):** For letters `p`/`P`/`e`/`E`, each value must be 64-character hex (accepted case-insensitively, normalized to lowercase) **or** a matching bech32 form — `npub`/`nprofile` for p/P, `note`/`nevent` for e/E — which is decoded to hex before it enters the filter. An invalid value (wrong length, non-hex, wrong bech32 type, malformed bech32) blocks the add with an inline error identifying the offending value; the filter and preview remain unchanged.
- [ ] **AC-6 (a validation):** For letters `a`/`A`, each value must match `<non-negative integer>:<64-char hex>:<identifier>` (identifier may be empty and may itself contain colons) **or** be an `naddr` bech32, which is decoded to that coordinate form. Invalid values block the add exactly as in AC-5.
- [ ] **AC-7 (free-form letters):** For any other letter, values are arbitrary non-empty strings: whitespace-trimmed, empty entries dropped, at least one value required to add. No format validation is applied.
- [ ] **AC-8 (honored end-to-end):** Given added tag filters, when the operator runs **Count** or **Start**, then the server includes each `"#<letter>": [values]` entry in the filter it actually executes (local count, remote count, and the sync command), rather than dropping it. Regression guard: unknown **non**-tag filter keys are still excluded, and requests without tag filters behave exactly as today.

## Concepts touched

- `nostr-relay` (`39998:<this instance's TA>:nostr-relay`) — the sync target/counterparty. Handle pubkey is per-deployment; resolve at runtime, never hardcode.
- Deliberately **none** from the tag family: the panel is generic operator tooling. A `#z` value is just a string here; the story bakes in no concept-graph semantics.

## Out of scope

- **Saved filter presets / persistence** — panel state stays ephemeral, matching Kinds/Authors/Time Range today.
- **Multi-character tag names** — strfry only indexes single-character tag names; the filter language can't serve them.
- **In-place editing** of an added filter's values — remove + re-add covers it (merge-on-re-add makes appending values easy).
- **Semantic validation for free-form letters** (e.g. checking a `#z` value is a real concept handle) and **autocomplete/suggestions** (e.g. canonical tag-family handles) — tempting for the tag-federation use case; deferred to a future relay-management story.
- **Values containing commas** — the comma-separated entry field can't express them. Accepted limitation; no known single-letter tag convention needs comma-bearing values.
- Any change to router-based federation or `strfry router` config.

## Open questions

Defaults taken to keep the approval loop to one round — flip any of these at approval time and the story will be amended:

1. **Uppercase `P`/`E`/`A` validated like lowercase?** Default **yes** — NIP-22 et al. use uppercase counterparts with identical value formats, and the validators are shared. (AC-5/AC-6 as written.)
2. **Duplicate letter: merge or reject?** Default **merge + dedupe** (AC-4) — friendlier for building up a value list incrementally.
3. **Accept bech32 (npub/nprofile/note/nevent/naddr) and normalize to hex/coordinate?** Default **yes** (AC-5/AC-6) — operators usually have an npub on the clipboard, and the decode helpers already exist in this codebase.

## Linked artifacts

- ADR: `engineering-team/decisions/relay-management/0001-sync-panel-tag-filters.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
