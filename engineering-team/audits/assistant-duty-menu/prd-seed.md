# PRD Seed: Assistant Management — the Duty Menu

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/assistant-duty-menu/audit.md`
**Anchor:** the acceptance frame in `book.md`
**Confidence:** high for what shipped (two stories, each PASS in round 1, on staging). The questions in §7 are open on
purpose.
**Date:** 2026-10-12

> This is a **reverse-engineered baseline** in the product-team PRD shape, built from what shipped. It is a strawman
> for the product team, not a ratified spec. Every section is tagged:
> - `[FROM FRAME]`: grounded in the acceptance frame or an owner decision recorded in the book or a story;
> - `[INFERRED]`: read off the as-built system;
> - `[UNKNOWN — product input needed]`.
>
> It continues the seed of book `assistant-duty-cards`, which built the placeholder, and answers part of that seed's
> §7.

## 1. Product vision

`[FROM FRAME]` A person's Tapestry Assistant tells other clients, instances and Assistants what it **offers**: which
duties it will publish and on which relay. It does that with a **Duty Menu**, one item under the shared list of Duty
Menus that Nous publishes. The person sees the offer, sees what is published, and publishes with one press.

`[INFERRED]` Why it matters: when someone gives a duty to an Assistant, a Treasure Map entry needs the relay where that
Assistant's insights are found. A menu is how a client learns that relay for an Assistant it doesn't run. It is the
first half of the owner's switching scenario. The second half, the Assistant's own Treasure Map saying what is
**active**, is the next page (§6).

## 2. Personas

`[INFERRED]` The person with a Tapestry Assistant on this instance, managing it from `/assistant`:
- the Owner, whose Assistant is the instance's Tapestry Assistant;
- customers, each with their own Assistant key;
- admins who are not customers.

What each sees differs, because the offer reflects what this instance does for that particular Assistant.

`[INFERRED]` Secondarily, other instances and clients that read the menu, and later a provider directory (`duty-menus.md`
§ 9).

## 3. Scope (as-built)

- `[FROM FRAME]` **`/assistant/duty-menu`.** The page shows two panels:
  - **What your Assistant offers:** each duty with its category (Scores, Lists, Concepts), its key and its relay;
  - **Your Assistant's published Duty Menu:** the menu found now, or none.

  Under them, one status line (up to date / not published yet / out of date) and one line saying the menu is public.
- `[FROM FRAME]` **One button**, **Have your Assistant publish its Duty Menu**. It is disabled while the menu is up to
  date, and the page shows a per-relay report. The person never edits the rows (book Decision 1).
- `[FROM FRAME]` **The hub card is a real check.** **Done** means a valid menu is found and it matches the offer
  (book Decision 2). The hub's count line and the Assistant Alert follow it.
- `[FROM FRAME]` **What is offered:**
  - Scores (kind `30382`) for the Owner and active customers;
  - Lists (`30392`–`30394`) and Concepts (`39998`, `39999`) for every Assistant.

  Customers' Lists are a commitment ahead of support. Each row names this instance's own public relay.
- `[FROM FRAME]` **An empty offer still needs a published empty menu** to be Done (story 1, the owner's answer 3(b)).
  **The menu carries its rows only** (story 2, the owner's answer).
- `[INFERRED]` **Out of scope, as built:**
  - publishing automatically;
  - a name or per-duty details;
  - storefronts;
  - other Assistants' menus and a provider directory;
  - the Assistant's own Treasure Map page;
  - `/treasure-map` reading menus to fill relays.

## 4. Domain model

`[INFERRED]` These are the entities as the code models them (`protocols/drafts/duty-menus.md` is their source):
- **Duty Menu:** one replaceable item per Assistant key. Its address is `39999:<Assistant>:duty-menu`, and it is
  signed by that key. It points at Nous' header with `z`, names the Assistant with `p`, and holds rows.
- **Row (duty):** a Treasure Map key plus the relay where those insights are published. It means *offered*, never
  *active*.
- **Offer:** what this instance can publish for one Assistant now, derived from its settings and the person's
  customer status.
- **Current:** the published rows equal the offer's rows.
- **Nous' header:** `39998:<Nous>:duty-menu`, a shared concept. It is **not published yet** (§6).

## 5. Design rules (as-built)

- `[INFERRED]` **The menu tells the truth about this instance,** with one owner-made exception (customers' Lists). A
  person can't add a duty the instance doesn't perform.
- `[INFERRED]` **The server builds and signs the menu.** Nothing the browser sends can change a row.
- `[INFERRED]` **Local first.** The menu is written here before anywhere else, and read from here first.
- `[INFERRED]` **The card counts as needing attention until it knows.** It keeps the hub's existing rule for every
  checked action.
- `[INFERRED]` **The page speaks in the hub's second person** and reuses the Outbox Relays page's report words.

## 6. Carry-forward & open questions

Promoted from audit §6:
1. **Your Assistant's Treasure Map page.** Self-Maps are now in the spec (book `duty-menus-and-self-maps`). This page
   would show what the Assistant is actively publishing, and it is the other half of the switching scenario.
2. **Customers' Assistants publish Lists.** Until they do, a customer's Lists row promises something not yet
   delivered.
3. **The relay in a person's own Treasure Map for Scores** can differ from the menu's (audit §6).
4. **Nous publishes the shared header**, so all menus can be listed and Duty Menu can be added to a dictionary.
5. **Promote to production**, together with the parallel `assistant-shared-categories` book.
6. **The FAQ** doesn't mention the Duty Menu yet.

## 7. What product must validate

- [ ] **Should the instance republish menus by itself?** Today, when settings or a customer's status change the offer,
      the card goes back to **Needs attention** until the person presses again. Is that the right nag, or should
      menus follow the offer automatically?
- [ ] **Is "Lists for every Assistant" the right promise before customers' Lists exist?** When does that support
      ship, and should the page say "coming" meanwhile? `[UNKNOWN — product input needed]`
- [ ] **What should a menu say beyond its rows?** A name, a description, and per-duty details such as the algorithm
      and the update interval would help a provider directory. Who writes those words?
- [ ] **Is the public line enough?** Every menu is listable by anyone, per-customer keys included (`duty-menus.md`
      § 12). Does the page need to say more, or offer an opt-out?
- [ ] **How should the Duty Menu and Your Assistant's Treasure Map pages relate?** Should one link to the other, or
      should they become one "what my Assistant offers and does" view? `[UNKNOWN — product input needed]`
