# Book of Work: Assistant Duties — the duties this instance offers, set by its Owner

**Slug:** assistant-duties-settings
**Status:** Closed
**Opened:** 2026-10-12
**Closed:** 2026-10-12 (on `staging`: story 1 review round 2 PASS `480343c22`; staging deploys 694 and 695 green; not yet on `main`)

## Intent anchor

**Acceptance frame (no PRD)**: the owner's ask, restated at intake (2026-10-12) and settled through seven questions
there. Completion is *judged* against the bullets below.

The ask, verbatim (copied from the session transcript, not retyped):

> We recently added a Duty Menu page at https://staging.brainstorm.world/assistant/duty-menu . Currently, we have hardcoded six duties by default: one Scores duty, three Lists duties, and two Concepts duties.  I would like to enable the Owner, or an Admin, to have the ability to add and subtract the Duties that are offered by that particular instance. To do that, let's create a new "Assistant Duties" tab on the Tapestry settings page, using this URL: [https://staging.brainstorm.world/tapestry/settings/](https://staging.brainstorm.world/tapestry/settings/relays)assistant-duties. The default duties when a new instance gets spun up will be the ones that we see now on the Duty Menu at https://staging.brainstorm.world/assistant/duty-menu: one Scores duty, three Lists duties, and two Concepts duties. 
>
> I'm not sure where the current list of six duties is currently stored, but I presume it is hardcoded in a script. If so, let's move it to a file in a directory in the server, and let that file be what gets edited when the Owner or an Admin makes some changes. Does this make sense?

### Found at intake (2026-10-12)

- **Where the six live.** They are written into the code that builds every Assistant's offer
  (`OFFER_KEYS`, `src/lib/duty-menu/index.js:37`), per ADR `assistant-duty-menu/0001` K1 ("the kinds actually built").
  Scores `30382`; Lists `30392`, `30393`, `30394`; Concepts `39998`, `39999`.
- **A file already exists for this.** Instance settings are two layers: shipped defaults in the code, and the Owner's
  changes in one file on the server's persistent volume (`/var/lib/brainstorm/settings.json`). The Settings page's
  Relays tab edits it today, and it survives redeploys.
- **Who gets Scores today.** The offer includes Scores only for the Owner's Assistant and for active customers'
  Assistants, because those are the only Assistants this instance computes Scores for. An Admin who is not also a
  customer gets no Scores row. Customers are active or inactive (the Owner sets it on Manage Customers); an inactive
  customer signs in as a guest and cannot open the Assistant pages at all.
- **Another page reads the offer.** `assistant-self-map` #1 (on `staging` 2026-10-12, PR #855) takes each duty's relay
  from the Duty Menu offer and calls a duty live only from what has actually landed. This book lands second, so it
  keeps that page working.

### Decisions taken at intake (2026-10-12)

1. **Adding means any Treasure Map key.** The Owner or an Admin may add any key the Treasure Map grammar allows,
   not only kinds this instance publishes. *(Chosen from: only built duties / any Treasure Map key / both, with a
   warning.)* This knowingly relaxes the closed book's "Honest rows" rule (`assistant-duty-menu` book § Acceptance
   frame): the menu may now offer a duty this instance does not publish, and no warning marks it.
2. **Stored in the existing settings file.** The six ship as defaults; changes go to the settings file on the
   persistent volume. *(Chosen from: the existing settings file / its own file.)*
3. **One list for every Assistant.** The Owner's Assistant and every customer's offer the same duties. *(Chosen
   from: every Assistant here / Owner vs customers.)*
4. **Path: Standard, all five phases.** *(Chosen from: Standard / the Light profile trial.)*
5. **Each duty names its relay.** A duty's relay is either this instance's relay (the six's default, chosen as
   today) or one the Owner or Admin types. *(Chosen from: same rule as today / the Owner types a relay.)*
6. **Scores for every Assistant.** No duty is held back by who the Assistant belongs to: Owner, Admins and customers
   alike. *(Chosen from: same as Scores today / every Assistant. The owner asked whether active and inactive
   customers differ; answered above under "Who gets Scores today". The one visible change is an Admin who is not a
   customer.)*
7. **Drag to reorder.** The Owner or Admin sets the order, and the menu lists the duties in that order. *(Chosen
   from: grouped by category / tab order; the owner added dragging.)*

### Decision taken at review round 1 (2026-10-12)

8. **Whole kinds only.** Story 1's review found that Your Assistant's Treasure Map reads offers by kind. A narrower
   key (`30382:rank`), a family key (`3038x`), `*` or a Concept key with a `d` made it say "not offered" where the Duty
   Menu said "offered". In one case it also flagged a true self-Map claim as false. The tab now accepts a whole kind
   (five digits) and nothing narrower or broader. This amends Decision 1: still any kind, including one this instance
   does not publish. *(Chosen from: whole kinds only / keep any key and teach the self-Map narrower and family keys.)*

### Acceptance frame

*Proposed from the intake decisions; confirmed by the owner at story 1's approval (2026-10-12).*

- [x] **An Assistant Duties tab.** `/tapestry/settings/assistant-duties` lists the duties this instance offers, and
      the Owner or an Admin can add any kind (a whole kind, Decision 8), remove any duty, set each duty's relay, drag
      them into order, and reset to the defaults. No one else can change them.
- [x] **Six by default.** A new instance offers today's six, each at this instance's relay, so nothing changes for
      the Owner's Duty Menu until someone edits the list.
- [x] **Kept on the server.** The list is no longer written into the code. Changes live in the instance's settings
      file and survive restarts and redeploys.
- [x] **Every Duty Menu follows it.** Every Assistant's Duty Menu page offers exactly the listed duties, in order,
      at their relays; publishing publishes them; an Assistant whose published menu no longer matches shows
      **Needs attention**.
- [x] **On staging**, at staging.brainstorm.world/tapestry/settings/assistant-duties.

## Epics in this book

- `assistant-duties-settings`: the Assistant Duties settings tab, and the offer that reads it (story 1).

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** high (one gap: no signed-in Owner or Admin has used the tab on staging; audit §5)

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/assistant-duties-settings/audit.md`
- Product feedback: `engineering-team/audits/assistant-duties-settings/prd-seed.md`
