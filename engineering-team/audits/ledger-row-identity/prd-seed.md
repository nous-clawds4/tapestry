# PRD Seed: A loose-ends ledger that many sessions can write to at once

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/ledger-row-identity/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high about what was built and why *(the frame was explicit, and each bullet was checked at close)*; low about whether any of it is product material *(see the note below)*
**Date:** 2026-09-20

> Reverse-engineered baseline in PRD shape. **Read this first:** this book changed the engineering harness — how the repo's list of small open items names each item — and not Brainstorm Search or Tapestry as anyone outside the team meets them. No screen, search result, API or published event changed. Most sections below are thin by nature and are left thin rather than padded. The seed exists so the product team can see what changed in the machinery that also files *their* loose ends, and decide whether anything here deserves product attention. The honest expectation: very little does (§7).

## 1. Product vision
`[FROM FRAME]` The team keeps one ledger of small open items — loose ends too small for a story. Many sessions, AI and human, add to it at the same time, often unable to see each other's work. Each item needs a name that anyone can create without asking anyone, and that never changes once it is written down, so that a reference to an item always means the item its author meant.

`[INFERRED]` The problem underneath is throughput. The operator is deliberately running more sessions in parallel, and the old naming scheme — the next whole number — made every extra session more likely to collide with another. Fourteen collisions are on record between 2026-08-07 and 2026-09-19, three of them while this book was in flight. Most spent a merge or a review round on renumbering, and at least one left a reference that still resolved, to the wrong item.

`[UNKNOWN — product input needed]` Whether this is only plumbing. The shape of the fix — many writers, no coordinator, names that must stay stable, disagreement surfaced at read or merge time and never blocked at write time — is the shape of Tapestry's own publishing model. That may be a coincidence worth nothing, or a small worked example worth keeping. A guess, flagged as one.

## 2. Personas
- `[FROM FRAME]` **The operator running many sessions in parallel** — resolved the collisions by hand during merges and promotions; wants merges that need no judgment about the ledger.
- `[FROM FRAME]` **Any session that files a loose end** — an AI session in an engineering or product role, or a person. Wants to write an item down and cite it without first learning what every other session has done.
- `[INFERRED]` **A reviewer** — used to spend review rounds checking for colliding numbers; now reads the result of an automatic check.
- `[INFERRED]` **Product-team roles** — they file items in the same ledger (the product retro sends its lessons there) and were given permission to write in the new location. How often they do is not known from this book. A guess.

## 3. Scope (as-built)
`[FROM FRAME]` Shipped, and live on the staging line:
- A new item is named by the day it was written plus a few descriptive words, and is its own small document. Creating one needs no look-up and no counting.
- The old numbered list is frozen where it stood. Every existing number still finds its item; nothing was renumbered and no reference was edited.
- An automatic check, run on every proposed merge, fails if a name appears twice, if someone adds to the frozen list, or if a new item is malformed — and says what to do instead.
- The roll-up views (the "what's open" report, the digest each session starts with, and the escalation banner for harness lessons) show old and new items as one list.
- One written rule for naming, citing and closing an item. The older advice — look at the shared line first and expect to renumber — is gone.
- A prerequisite fix: two open harness lessons had been invisible to those roll-ups because of one character in their text. They are counted now.

Decided out of scope: converting the old items to the new form; the two other append-only team files whose ends also conflict when two branches add to them; a helper command for naming; folders, archiving or an index for the new items; working through the items themselves.

## 4. Domain model
`[INFERRED]` No product concept was touched — no concept-graph entry, schema, event kind or stored product data. The ledger's own small model, for reference:
- **Ledger item** — name, type (bug, feature, protocol, docs, cleanup, or *meta* for a harness lesson), a one-sentence title, when it was opened and by what, status (open or done), when and how it was closed, a body, a pointer to the detail.
- **Two homes** — a legacy item has a number and lives as a line in the frozen list; a new item has a day-plus-words name and lives as its own document. An item never moves between homes and never changes its name once shared.
- **Citation** — refers to an item by name only, never by where it is stored, so storage can be reorganised later without breaking a reference.
- **Harness lesson** — the *meta* type. Three or more open, or any one older than about a month, raises a banner asking for a harness story. 119 are open on the shared line at this close, and the close itself files three more.

## 5. Design rules (as-built)
`[INFERRED]` Emergent rules worth ratifying, or rejecting, on purpose:
- A name must be creatable offline, with no shared counter and no registry of who may create one.
- A name, once shared, never changes. A repair must never be "rename it and chase the references": references that look identical to other numbers cannot be swept, and some live where no sweep reaches.
- Prefer designs in which keeping both sides of a merge is always the right resolution.
- Freeze rather than migrate. About 2,700 references inside the repo, and an unknown number outside it, point at the old numbers; uniformity was not worth moving them.
- One rule, written once. Every second copy is a future edit — one copy of the old rule lived outside the repo and had to be replaced by hand.
- The reader adapts to what people write, not the other way round: the counting fix changed the reader, and no one was asked to avoid a character.
- `[no rule was ever recorded]` How long closed items are kept. Today: for ever, as the audit trail. At the recent rate that is about 1,200 new documents a year in one folder.

## 6. Carry-forward & open questions
Promoted from audit §6:
- **The outcome is not observed yet.** The mechanism is proven in tests and on scratch copies; at close no two branches had yet added items in parallel under the new rule. Whether renumbering episodes have actually stopped is a question for a few weeks from now.
- **Two homes, permanently.** Old items keep their numbers and their place. Accepted at design time; revisit only if the frozen list itself becomes a problem.
- **The new items' folder is flat and only grows.** Folders, archiving or an index were deferred, and names are cited without locations so that the choice stays open.
- **Two other append-only team files still conflict** when two branches add to their ends. They carry no names, so nothing collides, but each such pair of branches still needs a hand resolution.
- **Not yet on the production line** — the operator's choice. No effect on anyone outside the team either way.
- Engineering clean-ups recorded as ledger items, needing no product decision: a line-ending case in which a new item passes the check and is then shown nowhere; a freeze that can be moved by the same change that breaks it; a status written with decoration that hides an old item; a small disagreement between two of the roll-up's readers.
- Three harness lessons from this book's retro, also ledger items: a human-gated book leaves no durable record that a gate was approved; the ledger's rule never tells a writer to look for an existing item first — nine items have been closed as duplicates of another; and the written command for a book-close commit leaves out a file that the same procedure edits.

## 7. What product must validate
Little here needs a product decision, and this list should not be read as a backlog.
- [ ] **Is any of this product material at all?** The default reading is no: adopt it as harness baseline, and no discovery phase is needed. `[product/operator decision]`
- [ ] **The product retro's wording.** The product flow sends each retro lesson to the shared ledger as a new item. That still works — the ledger's first rule now sends the writer to the new location, and the merge check catches an item added to the frozen list — but the product workflow's own text does not say so, and engineering does not edit product workflows. Does the product team want to? `[product-team input needed]`
- [ ] **Who checks that it worked, and when?** Suggested measure: collisions and renumbering episodes on the shared line, which should fall from fourteen in six weeks to none. `[operator decision]`
- [ ] **Is the lesson inbox the right next investment?** This book made *adding* a lesson cheap and safe. It did nothing for the backlog: 119 harness lessons are open on the shared line (122 with the three this close files), the oldest 80 days old, against a banner that fires at three. `[UNKNOWN — operator input needed]`
- [ ] **How long are closed items kept, and who browses them?** No rule was ever recorded (§5). `[UNKNOWN — operator input needed]`
