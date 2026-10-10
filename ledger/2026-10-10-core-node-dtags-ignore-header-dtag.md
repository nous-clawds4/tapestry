# A concept's `concept-graph` header tag can name an address where no Concept Graph exists, because core-node d-tags come from the name, not the header's d-tag

**Id:** 2026-10-10-core-node-dtags-ignore-header-dtag
**Type:** bug
**Opened:** 2026-10-10 (DList Auxiliary Events pre-NIP session; found by the doc-plan sweep, confirmed by hand)
**Status:** OPEN
**Done:** —

Tapestry Concepts § "The concept-graph header tag" says a concept's Concept Graph is at
`39999:<pubkey>:<header d-tag>-concept-graph`, and that readers may compute that address when the tag is absent.
`create-concept` writes the tag that way (`src/api/normalize/index.js:1260`, from `headerDTag` at `:1213`). But it
gives every core node, the Concept Graph included, a d-tag built from `slug` = `toSlugName(name)` (`:1176`, `:1193`,
`:1148-1150`; d-tags at `:1286`, `:1328`, `:1394`, `:1437`, `:1471`, `:1516`, `:1567`). The skeleton path does the
same from the header's `slug` tag or its name (`handleNormalizeSkeleton`, `:240`; Concept Graph d-tag at `:643`).

The two agree only when the header's d-tag equals that slug. They differ when:

- the request passes an explicit `dTag` that differs from the name's slug, or `random`, or a `nonce`
  (`dtag.headerDTag` appends `~<nonce>`, `src/lib/dtag.js:42-45`);
- the name contains anything other than ASCII letters, digits and whitespace: `dtag.slug` folds diacritics and turns
  every other character into a hyphen, while `toSlugName` only replaces whitespace. Checked with node: "Dog's Breed"
  gives header `dog-s-breed` and core nodes `dog's-breed`; "Café" gives `cafe` and `café`; "snake_case" gives
  `snake-case` and `snake_case`.

**A live case ships in firmware.** The firmware install calls create-concept with `dTag: slug`
(`src/firmware/install.js:171-176`). For `nostr-event-tag` the slug is `nostr-event-tag`, but the name it passes is
"nostr event tagging" (`firmware/versions/v1.0.0/concepts/nostr-event-tag/concept-header.json`), so its core nodes
land at `nostr-event-tagging-*` while its header's `concept-graph` tag names `nostr-event-tag-concept-graph`.

In those cases the published `concept-graph` tag names an address with nothing at it, and the spec's compute fallback
gives the same wrong address. Nothing in the reference deployment reads that tag yet (BIBLE §5: its consumer is the
deferred materialization stream), but two readers make the same assumption for the Superset, that it sits at
`<header d-tag>-superset`: the firmware install's community Superset fetch (`src/firmware/install.js:1107-1112`) and
the class-thread pull's anchor (`src/api/concept/pullClassThread.js:116`). Both miss the Superset of any concept
created under one of the conditions above, `nostr-event-tag` included. A third reader assumes the opposite, the current
name-slug convention: the tapestries create flow builds each member's Concept Graph import from `oSlugs.singular`
(`ui/src/pages/tapestries/useConceptOptions.js:37`, `tapestryDraft.mjs:72`, `:122`), the workaround tapestries story 3
added for `nostr-event-tag`.

**Fix shape.** Either build core-node d-tags from the header's d-tag, or write the tag from the Concept Graph's actual
address.

- **Option 1** applies to new concepts only; existing core nodes keep their addresses. It is the only option that also
  fixes the two Superset readers. But it moves new concepts' Concept Graphs away from where the tapestries create flow
  looks, and the flow can't simply switch: the header's d-tag never finds an older diverging concept's Concept Graph
  (`nostr-event-tag`'s stays at `nostr-event-tagging-concept-graph`), and the `concept-graph` tag finds it only once
  that header is re-emitted with a correct tag. The same change must keep the flow finding both older and newer
  concepts.
- **Either way,** existing headers whose tag is wrong need a re-emit of the header, or a reader that falls back further.
  The `o` tag (DList Auxiliary Events; Tapestry Concepts § Core nodes of a concept) gives readers a link that doesn't
  depend on d-tags, but only for core nodes that carry it.

**Pointer:** `src/api/normalize/index.js` (`handleCreateConcept`, `handleNormalizeSkeleton`); `src/lib/dtag.js`;
`src/firmware/install.js` (create-concept call; community Superset fetch); `src/api/concept/pullClassThread.js`;
`ui/src/pages/tapestries/useConceptOptions.js`;
`protocols/drafts/tapestry-concepts.md` § The concept-graph header tag.
