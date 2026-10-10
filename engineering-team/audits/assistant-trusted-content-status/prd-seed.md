# PRD Seed: Scores, Lists and Concepts — what your Tapestry Assistant publishes for you, told true on the hub

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/assistant-trusted-content-status/audit.md`
**Anchor:** the acceptance frame in `book.md`: the owner's ask, quoted verbatim, two decisions taken at intake (what "completed" means; the Standard path), and one taken at story approval (one link to `/treasure-map`). There was no Discovery conversation.
**Confidence:** **high** for what shipped and why; **medium** for how it reads to a person. It is deployed to `staging.brainstorm.world` and its anonymous surfaces were checked there. Nobody has yet watched a signed-in person's cards follow their own Treasure Map on a live instance.
**Date:** 2026-10-09

> This is a reverse-engineered baseline in the product-team PRD shape. It is a **strawman for the product team**, not a ratified spec. Sections are tagged `[FROM FRAME]`, `[INFERRED]`, or `[UNKNOWN — product input needed]`.
>
> **Read the confidence honestly.** The ask was concrete and short, and it was settled in two questions rather than a Discovery conversation. One product question was answered by an engineering rule rather than a product decision: whether a *backup* assignment counts (§7).

## 1. Product vision

`[FROM FRAME]` The Assistant Management page lists what your Tapestry Assistant does for you. Its *Publication of Trusted Content* section should use the same three words as your Treasure Map, **Scores**, **Lists** and **Concepts**, and each should say truthfully whether your Tapestry Assistant is the one publishing it.

`[INFERRED]` A Treasure Map (kind 10040) tells other apps which of your Assistants publishes which kind of insight. A person can have several Assistants, at several WoT Service Providers. The hub asks one narrower question: *is your Tapestry Assistant on this instance among them?* `/treasure-map` asks a different one: *is anyone?* The two pages answer differently on purpose (book Decision 1).

`[UNKNOWN — product input needed]` Whether "your Tapestry Assistant is assigned" should grow into "your Tapestry Assistant is assigned **and actually publishing**". Today the check reads only where the Map points.

## 2. Personas

`[FROM FRAME]` / `[INFERRED]`, from the story and the page's states:

- **A signed-in person with an Assistant on this instance** (Owner, Admin or Customer):
  - sees each card marked until their Treasure Map gives that category to their Tapestry Assistant, then Done;
  - follows a card to its page and finds the rule and a link to `/treasure-map`;
  - after saving their Map there, finds the hub already caught up.
- **A person whose Map gives a category only to another provider's Assistant** (Brainstorm's, say): sees Needs attention here, while `/treasure-map` shows the category as assigned. `[INFERRED]` That person may find the two pages' disagreement surprising (§7).
- **A signed-in person without an Assistant, or a visitor:** sees the cards unmarked and no pill, as before.

## 3. Scope (as-built)

`[FROM FRAME]` On `staging` (PR #832) and in production (2026-10-10, PR #838):

- **The names.** Scores, Lists, Concepts open the section, in that order. Descriptions, NIP links and page addresses are unchanged.
- **The answer.** Each category is Done when the person's newest Treasure Map gives it to their Tapestry Assistant here, alone or beside other Assistants. Otherwise it needs attention, with one of three reasons: no Map, not assigned, or other Assistants only. When the Map couldn't be read it is "not known yet", and stays marked but uncounted.
- **The look.** The hub's shared Done look: a green ✓, a "Done" badge, and a screen-reader prefix.
- **The count.** The count line and the top-bar pill agree with the marks.
- **Catching up.** A Map saved in the app re-checks the hub, with no polling.
- **The pages.** Each keeps its placeholder body, now with the rule and the link "Manage your Treasure Map →".

## 4. Domain model

`[INFERRED]`:
- **Treasure Map** (kind 10040, by the person): entries of `["<key>", <Assistant pubkey>, <relay>]`. A key's first Assistant is its *preferred* one, and any later ones are backups.
- **Category** (Scores = kinds 30380–30389 and `3038x…`; Lists = 30390–30399 and `3039x…`; Concepts = 39998/39999). A bare `*` reaches all three, unless a bare family entry covers that category. A `*:…` scope reaches none. The rule lives in `src/lib/treasureMapCategories.mjs`.
- **Your Tapestry Assistant here**: the one main→delegate mapping (for the Owner, the instance's Tapestry Assistant).
- **The category's state**: done · pending (no-map / not-assigned / other-assistants-only) · unfinished (the read didn't complete).

## 5. Design rules (as-built)

`[INFERRED]`:
- **Unknown is never Done,** and is never counted against you: the page marks it, the pill doesn't count it (`/setup`'s rule).
- **One reading of the Map,** shared by `/treasure-map` and the hub, so they can only differ where they *ask* different questions.
- **The hub's words come from the stories' § Copy.** A "Needs attention" card's page states its rule in plain words.
- `[UNKNOWN]` No rule was recorded for whether a page should show its own status and reason. The three pages don't yet.

## 6. Carry-forward & open questions

Promoted from audit §6:
- **The three pages:** show each category's status and reason, and perhaps a one-click "give this to my Tapestry Assistant" (audit §6 #3).
- **Backup-only assignments:** do they count? (audit §6 #5)
- **One vocabulary:** the FAQ and the three descriptions still use Trusted Assertions, Trusted Lists and Decentralized Lists (§6 #7).
- **Assigned versus publishing:** check that the Assistant actually publishes, not only that the Map points to it (§6 #8).
- **One Map relay list** for the browser and the server (§6 #4, engineering).
- **The remaining placeholders:** Bounties, Pins, Tags, Notifications and Alerts, Preferences (§6 #9).

## 7. What product must validate

- [ ] **The two pages' different questions.** Is it right that `/treasure-map` is satisfied by any Assistant while `/assistant` wants yours? If yes, should either page say so in words, so the difference doesn't read as a bug?
- [ ] **Backups.** Should naming your Tapestry Assistant as a backup for a category count as Done? Today it doesn't, because the card shows only the preferred Assistant.
- [ ] **The vocabulary.** Should the FAQ and the card descriptions move to Scores, Lists and Concepts as well?
- [ ] **What the three pages become,** now that they carry the rule and a link: status and reason, a fix, or something richer.
- [ ] **"Assigned" versus "publishing".** Is a Map pointer enough to call Scores done, or should the hub look for the Assistant's actual events?
