# Declarative rendering for DList data: a design note

**Status:** 💭 idea, for discussion with David and the Brainstorm team. Nothing here is ratified, and
nothing here changes a wire format. Worksheet entry: [W27](../protocols/worksheet.md#w27--declarative-rendering-hints-for-dlist-headers).
**Written:** 2026-10-03, from an operator question ("nostr and Tapestry seem uniquely suited to
declarative, data-driven UI: hypermedia, HAL, Siren, Hydra, Adaptive Cards, Naked Objects. How can we
use those ideas to make rendering arbitrary DList data on arbitrary clients and surfaces more
tractable?"), and the Brainstorm-UI session's display-hints work reviewed that week.
**Read first:** [Opinionated Views](../protocols/drafts/opinionated-views.md) (📝 pre-NIP, 2026-10-03).
This note is written to fit inside its three tiers, not to compete with them.

---

## 1. The claim

A DList header already separates the *shape* of data from the data. Tapestry adds two things most
hypermedia systems never had:

- **a way to say "my definition corresponds to yours"**, the `b` tag ([Inherit-From](../protocols/drafts/inherit-from.md) § The `b` tag);
- **a trust-weighted way for a shared vocabulary to emerge**, per point of view ([Shared Concepts](../protocols/drafts/shared-concepts.md)).

HAL, Siren and Hydra assume a server that decides which links and actions a client gets. On nostr,
anyone publishes, so every affordance is a *claim*, and the reader resolves which claims to believe.
That is harder. It is also why declarative rendering could work across the open network rather than
inside one API: the vocabulary for describing how things render can converge the way concepts
converge, without a standards committee.

## 2. Where this fits in Opinionated Views

Opinionated Views § 2 names three tiers of rendering:

| Tier | Built | What this note proposes for it |
|---|---|---|
| **Generic** | once per platform | Nothing. It stays the floor (§ 5, rule 2). |
| **Schema-driven** | once per platform, for every DList | **This note's whole subject.** Today it reads only what headers already carry: `names`, `required`, `field-type` (§ 2.1). Declarative hints on the header would let one generic renderer produce a much better card for *every* list, without anyone writing a view. |
| **Opinionated** | by hand, per category | Nothing. Hand-built views and prose view briefs (§§ 6–7) stay as they are: briefs are data a developer reads, never code a platform runs. |

The schema-driven tier is where the leverage is. Opinionated Views says it well: "There will always be
far more DLists than anyone can build views for." Every hint a header can carry raises the floor for
the long tail.

Opinionated Views § 2.1 deliberately waits on a fuller `field-type` vocabulary "until headers actually
use one". That trigger is arriving. As of 2026-10-03, on `wss://dcosl.brainstorm.world`:

- a GitHub Accounts copy (`39998:5a251bba…:github-accounts`, event `19f19245…`) carries
  `["display","title",…]` and a header `["image",<url>]`;
- a self-declared **URL Templates** concept exists (`39998:2efaa715bbb46dd5be6b7da8d7700266d11674b913b8178addb5c2e63d987331:url-templates`),
  with a first template item (`f19f39da…`, `["url-template","https://github.com/{username}"]`).

Both come from Brainstorm-UI, marked provisional. Its builder's guide is
`docs/dictionary/dlist-presentation-conventions.md` in the Brainstorm-UI repository (PR #151). That is
the moment to agree on names before a third client invents its own.

## 3. Prior art, mapped to what exists

| Hypermedia idea | DList / Tapestry equivalent | State |
|---|---|---|
| A data schema (Hydra's API documentation; JSON Schema) | Header `required` / `recommended` / `allowed` / `disallowed` (NIP), `optional` (convention), `field-type` (convention); firmware ships a `json-schema.json` per concept | Exists, loosely specified |
| A UI schema kept apart from the data schema (JSON Forms, react-jsonschema-form's `uiSchema`) | Brainstorm's `["display", <role>, <declared field>]` | Provisional |
| URL templates with explicit variable mapping (Hydra's `IriTemplate` and `IriTemplateMapping`; RFC 6570) | Brainstorm's `["link", <template id>, <relay>, <placeholder>, <field>, …]`, backed by the URL Templates concept | Provisional. It is very nearly Hydra's `IriTemplate`, and should say so. |
| Follow-your-nose discovery (Hydra's entry point; HAL `_links`) | kind-10040 Treasure Map → headers → items (`#z`) → lists of lists (`30397`) → class threads (`n`/`s`) | Exists |
| Host-owned styling (Adaptive Cards' host config) | The rule that a hint decorates a declared field and never dictates layout | Agreed in principle |
| Actions with their input fields (Siren `actions`) | Nothing declared. The protocol moves exist: react (kind 7), tag, pin, file an item, copy into my list | Gap |
| UI generated from the domain model (Naked Objects) | The concept graph *is* the domain model; an "add an item" form follows from the header | Not built |
| Which app opens which kind of thing (NIP-89, kinds `31990` / `31989`) | Opinionated Views § 7.4 notes NIP-89 can't name a DList category | Gap |

## 4. Ideas, in order of payoff

### 4.1 Describe roles and affordances, never layout

The field-types worksheet item (on `feat/tags`: "Field types as a DList: portable actions, not portable
rendering") reached the governing conclusion: a rendering language that suits a table, a phone, a
search card, a terminal and a voice assistant is a minefield, while "this value is a resource you can
visit" survives every surface. Brainstorm's roles (`title`, `summary`, `image`, `link`, `media`) are
the right kind of thing. The vocabulary should grow by *meaning*, not by widget:

- candidates: `date`, `geo`, `price`, `duration`, `rating`, `identity` (a pubkey: render the profile);
- each surface maps a role to its own widget: `geo` is a map pin on the web, an address in a terminal,
  "near Nashville" in a voice answer. That mapping is the platform's host config. It lives in client
  code and never on the wire.

The Opinionated Views surface names (`page`, `card`, `row`, `thumbnail`) are the right axis for host
config: "on a `card`, show `title`, `image` and one `summary` line."

### 4.2 Field types as concepts, bridged to existing vocabularies by `b`

If a field type is itself a DList element (the `feat/tags` worksheet proposal), a client that has never
seen `isbn` or `github-username` can still learn what the type affords. Add one step: a type element
carries a pointer-typed `b` to a schema.org or Hydra term (a `github-username` type pointing at an
account-identifier term). That is a lightweight `owl:sameAs`. It gives JSON-LD-style interoperability
without JSON-LD, and lets a client reuse widget libraries keyed by schema.org types.

### 4.3 Link templates: one store, two ways to bind

Brainstorm binds templates on the header (`link`, explicit placeholder→field pairs, multi-field). The
field-types proposal binds them on a type (one implied placeholder). These should be two ways to point
at **the same template objects**, not two registries: a type definition is then "values of this type
fill template ⟨id⟩ at placeholder ⟨p⟩", a one-pair `link` implied by the type. One syntax (RFC 6570
level 1), one store (the URL Templates concept), one trust story (the reader's own copy of URL
Templates decides which templates are offered). Brainstorm's safety rules (a literal `https://host/`
prefix; percent-encoding of every value; the expanded URL must stay on the template's host) answer the
open problems the field-types proposal lists.

### 4.4 Actions: the piece Siren has and DLists lack

Links say where to go; actions say what can be done. For a DList item the possible actions are already
known protocol moves: react +/− (kind 7), tag it, pin it, file another item, copy it into my list, open
it in a handler app. A header (or a type) could declare which make sense for its items, and a "propose
an item" form can be generated from `required` and `optional`, with `field-type` choosing each input
widget. That is Naked Objects without a server. Constraint: a **closed** action vocabulary, each action
specified once, never free-form endpoints. Actions publish signed events, so an open vocabulary would
let a header author choose what a reader signs.

### 4.5 Views as shareable, trust-resolved data

A "view" in this sense is presentation choices for a list: columns, sort, group-by, which roles show on
which surface, default filters. Make views DList items, adopt someone else's with a pointer `b`, and
resolve them with the precedence that copies already use (the dual-author rule in
[Assistant Designation](../protocols/drafts/assistant-designation.md), extended as Brainstorm does: my
view, my assistant's, the house's, the community's). This keeps presentation choices *out of the
definition*, so changing how a list looks never forks what the list is. It answers the POV-first
question for presentation: "how does GitHub Accounts look *to me*?" (Opinionated Views' view briefs are
a different thing: prose for builders. These are data for renderers.)

### 4.6 Trust is the security model

In HAL an affordance is a promise from a server you chose. Here it is a claim from anyone, so a
template, an action or a view is a phishing or manipulation surface.

- Honour templates, types and views only from the reader's own copies or from authors their point of
  view trusts.
- Nothing executable, ever. Declarative is what makes this safe: data can be checked and refused.
  That is the strongest argument against scriptable rendering of any kind, and it matches Opinionated
  Views § 7 ("Platforms share briefs, not code").
- Opinionated Views § 5's rules apply unchanged to anything a declarative renderer shows: present,
  never decide; fall back; keep the Nostr record; label what isn't nostr; don't store enrichment as
  truth; read safely; don't gate.

### 4.7 Explicit fallback levels

Write the levels down, so every client knows its floor and can say which level it implements:

| Level | A client renders… | Source |
|---|---|---|
| 0 | the item's `alt` text, or raw tags | NIP-31 |
| 1 | declared fields as label: value | the header's declarations (Opinionated Views § 2.1 is level 1) |
| 2 | roles: title, summary, image, media | display hints |
| 3 | links and actions | templates; an action vocabulary |
| 4 | type affordances, resolved by trust | field types as concepts |

An unknown construct drops to the level below. That keeps arbitrary clients interoperable at whatever
level they implement, the way `alt` keeps unknown kinds readable.

### 4.8 Per-concept handlers

For data too rich for a generic renderer (music, maps, code), a concept could recommend handler apps,
resolved by trust, with the schema-driven tier as the fallback. This is Opinionated Views open question
5 (NIP-89 can't name a DList category) seen from the rendering side.

### 4.9 A shared conformance corpus

The practical way to keep Brainstorm, Tapestry and others converging: a set of fixtures
(headers, items, and the expected role resolution), including the edge cases: a missing title field, a
`disallowed` field, a bad URL, conflicting hints, an unknown role. It would become the test suite of a
future NIP section.

## 5. Risks

- **Building a rendering language.** The classic failure of declarative UI. Roles and affordances, not
  layout; the host config stays in client code (§ 4.1).
- **Vocabulary fragmentation.** Each client minting its own hint names, which is why § 2 argues for
  agreeing on names now, while only one client publishes them.
- **Putting things on the wrong layer.** Schema in the NIP and the compat draft; roles and types in a
  presentation draft; views and handlers as trust-resolved data; layout in the client, always.
- **Getting ahead of usage.** Opinionated Views' instinct to wait for real use is right. The answer is
  to standardize what clients are already publishing (§ 2), not to design the full vocabulary up front.

## 6. Suggested path

1. **Worksheet [W27](../protocols/worksheet.md#w27--declarative-rendering-hints-for-dlist-headers)**
   (this note's entry) collects the questions.
2. A Protocol-Spec docs-mode pass ([workflow](../engineering-team/workflows/protocol-spec-workflow.md))
   ratifies them, split by maturity:
   - `field-type` into [decentralized-lists-compat](../protocols/drafts/decentralized-lists-compat.md),
     beside `item-kind` (the `feat/tags` worksheet item's stated graduation target);
   - the meaning of a declaration's third element into the DList NIP's next republish (David's call);
   - display roles, the header `image`, link templates and the URL Templates concept into a section of
     Opinionated Views (as the schema-driven tier's inputs) or a sibling draft.
3. Housekeeping first: reconcile the field-type worksheet items that exist only on `feat/tags` (as W17
   and W18, numbers that mean different items on `staging`; ledger row
   `2026-10-03-worksheet-numbers-diverge-across-branches`).

## 7. Open questions

1. **Home.** Do display hints belong in Opinionated Views (they feed its schema-driven tier) or in their
   own draft?
2. **Role vocabulary.** Brainstorm's five (`title`, `summary`, `image`, `link`, `media`), or a smaller
   first set? Which meaning-roles come next (§ 4.1)?
3. **Templates.** Header-level `link`, type-level templates, or both on one store (§ 4.3)? Should
   `link` adopt Hydra's mapping vocabulary by name?
4. **Actions.** Is a closed action vocabulary worth specifying now, or after a second platform asks?
5. **Views as data.** Worth a DList of their own, or does that collide with the uppercase `Z`
   proposal's "opinionated view briefs" ([W25](../protocols/worksheet.md#w25--uppercase-z-auxiliary-events-of-a-dlist-header))?
6. **Who publishes the shared vocabularies** (URL Templates, roles, types): firmware, or community
   handles (worksheet W1)?

## References

- [Opinionated Views](../protocols/drafts/opinionated-views.md) §§ 2, 2.1, 5, 7.
- [DList NIP](../protocols/nips/decentralized-lists.md) § List declaration (field declarations and their third element).
- [DList Header Declaration](../protocols/drafts/dlist-header-declaration.md); [Content Categories](../protocols/drafts/content-categories.md).
- [Assistant Designation](../protocols/drafts/assistant-designation.md) (the dual-author rule; curation copies).
- `feat/tags:protocols/worksheet.md`: "field-type header tag: in the wild, not in the NIP" and "Field
  types as a DList: portable actions, not portable rendering".
- Brainstorm-UI: `docs/dictionary/dlist-presentation-conventions.md` (PR #151).
- External: Hydra Core Vocabulary (`IriTemplate`, `IriTemplateMapping`); RFC 6570; Siren; HAL; JSON
  Forms (UI schema); Adaptive Cards (host config, templating); Naked Objects; NIP-31; NIP-89.
