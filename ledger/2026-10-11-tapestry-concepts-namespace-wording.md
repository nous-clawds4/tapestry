# Tapestry Concepts says json data is "namespaced by concept slug", but the code keys it by the camelCase singular

**Id:** 2026-10-11-tapestry-concepts-namespace-wording
**Type:** docs
**Opened:** 2026-10-11 (`duty-menus-and-self-maps` #2, review round 1, non-blocking 6)
**Status:** OPEN
**Done:** —

`protocols/drafts/tapestry-concepts.md` § "Data storage (json tag)" says element data in a `json` tag is "namespaced by
concept slug". Its own example (`{"dog": {...}}`) is a one-word slug, so the difference never shows. The code keys the
namespace by the concept's camelCase singular, `oKeys.singular` (`src/api/normalize/index.js` — e.g. `coffeeHouse`, not
`coffee-house`), and so does the generated JSON Schema's primary property. The same spec's § on the Primary Property
already speaks of the key.

The Duty Menus pre-NIP names its namespace explicitly (`dutyMenu`), so it is unaffected. Another spec, or another
implementer reading "by concept slug" literally, would write `duty-menu` and fail Tapestry's schema.

Fix shape: one doc-lane edit to `tapestry-concepts.md` § "Data storage (json tag)": "namespaced by the concept's
camelCase key (its Primary Property name), e.g. `coffeeHouse`". Add a two-word example.

**Pointer:** `engineering-team/reviews/done/duty-menus-and-self-maps/2-duty-menus-pre-nip.md` § Findings, non-blocking 6;
`src/api/normalize/index.js` (`toCamelCase`, `oKeys.singular`).
