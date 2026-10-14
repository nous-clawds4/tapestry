# PRD Seed: Scores — your Grapevine's freshness, and a way to refresh it

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/assistant-scores/audit.md`
**Anchor:** acceptance frame in `engineering-team/audits/assistant-scores/book.md`
**Confidence:** high for what shipped (the owner pressed it live on staging); medium for the inferred intent beyond the
ask.
**Date:** 2026-10-14

> This is a **reverse-engineered baseline** in the product-team PRD shape, built from what shipped. It is a *strawman
> for the product team*, not a ratified spec. Every section is tagged `[FROM FRAME]` (grounded in the kickoff acceptance
> frame), `[INFERRED]` (read off the as-built system), or `[UNKNOWN — product input needed]`.

## 1. Product vision

`[FROM FRAME]` A signed-in person can see how current their Grapevine is and refresh it themselves, without asking an
operator. Concretely, they see when their own Tapestry Assistant last calculated and published their trust scores
(NIP-85 Trusted Assertions), and can have it recalculate and republish them. The owner's words: "try not to
overengineer it."

`[INFERRED]` The Assistant publishes on the person's behalf so other clients can read their scores while they're
offline. The age of those scores is therefore something the person should be able to see and correct, and this page is
where the hub's Scores duty becomes something they can act on, not just a description.

`[UNKNOWN — product input needed]` Whether stale scores are a real, felt problem for Customers (how often, and how
noticed), or mostly an operator's concern.

## 2. Personas

- `[FROM FRAME]` **The Owner** of the instance: scores calculated by the instance's own pipeline and signed by the
  Tapestry Assistant. Can recalculate.
- `[FROM FRAME]` **An active Customer:** scores calculated per Customer and signed by their own Assistant. Can
  recalculate.
- `[FROM FRAME]` **An Admin who isn't a Customer, or a guest:** may have an Assistant, but no calculation runs for them
  here. Sees the status and the reason, with no button.
- `[INFERRED]` **The operator,** indirectly: a press is a heavy background job (20–60 minutes for a Customer, up to 4
  hours for the Owner) that occupies the instance and holds back deploys while it runs.

## 3. Scope (as-built)

`[FROM FRAME]` On the hub's Scores page (`/assistant/trusted-assertions`):
- your Assistant;
- when it last published your Trusted Assertions (date, time, how long ago), or "not yet";
- how many it has published;
- whether a recalculation is queued or running;
- **Recalculate and republish**, for the Owner and active Customers, one run at a time;
- for everyone else, one plain line saying why there is no button.

`[INFERRED]` Also shipped: the shared task-queue fix that lets any customer task be started on demand again (operator
triggers and per-Customer schedules), which this page depended on.

Out of scope as built: calculating for Admins without a Customer record, live progress, a cooldown, scheduling from the
page, and a hub mark for stale scores.

## 4. Domain model

`[INFERRED]`
- **Trusted Assertion** (kind 30382, NIP-85): one per scored pubkey, signed by the person's Assistant. Every run re-signs
  all of them, so the newest one's time *is* when the Grapevine was last published.
- **Tapestry Assistant:** the Owner's is the instance's Tapestry Assistant; a Customer's is their own key. It is the
  author whose assertions count.
- **Pipeline:** the recalculation that belongs to a person. The Owner's is `updateAllScoresForOwner`; a Customer's is
  their own `processCustomer`; others have none.
- **Run:** an instance of a pipeline on the task queue, which is queued, running, or neither. Instance-wide runs (all
  tasks, all Customers) count as the person's run too.

## 5. Design rules (as-built)

`[INFERRED]`
- It follows the hub's action-page frame: back link, the card's title and description, one card, the card's Treasure
  Map link at the foot.
- Whose data and whose run come only from the sign-in. A request can never name someone else.
- The page claims nothing it can't know. "Couldn't be read" is never "not yet", and an unknown run state shows no
  queued or running line.
- It reads once per load and once after a press. To see a run end, reload.
- Words live in one copy module, approved with the story.

## 6. Carry-forward & open questions

Promoted from the build audit §6:
1. **Production:** the page and the task-queue fix are on staging only.
2. **Admins without a Customer record:** should their Grapevine be calculated here at all?
3. **Live progress:** is "reload to see it end" enough for a 20-minute to 4-hour job?
4. **Cooldown:** declined at intake; revisit only if operators see press storms.
5. **A stale-scores mark** on the hub's Scores card.
6. **"Running" precision** while instance-wide runs are under way.

## 7. What product must validate

- [ ] `[UNKNOWN]` Is "last published" the freshness signal people want, or would "last calculated" (the pipeline's
      finish), or the age of the follow data it read, matter more?
- [ ] `[UNKNOWN]` Should the Owner's button also refresh the inputs? The Owner's pipeline recalculates and republishes
      but does not re-sync follows from relays first; the instance-wide run does.
- [ ] `[UNKNOWN]` Admins: calculate, or keep status only?
- [ ] `[INFERRED]` Is one run at a time, with no cooldown, the right guard once Customers use it?
- [ ] `[UNKNOWN]` Should the page or the hub card tell people when their scores have gone stale?
