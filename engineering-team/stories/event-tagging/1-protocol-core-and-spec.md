# Story 1: Event-tagging protocol spec + dependency-free core library

**Status:** Draft
**Created:** 2026-06-25
**Type:** Feature
**Epic:** event-tagging

## Background

We approved David's event-tagging protocol (PR #325, `protocols/drafts/event-taggings.md`): **indirect tagging** of nostr events via a `z`-tag descriptor and a per-tag "tagging-with-specific-tag" header — *not* the AI reviewer's collapse. We want to tag kind-1 notes across all note surfaces, and — per the operator — we want the core logic to be **SDK-extractable**: at least one third-party developer will add kind-1 tagging to their own app and should be able to lift our core wholesale.

So before any UI, server endpoint, or firmware change, we establish the **contract**: (a) a generic, stack-agnostic NIP-style spec promoted in `protocols/`, and (b) a **framework-agnostic, zero-dependency core library** that constructs the protocol's event shapes and discovery filters and is unit-tested in isolation. Everything later in the epic (read API, write path, UI) consumes this core rather than re-deriving the wire shape.

This story produces no signing, no relay I/O, no UI — only pure construction of unsigned events and filter objects, plus the spec. That makes it fully testable from the outside (inputs → exact JSON) and gives the other developer a copy-paste reference.

**Epic invariant inherited (local dev relay only):** no event may be published beyond the local dev strfry during this entire build — see the epic doc's "Build-time invariant" section. This story is *inherently* compliant: the core builds **unsigned events and filter objects and performs no I/O**, so it cannot publish anything. The acceptance criterion "never signs and never performs I/O" is what guarantees that here; the live enforcement (local-only publish helper / external-publish guard) lands in the write-path and UI stories.

## User-facing description

As a developer integrating Tapestry event-tagging — including a third-party dev building their own client — I want a precise generic protocol spec and a dependency-free reference implementation of the wire construction and discovery queries, so that I can correctly produce and find event-taggings without depending on Tapestry's stack, framework, or styles.

## Acceptance criteria

Testable from the outside (input → exact event/filter JSON). Throughout, `<TA>` is the runtime Tapestry-Assistant pubkey supplied by the caller (never hardcoded), and the wire shape must match `event-taggings.md` exactly.

- [ ] **Tag-element build.** Given `{ name, description, authorPubkey, taPubkey }`, when I call the core's build-tag-element function, then I get an unsigned `kind:39999` event with `d = <slug(name)>`, a `z` to `39998:<TA>:tag`, and content carrying `{ slug, name, description }` — matching the existing tag-element wire shape.
- [ ] **Tagging-header build.** Given a tag-element `{ authorPubkey, slug }` and `taPubkey`, when I call build-tagging-header, then I get an unsigned `kind:39999` event that is simultaneously (a) a list header — `names`, `description`, `d = tagging:<slug>-tagging` — and (b) a list item — `z` to `39998:<TA>:tagging-with-specific-tag` and an `a` to `39999:<authorPubkey>:<slug>` (the tag-element coordinate). Exactly per the spec's "Awesome Tag Taggings" header.
- [ ] **Tagging-assertion build (kind-1 target).** Given a tag descriptor (its tagging-header author + slug), a target **note id**, polarity, and `taPubkey`, when I call build-tagging-assertion, then I get an unsigned `kind:39999` event with: a `z` to `39998:<TA>:nostr-event-tag`; a `z` to the tagging-header coordinate `39999:<headerAuthor>:tagging:<slug>-tagging`; an `e` tag carrying the note id (because kind-1 is non-addressable); a `polarity` tag (`"1"` / `"-1"`); and a deterministic `d` tag of the documented form `event-tag-<descriptor>-<target8>-<asserter8>`.
- [ ] **Tagging-assertion build (addressable target).** Given an addressable target supplied as an `a`-coordinate instead of a note id, when I build the assertion, then the target is carried in an `a` tag (not `e`), honoring the header's `recommended a` / `allowed e` rule. Both target forms produce the same `z`/`polarity`/`d` structure.
- [ ] **Discovery filter — all taggings using a tag.** Given a tagging-header coordinate, when I call the discovery-filter builder, then I get the documented `{ "kinds":[39999], "#z":[ "39999:<headerAuthor>:tagging:<slug>-tagging" ] }` filter as a valid nostr filter object.
- [ ] **Discovery filter — all tags applied to an event.** Given a target note id (or a-coordinate), when I call the corresponding builder, then I get the documented filter(s) that return candidate taggings for that target.
- [ ] **Discovery filter — is a tag event-taggable yet.** Given a tag-element coordinate, when I call the builder that finds its tagging-header(s), then I get a filter over the `39998:<TA>:tagging-with-specific-tag` list members whose `a` points at that tag-element (per the spec's reverse-lookup section).
- [ ] **Zero coupling / zero deps.** The core module imports nothing from the app (no React, no server utils, no relay client) and declares no runtime dependencies; a test can `require`/`import` it in isolation and exercise every builder. It returns unsigned events and plain filter objects only — it never signs and never performs I/O.
- [ ] **Generic spec promoted.** `protocols/` contains a generic, stack-agnostic spec for event-tagging: standard protocols/ metadata header (Status 📝 pre-NIP, Canonical, Sources), a title block, no references to Tapestry files/styles/framework, polarity enum defined, deterministic `d`-tag forms stated normatively (header + assertion), and a "Relationship to other specs" section reconciling it with `tags.md` (the `nostr-event-tag` member it points forward to). `protocols/README.md` indexes it.
- [ ] **Read-time POV framing documented.** The spec states that discovery filters return **candidates**, and whether each tagging "counts" is a per-POV, read-time trust computation (invariants #1/#3) — not global truth. Polarity dispute-exclusion is likewise a read-time op.

## Concepts touched

- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:tag` — tag-element (the descriptor).
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-event` — the target event.
- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user-tag` — sibling spec to reconcile against (the pubkey-tagging analog).
- **NEW** `39998:<TA>:nostr-event-tag` — DList of event taggings (referenced by the assertion's `z`; physically seeded in Story 2).
- **NEW** `39998:<TA>:tagging-with-specific-tag` — per-tag tagging-header type (referenced by the header's `z`; seeded in Story 2).

> Architect re-resolves `<TA>` against the runtime instance TA. The core takes `taPubkey` as a parameter — it must not embed any deployment identifier.

## Out of scope

- Firmware seeding of the two new concepts (Story 2) — the core *references* the handles as composed strings; it does not require them to exist to be unit-tested.
- Server read API / relay scans / POV trust scoring (Story 3).
- Signing, publishing, the 3-publish orchestration, and any NIP-07 interaction (Story 4) — the core builds **unsigned** events; signing is the caller's job.
- Any UI / note-surface wiring (Story 5).
- Ratifying the spec from `drafts/` to a normative `nips/` entry — it stays a pre-NIP draft this story; only its content/placement is finalized for SDK reference.

## Open questions

- Exact home for the dependency-free core (a shared lib path importable by both server and client, vs. a reference module under `protocols/`). PO constraint: it must be dependency-free and extractable; the Architect chooses the location. *(Architecture)*
- Final deterministic `d`-tag string for the assertion — the draft shows `event-tag-<descriptor>-<target8>-<asserter8>` in a comment; promote to normative and define `<descriptor>`/`<target8>`. *(Architecture / spec)*
- The draft uses an `a` target in its worked example (tagging a tag). Confirm the kind-1 path uses `e` and that the core selects `e`-vs-`a` from the target form. *(resolved here: kind-1 → `e`; Architect verifies against header allowed/recommended)*

## Linked artifacts
- ADR: `engineering-team/decisions/event-tagging/0001-protocol-core-and-spec.md`
- Test plan: `engineering-team/stories/event-tagging/1-protocol-core-and-spec.test-plan.md` (suites: `test/event-tagging-core.test.js`, `test/event-tagging-spec.test.js`)
- Review: `engineering-team/reviews/event-tagging/1-protocol-core-and-spec.md` — **PASS** (CHANGES_REQUESTED → fixed: symmetric author-pubkey validation + test)
