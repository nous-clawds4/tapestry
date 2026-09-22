# The fixed Tapestry header is taller than the space the page leaves for it, so its bottom edge covers the content

**Id:** 2026-09-22-tapestry-header-covers-content
**Type:** bug
**Opened:** 2026-09-22 (book `assistant-management` close; found at story 2's review, non-blocking 4)
**Status:** OPEN
**Done:** —

**What was seen.** The control panel's header (`.app-header`, `ui/src/components/Header.jsx`) is
`position: fixed`. Every `/tapestry` page starts its content 48 px down (`.main-wrapper`, `margin-top: 48px`).
The header is not always 48 px tall. Measured on the built UI with every `/api` route mocked and no pill
showing, on `/tapestry/`:

| Viewer | Header height | Covered |
|---|---|---|
| Signed in as a Customer, every width from 320 to 1280 px (the user button is the same for every role) | 55 px | 7 px |
| Visitor, 375 to 1280 px | 48 px | none |
| Visitor, 320 px | 71 px (the brand wraps beside "Sign in with Nostr") | 23 px |

**Where 55 comes from.** The header has `min-height: 48px`, but the signed-in user button is 38 px tall.
Add 2 × 8 px padding and a 1 px border, and the header comes to 55 px (story 2's review measured the same).

**Not from this book.** The heights are the same with no pill as with one. Story 2's review also found
55 px with `.header-auth` forced back to `display: block`. The Assistant and Setup Alerts' own rules keep
the header from growing any further while a pill shows (ADR assistant-management/0002 Amendment 1; ADR
setup-status-and-alert/0002 Amendment 1).

**Fix shape.** Either make the page's offset follow the header, for example a CSS variable both read, or
`position: sticky` instead of `fixed`. Or keep the header at 48 px: a shorter user button, or less
padding. Then check the covered strip at the widths above, and at 320 px for a visitor.

**Pointer:**
- review `engineering-team/reviews/done/assistant-management/2-the-assistant-alert.md`, round 1,
  non-blocking 4;
- the measurement here was taken at the book's close.
