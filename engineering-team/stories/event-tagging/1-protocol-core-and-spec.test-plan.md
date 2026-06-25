# Test Plan: Story 1 — Event-tagging protocol core + spec

**Story:** `engineering-team/stories/event-tagging/1-protocol-core-and-spec.md`
**ADR:** `engineering-team/decisions/event-tagging/0001-protocol-core-and-spec.md`
**Date:** 2026-06-25

## Approach

Two hand-rolled CJS suites in the project's existing style (each exports `run()` → `{pass, fail, failures}`, wired into `test/test.js`):

- **`test/event-tagging-core.test.js`** — exercises the real, dependency-free core at `src/lib/event-tagging/` by `require`-ing it and asserting exact `{kind,tags,content}` / filter objects against fixed inputs. Pure construction → no relay, no signing, no HTTP, deterministic.
- **`test/event-tagging-spec.test.js`** — SOURCE-CONTRACT assertions over the finalized spec `protocols/drafts/event-taggings.md`, its index entry in `protocols/README.md`, and the `tags.md` pointer flip.

The under-test module does **not** exist yet, so the core module is `require`d **lazily inside each test** (never at file top) — that keeps `test/test.js`'s load phase from crashing and makes every failure a descriptive "core not implemented yet".

**Fixtures** (fixed, fake-but-valid 64-hex):
`TA=82b75e47…973833`, `JACK=1111…1111` (tag-element & header author), `ALICE=2222…2222` (asserter), `CHARLIE=3333…3333` (addressable-target author), `NOTE_ID=4444…4444`. Tag name `Awesome Tag` → slug `awesome-tag`.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 tag-element build | `buildTagElement: exact kind/tags/content for a named tag` | core | unit |
| AC-2 tagging-header build | `buildTaggingHeader: header+item shape, d=tagging:<slug>-tagging, a=tag-element` | core | unit |
| AC-3 assertion (kind-1 {id}→e) | `buildEventTaggingAssertion: kind-1 note target uses e, dual z, polarity, d-tag` | core | unit |
| AC-4 assertion (addressable {address}→a) | `buildEventTaggingAssertion: addressable target uses a, target8 from coord pubkey` | core | unit |
| AC-5 filter — taggings using a tag | `filterTaggingsUsingTag: #z over the tagging-header coord` | core | unit |
| AC-6 filter — tags applied to an event | `filterTagsAppliedToEvent: #e for {id}, #a for {address}` | core | unit |
| AC-7 filter — tagging-headers for a tag | `filterTaggingHeadersForTag: #a tag-element + #z tagging-with-specific-tag` | core | unit |
| AC-8 zero coupling / zero deps / no I/O | `purity: no app requires, no network, no Date.now, no crypto, CJS only` | core | source-contract |
| AC-8 (determinism) | `builders are deterministic and emit no pubkey/created_at` | core | unit |
| handle composers (ADR) | `handles: concept + address composers compose exact strings` | core | unit |
| slug parity (ADR) | `slug: byte-identical to src/lib/dtag.js slug incl. diacritics` | core | unit |
| polarity/pubkey guards (ADR) | `assertion rejects bad polarity and malformed pubkeys` | core | unit |
| AC-9 spec promoted | `spec: metadata header, title, normative d-tag + polarity, no // in JSON, relationship section` | spec | source-contract |
| AC-9 (index) | `spec: indexed in protocols/README.md` | spec | source-contract |
| AC-9 (tags.md flip) | `tags.md: "Event tagging" section points to event-taggings spec` | spec | source-contract |
| AC-9 (no stack leak) | `spec: no literal 64-hex pubkey hardcoded` | spec | source-contract |
| AC-10 read-time POV framing | `spec: discovery yields candidates; counting is a read-time per-POV op` | spec | source-contract |

## Edge cases

- [ ] Addressable-target `target8` derives from the coordinate's **pubkey segment** (`address.split(':')[1].slice(0,8)`), not the literal `39999:` prefix.
- [ ] `polarity` accepts only `1` / `-1` (number or numeric string per implementer's choice — test passes `1`/`-1` and one invalid `0`/`2`).
- [ ] Malformed `asserterPubkey` (not 64-hex) throws, with no silent fallback.
- [ ] Builders return objects with exactly `{kind,tags,content}` keys — no `pubkey`, no `created_at` (caller/signer adds those).
- [ ] Calling the same builder twice with identical inputs yields deep-equal output (no time variance).
- [ ] `slug` strips diacritics (`Café Über` → `cafe-uber`), matching `dtag.js`.

## Notes / resolutions (Tester decisions within ADR latitude)

- The ADR left the header's plural-name carriage open (`['names', name, <plural?>]`). Resolved: **`buildTaggingHeader` takes `names` as an array** and emits `['names', ...names]` (the DList multi-value convention; matches the draft's singular+plural example).
- **Tag-element `d` = `slug(name)`**, matching the *existing* `tag` concept (`useProfileTags.createTag` emits `d=slug`, e.g. `podcaster`) — **not** the draft example's `good-tag-tag` artifact. The draft example's tag-element `d` values are an inconsistency the spec finalization should correct; tests assert the real concept shape (`awesome-tag`). ⚠️ *Surfaced for the gate — see review note.*
- Canonical **tag order** asserted per the ADR's Implementation notes (assertion: `d, target, z(nostr-event-tag), z(header), polarity`; header: `d, names, description, z, a`; tag-element: `d, z`). Implementer must match.
- Filter objects asserted **field-by-field** (key order not constrained); event `tags` asserted **order-sensitive**.

## Test infrastructure
- Runner: `node test/test.js` (existing hand-rolled harness). No new framework, no build.
- No Concept Graph API, no firmware, no relay, no network required — pure host-side construction + file reads.
- Under-test module (to be created by the Implementer): `src/lib/event-tagging/` (`handles.js`, `slug.js`, `builders.js`, `filters.js`, `index.js`).
- Spec files read: `protocols/drafts/event-taggings.md`, `protocols/README.md`, `protocols/drafts/tags.md`. Cross-checked against existing `src/lib/dtag.js`.

## How to run

```
npm test
```

## Verification
The new tests fail with the current code (core module absent; spec not yet finalized). Failing output captured at red-phase commit (below).
