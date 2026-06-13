# Story 1: Reputation section point-of-view explainer popup

**Status:** Approved
**Created:** 2026-06-14
**Type:** Feature

## Background
On a public user profile page, the "Reputation" section shows trust-metric scores. Those
scores reflect a Web-of-Trust point of view — either the instance's **House** point of view
(the default) or the viewer's **Personalized** point of view, depending on which is currently
selected. Today nothing on the page tells a reader where those scores come from, so a viewer
has no way to know what the numbers mean or that they shift with the selected point of view.

The page already has this exact affordance elsewhere: a circled "i" (ⓘ) info control beside
the word "Verified" that opens a short dismissible popup explaining what "Verified" means.
This story gives the "Reputation" heading the same kind of explainer.

Affected: anyone viewing a public profile page — both authenticated viewers and anonymous
visitors.

## User-facing description
As someone viewing a public profile page, I want a brief explanation of where the Reputation
scores come from, so that I understand that those scores reflect a Web-of-Trust point of view
— either the House point of view or my Personalized point of view, whichever is currently
selected.

## Acceptance criteria
Testable from the outside. Each criterion gets at least one test.

- [ ] Given a public profile page, when it renders, then the "Reputation" section heading shows a circled "i" (ⓘ) informational control, visually and behaviorally consistent with the existing "Verified" info control on that page.
- [ ] Given the profile page is rendered, when the viewer activates the Reputation ⓘ control, then a dismissible popup opens.
- [ ] Given the Reputation popup is open, when the viewer activates its acknowledgement button, then the popup closes; and when the viewer dismisses the surrounding overlay, then the popup also closes — matching the existing info-popup dismissal pattern.
- [ ] Given the Reputation popup is open, then its text explains in plain language that the reputation scores shown in that section reflect a Web-of-Trust point of view, and that this is either the House point of view (the instance's default) or the viewer's Personalized point of view depending on which is currently selected. The explanation is general; it does not name which point of view is active at the moment.
- [ ] Given the Reputation popup is open, then its text is bounded to the Reputation-section scores and makes no claim about the Following / Verified Followers / Verified Reporters counts shown elsewhere on the page.
- [ ] Given the new control and popup, then with them removed the profile page behaves exactly as before: how the reputation scores are computed, fetched, namespaced by point of view, and which scores display are all unchanged.

## Concepts touched
List concepts (by handle if known) that this story affects. Useful for the Architect when orienting via `/api/concept-graph/summaries`.

- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:web-of-trust` — web of trust (the reputation model the popup names: the scores reflect a Web-of-Trust point of view; this concept's own description notes that "each user sees a personalized view of the network weighted by the people they trust," which is the House-vs-Personalized distinction in plain terms).
- `39998:e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36:graperank` — graperank (the contextual Web-of-Trust scoring algorithm that computes the personalized trust scores shown in the Reputation section).

Not modeled as Concept Graph nodes: "House point of view" and "Personalized point of view"
have no dedicated handle in the graph (verified against `/api/concept-graph/summaries` on this
instance — there is no `point-of-view`, `house`, `personalized`, or `reputation` node). They
are product/UI notions; the underlying personalized-view idea they name is carried inside the
`web-of-trust` and `graperank` concept descriptions above. See epic: PoV Resolution for where
the House-vs-Personalized selection is owned.

## Out of scope
What this story explicitly does NOT cover. Paste anything tempting that you decided to defer.

- Dynamically naming which point of view is currently active in the popup (the dynamic variant). The explanation is static and general.
- Any change to how the reputation scores are computed, fetched, namespaced by point of view, or which scores display. The existing Reputation data path stays untouched.
- Any claim in the popup about the Following / Verified Followers / Verified Reporters counts elsewhere on the page (they derive from different sources).
- Adding the popup to any page other than the public profile page.
- Any backend or API change.
- The open profile-followers follow-ups on the same surface (the duplicate Verified Followers metric row; personalized point of view for the follows/followers tables) — adjacent but not part of this work.

## Open questions
Anything the PO doesn't yet know. Resolve before approving the story.

- The exact user-facing wording of the popup (its title and body sentences) is intentionally left to be settled during the cycle, within the accuracy constraints above: it must convey that the scores reflect either the House or the Personalized point of view depending on which is selected, and it must not assert a point of view for the Following / Verified Followers / Verified Reporters counts. (Per the book, this is the one design decision delegated to the Director; it is not a blocker on approving the story.)

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
