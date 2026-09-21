# A book with no PRD gets no accessibility check from any role, so an ADR can prescribe a failing contrast and pass every gate

**Id:** 2026-09-21-no-accessibility-baseline-without-prd
**Type:** meta
**Opened:** 2026-09-21 (setup-status-and-alert #2 review, harness friction 2)
**Status:** OPEN
**Done:** —

The Setup Alert's "Finish setup →" chip is white on `#d29922`, a contrast of 2.52:1 at 12.48 px
bold. WCAG AA asks for 4.5:1, and on phones the chip is the only text in the pill. ADR
setup-status-and-alert/0002 § 4 prescribed "white bold text". That ADR passed its gate, Test Design
and Implementation without anyone measuring the contrast. The reviewer measured it (review
Non-blocking 1). The same review found a label-in-name gap (Non-blocking 2): below 640 px the pill's
accessible name does not contain its visible text.

**Why no role caught it:**
- The product designer's baseline ("Accessibility is baseline: contrast ratios, touch-target sizes,
  keyboard-navigation assumptions", `product-team/roles/product-designer.md:36`) runs only in the
  product flow. A book opened with an acceptance frame and no PRD never reaches it.
- The review checklist's "Product-guide adherence" section applies only "when the story traces to a
  PRD" (`engineering-team/templates/review-checklist.md:46`).
- The ADR template and the test-plan template ask nothing about accessibility.

**Fix shape:** one short accessibility line for every UI story, independent of a PRD. It would cover
text contrast against its real background, the accessible name versus the visible label (WCAG 2.5.3),
keyboard reach and a visible focus style. Candidates are the ADR template's implementation notes, the
test-plan template (so a Tester adds the check), and the review checklist's house-rules section. The
cheapest is the review checklist, which would make the Reviewer measure it every time.

**Pointer:** `engineering-team/reviews/setup-status-and-alert/2-the-setup-alert.md` § Harness
friction 2, and Non-blocking 1 and 2.
