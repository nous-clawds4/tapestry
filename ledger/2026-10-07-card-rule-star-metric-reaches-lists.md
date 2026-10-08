# A `*:` card-rule key that ends in a metric still counts on Lists, though only Scores carry metrics

**Id:** 2026-10-07-card-rule-star-metric-reaches-lists
**Type:** bug
**Opened:** 2026-10-07 (treasure-map-edit #1 review, non-blocking 1)
**Status:** DONE
**Done:** 2026-10-07 — settled by the owner's book decision 11: the page ignores every `*:…` entry that names
anything after the `*`, so these keys count nowhere. Built by treasure-map-edit #2 (ADR treasure-map-edit/0002), review
PASS: `engineering-team/reviews/done/treasure-map-edit/2-the-cards-ignore-scoped-star-entries.md`. Ships to staging with the
book's PR.

The cards' rule (`categoryAssistants`, `ui/src/pages/treasure-map/manageTreasureMap.js`, ADR treasure-map-edit/0001
sub-decision 2) decides which families a `*:…` entry reaches from its first word only: `tag`, `pin` and `dlist` reach
Scores and Lists. In the draft grammar (`protocols/drafts/treasure-maps.md` § 4.3, § 4.7) only a Score key has a metric
segment after its descriptor. So a `*:` key whose scope is longer than that system's List layout names a metric and
reaches only Scores:

- `tag` and `pin`: a List key has three scope segments (`tag:<category>:<Tag>`), a Score key four, so
  `*:tag:<cat>:<Tag>:<metric>` and `*:tag:::confidence` are Scores-only;
- `dlist`: a List key has two (`dlist:<DList>`), a Score key three, so `*:dlist:<DList>:rank` is Scores-only.

Today all of these also count on the Lists card. Checked 2026-10-07 at `c60a3ac`: `*:tag:X:T:confidence`,
`*:tag:::confidence`, `*:dlist:L:rank` and `*:pin:X:P:rank` each give one Assistant on Scores and one on Lists. The rule
before treasure-map-edit #1 did the same, so it isn't a regression. Story 1's AC-2 enumerates families by the first word
only, and nothing in the app writes these keys today.

**Fix shape.** In `appliesTo`, a `*:` entry with `tag` or `pin` and more than three scope segments, or `dlist` and more
than two, reaches Scores only. Add Node cases beside `test/treasure-map-card-rule-edges.test.js`'s F class. Fix it before
Edit mode relies on the rule for "individually assigned duties", or fold it into that story.

**Pointer:** `engineering-team/reviews/done/treasure-map-edit/1-the-card-rule-edge-cases.md` § Findings, non-blocking 1.
