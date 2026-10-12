# PRD Seed: Coming soon — the hub tells you what isn't built yet, and stops counting it

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/assistant-coming-soon/audit.md`
**Anchor:** the acceptance frame in `book.md`. It holds the owner's ask (quoted verbatim) and four decisions taken at
intake: which five cards, not counted in either reading, the page line, and the Light trial. There was no Discovery
conversation; the owner pointed at an existing example (the background image panel on `/assistant/profile`) and named
the cards.
**Confidence:** **high** for what shipped and why. **Medium-high** for how it reads to a person: the owner saw the built
hub section and the two rings side by side at Gate B, but nobody has looked at the hub signed in on a live instance.
**Date:** 2026-10-12

> This is a reverse-engineered baseline in the product-team PRD shape. It is a **strawman for the product team**, not a
> ratified spec. Sections are tagged `[FROM FRAME]`, `[INFERRED]`, or `[UNKNOWN — product input needed]`. It extends
> `audits/assistant-management/prd-seed.md`, whose hub made every unbuilt action an always-counted placeholder.

## 1. Product vision

`[FROM FRAME]` The Assistant Management page should count only what a person can act on. A card for a feature that
isn't built yet should say "Coming soon", the way the background image panel already does, and stay out of the "N
actions need attention" total.

`[INFERRED]` The count line and the top-bar reminder are a to-do list. Before this book, five of their six standing
items were things nobody could do, so the reminder never went away, even for a fully set-up person. Now the reminder
measures real gaps, plus one placeholder the owner chose to keep counting (Your Assistant's Treasure Map), because that
feature is close.

## 2. Personas

`[INFERRED]` From the story's "As someone managing my Tapestry Assistant…" and the hub's existing readers:
- **The set-up person**, whose real checks all pass. They see "1 action needs attention" instead of 6, and the top-bar
  reminder reads 1. *(Guess: they may still wonder why the Treasure Map card counts; see §7.)*
- **The visitor** (signed out). They see which features are coming, with no marks and no count.
- **The screen-reader user.** They hear "Coming soon: Bounties" once per card.

## 3. Scope (as-built)

`[FROM FRAME]`
- Five cards say **Coming soon** with a muted pill and no mark: Bounties, Pins, Tags, Notifications and Alerts,
  Preferences.
- They are left out of the hub's count line and the top-bar pill, in every state.
- Their pages lead with **Coming soon.** instead of **Placeholder page.**
- Your Assistant's Treasure Map is left as it is: marked and counted.

`[INFERRED]` (approved at Gate A, not in the original ask)
- The pill shows to every viewer, visitors included.
- Screen readers hear "Coming soon: <title>".

## 4. Domain model

`[INFERRED]` A hub action is now one of three kinds:
- **Checked:** the server answers whether it needs attention (seven today).
- **Coming soon:** not built; never marked or counted (five today).
- **Counted placeholder:** not built, but marked and counted until its check exists (one today, Your Assistant's
  Treasure Map).

Which kind an action is lives in the build (two key lists in `ui/src/pages/assistant/actions.js`), not in any event or
per-person data. It is the same for every viewer of one instance's build. No concept, event kind or stored shape
changed.

## 5. Design rules (as-built)

`[INFERRED]`
- "Coming soon" uses the background image panel's pill: the same class, words and colour.
- A Coming soon card has no marker. The empty circle beside its title is the hub's usual unmarked ring (indigo), not
  the example's dim grey. The owner saw both at Gate B and kept it.
- No rule was recorded for the count line at zero (§6).

## 6. Carry-forward & open questions

Promoted from build audit §6:
- **Production.** Not yet; it ships with the owner's next promotion.
- **The ring's colour.** Indigo today; dim grey would match the example exactly.
- **The count line at zero.** Once the Treasure Map card gets a real check, a fully set-up person would read "0 actions
  need attention". The top-bar pill already hides at zero; the hub's line has no zero state.
- **The signed-in look on staging**, by the owner.
- **Building the five.** Each one, when built, leaves the Coming soon list (and joins the checked list if it gets a
  check). See `audits/assistant-management/audit.md` §6 #1–#2.

## 7. What product must validate

- [ ] **Should the Treasure Map card count until it's built?** The owner kept it counted because it "will be soon".
  If that slips, it is the only standing item in every set-up person's reminder. `[UNKNOWN — product input needed]`
- [ ] **The zero state.** What the hub should say when nothing needs attention: hide the line, or say so ("Nothing
  needs attention")? `[UNKNOWN — product input needed]`
- [ ] **Should a Coming soon card be quieter still?** The dim-grey ring, or no chevron and no link, since its page has
  little to show. `[INFERRED]` today it stays a link so its planning notes remain reachable.
- [ ] **Is "Coming soon" a promise?** The pill tells visitors these five are on the way. Whether all five are on the
  roadmap, and in what order, has not been stated. `[UNKNOWN — product input needed]`
