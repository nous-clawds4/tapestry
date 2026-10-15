# The List page finds a kind-9998 header's items by `#e`, but the DList NIP says items name it with `z`

**Id:** 2026-10-03-list-page-9998-items-by-e
**Type:** bug
**Opened:** 2026-10-03 (cross-session review for Brainstorm-UI's Dictionary work; branch `docs/declarative-dlist-rendering`)
**Status:** OPEN
**Done:** —

**What was seen.** On `feat/tags`, `ui/src/pages/List.jsx:18-23` (`itemsFilter`) queries `{kinds:[9999,39999], '#e':[<header id>]}` when the header is kind 9998. The DList NIP says otherwise: "If the list header is a kind `9998` event, the `z` tag is the _event id_ of the list header" ([decentralized-lists](../protocols/nips/decentralized-lists.md) § Item declaration; Examples 1 and 2 show `["z","<id_list_of_developers>"]`). So a NIP-conformant item of a 9998 list never appears on `/list/<id>`, and the page shows "no items". `src/api/dlists/itemCounts.js` counts either tag (`z` or `e`), so the list index may show a count the list page then fails to render. Not on `staging` (the List page has not been merged there).

**Fix shape.** Query `'#z': [<header id>]` for 9998 headers; keep `'#e'` as a union only if an existing client is known to write it (none was found). Add a fixture to the List page's tests. Brainstorm-UI's guide was corrected to the NIP's form on 2026-10-02.

**Pointer:** `feat/tags:ui/src/pages/List.jsx:18-23`; `feat/tags:ui/src/utils/dlistFields.js` (`headerCoord` returns the id for 9998); decentralized-lists.md § Item declaration.
