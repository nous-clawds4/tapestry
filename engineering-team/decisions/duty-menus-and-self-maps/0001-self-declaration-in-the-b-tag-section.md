# ADR 0001: Self-declaration lives in inherit-from's `b` tag section, beside the reserved value

**Status:** Proposed
**Date:** 2026-10-10
**Story:** `engineering-team/stories/duty-menus-and-self-maps/1-ratify-self-pointing-b.md`

## Context

**The story** asks for the self-pointing `b` to become normative:
- AC1: the rule in `protocols/drafts/inherit-from.md` § "The `b` tag";
- AC2: one line in `protocols/drafts/shared-concepts.md` § "Declared affiliation", pointing back;
- AC3: no "canonical" or "consensus";
- AC4: `protocols/drafts/amendments-2026-09.md` § 3 marked applied;
- AC5: gates green, and no other `protocols/` file touched.

It is docs-mode: Test Design is skipped, and the Implementer writes spec prose.

**What the specs say today.**
- `inherit-from.md` § "The `b` tag" holds the wire format, the closed type registry (`pointer`, `inherit`,
  `inherit-items`; absent or unknown reads as `pointer`) and one special *value*: the reserved sentinel `b-tag-deferred`,
  in its own paragraph, "Reserved value (element 2)".
- `shared-concepts.md` defines no `b` semantics of its own (its § "Relationship to other specs"). It gives the policy
  reading: § "Declared affiliation" (pointer-`b`, zero weight, navigation not agreement) and § "Deliberate
  non-affiliation". The latter already says "when an author later wires or self-declares the header, the sentinel is
  replaced", so the term is used there before it is defined.
- `amendments-2026-09.md` § 3 proposes: "A header whose pointer-typed `b` tag names its own a-coordinate … declares itself
  canonical: the root other headers affiliate with. It asserts no deference …, opens no new path, and carries zero
  aggregation weight … Coverage tooling treats it as *dispositioned: self-declared* …".

**What the code already does** (the spec must describe it, not contradict it):
- Writing: `composeSelfDeclare` (`src/lib/headerDispositionCompose.js:28-32`) appends
  `["b", <own coordinate>, "pointer"]` and strips a `b-tag-deferred` sentinel. Submit as a Shared Concept
  (`src/api/concept/selfDeclare.js`) and Create New Concept with no target (`src/api/adoption/newConcept.js:71`) write the
  same tag.
- Classifying: `dispositionOf` (`src/lib/bValueForms.js:37-52`) reports `selfDeclared` when a `b` value equals the
  header's own coordinate, and `wired` for any other locatable value. Both can be true at once.
- Importing: `buildImportCypher` (`src/api/neo4j/eventSync.js:259-285`) derives `REFERENCES {source:'b-tag'}` for every
  non-`inherit` `b`. For a self-pointing `b` that is a **self-loop** on the header's own node.
- Reading: the Trusted Dictionary reads a self-declared header as pointing to itself (`src/lib/trustedDictionary.js:150`).

**Constraints.**
- The D2 vocabulary policy (`docs/NIP_REORG_DESIGN_HANDOFF.md` § D2) keeps "canonical" and "consensus" out of normative
  text and supplies deference / convergence / convention.
- "Root" is taken: `inherit-from.md` § "Resolution: the resolved definition" uses it for a node with no inherit-typed `b`.
  Calling a self-declared header "the root others affiliate with" would give one word two meanings in one spec.

**Concepts:** none changed. The rule governs any addressable DList header (kind `39998`, or a kind-`39999` declared
header) carrying a `b`. The stack is absent in this session, so no handles were read from a live graph; none are cited.

## Options considered

### Option A — The rule in inherit-from beside the reserved value; a policy line in shared-concepts; § 3 marked applied

- **inherit-from.** A new paragraph, "Self-declaration (element 2 = the carrier's own coordinate)", goes directly after
  "Reserved value (element 2)". Both describe a special element-2 value of the same tag, so they read as a pair.
- **shared-concepts.** § "Declared affiliation" gains a short **Self-declaration** paragraph: what it is for, and its place
  among the coverage states. It points to inherit-from for the wire form.
- **amendments.** § 3 is struck through as *applied*, with a pointer to where it landed; the proposal text is kept for
  history, following the file's own pattern for withdrawn items (§§ 2 and 5).

Pros:
- One normative home for the wire fact, as with the sentinel: value in inherit-from, policy in shared-concepts.
- The term "self-declares", which shared-concepts already uses, gets its definition.
- The text matches the shipped code.

Cons:
- Touches three files, plus one metadata sentence in the amendments file (see Decision, point 5).

### Option B — The whole rule in shared-concepts only

Pros: self-declaration is about affiliation, which is shared-concepts' subject.

Cons:
- shared-concepts says it "defines no `b` semantics of its own". A rule that gives an element-2 value a meaning is `b`
  semantics, and its sibling (the sentinel) lives in inherit-from.
- It fails AC1.

### Option C — Transcribe the amendment's wording verbatim

Pros: no rewording risk.

Cons:
- "canonical" breaks AC3 and D2.
- "the root" collides with resolution's "root".
- "opens no new path" is true, but silent about the self-loop the importer derives. A reader of the spec alone could
  expect no edge at all.

## Decision

We chose **Option A**. The wire meaning lives with the other element-2 rule in inherit-from, the policy reading stays a
pointer in shared-concepts, and the wording is D2-clean and matches the code.

**Sub-decisions:**

1. **The replacement for "canonical" is the verb itself.** A self-pointing `b` *self-declares* the header: it "offers it as
   a shared concept, one other authors may affiliate with". Convergence is named as what is resolved per point of view.
   Neither "canonical" nor "root" appears.
2. **The derived edge is stated, not denied.** The pointer derivation yields a self-loop,
   `(header)-[REFERENCES {source:'b-tag'}]->(header)`. It reaches no other node, so reach and deference closure are
   unchanged. "Opens no new path" is kept in that precise sense.
3. **Weight.** A header's own self-declaration is never counted as anyone's affiliation with it, and it carries no weight
   in any aggregate. This is the amendment's "zero aggregation weight" made concrete for the self case.
4. **Scope of the form.**
   - The rule covers a pointer-typed or untyped `b` whose element 2 is the carrier's own a-coordinate,
     `<kind>:<own pubkey>:<own d-tag>`.
   - Only an addressable header can self-declare: an immutable header (kind `9998`, or a kind-`9999` declared header)
     cannot carry its own event id.
   - A self-naming `b` of an inherit-family type is not addressed. Nobody writes one, and resolution's visited-set
     already makes it inert. `dispositionOf` counts it as self-declared whatever its type; that is harmless and left alone.
5. **Marking § 3 applied.** The heading is struck through with "— applied" and a dated pointer line, and the proposal text
   stays below. The file's metadata line ends "None of them defines a self-pointing `b`", which turns false once § 3
   lands. It gains a parenthetical, "(true when proposed; § 3 has since landed)". This is read as part of marking § 3
   applied (AC4); no other section changes.
6. **Metadata of the target specs.**
   - inherit-from's **Sources** line gains this ADR.
   - Its **Implementation** line gains one clause: self-declaration is implemented (`composeSelfDeclare`; Submit as a
     Shared Concept).
   - shared-concepts' Sources line gains this ADR.

## Consequences

- **Duty Menus can rely on it.** Story 2's header (handoff D10) self-declares under a normative rule.
- **One term, defined once.** shared-concepts' existing "self-declares" in § "Deliberate non-affiliation" now has a
  definition.
- **Three living specs still say "self-declared canonical",** a D2 slip, and stay untouched here (AC5):
  - `dlist-header-declaration.md` § 4, "The community version";
  - `trust-determination-methods.md` § 2, two table rows;
  - the `amendments-2026-09.md` § 1 table (a proposal, not a living spec).

  Follow-up: a doc-lane fix after this book, or a ledger row at story close if the Reviewer prefers.
- **No code change, no firmware reinstall.** Firmware reinstall required? **No.**

## Implementation notes

Docs-mode: the Implementer authors exactly these edits. The quoted text is the target wording; minor smoothing is fine
if the meaning is kept.

**1. `protocols/drafts/inherit-from.md`, § "The `b` tag"**, a new paragraph directly after the "Reserved value
(element 2)" paragraph and before "**Kinds:**":

> **Self-declaration (element 2 = the carrier's own coordinate).** A pointer-typed `b`, or one with no type, whose
> element 2 is its carrier's own a-coordinate — `["b", "<kind>:<own pubkey>:<own d-tag>", "pointer"]` — **self-declares**
> the header: its author offers it as a shared concept, one that other authors may affiliate with (policy in
> [Shared Concepts](./shared-concepts.md) § "Declared affiliation"). It is a claim, not an outcome: whether other authors
> converge on the header is resolved per point of view, never settled by the declaration. It asserts no deference
> (nothing defers to itself), and it carries no weight in any aggregate: a header's self-declaration is never counted as
> anyone's affiliation with it. Derived as a pointer, it yields a self-loop,
> `(header)-[REFERENCES {source:'b-tag'}]->(header)`, which reaches no other node, so reach and deference closure are
> unchanged. Only an addressable header can self-declare; an immutable header (kind `9998`, or a declared kind-`9999`
> header) cannot carry its own event id. Like any real affiliation, a self-declaration replaces a `b-tag-deferred`
> sentinel on the same header.

**2. `protocols/drafts/shared-concepts.md`, § "Declared affiliation"**, a new short paragraph after the paragraph that
ends "…defined in § "Reach"" and before the seeding paragraph:

> **Self-declaration.** An author may also offer their own header as a shared concept, for others to affiliate with, by
> pointing its `b` at the header's own coordinate (wire form and meaning: [Inherit-From](./inherit-from.md) § "The `b`
> tag"). Coverage tooling treats a self-declared header as dispositioned: the third state beside *wired* and *deliberately
> unaffiliated* (§ "Deliberate non-affiliation").

**3. `protocols/drafts/amendments-2026-09.md`:**
- The heading of § 3 becomes `## 3. ~~A self-pointing `b` declares a header canonical~~ — applied`.
- Directly under it, a line: "**Applied 2026-10-10** (`duty-menus-and-self-maps` #1, ADR 0001): now normative in
  [inherit-from.md](./inherit-from.md) § "The `b` tag" (Self-declaration), with the policy line in
  [shared-concepts.md](./shared-concepts.md) § "Declared affiliation", reworded under the D2 vocabulary policy. The proposal
  below is kept for history."
- The metadata line's "None of them defines a self-pointing `b`" gains "(true when proposed; § 3 has since landed)".
- Nothing else in the file changes.

**4. Metadata (sub-decision 6):**
- inherit-from **Sources**: add "self-declaration: `duty-menus-and-self-maps` ADR 0001 (from `amendments-2026-09.md` § 3)".
- inherit-from **Implementation**: add "self-declaration (a self-pointing `pointer` `b`) is implemented —
  `composeSelfDeclare` (`src/lib/headerDispositionCompose.js`), written by Submit as a Shared Concept".
- shared-concepts **Sources**: add "`duty-menus-and-self-maps` ADR 0001 (self-declaration)".

**Gates (AC3, AC5):**
- `grep -n -i -E "canonical|consensus"` over the added lines finds nothing. The metadata label `**Canonical:** not yet
  published` is the publication-URL field, not normative text.
- Every new link resolves.
- `bash scripts/harness-lint.sh` is clean.
- The stack-free `npm test` shows no regression against `origin/staging`.
- `git diff --stat` touches only the three `protocols/` files above, plus the story's Linked artifacts.

No test-file changes: docs-mode, Test Design skipped.

## Out of scope

- Rewording the three other "self-declared canonical" passages (Consequences).
- Any rule for a self-naming inherit-family `b`.
- Story 2's Duty Menu spec and story 3's Self-Maps.
- Any code or UI change. The code already matches.
